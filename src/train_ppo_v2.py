from __future__ import annotations

import os
import sys
from datetime import datetime

import numpy as np
import pandas as pd

from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import DummyVecEnv, VecNormalize

# Ensure repo root is on path when running as a script.
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.rl.datasets import time_split_by_ratio
from src.rl.env_v2 import ExecutionCostConfig, RewardConfig, SensexTradingEnvV2
from src.rl.eval_v2 import compute_equity_metrics, save_json


def make_env(df: pd.DataFrame, feature_cols: list[str], seed: int = 0):
    def _thunk():
        exposure_abs_weight = float(os.getenv("PPO_V2_EXPOSURE_ABS_WEIGHT", "0.0"))
        benchmark = os.getenv("PPO_V2_BENCHMARK", "vol_target_long").strip()
        target_vol_annual = float(os.getenv("PPO_V2_TARGET_VOL_ANNUAL", "0.12"))
        high_vol_cap = float(os.getenv("PPO_V2_HIGH_VOL_CAP", "1.0"))
        env = SensexTradingEnvV2(
            df=df,
            feature_cols=feature_cols,
            initial_capital=100000.0,
            execution=ExecutionCostConfig(fee_bps=1.0, slippage_bps=2.0, borrow_bps_daily=1.0),
            reward_cfg=RewardConfig(
                dsr_alpha=0.02,
                dsr_weight=1.0,
                sortino_weight=0.05,
                drawdown_weight=0.5,
                turnover_weight=0.05,
                exposure_abs_weight=exposure_abs_weight,
                benchmark=benchmark,
                target_vol_annual=target_vol_annual,
            ),
            max_abs_exposure=1.0,
            high_vol_exposure_cap=high_vol_cap,
        )
        env.reset(seed=seed)
        return env

    return _thunk


def rollout_equity(model: PPO, env: SensexTradingEnvV2) -> tuple[list[float], list[float], list[float]]:
    obs, _ = env.reset()
    equity = [env.equity]
    turnover = []
    exposure = [env.exposure]

    for _ in range(len(env.df) - 1):
        action, _ = model.predict(obs, deterministic=True)
        obs, reward, done, truncated, info = env.step(action)
        equity.append(float(info["equity"]))
        turnover.append(float(info["turnover_notional"]) / max(1.0, float(info["equity"])))
        exposure.append(float(info["exposure"]))
        if done or truncated:
            break
    return equity, turnover, exposure


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_path_v2 = os.path.join(base_dir, "..", "data", "processed", "master_dataset_rl_v2.csv")
    data_path_v1 = os.path.join(base_dir, "..", "data", "processed", "master_dataset.csv")
    runs_dir = os.path.join(base_dir, "..", "runs")
    models_dir = os.path.join(base_dir, "..", "models")
    os.makedirs(runs_dir, exist_ok=True)
    os.makedirs(models_dir, exist_ok=True)

    data_path = data_path_v2 if os.path.exists(data_path_v2) else data_path_v1
    df = pd.read_csv(data_path)

    # Use all available *market* features only (no agent state cols)
    # Prefer z-scored features to reduce scale issues.
    # Feature set: base normalized market features + v2 multi-horizon context features (if present).
    feature_cols = [
        # base
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
        # v2 additions (z-scored by build_features_v2.py)
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

    split = time_split_by_ratio(df, train_ratio=0.7, val_ratio=0.15)

    exp_id = datetime.now().strftime("ppo_v2_%Y%m%d_%H%M%S")
    exp_dir = os.path.join(runs_dir, exp_id)
    os.makedirs(exp_dir, exist_ok=True)

    train_env = DummyVecEnv([make_env(split.train, feature_cols, seed=1)])
    train_env = VecNormalize(train_env, norm_obs=True, norm_reward=True, clip_obs=10.0)

    model = PPO(
        "MlpPolicy",
        train_env,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=128,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        # Exploration knob: increase to reduce exposure collapse; tune down once stable.
        ent_coef=float(os.getenv("PPO_V2_ENT_COEF", "0.02")),
        clip_range=0.2,
        verbose=1,
        seed=1,
    )

    # Allow quick iterations without editing code.
    total_steps = int(os.getenv("PPO_V2_TIMESTEPS", "200000"))
    model.learn(total_timesteps=total_steps)

    # Save model + vecnormalize stats
    model_path = os.path.join(models_dir, "ppo_sensex_bot_v2")
    model.save(model_path)
    train_env.save(os.path.join(exp_dir, "vecnormalize.pkl"))

    # Evaluate (deterministic) on val and test with raw envs (no reward norm)
    # Note: we re-use VecNormalize only for obs normalization at inference.
    val_env = SensexTradingEnvV2(split.val, feature_cols=feature_cols)
    test_env = SensexTradingEnvV2(split.test, feature_cols=feature_cols)

    # wrap with vecnorm for obs at inference
    infer_env = DummyVecEnv([lambda: val_env])
    infer_env = VecNormalize.load(os.path.join(exp_dir, "vecnormalize.pkl"), infer_env)
    infer_env.training = False
    infer_env.norm_reward = False

    # SB3 expects vec env for predict loop; easiest is to roll out with the underlying env
    # using the same normalization object for observations.
    def rollout_with_norm(raw_env: SensexTradingEnvV2):
        obs, _ = raw_env.reset()
        equity = [raw_env.equity]
        turnover = []
        exposure = [raw_env.exposure]
        for _ in range(len(raw_env.df) - 1):
            obs_norm = infer_env.normalize_obs(obs)
            action, _ = model.predict(obs_norm, deterministic=True)
            obs, reward, done, truncated, info = raw_env.step(action)
            equity.append(float(info["equity"]))
            turnover.append(float(info["turnover_notional"]) / max(1.0, float(info["equity"])))
            exposure.append(float(info["exposure"]))
            if done or truncated:
                break
        return equity, turnover, exposure

    val_equity, val_turnover, val_exposure = rollout_with_norm(val_env)
    test_equity, test_turnover, test_exposure = rollout_with_norm(test_env)

    report = {
        "exp_id": exp_id,
        "total_steps": total_steps,
        "feature_cols": feature_cols,
        "val": compute_equity_metrics(np.array(val_equity), np.array(val_turnover), np.array(val_exposure)),
        "test": compute_equity_metrics(np.array(test_equity), np.array(test_turnover), np.array(test_exposure)),
    }
    save_json(os.path.join(exp_dir, "report.json"), report)
    print(f"Saved report to {os.path.join(exp_dir, 'report.json')}")
    print("VAL:", report["val"])
    print("TEST:", report["test"])


if __name__ == "__main__":
    main()

