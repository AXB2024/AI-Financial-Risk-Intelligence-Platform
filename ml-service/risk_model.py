from __future__ import annotations

from typing import Dict, List

import numpy as np


def calculate_historical_var(
    weights: List[float],
    asset_returns: List[List[float]],
    confidence: float = 0.95,
) -> Dict[str, float]:
    """Calculate VaR, volatility, and expected shortfall using historical simulation."""
    returns_matrix = np.array(asset_returns, dtype=np.float64)
    weights_array = np.array(weights, dtype=np.float64)

    portfolio_returns = np.dot(weights_array, returns_matrix)

    tail_percentile = float((1 - confidence) * 100)
    threshold = np.percentile(portfolio_returns, tail_percentile)

    var_95 = float(max(0.0, -threshold))
    volatility = float(np.std(portfolio_returns, ddof=1))

    tail_losses = portfolio_returns[portfolio_returns <= threshold]
    expected_shortfall = float(max(0.0, -np.mean(tail_losses))) if tail_losses.size else var_95

    return {
        "var_95": round(var_95, 6),
        "volatility": round(volatility, 6),
        "expected_shortfall": round(expected_shortfall, 6),
    }
