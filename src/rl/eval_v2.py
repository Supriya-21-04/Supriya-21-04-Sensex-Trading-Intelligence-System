from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from typing import Any

import numpy as np
import pandas as pd


@dataclass
class EquityMetrics:
    final_value: float
    total_return_pct: float
    cagr_pct: float
    sharpe: float
    sortino: float
    max_drawdown_pct: float
    calmar: float
    daily_turnover_mean: float
    exposure_mean: float
    exposure_abs_mean: float
    profit_factor: float
    expectancy_daily: float


def _max_drawdown(equity: np.ndarray) -> float:
    roll_max = np.maximum.accumulate(equity)
    dd = (equity - roll_max) / np.where(roll_max == 0, 1.0, roll_max)
    return float(dd.min())


def compute_equity_metrics(equity: np.ndarray, daily_turnover: np.ndarray | None = None, exposure: np.ndarray | None = None) -> EquityMetrics:
    equity = np.asarray(equity, dtype=float)
    if len(equity) < 2:
        raise ValueError("equity must have at least 2 points")

    ret = equity[-1] / equity[0] - 1.0
    total_return_pct = float(ret * 100.0)
    years = max(len(equity) / 252.0, 1e-9)
    cagr = float(((equity[-1] / equity[0]) ** (1.0 / years) - 1.0) * 100.0)

    daily_r = pd.Series(equity).pct_change().dropna()
    mu = float(daily_r.mean())
    sd = float(daily_r.std())
    sharpe = float((mu / sd) * np.sqrt(252.0)) if sd > 0 else 0.0

    downside = daily_r[daily_r < 0]
    dd_sd = float(downside.std())
    sortino = float((mu / dd_sd) * np.sqrt(252.0)) if dd_sd > 0 else 0.0

    mdd = _max_drawdown(equity)  # negative
    max_dd_pct = float(mdd * 100.0)
    calmar = float((cagr / abs(max_dd_pct)) if max_dd_pct != 0 else 0.0)

    daily_turnover = np.asarray(daily_turnover, dtype=float) if daily_turnover is not None else None
    exposure = np.asarray(exposure, dtype=float) if exposure is not None else None

    # Profit factor + daily expectancy (using daily returns as "trades" for robustness)
    pos_sum = float(daily_r[daily_r > 0].sum())
    neg_sum = float((-daily_r[daily_r < 0]).sum())
    profit_factor = float(pos_sum / neg_sum) if neg_sum > 0 else float("inf") if pos_sum > 0 else 0.0
    expectancy_daily = float(daily_r.mean())

    return EquityMetrics(
        final_value=float(equity[-1]),
        total_return_pct=total_return_pct,
        cagr_pct=cagr,
        sharpe=sharpe,
        sortino=sortino,
        max_drawdown_pct=max_dd_pct,
        calmar=calmar,
        daily_turnover_mean=float(daily_turnover.mean()) if daily_turnover is not None and len(daily_turnover) else 0.0,
        exposure_mean=float(exposure.mean()) if exposure is not None and len(exposure) else 0.0,
        exposure_abs_mean=float(np.abs(exposure).mean()) if exposure is not None and len(exposure) else 0.0,
        profit_factor=profit_factor,
        expectancy_daily=expectancy_daily,
    )


def block_bootstrap_ci(
    series: np.ndarray,
    statistic_fn,
    block: int = 10,
    n_boot: int = 1000,
    alpha: float = 0.05,
    seed: int = 7,
) -> dict[str, float]:
    """
    Moving-block bootstrap CI for time series.
    Returns dict with keys: point, lo, hi
    """
    rng = np.random.default_rng(seed)
    x = np.asarray(series, dtype=float)
    n = len(x)
    if n < 2:
        v = float(statistic_fn(x))
        return {"point": v, "lo": v, "hi": v}

    point = float(statistic_fn(x))
    b = max(2, min(int(block), n))
    n_blocks = int(np.ceil(n / b))

    stats = []
    for _ in range(int(n_boot)):
        starts = rng.integers(0, n - b + 1, size=n_blocks)
        sample = np.concatenate([x[s : s + b] for s in starts])[:n]
        stats.append(float(statistic_fn(sample)))
    stats = np.sort(np.asarray(stats))
    lo = float(np.quantile(stats, alpha / 2))
    hi = float(np.quantile(stats, 1 - alpha / 2))
    return {"point": point, "lo": lo, "hi": hi}


def save_json(path: str, payload: dict[str, Any]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, default=lambda o: asdict(o) if hasattr(o, "__dataclass_fields__") else str(o))

