from __future__ import annotations

from typing import Dict, List

import numpy as np
from sklearn.ensemble import IsolationForest


def detect_anomaly(series: List[float]) -> Dict[str, float | bool]:
    """Detect anomalies in portfolio value series using Isolation Forest + z-score."""
    values = np.array(series, dtype=np.float64)

    if values.size < 4:
        return {
            "anomaly_score": 0.0,
            "is_anomaly": False,
            "z_score": 0.0,
        }

    returns = np.diff(values) / values[:-1]
    mean = float(np.mean(returns))
    std = float(np.std(returns, ddof=1)) if returns.size > 1 else 0.0
    z_score = 0.0 if std == 0 else float((returns[-1] - mean) / std)

    if returns.size < 12:
        return {
            "anomaly_score": round(abs(z_score), 6),
            "is_anomaly": abs(z_score) > 2.5,
            "z_score": round(z_score, 6),
        }

    model = IsolationForest(contamination=0.08, random_state=42)
    model.fit(returns.reshape(-1, 1))

    decision_scores = model.decision_function(returns.reshape(-1, 1))
    predictions = model.predict(returns.reshape(-1, 1))

    model_anomaly = bool(predictions[-1] == -1)
    zscore_anomaly = abs(z_score) > 2.5

    # IsolationForest gives lower scores for outliers, so invert for a direct anomaly score.
    anomaly_score = float(-decision_scores[-1])

    return {
        "anomaly_score": round(anomaly_score, 6),
        "is_anomaly": bool(model_anomaly or zscore_anomaly),
        "z_score": round(z_score, 6),
    }
