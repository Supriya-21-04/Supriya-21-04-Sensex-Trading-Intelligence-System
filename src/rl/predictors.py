from __future__ import annotations

import numpy as np
import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier


def make_direction_labels(df: pd.DataFrame, price_col: str = "Close") -> pd.Series:
    close = pd.to_numeric(df[price_col], errors="coerce").astype(float)
    y = (close.shift(-1) > close).astype(int)
    return y.iloc[:-1]  # last label would be NaN/invalid for next-day


def train_xgb_direction_classifier(
    train_df: pd.DataFrame,
    feature_cols: list[str],
    price_col: str = "Close",
    seed: int = 7,
) -> XGBClassifier:
    X = train_df[feature_cols].iloc[:-1].astype(float).values
    y = make_direction_labels(train_df, price_col=price_col).values

    # Structural baseline model: not tuned for the split, meant to be robust.
    model = XGBClassifier(
        n_estimators=400,
        max_depth=4,
        learning_rate=0.03,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_lambda=2.0,
        min_child_weight=5,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=seed,
        n_jobs=0,
    )
    model.fit(X, y)
    return model


def train_rf_direction_classifier(
    train_df: pd.DataFrame,
    feature_cols: list[str],
    price_col: str = "Close",
    seed: int = 7,
) -> RandomForestClassifier:
    X = train_df[feature_cols].iloc[:-1].astype(float).values
    y = make_direction_labels(train_df, price_col=price_col).values
    model = RandomForestClassifier(
        n_estimators=600,
        max_depth=8,
        min_samples_leaf=10,
        max_features="sqrt",
        bootstrap=True,
        n_jobs=-1,
        random_state=seed,
    )
    model.fit(X, y)
    return model


def predict_up_proba_sklearn(
    model,
    df: pd.DataFrame,
    feature_cols: list[str],
) -> np.ndarray:
    X = df[feature_cols].astype(float).values
    p = model.predict_proba(X)[:, 1]
    return np.asarray(p, dtype=float)


def ensemble_prob(p_list: list[np.ndarray], weights: list[float] | None = None) -> np.ndarray:
    ps = [np.asarray(p, dtype=float) for p in p_list]
    if not ps:
        raise ValueError("empty p_list")
    n = len(ps[0])
    for p in ps:
        if len(p) != n:
            raise ValueError("prob arrays must match length")
    if weights is None:
        w = np.ones(len(ps), dtype=float) / len(ps)
    else:
        w = np.asarray(weights, dtype=float)
        w = w / max(1e-12, float(np.sum(w)))
    out = np.zeros(n, dtype=float)
    for wi, pi in zip(w, ps):
        out += wi * pi
    return np.clip(out, 1e-6, 1 - 1e-6)


def prob_confidence_entropy(p_up: np.ndarray) -> np.ndarray:
    """
    Confidence in [0,1] based on normalized entropy of Bernoulli(p).
    1 = very confident (p near 0/1), 0 = maximally uncertain (p ~ 0.5).
    """
    p = np.clip(np.asarray(p_up, dtype=float), 1e-6, 1 - 1e-6)
    h = -(p * np.log(p) + (1 - p) * np.log(1 - p))
    h_max = np.log(2.0)
    conf = 1.0 - (h / h_max)
    return np.clip(conf, 0.0, 1.0)


def predict_up_proba(
    model: XGBClassifier,
    df: pd.DataFrame,
    feature_cols: list[str],
) -> np.ndarray:
    X = df[feature_cols].astype(float).values
    p = model.predict_proba(X)[:, 1]
    return np.asarray(p, dtype=float)


def prob_to_exposure(p_up: np.ndarray, neutral_band: float = 0.05) -> np.ndarray:
    """
    Convert probability to target exposure in [-1, 1] with a neutral band.
    """
    p = np.asarray(p_up, dtype=float)
    centered = 2.0 * (p - 0.5)  # [-1, 1]
    # neutral band around 0
    out = centered.copy()
    out[np.abs(out) < neutral_band] = 0.0
    return np.clip(out, -1.0, 1.0)


def expanding_xgb_proba(
    df: pd.DataFrame,
    feature_cols: list[str],
    price_col: str = "Close",
    min_train: int = 252,
    refit_every: int = 5,
    seed: int = 7,
) -> np.ndarray:
    """
    Leak-safe probability feature using an expanding-window fit.

    For each t, the model is fit on rows [0:t) and predicts p(up) for row t.
    To reduce cost, we only refit every `refit_every` steps and reuse the last model in between.
    """
    n = len(df)
    p = np.full(n, 0.5, dtype=float)
    model = None
    last_fit_t = None

    for t in range(min_train, n):
        if (model is None) or (last_fit_t is None) or ((t - last_fit_t) >= refit_every):
            train_slice = df.iloc[:t].copy()
            # fit using data up to t-1; labels use shift(-1) so exclude last row
            if len(train_slice) < (min_train + 2):
                continue
            model = train_xgb_direction_classifier(train_slice, feature_cols=feature_cols, price_col=price_col, seed=seed)
            last_fit_t = t
        x = df[feature_cols].iloc[[t]].astype(float).values
        p[t] = float(model.predict_proba(x)[:, 1][0])
    return p


def expanding_ensemble_proba(
    df: pd.DataFrame,
    feature_cols: list[str],
    price_col: str = "Close",
    min_train: int = 252,
    refit_every: int = 5,
    seed: int = 7,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Leak-safe expanding ensemble of (XGB + RF) probabilities.

    Returns:
      p_up_ens: ensemble probability
      conf: entropy-based confidence in [0,1]
    """
    n = len(df)
    p_ens = np.full(n, 0.5, dtype=float)
    conf = np.zeros(n, dtype=float)

    xgb = None
    rf = None
    last_fit_t = None

    for t in range(min_train, n):
        if (last_fit_t is None) or ((t - last_fit_t) >= refit_every):
            train_slice = df.iloc[:t].copy()
            if len(train_slice) < (min_train + 2):
                continue
            xgb = train_xgb_direction_classifier(train_slice, feature_cols=feature_cols, price_col=price_col, seed=seed)
            rf = train_rf_direction_classifier(train_slice, feature_cols=feature_cols, price_col=price_col, seed=seed + 101)
            last_fit_t = t
        x = df[feature_cols].iloc[[t]].astype(float).values
        px = float(xgb.predict_proba(x)[:, 1][0]) if xgb is not None else 0.5
        pr = float(rf.predict_proba(x)[:, 1][0]) if rf is not None else 0.5
        pe = float(ensemble_prob([np.array([px]), np.array([pr])])[0])
        p_ens[t] = pe
        conf[t] = float(prob_confidence_entropy(np.array([pe]))[0])

    return p_ens, conf

