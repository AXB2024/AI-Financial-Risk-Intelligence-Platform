from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ml-service")

MODELS_AVAILABLE = True

try:
    from advanced_analytics import (
        backtest_var,
        calculate_factor_exposures,
        calculate_tail_risk,
        detect_market_regime,
        optimize_portfolio,
    )
    from anomaly import detect_anomaly
    from financial_lexicon_screen import screen_financial_news
    from risk_model import calculate_var_suite
except Exception as import_error:  # pragma: no cover - runtime fallback guard
    MODELS_AVAILABLE = False
    logger.warning("Model modules unavailable. Falling back to mock responses: %s", import_error)

    def calculate_var_suite(
        weights: List[float],
        asset_returns: List[List[float]],
        confidence: float = 0.95,
        method: str = "historical",
        seed: int = 1729,
        simulations: int = 20000,
    ) -> dict:
        return {
            "var_95": 0.021,
            "volatility": 0.014,
            "expected_shortfall": 0.029,
            "selected_method": method,
            "methods": {},
            "model_version": "mock-risk-var-suite",
            "deterministic_seed": seed,
            "mode": "mock",
            "confidence": confidence,
            "assets": len(weights),
            "periods": len(asset_returns[0]) if asset_returns else 0,
        }

    def detect_anomaly(series: List[float]) -> dict:
        return {
            "anomaly_score": 0.12,
            "is_anomaly": False,
            "z_score": 0.34,
            "mode": "mock",
            "points": len(series),
        }

    def calculate_tail_risk(
        weights: List[float],
        asset_returns: List[List[float]],
        historical_scenarios: List[dict] | None = None,
    ) -> dict:
        return {"var_99": 0.031, "cvar_99": 0.044, "max_drawdown": -0.12, "mode": "mock"}

    def calculate_factor_exposures(
        weights: List[float],
        asset_returns: List[List[float]],
        factor_returns: dict,
    ) -> dict:
        return {"exposures": [], "r_squared": 0, "mode": "mock"}

    def backtest_var(
        weights: List[float],
        asset_returns: List[List[float]],
        confidence: float = 0.95,
        window: int = 60,
    ) -> dict:
        return {"status": "mock", "exceptions": 0, "observations": 0}

    def detect_market_regime(weights: List[float], asset_returns: List[List[float]]) -> dict:
        return {"current_regime": "sideways", "probabilities": {"sideways": 1.0}, "mode": "mock"}

    def optimize_portfolio(symbols: List[str], asset_returns: List[List[float]]) -> dict:
        weight = round(1 / max(len(symbols), 1), 6)
        return {"risk_parity": [{"symbol": symbol.upper(), "weight": weight} for symbol in symbols], "mode": "mock"}

    def screen_financial_news(items: List[dict]) -> List[dict]:
        return [
            {
                "symbol": item.get("symbol", "").upper(),
                "score": 0.0,
                "label": "neutral",
                "confidence": 0.5,
                "themes": ["market"],
                "mode": "mock",
            }
            for item in items
        ]


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Startup log required for deployment checks and container health debugging.
    logger.info("ML Service Started Successfully")
    print("ML Service Started Successfully")
    yield

app = FastAPI(
    title="AI Financial Risk ML Service",
    version="1.0.0",
    description="ML microservice for VaR, anomaly detection, and lexicon-based news screening.",
    lifespan=lifespan,
)


class RiskRequest(BaseModel):
    confidence: float = Field(default=0.95, gt=0.5, lt=0.999)
    method: str = Field(default="historical")
    seed: int = Field(default=1729)
    simulations: int = Field(default=20000, ge=1000, le=500000)
    weights: List[float] = Field(min_length=1)
    asset_returns: List[List[float]] = Field(min_length=1)


class AnomalyRequest(BaseModel):
    series: List[float] = Field(min_length=4)


class LexiconScreenItem(BaseModel):
    symbol: str
    text: str
    source: str | None = None
    url: str | None = None
    published_at: str | None = None


class LexiconScreenRequest(BaseModel):
    items: List[LexiconScreenItem] = Field(min_length=1)


class AdvancedAnalyticsRequest(BaseModel):
    symbols: List[str] = Field(min_length=1)
    weights: List[float] = Field(min_length=1)
    asset_returns: List[List[float]] = Field(min_length=1)
    historical_scenarios: List[dict] = Field(default_factory=list)


class FactorExposureRequest(BaseModel):
    symbols: List[str] = Field(min_length=1)
    weights: List[float] = Field(min_length=1)
    asset_returns: List[List[float]] = Field(min_length=1)
    factor_returns: dict


class VarBacktestRequest(BaseModel):
    weights: List[float] = Field(min_length=1)
    asset_returns: List[List[float]] = Field(min_length=1)
    confidence: float = Field(default=0.95, gt=0.5, lt=0.999)
    window: int = Field(default=60, ge=30, le=500)


@app.get("/")
def root() -> dict:
    return {"status": "ML service running"}


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/risk")
def risk(payload: RiskRequest) -> dict:
    if len(payload.weights) != len(payload.asset_returns):
        raise HTTPException(
            status_code=400,
            detail="weights length must match number of asset return vectors",
        )

    lengths = {len(vector) for vector in payload.asset_returns}
    if len(lengths) != 1:
        raise HTTPException(status_code=400, detail="asset return vectors must have same length")

    weight_sum = sum(payload.weights)
    if abs(weight_sum - 1.0) > 1e-4:
        raise HTTPException(status_code=400, detail="weights must sum to 1.0")

    if next(iter(lengths)) < 30:
        raise HTTPException(status_code=400, detail="at least 30 periods required for VaR")

    result = calculate_var_suite(
        weights=payload.weights,
        asset_returns=payload.asset_returns,
        confidence=payload.confidence,
        method=payload.method,
        seed=payload.seed,
        simulations=payload.simulations,
    )
    if not MODELS_AVAILABLE:
        result["mode"] = "mock"
    return result


@app.post("/anomaly")
def anomaly(payload: AnomalyRequest) -> dict:
    result = detect_anomaly(payload.series)
    if not MODELS_AVAILABLE:
        result["mode"] = "mock"
    return result


@app.post("/advanced-risk")
def advanced_risk(payload: AdvancedAnalyticsRequest) -> dict:
    _validate_analytics_payload(payload)
    return calculate_tail_risk(
        weights=payload.weights,
        asset_returns=payload.asset_returns,
        historical_scenarios=payload.historical_scenarios,
    )


@app.post("/regime")
def regime(payload: AdvancedAnalyticsRequest) -> dict:
    _validate_analytics_payload(payload)
    return detect_market_regime(
        weights=payload.weights,
        asset_returns=payload.asset_returns,
    )


@app.post("/optimize")
def optimize(payload: AdvancedAnalyticsRequest) -> dict:
    _validate_analytics_payload(payload)
    return optimize_portfolio(
        symbols=payload.symbols,
        asset_returns=payload.asset_returns,
    )


@app.post("/factor-exposures")
def factor_exposures(payload: FactorExposureRequest) -> dict:
    _validate_factor_payload(payload)
    return calculate_factor_exposures(
        weights=payload.weights,
        asset_returns=payload.asset_returns,
        factor_returns=payload.factor_returns,
    )


@app.post("/var-backtest")
def var_backtest(payload: VarBacktestRequest) -> dict:
    _validate_returns_payload(payload.weights, payload.asset_returns, 90)
    return backtest_var(
        weights=payload.weights,
        asset_returns=payload.asset_returns,
        confidence=payload.confidence,
        window=payload.window,
    )


@app.post("/financial-lexicon-screen")
def financial_lexicon_screen(payload: LexiconScreenRequest) -> dict:
    items = [
        {
            "symbol": item.symbol,
            "text": item.text,
            "source": item.source,
            "url": item.url,
            "published_at": item.published_at,
        }
        for item in payload.items
    ]
    return {"results": screen_financial_news(items)}


def _validate_analytics_payload(payload: AdvancedAnalyticsRequest) -> None:
    if len(payload.weights) != len(payload.asset_returns) or len(payload.symbols) != len(payload.weights):
        raise HTTPException(
            status_code=400,
            detail="symbols, weights, and asset return vectors must have matching lengths",
        )

    lengths = {len(vector) for vector in payload.asset_returns}
    if len(lengths) != 1:
        raise HTTPException(status_code=400, detail="asset return vectors must have same length")

    if next(iter(lengths)) < 30:
        raise HTTPException(status_code=400, detail="at least 30 periods required for premium analytics")

    if abs(sum(payload.weights) - 1.0) > 1e-4:
        raise HTTPException(status_code=400, detail="weights must sum to 1.0")


def _validate_factor_payload(payload: FactorExposureRequest) -> None:
    if len(payload.weights) != len(payload.asset_returns) or len(payload.symbols) != len(payload.weights):
        raise HTTPException(
            status_code=400,
            detail="symbols, weights, and asset return vectors must have matching lengths",
        )
    _validate_returns_payload(payload.weights, payload.asset_returns, 30)


def _validate_returns_payload(weights: List[float], asset_returns: List[List[float]], min_periods: int) -> None:
    if len(weights) != len(asset_returns):
        raise HTTPException(status_code=400, detail="weights length must match number of return vectors")

    lengths = {len(vector) for vector in asset_returns}
    if len(lengths) != 1:
        raise HTTPException(status_code=400, detail="asset return vectors must have same length")

    if next(iter(lengths)) < min_periods:
        raise HTTPException(status_code=400, detail=f"at least {min_periods} periods required")

    if abs(sum(weights) - 1.0) > 1e-4:
        raise HTTPException(status_code=400, detail="weights must sum to 1.0")
