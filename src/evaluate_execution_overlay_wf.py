from __future__ import annotations

import os
import sys
from dataclasses import asdict
from datetime import datetime

import numpy as np
import pandas as pd
from sb3_contrib import RecurrentPPO
from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import DummyVecEnv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.rl.env_execution_overlay import ExecOverlayConfig, ExecutionOverlayEnv
from src.rl.env_v2 import SensexTradingEnvV2
from src.rl.eval_v2 import block_bootstrap_ci, compute_equity_metrics, save_json
from src.rl.predictors import expanding_ensemble_proba, prob_to_exposure


def deterministic_equity(df: pd.DataFrame, target_col: str, price_col: str = "Close", fee_bps=1.0, slip_bps=2.0):
    close = df[price_col].astype(float).values
    target = df[target_col].astype(float).values
    n = len(close)
    eq = np.zeros(n, dtype=float)
    exp = np.zeros(n, dtype=float)
    eq[0] = 100000.0
    curr = 0.0
    for t in range(n - 1):
        tgt = float(np.clip(target[t], -1.0, 1.0))
        turnover = abs(tgt - curr) * eq[t]
        costs = turnover * ((fee_bps + slip_bps) / 10000.0)
        r = close[t + 1] / close[t] - 1.0 if close[t] != 0 else 0.0
        eq[t + 1] = max(0.0, eq[t] * (1 + tgt * r) - costs)
        curr = tgt
        exp[t + 1] = curr
    return eq, exp


def rollout_exec_overlay(model: RecurrentPPO, env: ExecutionOverlayEnv):
    obs, _ = env.reset()
    lstm_states = None
    episode_starts = np.array([True], dtype=bool)
    eq = [env.equity]
    exp = [env.exposure]
    trk = []
    tov = []
    for _ in range(len(env.df) - 1):
        action, lstm_states = model.predict(obs, state=lstm_states, episode_start=episode_starts, deterministic=True)
        obs, reward, done, trunc, info = env.step(action)
        episode_starts = np.array([done], dtype=bool)
        eq.append(float(info["equity"]))
        exp.append(float(info["exposure"]))
        trk.append(float(info["tracking_error"]))
        tov.append(float(info["turnover"]))
        if done or trunc:
            break
    return np.asarray(eq), np.asarray(exp), np.asarray(trk), np.asarray(tov)


def rollout_pure_rl(df: pd.DataFrame, feature_cols: list[str], timesteps: int, seed: int):
    train_env = DummyVecEnv([lambda: SensexTradingEnvV2(df=df, feature_cols=feature_cols)])
    model = PPO(
        "MlpPolicy",
        train_env,
        learning_rate=3e-4,
        n_steps=1024,
        batch_size=128,
        n_epochs=8,
        gamma=0.99,
        verbose=0,
        seed=seed,
    )
    model.learn(total_timesteps=timesteps)
    env = SensexTradingEnvV2(df=df, feature_cols=feature_cols)
    obs, _ = env.reset()
    eq = [env.equity]
    for _ in range(len(df) - 1):
        a, _ = model.predict(obs, deterministic=True)
        obs, _, done, trunc, info = env.step(a)
        eq.append(float(info["equity"]))
        if done or trunc:
            break
    return np.asarray(eq)


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(base_dir, "..", "data", "processed", "master_dataset_rl_v2.csv")
    runs_dir = os.path.join(base_dir, "..", "runs")
    os.makedirs(runs_dir, exist_ok=True)
    df = pd.read_csv(data_path)

    feature_cols = [c for c in [
        "Close_z","RSI_14_z","STO_K_z","MACD_z","ATR_14_z","Volatility_Ratio_z","Regime_Flag",
        "OBV_z","SMA_200_z","Sentiment","Returns_z","Vol_Change_z","ret_2d_z","ret_5d_z","ret_10d_z",
        "ret_20d_z","ret_60d_z","vol_10d_z","vol_20d_z","vol_60d_z","price_to_sma200_z",
        "sma200_slope_20d_z","vol_z_20d_z","vol_trend_20d_z","vr_change_5d_z","vr_vol_20d_z","mkt_drawdown_60d_z",
        "vol_q","trend_regime","trend_strength"
    ] if c in df.columns]

    n_folds = int(os.getenv("WF_FOLDS", "5"))
    min_train = int(os.getenv("WF_MIN_TRAIN", "450"))
    exec_steps = int(os.getenv("WF_EXEC_TIMESTEPS", "12000"))
    pure_steps = int(os.getenv("WF_PURE_TIMESTEPS", "8000"))
    n = len(df)
    edges = np.linspace(min_train, n - 2, n_folds + 1, dtype=int)

    exp_id = datetime.now().strftime("exec_overlay_wf_%Y%m%d_%H%M%S")
    out_dir = os.path.join(runs_dir, exp_id)
    os.makedirs(out_dir, exist_ok=True)

    folds = []
    all_overlay_r = []
    all_det_r = []

    for k in range(n_folds):
        i0 = int(edges[k])
        i1 = int(edges[k + 1])
        train_df = df.iloc[:i0].copy()
        test_df = df.iloc[i0:i1].copy()
        if len(test_df) < 50:
            continue

        # Leak-safe predictive ensemble as target exposure
        p_tr, c_tr = expanding_ensemble_proba(train_df, feature_cols=feature_cols, min_train=80, refit_every=10, seed=100 + k)
        p_te, c_te = expanding_ensemble_proba(test_df, feature_cols=feature_cols, min_train=80, refit_every=10, seed=200 + k)
        train_df["target_exposure"] = np.clip(prob_to_exposure(p_tr, 0.05) * c_tr, -1.0, 1.0)
        test_df["target_exposure"] = np.clip(prob_to_exposure(p_te, 0.05) * c_te, -1.0, 1.0)

        # Deterministic baseline (no RL)
        det_eq, det_exp = deterministic_equity(test_df, "target_exposure")
        det_metrics = compute_equity_metrics(det_eq, exposure=det_exp)

        # Execution-only RL overlay (RecurrentPPO)
        overlay_feats = feature_cols + [c for c in ["ens_p_up", "ens_conf"] if c in train_df.columns]
        # feed predictor context explicitly
        train_df["ens_p_up"] = p_tr
        train_df["ens_conf"] = c_tr
        test_df["ens_p_up"] = p_te
        test_df["ens_conf"] = c_te
        overlay_feats = feature_cols + ["ens_p_up", "ens_conf"]

        cfg = ExecOverlayConfig(
            max_delta_exposure=float(os.getenv("WF_EXEC_MAX_DELTA", "0.12")),
            high_vol_cap=float(os.getenv("WF_EXEC_HIGH_VOL_CAP", "0.6")),
            tracking_weight=float(os.getenv("WF_EXEC_TRACK_W", "2.0")),
            turnover_weight=float(os.getenv("WF_EXEC_TURN_W", "0.25")),
            drawdown_weight=float(os.getenv("WF_EXEC_DD_W", "0.5")),
            return_weight=float(os.getenv("WF_EXEC_RET_W", "0.2")),
        )

        vec_env = DummyVecEnv([lambda: ExecutionOverlayEnv(train_df, feature_cols=overlay_feats, cfg=cfg)])
        rppo = RecurrentPPO(
            "MlpLstmPolicy",
            vec_env,
            learning_rate=2e-4,
            n_steps=256,
            batch_size=128,
            n_epochs=5,
            gamma=0.99,
            gae_lambda=0.95,
            ent_coef=0.005,
            verbose=0,
            seed=500 + k,
        )
        rppo.learn(total_timesteps=exec_steps)

        test_env = ExecutionOverlayEnv(test_df, feature_cols=overlay_feats, cfg=cfg)
        ov_eq, ov_exp, ov_trk, ov_tov = rollout_exec_overlay(rppo, test_env)
        ov_metrics = compute_equity_metrics(ov_eq, daily_turnover=ov_tov, exposure=ov_exp)

        # Pure RL reference on same test fold (trained on train split)
        pure_eq = rollout_pure_rl(train_df, feature_cols=feature_cols, timesteps=pure_steps, seed=900 + k)
        pure_metrics = compute_equity_metrics(pure_eq)

        folds.append(
            {
                "fold": k,
                "train_rows": int(len(train_df)),
                "test_rows": int(len(test_df)),
                "deterministic_conf_sizing": asdict(det_metrics),
                "execution_rl_overlay": asdict(ov_metrics),
                "pure_rl_reference_train_only": asdict(pure_metrics),
                "overlay_tracking_error_mean": float(np.mean(ov_trk)) if len(ov_trk) else 0.0,
                "overlay_turnover_mean": float(np.mean(ov_tov)) if len(ov_tov) else 0.0,
            }
        )

        all_overlay_r.append(pd.Series(ov_eq).pct_change().dropna().values)
        all_det_r.append(pd.Series(det_eq).pct_change().dropna().values)

        print(
            f"Fold {k}: det_ret={det_metrics.total_return_pct:.2f}% det_sh={det_metrics.sharpe:.2f} | "
            f"ov_ret={ov_metrics.total_return_pct:.2f}% ov_sh={ov_metrics.sharpe:.2f} "
            f"trk={np.mean(ov_trk) if len(ov_trk) else 0:.4f} tov={np.mean(ov_tov) if len(ov_tov) else 0:.4f}"
        )

    if not folds:
        raise RuntimeError("No folds evaluated")

    over = np.concatenate(all_overlay_r)
    det = np.concatenate(all_det_r)
    diff = over - det[: len(over)] if len(det) >= len(over) else over[: len(det)] - det

    out = {
        "exp_id": exp_id,
        "n_folds_requested": n_folds,
        "folds": folds,
        "bootstrap": {
            "overlay_sharpe_ci": block_bootstrap_ci(over, lambda x: float((np.mean(x) / (np.std(x) + 1e-12)) * np.sqrt(252)), n_boot=300),
            "deterministic_sharpe_ci": block_bootstrap_ci(det, lambda x: float((np.mean(x) / (np.std(x) + 1e-12)) * np.sqrt(252)), n_boot=300),
            "overlay_minus_deterministic_return_ci": block_bootstrap_ci(diff, lambda x: float(np.mean(x)), n_boot=300),
        },
    }
    save_json(os.path.join(out_dir, "exec_overlay_report.json"), out)
    print(f"Saved execution overlay report to {os.path.join(out_dir, 'exec_overlay_report.json')}")


if __name__ == "__main__":
    main()

