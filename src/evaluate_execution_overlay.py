from __future__ import annotations

import json
import os
import sys
from dataclasses import asdict
from datetime import datetime

import numpy as np
import pandas as pd
from sb3_contrib import RecurrentPPO
from sklearn.metrics import (
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from stable_baselines3.common.vec_env import DummyVecEnv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.rl.env_execution_overlay import ExecOverlayConfig, ExecutionOverlayEnv
from src.rl.eval_v2 import block_bootstrap_ci, compute_equity_metrics
from src.rl.predictors import expanding_ensemble_proba, prob_to_exposure


def _feature_cols(df: pd.DataFrame) -> list[str]:
    cols = [
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
        "mkt_drawdown_60d_z",
        "vol_q",
        "trend_regime",
        "trend_strength",
    ]
    return [c for c in cols if c in df.columns]


def deterministic_equity(df: pd.DataFrame, target_col: str, price_col: str = "Close", fee_bps=1.0, slip_bps=2.0):
    close = df[price_col].astype(float).values
    target = df[target_col].astype(float).values
    n = len(close)
    eq = np.zeros(n, dtype=float)
    exp = np.zeros(n, dtype=float)
    turnover = np.zeros(n, dtype=float)
    eq[0] = 100000.0
    curr = 0.0
    for t in range(n - 1):
        tgt = float(np.clip(target[t], -1.0, 1.0))
        turn = abs(tgt - curr)
        turnover[t + 1] = turn
        costs = turn * eq[t] * ((fee_bps + slip_bps) / 10000.0)
        r = close[t + 1] / close[t] - 1.0 if close[t] != 0 else 0.0
        eq[t + 1] = max(0.0, eq[t] * (1 + tgt * r) - costs)
        curr = tgt
        exp[t + 1] = curr
    return eq, exp, turnover


def rollout_exec_overlay(model: RecurrentPPO, env: ExecutionOverlayEnv):
    obs, _ = env.reset()
    lstm_states = None
    episode_starts = np.array([True], dtype=bool)
    rows = []
    for _ in range(len(env.df) - 1):
        action, lstm_states = model.predict(obs, state=lstm_states, episode_start=episode_starts, deterministic=True)
        obs, reward, done, trunc, info = env.step(action)
        episode_starts = np.array([done], dtype=bool)
        rows.append(
            {
                "equity": float(info["equity"]),
                "exposure": float(info["exposure"]),
                "target_exposure": float(info["target_exposure"]),
                "tracking_error": float(info["tracking_error"]),
                "turnover": float(info["turnover"]),
                "market_ret": float(info["market_ret"]),
                "step_ret": float(info["step_ret"]),
                "reward": float(reward),
            }
        )
        if done or trunc:
            break
    return pd.DataFrame(rows)


def predictive_quality_report(df: pd.DataFrame, p_up: np.ndarray) -> dict:
    close = pd.to_numeric(df["Close"], errors="coerce").astype(float).values
    y_true = (close[1:] > close[:-1]).astype(int)
    p = np.asarray(p_up[:-1], dtype=float)
    y_pred = (p >= 0.5).astype(int)

    long_mask = y_pred == 1
    short_mask = y_pred == 0
    long_acc = float((y_true[long_mask] == 1).mean()) if np.any(long_mask) else 0.0
    short_acc = float((y_true[short_mask] == 0).mean()) if np.any(short_mask) else 0.0

    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    return {
        "directional_accuracy": float((y_true == y_pred).mean()),
        "long_accuracy": long_acc,
        "short_accuracy": short_acc,
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, p)) if len(np.unique(y_true)) > 1 else 0.5,
        "confusion_matrix": cm.tolist(),
    }


def run_execution_overlay_analysis() -> str:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(base_dir, "..", "data", "processed", "master_dataset_rl_v2.csv")
    out_root = os.path.join(base_dir, "..", "runs", "analysis_reports")
    os.makedirs(out_root, exist_ok=True)

    run_id = datetime.now().strftime("analysis_%Y%m%d_%H%M%S")
    out_dir = os.path.join(out_root, run_id)
    os.makedirs(out_dir, exist_ok=True)

    df = pd.read_csv(data_path)
    feat = _feature_cols(df)
    n = len(df)

    n_folds = int(os.getenv("WF_FOLDS", "5"))
    min_train = int(os.getenv("WF_MIN_TRAIN", "450"))
    exec_steps = int(os.getenv("WF_EXEC_TIMESTEPS", "6000"))
    edges = np.linspace(min_train, n - 2, n_folds + 1, dtype=int)

    fold_rows = []
    overlay_daily = []
    det_daily = []

    # Predictive quality on full series with expanding fit (for report only)
    p_all, c_all = expanding_ensemble_proba(df, feature_cols=feat, min_train=120, refit_every=20, seed=42)
    pred_q = predictive_quality_report(df, p_all)

    for k in range(n_folds):
        i0, i1 = int(edges[k]), int(edges[k + 1])
        train_df = df.iloc[:i0].copy()
        test_df = df.iloc[i0:i1].copy()
        if len(test_df) < 50:
            continue

        p_tr, c_tr = expanding_ensemble_proba(train_df, feature_cols=feat, min_train=80, refit_every=20, seed=100 + k)
        p_te, c_te = expanding_ensemble_proba(test_df, feature_cols=feat, min_train=80, refit_every=20, seed=200 + k)
        train_df["ens_p_up"] = p_tr
        train_df["ens_conf"] = c_tr
        test_df["ens_p_up"] = p_te
        test_df["ens_conf"] = c_te
        train_df["target_exposure"] = np.clip(prob_to_exposure(p_tr, 0.05) * c_tr, -1.0, 1.0)
        test_df["target_exposure"] = np.clip(prob_to_exposure(p_te, 0.05) * c_te, -1.0, 1.0)

        det_eq, det_exp, det_tov = deterministic_equity(test_df, "target_exposure")
        det_m = compute_equity_metrics(det_eq, daily_turnover=det_tov, exposure=det_exp)

        cfg = ExecOverlayConfig(
            max_delta_exposure=float(os.getenv("WF_EXEC_MAX_DELTA", "0.12")),
            high_vol_cap=float(os.getenv("WF_EXEC_HIGH_VOL_CAP", "0.6")),
            tracking_weight=float(os.getenv("WF_EXEC_TRACK_W", "2.0")),
            turnover_weight=float(os.getenv("WF_EXEC_TURN_W", "0.25")),
            drawdown_weight=float(os.getenv("WF_EXEC_DD_W", "0.5")),
            return_weight=float(os.getenv("WF_EXEC_RET_W", "0.2")),
        )
        overlay_feats = feat + ["ens_p_up", "ens_conf"]
        vec_env = DummyVecEnv([lambda: ExecutionOverlayEnv(train_df, feature_cols=overlay_feats, cfg=cfg)])
        model = RecurrentPPO(
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
            seed=700 + k,
        )
        model.learn(total_timesteps=exec_steps)

        eval_env = ExecutionOverlayEnv(test_df, feature_cols=overlay_feats, cfg=cfg)
        ts = rollout_exec_overlay(model, eval_env)
        ov_eq = np.concatenate([[100000.0], ts["equity"].values])
        ov_exp = np.concatenate([[0.0], ts["exposure"].values])
        ov_tov = np.concatenate([[0.0], ts["turnover"].values])
        ov_m = compute_equity_metrics(ov_eq, daily_turnover=ov_tov, exposure=ov_exp)

        ts["fold"] = k
        ts.to_csv(os.path.join(out_dir, f"fold_{k}_timeseries.csv"), index=False)

        overlay_daily.append(pd.Series(ov_eq).pct_change().dropna().values)
        det_daily.append(pd.Series(det_eq).pct_change().dropna().values)

        fold_rows.append(
            {
                "fold": k,
                "train_rows": len(train_df),
                "test_rows": len(test_df),
                "overlay_return_pct": ov_m.total_return_pct,
                "overlay_sharpe": ov_m.sharpe,
                "overlay_sortino": ov_m.sortino,
                "overlay_max_dd_pct": ov_m.max_drawdown_pct,
                "overlay_profit_factor": ov_m.profit_factor,
                "overlay_turnover_mean": float(ts["turnover"].mean()) if not ts.empty else 0.0,
                "overlay_exposure_mean": float(ts["exposure"].mean()) if not ts.empty else 0.0,
                "overlay_tracking_error_mean": float(ts["tracking_error"].mean()) if not ts.empty else 0.0,
                "det_return_pct": det_m.total_return_pct,
                "det_sharpe": det_m.sharpe,
                "det_max_dd_pct": det_m.max_drawdown_pct,
                "cost_impact_bps_proxy": float((det_m.total_return_pct - ov_m.total_return_pct) * 100),
            }
        )

    folds_df = pd.DataFrame(fold_rows)
    folds_df.to_csv(os.path.join(out_dir, "fold_summary.csv"), index=False)

    ov_r = np.concatenate(overlay_daily) if overlay_daily else np.array([0.0])
    dt_r = np.concatenate(det_daily) if det_daily else np.array([0.0])
    delta = ov_r[: min(len(ov_r), len(dt_r))] - dt_r[: min(len(ov_r), len(dt_r))]

    summary = {
        "run_id": run_id,
        "predictive_quality": pred_q,
        "aggregate": {
            "mean_overlay_return_pct": float(folds_df["overlay_return_pct"].mean()) if not folds_df.empty else 0.0,
            "mean_overlay_sharpe": float(folds_df["overlay_sharpe"].mean()) if not folds_df.empty else 0.0,
            "median_overlay_sharpe": float(folds_df["overlay_sharpe"].median()) if not folds_df.empty else 0.0,
            "mean_det_return_pct": float(folds_df["det_return_pct"].mean()) if not folds_df.empty else 0.0,
            "mean_det_sharpe": float(folds_df["det_sharpe"].mean()) if not folds_df.empty else 0.0,
            "avg_tracking_error": float(folds_df["overlay_tracking_error_mean"].mean()) if not folds_df.empty else 0.0,
            "avg_turnover": float(folds_df["overlay_turnover_mean"].mean()) if not folds_df.empty else 0.0,
        },
        "bootstrap": {
            "overlay_sharpe_ci": block_bootstrap_ci(ov_r, lambda x: float((np.mean(x) / (np.std(x) + 1e-12)) * np.sqrt(252.0)), n_boot=300),
            "deterministic_sharpe_ci": block_bootstrap_ci(dt_r, lambda x: float((np.mean(x) / (np.std(x) + 1e-12)) * np.sqrt(252.0)), n_boot=300),
            "overlay_minus_det_return_ci": block_bootstrap_ci(delta, lambda x: float(np.mean(x)), n_boot=300),
        },
    }
    with open(os.path.join(out_dir, "summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    return out_dir


if __name__ == "__main__":
    out = run_execution_overlay_analysis()
    print(f"Saved analysis to: {out}")

