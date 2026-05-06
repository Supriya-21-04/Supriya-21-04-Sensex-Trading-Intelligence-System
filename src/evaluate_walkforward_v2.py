from __future__ import annotations

import os
import sys
from dataclasses import asdict
from datetime import datetime

import numpy as np
import pandas as pd

from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import DummyVecEnv, VecNormalize

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.rl.env_v2 import SensexTradingEnvV2
from src.rl.eval_v2 import block_bootstrap_ci, compute_equity_metrics, save_json
from src.rl.predictors import expanding_ensemble_proba, expanding_xgb_proba, prob_to_exposure


def regime_slice_metrics(df: pd.DataFrame, equity: np.ndarray) -> dict:
    """
    Compute metrics separately for Regime_Flag=0/1 (if present).
    Uses the same equity path but slices days by regime; this is approximate but informative.
    """
    if "Regime_Flag" not in df.columns:
        return {}
    reg = df["Regime_Flag"].astype(float).values
    # align: equity has len(df) points
    if len(equity) != len(df):
        m = min(len(equity), len(df))
        reg = reg[:m]
        equity = equity[:m]
    out = {}
    for flag in (0.0, 1.0):
        idx = np.where(reg == flag)[0]
        if len(idx) < 30:
            continue
        # take equity at those indices; rebase to first point
        eq = equity[idx]
        if len(eq) < 2:
            continue
        out[str(int(flag))] = asdict(compute_equity_metrics(eq))
    return out


def vol_quantile_metrics(df: pd.DataFrame, equity: np.ndarray, vol_col: str = "vol_20d") -> dict:
    """
    Regime breakdown by volatility quantiles (robust even if Regime_Flag is uninformative).
    """
    if vol_col not in df.columns:
        return {}
    v = pd.to_numeric(df[vol_col], errors="coerce").astype(float).values
    # align: equity has len(df) points
    if len(equity) != len(df):
        m = min(len(equity), len(df))
        v = v[:m]
        equity = equity[:m]
    if np.all(~np.isfinite(v)):
        return {}

    qs = np.nanquantile(v, [0.25, 0.5, 0.75])
    buckets = [
        ("q1_low", v <= qs[0]),
        ("q2_midlow", (v > qs[0]) & (v <= qs[1])),
        ("q3_midhigh", (v > qs[1]) & (v <= qs[2])),
        ("q4_high", v > qs[2]),
    ]
    out = {}
    for name, mask in buckets:
        idx = np.where(mask & np.isfinite(v))[0]
        if len(idx) < 30:
            continue
        eq = equity[idx]
        if len(eq) < 2:
            continue
        out[name] = asdict(compute_equity_metrics(eq))
    return out


def momentum_baseline_equity(df: pd.DataFrame, price_col="Close", lookback=20, fee_bps=1.0, slip_bps=2.0) -> np.ndarray:
    """
    Simple time-series momentum: go long if lookback return > 0, short if < 0.
    Includes simple turnover costs on exposure flips.
    """
    close = df[price_col].astype(float).values
    n = len(close)
    equity = np.zeros(n, dtype=float)
    equity[0] = 100000.0
    exposure = 0.0

    for t in range(n - 1):
        if t < lookback:
            target = 0.0
        else:
            lb = close[t] / close[t - lookback] - 1.0 if close[t - lookback] != 0 else 0.0
            target = 1.0 if lb > 0 else (-1.0 if lb < 0 else 0.0)

        delta = target - exposure
        turnover = abs(delta) * equity[t]
        costs = turnover * ((fee_bps + slip_bps) / 10000.0)

        r = close[t + 1] / close[t] - 1.0 if close[t] != 0 else 0.0
        equity[t + 1] = max(0.0, equity[t] * (1 + target * r) - costs)
        exposure = target

    return equity


def vol_target_buyhold_equity(df: pd.DataFrame, price_col="Close", vol_window=20, target_vol_annual=0.12) -> np.ndarray:
    """
    Volatility targeting long-only: exposure scales inversely with recent vol.
    """
    close = df[price_col].astype(float).values
    n = len(close)
    equity = np.zeros(n, dtype=float)
    equity[0] = 100000.0

    daily_r = pd.Series(close).pct_change().fillna(0.0).values
    for t in range(n - 1):
        if t < vol_window:
            exp = 0.0
        else:
            vol = float(np.std(daily_r[t - vol_window + 1 : t + 1]))
            target_daily = target_vol_annual / np.sqrt(252.0)
            exp = float(np.clip(target_daily / (vol + 1e-12), 0.0, 1.0))

        equity[t + 1] = max(0.0, equity[t] * (1 + exp * daily_r[t + 1]))
    return equity


def xgb_prob_strategy_equity(
    df: pd.DataFrame,
    p_up: np.ndarray,
    price_col: str = "Close",
    fee_bps: float = 1.0,
    slip_bps: float = 2.0,
    neutral_band: float = 0.05,
) -> np.ndarray:
    close = df[price_col].astype(float).values
    n = len(close)
    equity = np.zeros(n, dtype=float)
    equity[0] = 100000.0
    exposure = 0.0

    exp_series = prob_to_exposure(p_up, neutral_band=neutral_band)
    for t in range(n - 1):
        target = float(exp_series[t])
        delta = target - exposure
        turnover = abs(delta) * equity[t]
        costs = turnover * ((fee_bps + slip_bps) / 10000.0)
        r = close[t + 1] / close[t] - 1.0 if close[t] != 0 else 0.0
        equity[t + 1] = max(0.0, equity[t] * (1 + target * r) - costs)
        exposure = target
    return equity


def ensemble_conf_strategy_equity(
    df: pd.DataFrame,
    p_up: np.ndarray,
    conf: np.ndarray,
    price_col: str = "Close",
    fee_bps: float = 1.0,
    slip_bps: float = 2.0,
    neutral_band: float = 0.05,
) -> np.ndarray:
    """
    Confidence-aware sizing: exposure = prob_to_exposure(p) * conf
    """
    close = df[price_col].astype(float).values
    n = len(close)
    equity = np.zeros(n, dtype=float)
    equity[0] = 100000.0
    exposure = 0.0

    base = prob_to_exposure(p_up, neutral_band=neutral_band)
    conf = np.clip(np.asarray(conf, dtype=float), 0.0, 1.0)
    exp_series = np.clip(base * conf, -1.0, 1.0)

    for t in range(n - 1):
        target = float(exp_series[t])
        delta = target - exposure
        turnover = abs(delta) * equity[t]
        costs = turnover * ((fee_bps + slip_bps) / 10000.0)
        r = close[t + 1] / close[t] - 1.0 if close[t] != 0 else 0.0
        equity[t + 1] = max(0.0, equity[t] * (1 + target * r) - costs)
        exposure = target
    return equity


def rollout_model_equity(
    model: PPO,
    vecnorm: VecNormalize,
    df: pd.DataFrame,
    feature_cols: list[str],
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    high_vol_cap = float(os.getenv("WF_HIGH_VOL_CAP", "1.0"))
    env = SensexTradingEnvV2(df=df, feature_cols=feature_cols, high_vol_exposure_cap=high_vol_cap)
    obs, _ = env.reset()
    equity = [env.equity]
    exposure = [env.exposure]
    turnover = []

    for _ in range(len(df) - 1):
        obs_n = vecnorm.normalize_obs(obs)
        action, _ = model.predict(obs_n, deterministic=True)
        obs, r, done, trunc, info = env.step(action)
        equity.append(float(info["equity"]))
        exposure.append(float(info["exposure"]))
        turnover.append(float(info["turnover_notional"]) / max(1.0, float(info["equity"])))
        if done or trunc:
            break
    return np.asarray(equity), np.asarray(turnover), np.asarray(exposure)


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_path_v2 = os.path.join(base_dir, "..", "data", "processed", "master_dataset_rl_v2.csv")
    data_path_v1 = os.path.join(base_dir, "..", "data", "processed", "master_dataset.csv")
    runs_dir = os.path.join(base_dir, "..", "runs")
    os.makedirs(runs_dir, exist_ok=True)

    data_path = data_path_v2 if os.path.exists(data_path_v2) else data_path_v1
    df = pd.read_csv(data_path)
    feature_cols = [
        "Close_z",
        "RSI_14_z",
        "STO_K_z",
        "MACD_z",
        "ATR_14_z",
        "Volatility_Ratio_z",
        "Regime_Flag",
        "OBV_z",
        "SMA_200_z",
        "Sentiment",
        "Returns_z",
        "Vol_Change_z",
        # v2 multi-horizon context (if present)
        "ret_2d_z",
        "ret_5d_z",
        "ret_10d_z",
        "ret_20d_z",
        "ret_60d_z",
        "vol_10d_z",
        "vol_20d_z",
        "vol_60d_z",
        "price_to_sma200_z",
        "sma200_slope_20d_z",
        "vol_z_20d_z",
        "vol_trend_20d_z",
        "vr_change_5d_z",
        "vr_vol_20d_z",
    ]
    feature_cols = [c for c in feature_cols if c in df.columns]

    # Walk-forward folds: train on [0:i], test on [i:j]
    n = len(df)
    n_folds = int(os.getenv("WF_FOLDS", "5"))
    min_train = int(os.getenv("WF_MIN_TRAIN", str(int(n * 0.5))))
    timesteps = int(os.getenv("WF_TIMESTEPS", "50000"))

    exp_id = datetime.now().strftime("walkforward_v2_%Y%m%d_%H%M%S")
    out_dir = os.path.join(runs_dir, exp_id)
    os.makedirs(out_dir, exist_ok=True)

    fold_edges = np.linspace(min_train, n - 2, n_folds + 1, dtype=int)

    fold_reports = []
    all_test_daily_returns = []

    for k in range(n_folds):
        train_end = int(fold_edges[k])
        test_end = int(fold_edges[k + 1])
        train_df = df.iloc[:train_end].copy()
        test_df = df.iloc[train_end:test_end].copy()
        if len(test_df) < 50:
            continue

        # Predictive baseline + leak-safe probability feature (expanding refit)
        # - `p_up_test` is leak-safe within the fold test window
        # - If enabled, we also build a leak-safe `xgb_p_up` for train so RL can train with the same obs dimension.
        neutral_band = float(os.getenv("WF_XGB_NEUTRAL_BAND", "0.05"))
        p_up_test, conf_test = expanding_ensemble_proba(
            test_df,
            feature_cols=feature_cols,
            price_col="Close",
            min_train=int(os.getenv("WF_XGB_MIN_TRAIN", "252")),
            refit_every=int(os.getenv("WF_XGB_REFIT_EVERY", "5")),
            seed=7 + k,
        )
        test_df["ens_p_up"] = p_up_test
        test_df["ens_conf"] = conf_test

        ens_eq = ensemble_conf_strategy_equity(test_df, p_up_test, conf_test, neutral_band=neutral_band)
        ens_metrics = compute_equity_metrics(ens_eq)

        # Train vecnorm + PPO on expanding window
        use_pred = os.getenv("WF_USE_XGB_SIGNAL", "1").strip() == "1"
        if use_pred:
            p_up_train, conf_train = expanding_ensemble_proba(
                train_df,
                feature_cols=feature_cols,
                price_col="Close",
                min_train=int(os.getenv("WF_XGB_MIN_TRAIN", "252")),
                refit_every=int(os.getenv("WF_XGB_REFIT_EVERY", "5")),
                seed=17 + k,
            )
            train_df["ens_p_up"] = p_up_train
            train_df["ens_conf"] = conf_train

        # RL sees predictive context + regimes (if present)
        extra = []
        if use_pred and "ens_p_up" in train_df.columns:
            extra += ["ens_p_up", "ens_conf"]
        for c in ("vol_q", "trend_regime", "trend_strength"):
            if c in train_df.columns:
                extra.append(c)

        rl_feature_cols = feature_cols + extra

        train_env = DummyVecEnv([lambda: SensexTradingEnvV2(train_df, feature_cols=rl_feature_cols)])
        vec = VecNormalize(train_env, norm_obs=True, norm_reward=True, clip_obs=10.0)

        model = PPO(
            "MlpPolicy",
            vec,
            learning_rate=3e-4,
            n_steps=2048,
            batch_size=128,
            n_epochs=10,
            gamma=0.99,
            gae_lambda=0.95,
            ent_coef=float(os.getenv("WF_ENT_COEF", "0.02")),
            clip_range=0.2,
            verbose=0,
            seed=7 + k,
        )
        model.learn(total_timesteps=timesteps)

        # Eval on fold test
        vec.training = False
        vec.norm_reward = False

        # Hybrid RL: evaluate with same feature set (including xgb_p_up when enabled)
        equity, turnover, exposure = rollout_model_equity(model, vec, test_df, rl_feature_cols)
        m = compute_equity_metrics(equity, turnover, exposure)
        regime_metrics = regime_slice_metrics(test_df, equity)
        volq_metrics = vol_quantile_metrics(test_df, equity, vol_col="vol_20d")

        # stronger baselines
        mom = compute_equity_metrics(momentum_baseline_equity(test_df), None, None)
        vt = compute_equity_metrics(vol_target_buyhold_equity(test_df), None, None)

        fold_reports.append(
            {
                "fold": k,
                "train_rows": int(len(train_df)),
                "test_rows": int(len(test_df)),
                "rl": asdict(m),
                "rl_by_regime": regime_metrics,
                "rl_by_vol_quantile": volq_metrics,
                "ensemble_conf_strategy": asdict(ens_metrics),
                "momentum": asdict(mom),
                "vol_target_bh": asdict(vt),
            }
        )

        daily_r = pd.Series(equity).pct_change().dropna().values
        all_test_daily_returns.append(daily_r)

        print(
            f"Fold {k}: test_ret={m.total_return_pct:.2f}% sharpe={m.sharpe:.2f} "
            f"mdd={m.max_drawdown_pct:.2f}% | ens_ret={ens_metrics.total_return_pct:.2f}% "
            f"mom_ret={mom.total_return_pct:.2f}% vt_ret={vt.total_return_pct:.2f}%"
        )

    if not fold_reports:
        raise RuntimeError("No folds evaluated. Try lowering WF_MIN_TRAIN or WF_FOLDS.")

    all_r = np.concatenate(all_test_daily_returns)
    sharpe_ci = block_bootstrap_ci(
        all_r,
        statistic_fn=lambda x: float((np.mean(x) / (np.std(x) + 1e-12)) * np.sqrt(252.0)),
        block=int(os.getenv("WF_BOOT_BLOCK", "10")),
        n_boot=int(os.getenv("WF_BOOT_N", "500")),
        alpha=0.05,
        seed=7,
    )

    out = {
        "exp_id": exp_id,
        "n_folds_requested": n_folds,
        "timesteps_per_fold": timesteps,
        "folds": fold_reports,
        "bootstrap": {"sharpe_ci": sharpe_ci, "n_daily_returns": int(len(all_r))},
    }

    save_json(os.path.join(out_dir, "walkforward_report.json"), out)
    print(f"Saved walk-forward report to {os.path.join(out_dir, 'walkforward_report.json')}")
    print("Bootstrap Sharpe CI:", sharpe_ci)


if __name__ == "__main__":
    main()

