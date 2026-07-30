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
    from advanced_analytics import calculate_tail_risk, detect_market_regime, optimize_portfolio
    from anomaly import detect_anomaly
    from financial_sentiment import analyze_financial_sentiment
    from risk_model import calculate_historical_var
    from sentiment import analyze_sentiment
except Exception as import_error:  # pragma: no cover - runtime fallback guard
    MODELS_AVAILABLE = False
    logger.warning("Model modules unavailable. Falling back to mock responses: %s", import_error)

    def calculate_historical_var(
        weights: List[float],
        asset_returns: List[List[float]],
        confidence: float = 0.95,
    ) -> dict:
        return {
            "var_95": 0.021,
            "volatility": 0.014,
            "expected_shortfall": 0.029,
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

    def analyze_sentiment(items: List[dict]) -> List[dict]:
        return [
            {"symbol": item.get("symbol", "").upper(), "score": 0.15, "label": "neutral", "mode": "mock"}
            for item in items
        ]

    def calculate_tail_risk(weights: List[float], asset_returns: List[List[float]]) -> dict:
        return {"var_99": 0.031, "cvar_99": 0.044, "max_drawdown": -0.12, "mode": "mock"}

    def detect_market_regime(weights: List[float], asset_returns: List[List[float]]) -> dict:
        return {"current_regime": "sideways", "probabilities": {"sideways": 1.0}, "mode": "mock"}

    def optimize_portfolio(symbols: List[str], asset_returns: List[List[float]]) -> dict:
        weight = round(1 / max(len(symbols), 1), 6)
        return {"risk_parity": [{"symbol": symbol.upper(), "weight": weight} for symbol in symbols], "mode": "mock"}

    def analyze_financial_sentiment(items: List[dict]) -> List[dict]:
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
    description="ML microservice for VaR, anomaly detection, and sentiment scoring.",
    lifespan=lifespan,
)


class RiskRequest(BaseModel):
    confidence: float = Field(default=0.95, gt=0.5, lt=0.999)
    weights: List[float] = Field(min_length=1)
    asset_returns: List[List[float]] = Field(min_length=1)


class AnomalyRequest(BaseModel):
    series: List[float] = Field(min_length=4)


class SentimentItem(BaseModel):
    symbol: str
    text: str
    source: str | None = None
    url: str | None = None
    published_at: str | None = None


class SentimentRequest(BaseModel):
    items: List[SentimentItem] = Field(min_length=1)


class AdvancedAnalyticsRequest(BaseModel):
    symbols: List[str] = Field(min_length=1)
    weights: List[float] = Field(min_length=1)
    asset_returns: List[List[float]] = Field(min_length=1)


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

    result = calculate_historical_var(
        weights=payload.weights,
        asset_returns=payload.asset_returns,
        confidence=payload.confidence,
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


@app.post("/sentiment")
def sentiment(payload: SentimentRequest) -> dict:
    items = [{"symbol": item.symbol, "text": item.text} for item in payload.items]
    results = analyze_sentiment(items)
    return {"results": results}


@app.post("/advanced-risk")
def advanced_risk(payload: AdvancedAnalyticsRequest) -> dict:
    _validate_analytics_payload(payload)
    return calculate_tail_risk(
        weights=payload.weights,
        asset_returns=payload.asset_returns,
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


@app.post("/financial-sentiment")
def financial_sentiment(payload: SentimentRequest) -> dict:
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
    return {"results": analyze_financial_sentiment(items)}


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
