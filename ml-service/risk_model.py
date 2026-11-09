from __future__ import annotations

import math
from decimal import Decimal, ROUND_HALF_UP, getcontext
from typing import Dict, List

import numpy as np

getcontext().prec = 40
MODEL_VERSION = "risk-var-suite-v2.0.0"
DEFAULT_SEED = 1729
DEFAULT_MONTE_CARLO_SIMULATIONS = 20000


def _portfolio_returns(weights: List[float], asset_returns: List[List[float]]) -> np.ndarray:
    returns_matrix = np.array(asset_returns, dtype=np.float64)
    weights_array = np.array(weights, dtype=np.float64)
    periods = min(vector.size for vector in returns_matrix)
    return np.dot(weights_array, returns_matrix[:, -periods:])


def _standard_normal_inverse_cdf(probability: float) -> float:
    """Acklam inverse-normal approximation, deterministic and SciPy-free."""
    if probability <= 0 or probability >= 1:
        raise ValueError("probability must be between 0 and 1")

    a = [
        -3.969683028665376e01,
        2.209460984245205e02,
        -2.759285104469687e02,
        1.383577518672690e02,
        -3.066479806614716e01,
        2.506628277459239e00,
    ]
    b = [
        -5.447609879822406e01,
        1.615858368580409e02,
        -1.556989798598866e02,
        6.680131188771972e01,
        -1.328068155288572e01,
    ]
    c = [
        -7.784894002430293e-03,
        -3.223964580411365e-01,
        -2.400758277161838e00,
        -2.549732539343734e00,
        4.374664141464968e00,
        2.938163982698783e00,
    ]
    d = [
        7.784695709041462e-03,
        3.224671290700398e-01,
        2.445134137142996e00,
        3.754408661907416e00,
    ]

    low = 0.02425
    high = 1 - low

    if probability < low:
        q = math.sqrt(-2 * math.log(probability))
        return (
            (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
            / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
        )

    if probability > high:
        q = math.sqrt(-2 * math.log(1 - probability))
        return -(
            (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
            / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
        )

    q = probability - 0.5
    r = q * q
    return (
        (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5])
        * q
        / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    )


def _tail_metrics(losses: np.ndarray, confidence: float) -> Dict[str, float]:
    threshold = np.percentile(losses, confidence * 100)
    tail = losses[losses >= threshold]
    return {
        "var": _quantize(max(0.0, threshold)),
        "expected_shortfall": _quantize(max(0.0, np.mean(tail)) if tail.size else threshold),
    }


def _quantize(value: float | np.float64, places = "0.0000000001") -> float:
    return float(Decimal(str(float(value))).quantize(Decimal(places), rounding=ROUND_HALF_UP))


def calculate_var_suite(
    weights: List[float],
    asset_returns: List[List[float]],
    confidence: float = 0.95,
    method: str = "historical",
    seed: int = DEFAULT_SEED,
    simulations: int = DEFAULT_MONTE_CARLO_SIMULATIONS,
) -> Dict[str, object]:
    """Calculate historical, parametric, and Monte Carlo VaR with reproducible metadata."""
    returns = _portfolio_returns(weights, asset_returns)
    losses = -returns
    lookback_periods = int(returns.size)
    mean_return = float(np.mean(returns))
    volatility = float(np.std(returns, ddof=1)) if returns.size > 1 else 0.0

    historical = _tail_metrics(losses, confidence)

    z_score = _standard_normal_inverse_cdf(confidence)
    parametric_var = max(0.0, -(mean_return - z_score * volatility))
    parametric_es = 0.0
    if volatility > 0:
        density = math.exp(-(z_score**2) / 2) / math.sqrt(2 * math.pi)
        parametric_es = max(0.0, -(mean_return - volatility * density / (1 - confidence)))

    rng = np.random.default_rng(seed)
    simulated_returns = rng.normal(mean_return, volatility, simulations)
    monte_carlo = _tail_metrics(-simulated_returns, confidence)

    methods = {
        "historical": {
            "method": "historical",
            "var": historical["var"],
            "expected_shortfall": historical["expected_shortfall"],
            "parameters": {
                "confidence": confidence,
                "lookback_periods": lookback_periods,
                "percentile": round((1 - confidence) * 100, 4),
            },
        },
        "parametric": {
            "method": "parametric",
            "var": _quantize(parametric_var),
            "expected_shortfall": _quantize(parametric_es),
            "parameters": {
                "confidence": confidence,
                "mean_return": _quantize(mean_return),
                "volatility": _quantize(volatility),
                "distribution": "normal",
                "z_score": round(z_score, 6),
            },
        },
        "monte_carlo": {
            "method": "monte_carlo",
            "var": monte_carlo["var"],
            "expected_shortfall": monte_carlo["expected_shortfall"],
            "parameters": {
                "confidence": confidence,
                "simulations": simulations,
                "seed": seed,
                "mean_return": _quantize(mean_return),
                "volatility": _quantize(volatility),
                "distribution": "normal",
            },
        },
    }

    selected_method = method if method in methods else "historical"
    selected = methods[selected_method]

    return {
        "var_95": selected["var"],
        "volatility": _quantize(volatility),
        "expected_shortfall": selected["expected_shortfall"],
        "selected_method": selected_method,
        "methods": methods,
        "model_version": MODEL_VERSION,
        "deterministic_seed": seed,
    }


def calculate_historical_var(
    weights: List[float],
    asset_returns: List[List[float]],
    confidence: float = 0.95,
) -> Dict[str, object]:
    """Backward-compatible entrypoint used by older callers."""
    return calculate_var_suite(weights, asset_returns, confidence, method="historical")
