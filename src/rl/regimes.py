from __future__ import annotations

import numpy as np
import pandas as pd


def add_regime_columns(
    df: pd.DataFrame,
    vol_col: str = "vol_20d",
    trend_col: str = "price_to_sma200",
    slope_col: str = "sma200_slope_20d",
) -> pd.DataFrame:
    """
    Leak-safe regime features based only on current/past values.

    Produces:
    - vol_q (0..3): volatility quartile bucket (computed on expanding history)
    - trend_regime: {-1,0,1} for bear/sideways/bull proxy
    - trend_strength: |price_to_sma200|
    """
    out = df.copy()

    if vol_col in out.columns:
        v = pd.to_numeric(out[vol_col], errors="coerce").astype(float)
        # expanding quantiles (leak-safe): quantiles computed up to t
        vol_q = np.full(len(out), np.nan, dtype=float)
        for t in range(len(out)):
            hist = v.iloc[: t + 1].dropna()
            if len(hist) < 60:
                continue
            q = np.quantile(hist.values, [0.25, 0.5, 0.75])
            vt = float(v.iloc[t])
            if not np.isfinite(vt):
                continue
            vol_q[t] = 0.0 if vt <= q[0] else 1.0 if vt <= q[1] else 2.0 if vt <= q[2] else 3.0
        out["vol_q"] = vol_q

    # Trend regime proxy
    trend = pd.to_numeric(out.get(trend_col, 0.0), errors="coerce").astype(float).fillna(0.0)
    slope = pd.to_numeric(out.get(slope_col, 0.0), errors="coerce").astype(float).fillna(0.0)
    strength = trend.abs()

    # thresholds chosen to be scale-free (ratios)
    bull = (trend > 0.0) & (slope > 0.0) & (strength > 0.002)
    bear = (trend < 0.0) & (slope < 0.0) & (strength > 0.002)
    tr = np.zeros(len(out), dtype=float)
    tr[bull.values] = 1.0
    tr[bear.values] = -1.0

    out["trend_regime"] = tr
    out["trend_strength"] = strength.values
    return out

