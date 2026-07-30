from __future__ import annotations

from typing import Dict, List

import numpy as np


def _portfolio_returns(weights: List[float], asset_returns: List[List[float]]) -> np.ndarray:
    returns_matrix = np.array(asset_returns, dtype=np.float64)
    weights_array = np.array(weights, dtype=np.float64)
    return np.dot(weights_array, returns_matrix)


def _max_drawdown_from_returns(returns: np.ndarray) -> float:
    equity = np.cumprod(1 + returns)
    peaks = np.maximum.accumulate(equity)
    drawdowns = (equity - peaks) / peaks
    return float(np.min(drawdowns)) if drawdowns.size else 0.0


def calculate_tail_risk(weights: List[float], asset_returns: List[List[float]]) -> Dict[str, object]:
    """Premium tail metrics from historical simulation and deterministic stress shocks."""
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

    scenarios = {
        "rate_shock": -0.018,
        "equity_selloff": -0.055,
        "liquidity_gap": -0.032,
        "credit_spread_widening": -0.024,
    }

    return {
        "var_99": round(float(max(0.0, -var_99_threshold)), 6),
        "cvar_99": round(float(max(0.0, -np.mean(tail_99))) if tail_99.size else 0.0, 6),
        "var_975": round(float(max(0.0, -var_975_threshold)), 6),
        "downside_deviation": round(float(np.std(downside_returns, ddof=1)) if downside_returns.size > 1 else 0.0, 6),
        "max_drawdown": round(_max_drawdown_from_returns(returns), 6),
        "skewness": round(skewness, 6),
        "kurtosis": round(kurtosis, 6),
        "stress_scenarios": [
            {"name": name, "shock": shock, "estimated_loss": round(abs(shock), 6)}
            for name, shock in scenarios.items()
        ],
        "model": "historical-tail-risk-v1",
    }


def detect_market_regime(weights: List[float], asset_returns: List[List[float]]) -> Dict[str, object]:
    """Classify market regime from trend, realized volatility, and drawdown features."""
    returns = _portfolio_returns(weights, asset_returns)
    recent = returns[-30:] if returns.size >= 30 else returns
    longer = returns[-90:] if returns.size >= 90 else returns

    recent_return = float(np.prod(1 + recent) - 1) if recent.size else 0.0
    realized_vol = float(np.std(recent, ddof=1) * np.sqrt(252)) if recent.size > 1 else 0.0
    drawdown = _max_drawdown_from_returns(longer)

    stress_score = min(1.0, max(0.0, realized_vol / 0.45 + abs(min(drawdown, 0)) / 0.35))
    bull_score = min(1.0, max(0.0, recent_return / 0.12 + (0.25 - realized_vol) / 0.25))
    bear_score = min(1.0, max(0.0, -recent_return / 0.12 + abs(min(drawdown, 0)) / 0.25))
    sideways_score = min(1.0, max(0.0, 1 - abs(recent_return) / 0.08 - realized_vol / 0.6))

    raw_scores = {
        "bull": bull_score,
        "bear": bear_score,
        "stressed": stress_score,
        "sideways": sideways_score,
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
        },
        "model": "regime-classifier-v1",
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
        "model": "optimizer-v1",
    }


def _format_weights(symbols: List[str], weights: np.ndarray) -> List[Dict[str, float | str]]:
    return [
        {"symbol": symbol.upper(), "weight": round(float(weight), 6)}
        for symbol, weight in zip(symbols, weights)
    ]
