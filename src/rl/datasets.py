from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class TimeSplit:
    train: pd.DataFrame
    val: pd.DataFrame
    test: pd.DataFrame


def time_split_by_ratio(df: pd.DataFrame, train_ratio=0.7, val_ratio=0.15) -> TimeSplit:
    """
    Deterministic time split. No shuffling.
    """
    if df is None or df.empty:
        raise ValueError("df must be non-empty")
    if train_ratio <= 0 or val_ratio <= 0 or (train_ratio + val_ratio) >= 1:
        raise ValueError("invalid ratios")

    n = len(df)
    i_train = int(n * train_ratio)
    i_val = int(n * (train_ratio + val_ratio))
    return TimeSplit(train=df.iloc[:i_train].copy(), val=df.iloc[i_train:i_val].copy(), test=df.iloc[i_val:].copy())

