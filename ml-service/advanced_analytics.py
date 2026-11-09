from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP, getcontext
from typing import Dict, List

import numpy as np

getcontext().prec = 40
MODEL_VERSION = "premium-risk-analytics-v2.0.0"


def _portfolio_returns(weights: List[float], asset_returns: List[List[float]]) -> np.ndarray:
    returns_matrix = np.array(asset_returns, dtype=np.float64)
    weights_array = np.array(weights, dtype=np.float64)
    periods = min(vector.size for vector in returns_matrix)
    return np.dot(weights_array, returns_matrix[:, -periods:])


def _max_drawdown_from_returns(returns: np.ndarray) -> float:
    equity = np.cumprod(1 + returns)
    peaks = np.maximum.accumulate(equity)
    drawdowns = (equity - peaks) / peaks
    return float(np.min(drawdowns)) if drawdowns.size else 0.0


def _quantize(value: float | np.float64, places = "0.0000000001") -> float:
    return float(Decimal(str(float(value))).quantize(Decimal(places), rounding=ROUND_HALF_UP))


def calculate_tail_risk(
    weights: List[float],
    asset_returns: List[List[float]],
    historical_scenarios: List[Dict[str, object]] | None = None,
) -> Dict[str, object]:
    """Premium tail metrics from historical returns and replayed historical episode paths."""
    returns = _portfolio_returns(weights, asset_returns)

    var_99_threshold = np.percentile(returns, 1)
    var_975_threshold = np.percentile(returns, 2.5)
    tail_99 = returns[returns <= var_99_threshold]
    downside_returns = returns[returns < 0]

    mean = float(np.mean(returns))
    std = float(np.std(returns, ddof=1)) if returns.size > 1 else 0.0
    centered = returns - mean
    skewness = float(np.mean(centered**3) / (std**3)) if std else 0.0
    kurtosis = float(np.mean(centered**4) / (std**4)) if std else 0.0

    return {
        "var_99": _quantize(max(0.0, -var_99_threshold)),
        "cvar_99": _quantize(max(0.0, -np.mean(tail_99)) if tail_99.size else 0.0),
        "var_975": _quantize(max(0.0, -var_975_threshold)),
        "downside_deviation": _quantize(np.std(downside_returns, ddof=1) if downside_returns.size > 1 else 0.0),
        "max_drawdown": _quantize(_max_drawdown_from_returns(returns)),
        "skewness": _quantize(skewness),
        "kurtosis": _quantize(kurtosis),
        "stress_scenarios": replay_historical_scenarios(weights, historical_scenarios or []),
        "model_version": MODEL_VERSION,
    }


def replay_historical_scenarios(
    weights: List[float],
    historical_scenarios: List[Dict[str, object]],
) -> List[Dict[str, object]]:
    results: List[Dict[str, object]] = []
    weights_array = np.array(weights, dtype=np.float64)

    for scenario in historical_scenarios:
        returns_by_asset = scenario.get("asset_returns", [])
        if not isinstance(returns_by_asset, list) or not returns_by_asset:
            continue

        returns_matrix = np.array(returns_by_asset, dtype=np.float64)
        if returns_matrix.ndim != 2 or returns_matrix.shape[0] != weights_array.size:
            continue

        periods = min(returns_matrix.shape[1], 756)
        portfolio_returns = np.dot(weights_array, returns_matrix[:, :periods])
        cumulative_path = np.cumprod(1 + portfolio_returns) - 1
        max_loss = float(np.min(cumulative_path)) if cumulative_path.size else 0.0
        terminal_return = float(cumulative_path[-1]) if cumulative_path.size else 0.0

        results.append(
            {
                "name": str(scenario.get("name", "historical_episode")),
                "period": str(scenario.get("period", "unknown")),
                "source": str(scenario.get("source", "market-data-service")),
                "days": int(periods),
                "terminal_return": round(terminal_return, 6),
                "max_loss": round(abs(min(max_loss, 0.0)), 6),
                "worst_day": round(float(abs(min(np.min(portfolio_returns), 0.0))), 6),
                "method": "historical_episode_replay",
            }
        )

    return results


def calculate_factor_exposures(
    weights: List[float],
    asset_returns: List[List[float]],
    factor_returns: Dict[str, List[float]],
) -> Dict[str, object]:
    """OLS exposure decomposition for Fama-French 5 factors plus momentum."""
    returns = _portfolio_returns(weights, asset_returns)
    factor_names = ["mkt_rf", "smb", "hml", "rmw", "cma", "mom"]
    matrix = np.array([factor_returns.get(name, []) for name in factor_names], dtype=np.float64)

    if matrix.ndim != 2 or matrix.shape[0] != len(factor_names) or matrix.shape[1] < 30:
        return {
            "model_version": MODEL_VERSION,
            "source": "missing_factor_data",
            "exposures": [],
            "r_squared": 0.0,
            "alpha": 0.0,
        }

    periods = min(returns.size, matrix.shape[1])
    y = returns[-periods:]
    x = matrix[:, -periods:].T
    x_with_intercept = np.column_stack([np.ones(periods), x])
    coefficients, *_ = np.linalg.lstsq(x_with_intercept, y, rcond=None)
    fitted = x_with_intercept @ coefficients
    residuals = y - fitted
    total_sum_squares = float(np.sum((y - np.mean(y)) ** 2))
    residual_sum_squares = float(np.sum(residuals**2))
    r_squared = 1 - residual_sum_squares / total_sum_squares if total_sum_squares else 0.0

    return {
        "model_version": MODEL_VERSION,
        "source": "fama_french_5_factor_plus_momentum",
        "alpha": round(float(coefficients[0]), 8),
        "r_squared": round(float(max(0.0, min(1.0, r_squared))), 6),
        "exposures": [
            {"factor": name, "beta": round(float(beta), 6)}
            for name, beta in zip(factor_names, coefficients[1:])
        ],
        "periods": int(periods),
        "method": "ordinary_least_squares",
    }


def backtest_var(
    weights: List[float],
    asset_returns: List[List[float]],
    confidence: float = 0.95,
    window: int = 60,
) -> Dict[str, object]:
    """Published VaR validation using Kupiec POF and Christoffersen coverage tests."""
    returns = _portfolio_returns(weights, asset_returns)
    if returns.size <= window + 5:
        return {
            "model_version": MODEL_VERSION,
            "status": "insufficient_history",
            "exceptions": 0,
            "observations": 0,
        }

    exceptions: List[int] = []
    forecasts: List[float] = []
    realized_losses: List[float] = []

    for idx in range(window, returns.size):
        train = returns[idx - window : idx]
        var_threshold = np.percentile(train, (1 - confidence) * 100)
        forecast_loss = max(0.0, -float(var_threshold))
        realized_loss = max(0.0, -float(returns[idx]))
        forecasts.append(forecast_loss)
        realized_losses.append(realized_loss)
        exceptions.append(1 if realized_loss > forecast_loss else 0)

    x = int(sum(exceptions))
    n = len(exceptions)
    expected_exception_rate = 1 - confidence
    observed_exception_rate = x / n if n else 0.0
    kupiec_lr = _kupiec_lr(n, x, expected_exception_rate)
    christoffersen_lr = _christoffersen_lr(exceptions)

    return {
        "model_version": MODEL_VERSION,
        "method": "rolling_historical_var",
        "confidence": confidence,
        "window": window,
        "observations": n,
        "exceptions": x,
        "expected_exceptions": round(n * expected_exception_rate, 3),
        "observed_exception_rate": round(observed_exception_rate, 6),
        "kupiec_pof": {
            "lr_stat": round(kupiec_lr, 6),
            "passed_95": bool(kupiec_lr < 3.841459),
            "critical_value_95": 3.841459,
        },
        "christoffersen_conditional_coverage": {
            "lr_stat": round(christoffersen_lr, 6),
            "passed_95": bool(christoffersen_lr < 5.991465),
            "critical_value_95": 5.991465,
        },
        "average_forecast_var": round(float(np.mean(forecasts)), 6),
        "average_realized_loss": round(float(np.mean(realized_losses)), 6),
    }


def _kupiec_lr(observations: int, exceptions: int, expected_rate: float) -> float:
    if observations == 0:
        return 0.0
    observed_rate = exceptions / observations
    if observed_rate <= 0 or observed_rate >= 1:
        observed_rate = min(max(observed_rate, 1e-12), 1 - 1e-12)
    expected_rate = min(max(expected_rate, 1e-12), 1 - 1e-12)
    log_unrestricted = exceptions * np.log(observed_rate) + (observations - exceptions) * np.log(1 - observed_rate)
    log_restricted = exceptions * np.log(expected_rate) + (observations - exceptions) * np.log(1 - expected_rate)
    return float(-2 * (log_restricted - log_unrestricted))


def _christoffersen_lr(exceptions: List[int]) -> float:
    if len(exceptions) < 2:
        return 0.0

    n00 = n01 = n10 = n11 = 0
    for previous, current in zip(exceptions[:-1], exceptions[1:]):
        if previous == 0 and current == 0:
            n00 += 1
        elif previous == 0 and current == 1:
            n01 += 1
        elif previous == 1 and current == 0:
            n10 += 1
        else:
            n11 += 1

    pi = (n01 + n11) / max(n00 + n01 + n10 + n11, 1)
    pi0 = n01 / max(n00 + n01, 1)
    pi1 = n11 / max(n10 + n11, 1)

    def log_likelihood(p0: float, p1: float | None = None) -> float:
        p0 = min(max(p0, 1e-12), 1 - 1e-12)
        if p1 is None:
            p1 = p0
        p1 = min(max(p1, 1e-12), 1 - 1e-12)
        return (
            n00 * np.log(1 - p0)
            + n01 * np.log(p0)
            + n10 * np.log(1 - p1)
            + n11 * np.log(p1)
        )

    independence_lr = -2 * (log_likelihood(pi) - log_likelihood(pi0, pi1))
    kupiec_transition_lr = _kupiec_lr(len(exceptions) - 1, n01 + n11, pi)
    return float(max(0.0, independence_lr + kupiec_transition_lr))


def detect_market_regime(weights: List[float], asset_returns: List[List[float]]) -> Dict[str, object]:
    """Classify market regime from realized trend, volatility, drawdown, and tail pressure."""
    returns = _portfolio_returns(weights, asset_returns)
    recent = returns[-30:] if returns.size >= 30 else returns
    longer = returns[-90:] if returns.size >= 90 else returns

    recent_return = float(np.prod(1 + recent) - 1) if recent.size else 0.0
    realized_vol = float(np.std(recent, ddof=1) * np.sqrt(252)) if recent.size > 1 else 0.0
    drawdown = _max_drawdown_from_returns(longer)
    tail_pressure = float(np.percentile(recent, 5)) if recent.size else 0.0

    raw_scores = {
        "bull": max(0.0, recent_return * 8 + (0.28 - realized_vol) * 2),
        "bear": max(0.0, -recent_return * 8 + abs(min(drawdown, 0)) * 3),
        "stressed": max(0.0, realized_vol * 2 + abs(min(tail_pressure, 0)) * 18 + abs(min(drawdown, 0)) * 2),
        "sideways": max(0.0, 1 - abs(recent_return) * 8 - realized_vol),
    }
    total = sum(raw_scores.values()) or 1.0
    probabilities = {key: round(value / total, 4) for key, value in raw_scores.items()}
    current = max(probabilities, key=probabilities.get)

    return {
        "current_regime": current,
        "probabilities": probabilities,
        "features": {
            "recent_30_period_return": round(recent_return, 6),
            "annualized_realized_volatility": round(realized_vol, 6),
            "rolling_drawdown": round(drawdown, 6),
            "tail_pressure_p5": round(tail_pressure, 6),
        },
        "model_version": "regime-classifier-v2.0.0",
        "method": "deterministic_feature_scoring",
    }


def optimize_portfolio(symbols: List[str], asset_returns: List[List[float]]) -> Dict[str, object]:
    """Return practical premium allocations: min variance, max Sharpe, and risk parity."""
    returns_matrix = np.array(asset_returns, dtype=np.float64).T
    covariance = np.cov(returns_matrix, rowvar=False)
    mean_returns = np.mean(returns_matrix, axis=0)
    n_assets = len(symbols)

    covariance = covariance + np.eye(n_assets) * 1e-6
    inv_cov = np.linalg.pinv(covariance)
    ones = np.ones(n_assets)

    min_variance = inv_cov @ ones
    min_variance = np.maximum(min_variance, 0)
    min_variance = min_variance / np.sum(min_variance) if np.sum(min_variance) else ones / n_assets

    excess = np.maximum(mean_returns, 0)
    max_sharpe = inv_cov @ excess if np.any(excess) else inv_cov @ mean_returns
    max_sharpe = np.maximum(max_sharpe, 0)
    max_sharpe = max_sharpe / np.sum(max_sharpe) if np.sum(max_sharpe) else ones / n_assets

    asset_vol = np.sqrt(np.diag(covariance))
    inverse_vol = 1 / np.maximum(asset_vol, 1e-6)
    risk_parity = inverse_vol / np.sum(inverse_vol)

    return {
        "min_variance": _format_weights(symbols, min_variance),
        "max_sharpe": _format_weights(symbols, max_sharpe),
        "risk_parity": _format_weights(symbols, risk_parity),
        "model_version": "optimizer-v2.0.0",
        "deterministic": True,
    }


def _format_weights(symbols: List[str], weights: np.ndarray) -> List[Dict[str, float | str]]:
    return [
        {"symbol": symbol.upper(), "weight": round(float(weight), 6)}
        for symbol, weight in zip(symbols, weights)
    ]
