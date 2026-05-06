from __future__ import annotations

import os

import numpy as np
import pandas as pd

import sys

# Allow running this file directly from repo root
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.rl.regimes import add_regime_columns


def _rolling_z(df: pd.DataFrame, col: str, window: int = 30) -> pd.Series:
    mu = df[col].rolling(window=window, min_periods=window).mean()
    sd = df[col].rolling(window=window, min_periods=window).std()
    return (df[col] - mu) / sd.replace(0, np.nan)


def add_market_state_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Adds leak-safe features (only uses present/past rows).

    Assumptions:
    - Row t is usable for decision at end of day t.
    - No feature uses future prices (no negative shifts).
    """
    df = df.copy()
    close = df["Close"].astype(float)
    vol = df["Volume"].astype(float) if "Volume" in df.columns else pd.Series(0.0, index=df.index)

    # Multi-horizon returns
    for h in (2, 5, 10, 20, 60):
        df[f"ret_{h}d"] = close.pct_change(h)

    # Rolling realized volatility of daily returns
    daily_r = close.pct_change().fillna(0.0)
    for w in (10, 20, 60):
        df[f"vol_{w}d"] = daily_r.rolling(window=w, min_periods=w).std()

    # Market drawdown state (context for risk + mean reversion)
    peak_60 = close.rolling(window=60, min_periods=60).max()
    df["mkt_drawdown_60d"] = (close / peak_60) - 1.0

    # Trend / momentum context (price vs SMA200 already exists, but make ratio + slope proxy)
    if "SMA_200" in df.columns:
        sma200 = df["SMA_200"].astype(float).replace(0, np.nan)
        df["price_to_sma200"] = (close / sma200) - 1.0
        df["sma200_slope_20d"] = df["SMA_200"].astype(float).pct_change(20)
    else:
        df["price_to_sma200"] = 0.0
        df["sma200_slope_20d"] = 0.0

    # Volume features
    df["vol_z_20d"] = (vol - vol.rolling(20, min_periods=20).mean()) / vol.rolling(20, min_periods=20).std().replace(0, np.nan)
    df["vol_trend_20d"] = vol.pct_change(20)

    # Volatility-of-volatility (regime instability proxy)
    if "Volatility_Ratio" in df.columns:
        vr = df["Volatility_Ratio"].astype(float)
        df["vr_change_5d"] = vr.pct_change(5)
        df["vr_vol_20d"] = vr.rolling(20, min_periods=20).std()
    else:
        df["vr_change_5d"] = 0.0
        df["vr_vol_20d"] = 0.0

    return df


def normalize_for_rl(df: pd.DataFrame) -> pd.DataFrame:
    """
    Produce z-scored versions for continuous features added in v2.
    Keeps binary/normalized features raw: Regime_Flag, Sentiment.
    """
    df = df.copy()
    raw_cols = [c for c in df.columns if c in ("Regime_Flag", "Sentiment")]

    # Choose new continuous columns to z-score
    candidate = [
        c
        for c in df.columns
        if c.startswith(("ret_", "vol_", "price_to_", "sma200_slope_", "vol_z_", "vol_trend_", "vr_"))
    ]
    # also z-score drawdown state
    if "mkt_drawdown_60d" in df.columns:
        candidate.append("mkt_drawdown_60d")
    for c in candidate:
        if c in raw_cols:
            continue
        df[f"{c}_z"] = _rolling_z(df, c, window=30)

    # Drop rows with NaNs created by rolling windows (keep it strict to avoid implicit forward fill)
    must_have = [f"{c}_z" for c in candidate] + raw_cols
    must_have = [c for c in must_have if c in df.columns]
    df = df.dropna(subset=must_have)
    return df


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    master_in = os.path.join(base_dir, "..", "..", "data", "processed", "master_dataset.csv")
    master_out = os.path.join(base_dir, "..", "..", "data", "processed", "master_dataset_rl_v2.csv")

    if not os.path.exists(master_in):
        raise FileNotFoundError(f"Missing {master_in}. Run feature_engineering.py first.")

    df = pd.read_csv(master_in)
    df = add_market_state_features(df)
    df = add_regime_columns(df)
    df = normalize_for_rl(df)
    df.to_csv(master_out, index=False)
    print(f"Saved RL v2 dataset to: {os.path.normpath(master_out)} ({len(df)} rows)")


if __name__ == "__main__":
    main()

