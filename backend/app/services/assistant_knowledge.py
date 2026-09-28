"""Поиск по статьям справки CRM с учётом прав ролей (данные выгружаются из фронтенда)."""

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


def _role(role: str) -> dict:
    data = knowledge()
    return data["roles"].get(role, data["roles"]["manager"])


def _allowed(article_or_page: dict, grants: set[str]) -> bool:
    return not article_or_page["permission"] or article_or_page["permission"] in grants


def _tokens(value: str) -> set[str]:
    """Слова запроса без предлогов и «как/где». Первые 5 букв — грубый стемминг: «отчёт», «отчёты»,
    «отчётов» совпадают без морфологического словаря."""

    words = re.findall(r"[a-zа-яё0-9]+", value.lower().replace("ё", "е"))
    return {word[:5] if len(word) > 5 else word for word in words if len(word) > 2 and word not in STOP_WORDS}


def _score(query: set[str], article: dict) -> int:
    """Совпадение в заголовке весит больше всего, затем ключевые слова, описание и текст шагов."""

    if not query:
        return 0
    title = _tokens(article["title"])
    keywords = _tokens(" ".join(article["keywords"]))
    summary = _tokens(article["summary"])
    body = _tokens(" ".join(article["steps"] + article["tips"]))
    return sum(5 * (token in title) + 3 * (token in keywords) + 2 * (token in summary) + (token in body)
               for token in query)


def retrieve(question: str, role: str, limit: int = 2) -> tuple[list[dict], dict | None]:
    """Статьи справки для ответа модели и, если вопрос явно о закрытой для роли функции, эта статья.

    Отбор: сначала всё с оценкой от 3, затем доступные роли статьи не хуже лучшей минус 3 (но не ниже 5) —
    так в контекст модели не попадают случайные слабые совпадения. Закрытая статья возвращается отдельно,
    только если она подходит заметно (от 7) и лучше любой доступной: тогда помощник честно скажет «нет прав».
    """

    data = knowledge()
    grants = set(_role(role)["permissions"])
    query = _tokens(question)
    ranked = sorted(((score, article) for article in data["articles"]
                     if (score := _score(query, article)) >= 3), key=lambda item: item[0], reverse=True)
    allowed = [(score, article) for score, article in ranked if _allowed(article, grants)]
    denied = [(score, article) for score, article in ranked if not _allowed(article, grants)]
    restricted = denied[0][1] if denied and denied[0][0] >= 7 and denied[0][0] > (allowed[0][0] if allowed else 0) else None
    minimum = max(5, allowed[0][0] - 3) if allowed else 5
    return [article for score, article in allowed if score >= minimum][:limit], restricted


def role_context(role: str, *, include_pages: bool = False) -> str:
    info = _role(role)
    grants = set(info["permissions"])
    pages = ", ".join(page["label"] for page in knowledge()["pages"] if _allowed(page, grants))
    return (f"Роль пользователя: {info['label']}. {info['description']}"
            + (f" Доступные разделы: {pages}." if include_pages else ""))


def allowed_pages(role: str) -> list[str]:
    grants = set(_role(role)["permissions"])
    return [page["id"] for page in knowledge()["pages"] if _allowed(page, grants)]


def navigation_target(message: str) -> dict | None:
    """«Открой отчёты» → страница, если каждое слово её фразы-основы есть в запросе как начало слова."""

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
    """Выжимка статей для промпта маленькой локальной модели: контекст у неё 2048 токенов, поэтому
    кратко — первые шаги и последний, по первому предложению; подробно — до пяти шагов и совет."""

    chunks = []
    for article in articles:
        source_steps = article["steps"][:5] if detailed else (article["steps"][:2] + article["steps"][-1:] if len(article["steps"]) > 2 else article["steps"])
        if detailed:
            steps = " ".join(step.replace("**", "")[:170] for step in source_steps)
        else:
            brief = []
            for step in source_steps:
                clean = re.sub(r"^Шаг\s+\d+\.\s*", "", step.replace("**", ""))
                brief.append(re.split(r"(?<=[.!?])\s+", clean, maxsplit=1)[0])
            steps = " ".join(brief)
        tips = " ".join(tip[:140] for tip in article["tips"][:1]) if detailed else ""
        chunks.append(f"{article['title']}: {article['summary'][:150]} {steps} {tips}"[:1000 if detailed else 600])
    return "\n".join(chunks)


def access_denial(article: dict, role: str) -> str:
    data = knowledge()
    role_genitive = {"manager": "менеджера", "lead": "руководителя", "admin": "администратора"}
    permitted = [role_genitive[name] for name, info in data["roles"].items()
                 if article["permission"] in info["permissions"] and name != role]
    owners = " и ".join(permitted)
    return (f"В вашей роли эта функция недоступна. Доступ к «{article['title']}» есть у {owners}. "
            "Попросите коллегу с нужными правами или администратора помочь.")
