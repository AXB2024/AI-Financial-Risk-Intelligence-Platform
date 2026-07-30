from __future__ import annotations

import re
from math import sqrt
from typing import Dict, List

POSITIVE_TERMS = {
    "upgrade",
    "outperform",
    "beats",
    "record",
    "margin expansion",
    "free cash flow",
    "guidance raised",
    "buyback",
    "demand growth",
    "profitability",
}

NEGATIVE_TERMS = {
    "downgrade",
    "misses",
    "guidance cut",
    "margin pressure",
    "liquidity risk",
    "default",
    "investigation",
    "fraud",
    "layoffs",
    "demand slowdown",
}

RISK_THEMES = {
    "liquidity": {"liquidity", "cash burn", "funding", "refinancing"},
    "credit": {"default", "debt", "spread", "rating", "covenant"},
    "regulatory": {"regulator", "investigation", "fine", "antitrust", "compliance"},
    "earnings": {"earnings", "guidance", "margin", "revenue", "profit"},
    "macro": {"rates", "inflation", "fx", "recession", "tariff"},
}


def analyze_financial_sentiment(items: List[Dict[str, str]]) -> List[Dict[str, object]]:
    results: List[Dict[str, object]] = []

    for item in items:
        text = item.get("text", "")
        lower = text.lower()
        tokens = re.findall(r"[a-zA-Z']+", lower)
        positive = sum(1 for term in POSITIVE_TERMS if term in lower)
        negative = sum(1 for term in NEGATIVE_TERMS if term in lower)
        raw = positive - negative
        score = 0.0 if not tokens else raw / sqrt(len(tokens))
        label = "positive" if score > 0.08 else "negative" if score < -0.08 else "neutral"
        themes = [
            theme
            for theme, terms in RISK_THEMES.items()
            if any(term in lower for term in terms)
        ]

        confidence = min(0.95, 0.45 + (positive + negative + len(themes)) * 0.08)

        results.append(
            {
                "symbol": item.get("symbol", "").upper(),
                "score": round(float(score), 6),
                "label": label,
                "confidence": round(confidence, 4),
                "themes": themes or ["market"],
                "source": item.get("source", "mock-news"),
                "url": item.get("url"),
                "published_at": item.get("published_at"),
                "model": "financial-sentiment-v1",
            }
        )

    return results
