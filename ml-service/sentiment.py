from __future__ import annotations

from math import sqrt
import re
from typing import Dict, List

POSITIVE_WORDS = {
    "growth",
    "strong",
    "record",
    "expands",
    "improved",
    "optimism",
    "beats",
    "recovery",
    "elevated",
    "efficiency",
    "profit",
}

NEGATIVE_WORDS = {
    "soften",
    "pressured",
    "bottlenecks",
    "risk",
    "decline",
    "drop",
    "concern",
    "weak",
    "volatility",
    "regulators",
    "competition",
}


def _tokenize(text: str) -> List[str]:
    return re.findall(r"[a-zA-Z']+", text.lower())


def _score_text(text: str) -> float:
    tokens = _tokenize(text)
    if not tokens:
        return 0.0

    positive = sum(1 for token in tokens if token in POSITIVE_WORDS)
    negative = sum(1 for token in tokens if token in NEGATIVE_WORDS)

    raw_score = positive - negative
    normalized = raw_score / sqrt(len(tokens))

    return round(float(normalized), 6)


def _label(score: float) -> str:
    if score > 0.2:
        return "positive"
    if score < -0.2:
        return "negative"
    return "neutral"


def analyze_sentiment(items: List[Dict[str, str]]) -> List[Dict[str, str | float]]:
    results: List[Dict[str, str | float]] = []

    for item in items:
        score = _score_text(item["text"])
        results.append(
            {
                "symbol": item["symbol"].upper(),
                "score": score,
                "label": _label(score),
            }
        )

    return results
