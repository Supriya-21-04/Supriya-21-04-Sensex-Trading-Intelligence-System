from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
import gymnasium as gym
from gymnasium import spaces

from .rewards import (
    DifferentialSharpeState,
    differential_sharpe_reward,
    drawdown_penalty,
    sortino_like_reward,
    turnover_penalty,
)


@dataclass
class ExecutionCostConfig:
    fee_bps: float = 1.0  # per turnover, in basis points of traded notional
    slippage_bps: float = 2.0  # linear slippage, in bps of traded notional
    borrow_bps_daily: float = 1.0  # short borrow cost, daily bps on short notional


@dataclass
class RewardConfig:
    # Differential Sharpe
    dsr_alpha: float = 0.01
    dsr_weight: float = 1.0
    # Local utility shaping (helps training stability)
    sortino_weight: float = 0.1
    # Risk controls
    drawdown_weight: float = 0.5
    turnover_weight: float = 0.1
    # Mild encouragement to avoid trivial near-zero exposure collapse (not a hard constraint).
    exposure_abs_weight: float = 0.0  # set small (e.g. 0.01) if the agent collapses to ~0 exposure
    # Benchmark for "excess" objective. Using a strong benchmark reduces overfit and stabilizes regimes.
    benchmark: str = "market"  # "market" | "vol_target_long"
    target_vol_annual: float = 0.12
    benchmark_vol_col: str = "vol_20d"  # should be raw (not z-scored)


class SensexTradingEnvV2(gym.Env):
    """
    Realistic long/short/flat environment with POSITION SIZING.

    Action: continuous target exposure in [-1, +1] (fraction of equity).
      -1 = fully short, 0 = flat, +1 = fully long

    Execution:
      - trade at current Close with proportional fee + slippage on turnover
      - equity = cash + position_value
      - position_value = exposure * equity (rebalanced)

    Reward:
      Differential Sharpe on step returns + drawdown and turnover penalties.
    """

    metadata = {"render_modes": ["human"]}

    def __init__(
        self,
        df: pd.DataFrame,
        feature_cols: list[str],
        price_col: str = "Close",
        date_col: str = "Date",
        initial_capital: float = 100000.0,
        execution: ExecutionCostConfig | None = None,
        reward_cfg: RewardConfig | None = None,
        max_abs_exposure: float = 1.0,
        high_vol_exposure_cap: float | None = None,
        high_vol_flag_col: str = "Regime_Flag",
    ):
        super().__init__()

        if df is None or df.empty:
            raise ValueError("df must be a non-empty DataFrame")
        if price_col not in df.columns:
            raise ValueError(f"df missing required price column: {price_col}")
        for c in feature_cols:
            if c not in df.columns:
                raise ValueError(f"df missing feature column: {c}")

        self.df = df.reset_index(drop=True).copy()
        self.feature_cols = list(feature_cols)
        self.price_col = price_col
        self.date_col = date_col

        self.initial_capital = float(initial_capital)
        self.execution = execution or ExecutionCostConfig()
        self.reward_cfg = reward_cfg or RewardConfig()
        self.max_abs_exposure = float(max_abs_exposure)
        self.high_vol_exposure_cap = (
            float(high_vol_exposure_cap)
            if high_vol_exposure_cap is not None
            else self.max_abs_exposure
        )
        self.high_vol_flag_col = high_vol_flag_col

        # Action is target exposure in [-max_abs_exposure, +max_abs_exposure]
        self.action_space = spaces.Box(
            low=np.array([-self.max_abs_exposure], dtype=np.float32),
            high=np.array([self.max_abs_exposure], dtype=np.float32),
            dtype=np.float32,
        )

        # Observation: feature vector + [current_exposure]
        obs_dim = len(self.feature_cols) + 1
        self.observation_space = spaces.Box(
            low=-np.inf, high=np.inf, shape=(obs_dim,), dtype=np.float32
        )

        # Internal state
        self.current_step = 0
        self.cash = self.initial_capital
        self.exposure = 0.0  # fraction of equity
        self.equity = self.initial_capital
        self.peak_equity = self.initial_capital
        self.dsr_state = DifferentialSharpeState()
        self.last_sharpe = 0.0

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.current_step = 0
        self.cash = self.initial_capital
        self.exposure = 0.0
        self.equity = self.initial_capital
        self.peak_equity = self.initial_capital
        self.dsr_state = DifferentialSharpeState()
        self.last_sharpe = 0.0
        return self._get_obs(), {}

    def _get_obs(self) -> np.ndarray:
        feats = (
            self.df.loc[self.current_step, self.feature_cols]
            .astype(float)
            .values.astype(np.float32)
        )
        obs = np.concatenate([feats, np.array([self.exposure], dtype=np.float32)])
        return np.nan_to_num(obs, nan=0.0, posinf=0.0, neginf=0.0)

    def _price(self, step: int) -> float:
        return float(self.df.loc[step, self.price_col])

    def step(self, action):
        # Optional: cap exposure in high-volatility regimes (risk control).
        cap = self.max_abs_exposure
        if self.high_vol_flag_col in self.df.columns:
            try:
                if float(self.df.loc[self.current_step, self.high_vol_flag_col]) >= 1.0:
                    cap = min(cap, self.high_vol_exposure_cap)
            except Exception:
                pass
        target_exposure = float(np.clip(action[0], -cap, cap))
        price_t = self._price(self.current_step)

        # Mark-to-market equity at start of step (before rebalancing)
        # Position value is exposure * equity (self-financing approximation)
        # Under this approximation, we maintain exposure directly and update equity via returns.
        equity_start = float(self.equity)

        # Turnover cost based on exposure change
        delta_exp = target_exposure - float(self.exposure)
        turnover_notional = abs(delta_exp) * equity_start

        fee = turnover_notional * (self.execution.fee_bps / 10000.0)
        slip = turnover_notional * (self.execution.slippage_bps / 10000.0)

        # Borrow cost for short exposure (applied on existing short notional)
        short_notional = max(0.0, -float(self.exposure)) * equity_start
        borrow = short_notional * (self.execution.borrow_bps_daily / 10000.0)

        # Advance time (realized return on exposure during next step)
        self.current_step += 1
        done = self.current_step >= (len(self.df) - 1)
        truncated = False

        price_next = price_t if done else self._price(self.current_step)
        market_ret = (price_next / price_t - 1.0) if price_t != 0 else 0.0

        # Equity evolves with exposure to market return minus costs
        # equity_next = equity_start * (1 + exposure * market_ret) - costs
        equity_next = equity_start * (1.0 + target_exposure * market_ret) - fee - slip - borrow
        equity_next = float(max(0.0, equity_next))

        self.exposure = target_exposure
        self.equity = equity_next
        self.peak_equity = max(self.peak_equity, self.equity)

        # Step return for reward computation
        step_ret = (equity_next / equity_start - 1.0) if equity_start > 0 else 0.0

        # Benchmark return (for excess reward)
        bench_ret = 0.0
        if self.reward_cfg.benchmark == "market":
            bench_ret = market_ret  # 1x buy&hold market return
        elif self.reward_cfg.benchmark == "vol_target_long":
            vol = None
            if self.reward_cfg.benchmark_vol_col in self.df.columns:
                try:
                    vol = float(self.df.loc[self.current_step, self.reward_cfg.benchmark_vol_col])
                except Exception:
                    vol = None
            if vol is None or not np.isfinite(vol) or vol <= 0:
                bench_exp = 0.0
            else:
                target_daily = float(self.reward_cfg.target_vol_annual) / np.sqrt(252.0)
                bench_exp = float(np.clip(target_daily / (vol + 1e-12), 0.0, 1.0))
            bench_ret = bench_exp * market_ret

        # Risk-adjusted reward on EXCESS return (alpha), not raw return
        excess_ret = float(step_ret - bench_ret)
        dsr_r, self.dsr_state, sharpe_est = differential_sharpe_reward(
            self.dsr_state, excess_ret, alpha=self.reward_cfg.dsr_alpha
        )
        dd_pen = drawdown_penalty(self.equity, self.peak_equity, scale=1.0)
        to_pen = turnover_penalty(delta_exp, scale=1.0)
        sortino = sortino_like_reward(step_ret, target=0.0, downside_scale=10.0)

        reward = (
            self.reward_cfg.dsr_weight * dsr_r
            + self.reward_cfg.sortino_weight * sortino
            - self.reward_cfg.drawdown_weight * dd_pen
            - self.reward_cfg.turnover_weight * to_pen
            + self.reward_cfg.exposure_abs_weight * abs(target_exposure)
        )

        obs = self._get_obs() if not done else np.zeros(self.observation_space.shape, dtype=np.float32)
        info = {
            "date": self.df.loc[self.current_step, self.date_col] if self.date_col in self.df.columns else None,
            "price_t": price_t,
            "price_next": price_next,
            "market_ret": float(market_ret),
            "step_ret": float(step_ret),
            "bench_ret": float(bench_ret),
            "excess_ret": float(excess_ret),
            "equity": float(self.equity),
            "peak_equity": float(self.peak_equity),
            "drawdown": float((self.equity - self.peak_equity) / self.peak_equity) if self.peak_equity > 0 else 0.0,
            "exposure": float(self.exposure),
            "delta_exposure": float(delta_exp),
            "turnover_notional": float(turnover_notional),
            "fee": float(fee),
            "slippage": float(slip),
            "borrow": float(borrow),
            "sharpe_est": float(sharpe_est),
        }
        return obs, float(reward), done, truncated, info

