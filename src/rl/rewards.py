from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class DifferentialSharpeState:
    """
    Online (streaming) differential Sharpe approximation.

    Uses exponentially-weighted moving moments of returns:
      m_t = (1-a) m_{t-1} + a r_t
      v_t = (1-a) v_{t-1} + a (r_t - m_t)^2

    Sharpe ~ m / sqrt(v + eps)
    Reward is delta-Sharpe between steps.

    References:
    - Moody, Saffell (2001): Learning to trade via direct reinforcement
    - "Differential Sharpe Ratio" variants used in many trading RL papers
    """

    ema_mean: float = 0.0
    ema_var: float = 0.0
    last_sharpe: float = 0.0


def differential_sharpe_reward(
    state: DifferentialSharpeState,
    r: float,
    alpha: float = 0.01,
    eps: float = 1e-12,
) -> tuple[float, DifferentialSharpeState, float]:
    """
    Args:
      state: running Sharpe state
      r: step return (portfolio return, not PnL)
      alpha: EWMA smoothing factor. Smaller => longer memory.

    Returns:
      reward: delta Sharpe
      new_state
      sharpe: current estimated Sharpe (not annualized)
    """
    m = (1.0 - alpha) * state.ema_mean + alpha * r
    # use (r - m)^2 with updated mean to reduce drift
    v = (1.0 - alpha) * state.ema_var + alpha * float((r - m) ** 2)
    sharpe = float(m / (np.sqrt(v + eps)))
    reward = sharpe - float(state.last_sharpe)
    return reward, DifferentialSharpeState(ema_mean=m, ema_var=v, last_sharpe=sharpe), sharpe


def sortino_like_reward(
    r: float,
    target: float = 0.0,
    downside_scale: float = 10.0,
) -> float:
    """
    A simple per-step utility that penalizes downside more than upside.
    This is not a true Sortino ratio (which needs a window), but it works
    as a local shaping term.
    """
    downside = min(0.0, r - target)
    return float(r - downside_scale * (downside**2))


def drawdown_penalty(equity: float, peak_equity: float, scale: float = 1.0) -> float:
    if peak_equity <= 0:
        return 0.0
    dd = (equity - peak_equity) / peak_equity  # negative or zero
    return float(scale * abs(min(0.0, dd)))


def turnover_penalty(delta_exposure: float, scale: float = 0.001) -> float:
    return float(scale * abs(delta_exposure))

