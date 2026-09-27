"""Search the checked-in CRM help articles with permissions from the frontend role model."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path


KNOWLEDGE_PATH = Path(__file__).resolve().parents[1] / "assistant_knowledge.json"
STOP_WORDS = {
    "как", "какие", "какой", "какая", "где", "мне", "можно", "нужно", "надо", "это", "что",
    "чтобы", "через", "если", "для", "при", "или", "мои", "свои", "своих", "пожалуйста",
    "помоги", "подскажи", "показать", "сделать", "сделай", "системе", "работы",
}


@lru_cache(maxsize=1)
def knowledge() -> dict:
    return json.loads(KNOWLEDGE_PATH.read_text(encoding="utf-8"))


def _tokens(value: str) -> set[str]:
    words = re.findall(r"[a-zа-яё0-9]+", value.lower().replace("ё", "е"))
    return {word[:5] if len(word) > 5 else word for word in words if len(word) > 2 and word not in STOP_WORDS}


def _score(query: set[str], article: dict) -> int:
    if not query:
        return 0
    title = _tokens(article["title"])
    keywords = _tokens(" ".join(article["keywords"]))
    summary = _tokens(article["summary"])
    body = _tokens(" ".join(article["steps"] + article["tips"]))
    return sum(5 * (token in title) + 3 * (token in keywords) + 2 * (token in summary) + (token in body)
               for token in query)


def retrieve(question: str, role: str, limit: int = 2) -> tuple[list[dict], dict | None]:
    data = knowledge()
    grants = set(data["roles"].get(role, data["roles"]["manager"])["permissions"])
    query = _tokens(question)
    ranked = sorted(((score, article) for article in data["articles"]
                     if (score := _score(query, article)) >= 3), key=lambda item: item[0], reverse=True)
    allowed = [(score, article) for score, article in ranked if not article["permission"] or article["permission"] in grants]
    denied = [(score, article) for score, article in ranked if article["permission"] and article["permission"] not in grants]
    restricted = denied[0][1] if denied and denied[0][0] >= 7 and denied[0][0] > (allowed[0][0] if allowed else 0) else None
    minimum = max(5, allowed[0][0] - 3) if allowed else 5
    return [article for score, article in allowed if score >= minimum][:limit], restricted


def role_context(role: str, *, include_pages: bool = False) -> str:
    data = knowledge()
    info = data["roles"].get(role, data["roles"]["manager"])
    grants = set(info["permissions"])
    pages = ", ".join(page["label"] for page in data["pages"]
                      if not page["permission"] or page["permission"] in grants)
    return (f"Роль пользователя: {info['label']}. {info['description']}"
            + (f" Доступные разделы: {pages}." if include_pages else ""))


def allowed_pages(role: str) -> list[str]:
    data = knowledge()
    grants = set(data["roles"].get(role, data["roles"]["manager"])["permissions"])
    return [page["id"] for page in data["pages"]
            if not page["permission"] or page["permission"] in grants]


def navigation_target(message: str) -> dict | None:
    text = message.lower().replace("ё", "е").strip()
    if not re.match(r"^(открой|откройте|перейди|перейдите|зайди|зайдите)\b", text):
        return None
    tokens = re.findall(r"[a-zа-я0-9]+", text)
    for page in knowledge()["pages"]:
        for phrase in page["stems"]:
            parts = re.findall(r"[a-zа-я0-9]+", phrase.lower().replace("ё", "е"))
            if parts and all(any(token.startswith(part) for token in tokens) for part in parts):
                return page
    return None


def article_context(articles: list[dict], *, detailed: bool = False) -> str:
    chunks = []
    for article in articles:
        steps = " ".join(step.replace("**", "")[:170] for step in article["steps"][:5 if detailed else 4])
        tips = " ".join(tip[:140] for tip in article["tips"][:1]) if detailed else ""
        chunks.append(f"{article['title']}: {article['summary']} {steps} {tips}"[:1000 if detailed else 650])
    return "\n".join(chunks)


def access_denial(article: dict, role: str) -> str:
    data = knowledge()
    permitted = [info["label"].lower() for name, info in data["roles"].items()
                 if article["permission"] in info["permissions"] and name != role]
    owners = " и ".join(permitted)
    return (f"В вашей роли эта функция недоступна. Доступ к «{article['title']}» есть у {owners}. "
            "Попросите коллегу с нужными правами или администратора помочь.")
