from __future__ import annotations

from dataclasses import dataclass

import gymnasium as gym
import numpy as np
import pandas as pd
from gymnasium import spaces


@dataclass
class ExecOverlayConfig:
    fee_bps: float = 1.0
    slippage_bps: float = 2.0
    borrow_bps_daily: float = 1.0
    max_abs_exposure: float = 1.0
    # Max step change in exposure from one day to next
    max_delta_exposure: float = 0.15
    # In high volatility regimes, cap absolute exposure
    high_vol_cap: float = 0.6
    high_vol_flag_col: str = "Regime_Flag"
    # Reward weights
    tracking_weight: float = 2.0
    turnover_weight: float = 0.2
    drawdown_weight: float = 0.5
    return_weight: float = 0.2


class ExecutionOverlayEnv(gym.Env):
    """
    Execution-only RL:
      - predictor provides target exposure externally (column target_exposure)
      - agent action is an incremental adjustment around current exposure
      - objective: track target with low turnover/cost and controlled drawdown
    """

    metadata = {"render_modes": ["human"]}

    def __init__(
        self,
        df: pd.DataFrame,
        feature_cols: list[str],
        cfg: ExecOverlayConfig | None = None,
        price_col: str = "Close",
        target_col: str = "target_exposure",
        initial_capital: float = 100000.0,
    ):
        super().__init__()
        self.df = df.reset_index(drop=True).copy()
        self.feature_cols = list(feature_cols)
        self.cfg = cfg or ExecOverlayConfig()
        self.price_col = price_col
        self.target_col = target_col
        self.initial_capital = float(initial_capital)

        if self.price_col not in self.df.columns:
            raise ValueError(f"Missing {self.price_col}")
        if self.target_col not in self.df.columns:
            raise ValueError(f"Missing {self.target_col}")
        for c in self.feature_cols:
            if c not in self.df.columns:
                raise ValueError(f"Missing feature {c}")

        # Action = delta exposure proposal in [-1, 1], scaled by max_delta_exposure
        self.action_space = spaces.Box(low=np.array([-1.0], dtype=np.float32), high=np.array([1.0], dtype=np.float32), dtype=np.float32)
        # Obs = features + [target_exposure, current_exposure]
        self.observation_space = spaces.Box(
            low=-np.inf, high=np.inf, shape=(len(self.feature_cols) + 2,), dtype=np.float32
        )

        self.current_step = 0
        self.exposure = 0.0
        self.equity = self.initial_capital
        self.peak_equity = self.initial_capital

    def _obs(self):
        feats = self.df.loc[self.current_step, self.feature_cols].astype(float).values.astype(np.float32)
        target = float(self.df.loc[self.current_step, self.target_col])
        return np.concatenate([feats, np.array([target, self.exposure], dtype=np.float32)])

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.current_step = 0
        self.exposure = 0.0
        self.equity = self.initial_capital
        self.peak_equity = self.initial_capital
        return self._obs(), {}

    def step(self, action):
        a = float(np.clip(action[0], -1.0, 1.0))
        target = float(self.df.loc[self.current_step, self.target_col])

        # Vol-aware cap
        cap = self.cfg.max_abs_exposure
        if self.cfg.high_vol_flag_col in self.df.columns:
            try:
                if float(self.df.loc[self.current_step, self.cfg.high_vol_flag_col]) >= 1.0:
                    cap = min(cap, self.cfg.high_vol_cap)
            except Exception:
                pass

        # Constrained adjustment around current exposure
        delta = a * self.cfg.max_delta_exposure
        proposed = float(np.clip(self.exposure + delta, -cap, cap))

        # Smooth toward target by clipping not only absolute but also overshoot
        # This prevents aggressive override behavior.
        if (target - self.exposure) > 0:
            proposed = min(proposed, target + self.cfg.max_delta_exposure)
        else:
            proposed = max(proposed, target - self.cfg.max_delta_exposure)
        new_exposure = float(np.clip(proposed, -cap, cap))

        price_t = float(self.df.loc[self.current_step, self.price_col])
        self.current_step += 1
        done = self.current_step >= (len(self.df) - 1)
        truncated = False
        price_n = price_t if done else float(self.df.loc[self.current_step, self.price_col])
        market_ret = (price_n / price_t - 1.0) if price_t != 0 else 0.0

        equity_start = float(self.equity)
        turnover_notional = abs(new_exposure - self.exposure) * equity_start
        costs = turnover_notional * ((self.cfg.fee_bps + self.cfg.slippage_bps) / 10000.0)
        borrow = max(0.0, -self.exposure) * equity_start * (self.cfg.borrow_bps_daily / 10000.0)

        equity_next = max(0.0, equity_start * (1.0 + new_exposure * market_ret) - costs - borrow)
        step_ret = (equity_next / equity_start - 1.0) if equity_start > 0 else 0.0
        self.equity = float(equity_next)
        self.peak_equity = max(self.peak_equity, self.equity)
        dd = float((self.equity - self.peak_equity) / self.peak_equity) if self.peak_equity > 0 else 0.0

        # Execution-focused reward (NOT directional alpha generation)
        tracking_err = abs(new_exposure - target)
        turnover = abs(new_exposure - self.exposure)
        reward = (
            -self.cfg.tracking_weight * tracking_err
            -self.cfg.turnover_weight * turnover
            -self.cfg.drawdown_weight * abs(min(0.0, dd))
            +self.cfg.return_weight * step_ret
        )

        self.exposure = new_exposure
        obs = self._obs() if not done else np.zeros(self.observation_space.shape, dtype=np.float32)
        info = {
            "equity": self.equity,
            "drawdown": dd,
            "exposure": self.exposure,
            "target_exposure": target,
            "tracking_error": tracking_err,
            "turnover": turnover,
            "market_ret": market_ret,
            "step_ret": step_ret,
        }
        return obs, float(reward), done, truncated, info

