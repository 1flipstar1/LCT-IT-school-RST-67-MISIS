"""Local Ollama assistant: answers questions or picks one action for the browser to execute.

The model never touches data. It either replies with text or returns a tool call; the frontend
resolves names against catalogs, checks the user's rights and executes the action itself.
"""

from __future__ import annotations

import json
import re
from datetime import date
from typing import Any, get_args

import httpx

from app.core.config import settings
from app.core.errors import APIError
from app.schemas.assistant import ActionName, AssistantAction, AssistantStatus, ChatRequest, ChatResponse
from app.services.assistant_knowledge import access_denial, allowed_pages, article_context, navigation_target, retrieve, role_context


PAGE_NAMES = {
    "dashboard": "Дашборд",
    "profile": "Настройки профиля",
    "interactions": "Взаимодействия",
    "analytics": "Аналитика",
    "reports": "Отчёты",
    "catalogs": "Справочники",
    "workflows": "Этапы работы",
    "integrations": "Интеграции",
    "users": "Пользователи и доступ",
    "audit": "Журнал действий",
    "help": "Справка",
    "other": "другой раздел",
}

REPORT_GUIDE = (
    "Отчёты создаются в разделе «Отчёты»: выберите период и при необходимости "
    "вузы, направления, продукты и ответственных; отметьте колонки и формат "
    "XLSX, XLS или PDF; нажмите «Скачать». Файл сохранится на компьютер, "
    "а запись появится в истории отчётов. Повторное скачивание собирает файл "
    "по актуальным данным."
)

TRANSITION_RULES = (
    "В карточке взаимодействия этап меняют через «Сменить этап». Вперёд можно "
    "перейти на следующий этап; комментарий и файлы по желанию. Пропустить можно "
    "только необязательный этап, с обязательным комментарием. Возврат возможен "
    "на предыдущий этап, тоже с обязательным комментарием. С последнего этапа "
    "взаимодействие завершается. Подсказка «ожидается файл» описывает результат "
    "этапа, но сама по себе не делает файл обязательным для перехода."
)

DETAIL_RULES = {
    "short": "Ответь одним абзацем, максимум двумя предложениями, без списка и нумерации. Закончи мысль.",
    "detailed": "Отвечай подробно: по шагам, с пояснением, где находится каждая кнопка.",
}

_NAMES = {"type": "array", "items": {"type": "string"}}
_FILTER_PROPERTIES: dict[str, Any] = {
    "universities": {**_NAMES, "description": "Вузы: полные или краткие названия, как назвал пользователь"},
    "directions": {**_NAMES, "description": "ИТ-направления"},
    "products": {**_NAMES, "description": "ИТ-продукты"},
    "programs": {**_NAMES, "description": "ИТ-программы"},
    "managers": {**_NAMES, "description": "Ответственные: фамилия или имя и фамилия"},
    "stages": {**_NAMES, "description": "Этапы работы"},
    "period": {"type": "string", "enum": ["all", "30d", "90d", "365d"], "description": "Готовый период: 30d — месяц, 90d — 3 месяца, 365d — год"},
    "date_from": {"type": "string", "description": "Начало периода, YYYY-MM-DD"},
    "date_to": {"type": "string", "description": "Конец периода, YYYY-MM-DD"},
    "only_attention": {"type": "boolean", "description": "Только просроченные и со сроком в ближайшие дни"},
}
_TARGET_PROPERTIES = {key: _FILTER_PROPERTIES[key] for key in ("universities", "directions", "products", "managers")}


def _tool(name: str, description: str, properties: dict[str, Any], required: list[str] | None = None) -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {"type": "object", "properties": properties, "required": required or []},
        },
    }


TOOLS = [
    _tool(
        "create_report",
        "Сформировать файл отчёта по взаимодействиям с вузами. Вызывай, когда просят сделать, выгрузить или скачать отчёт.",
        {
            **_FILTER_PROPERTIES,
            "format": {"type": "string", "enum": ["xlsx", "xls", "pdf"]},
            "columns": {
                "type": "array",
                "items": {
                    "type": "string",
                    "enum": ["university", "direction", "program", "product", "stage", "manager", "vendor", "contract", "licenseSignedAt", "licenseYears", "transferStatus", "startedAt"],
                },
                "description": "Колонки, только если пользователь их назвал",
            },
            "name": {"type": "string", "description": "Название отчёта, только если пользователь его задал"},
        },
    ),
    _tool("repeat_last_report", "Скачать заново последний сформированный отчёт.", {}),
    _tool("find_interactions", "Найти и показать взаимодействия с вузами по условиям.", _FILTER_PROPERTIES),
    _tool("show_stats", "Показать сводку: сколько взаимодействий, в работе, просрочено, по фазам.", _FILTER_PROPERTIES),
    _tool(
        "open_page",
        "Открыть раздел приложения.",
        {"page": {"type": "string", "enum": ["dashboard", "interactions", "board", "analytics", "reports", "catalogs", "import", "workflows", "integrations", "users", "audit", "help"]}},
        ["page"],
    ),
    _tool("open_interaction", "Открыть карточку взаимодействия конкретного вуза.", _TARGET_PROPERTIES),
    _tool(
        "change_stage",
        "Перевести взаимодействие вуза на другой этап. Пользователь подтвердит действие в интерфейсе.",
        {
            **_TARGET_PROPERTIES,
            "move": {"type": "string", "enum": ["next", "back", "skip"], "description": "next — вперёд, back — вернуть на доработку, skip — пропустить необязательный"},
            "comment": {"type": "string"},
        },
        ["move"],
    ),
    _tool(
        "interaction_details",
        "Сводка по взаимодействию вуза: этап, срок, ответственный, договор, последние события, следующий шаг. "
        "Вызывай на «как дела у…», «что с…», «статус…», «расскажи про…».",
        _TARGET_PROPERTIES,
    ),
    _tool("university_contacts", "Контакты представителей вуза: ФИО, должность, почта, телефон.", {"universities": _FILTER_PROPERTIES["universities"]}, ["universities"]),
    _tool("manager_workload", "Нагрузка по ответственным: сколько взаимодействий в работе и просрочено у каждого.", _FILTER_PROPERTIES),
    _tool("daily_plan", "План на день для пользователя: просроченные и срочные этапы и с чего начать.", {}),
    _tool(
        "add_comment",
        "Добавить комментарий к взаимодействию вуза. Пользователь подтвердит действие в интерфейсе.",
        {**_TARGET_PROPERTIES, "text": {"type": "string", "description": "Текст комментария"}},
        ["text"],
    ),
]

ACTION_NAMES = set(get_args(ActionName))
TOOL_BY_NAME = {tool["function"]["name"]: tool for tool in TOOLS}


def _report_tool(message: str) -> dict:
    """Only expose report arguments mentioned in this request; the browser resolves filters too."""
    fields = {"universities", "format"}
    optional = {
        "directions": ("направлен",),
        "products": ("продукт",),
        "programs": ("программ",),
        "managers": ("ответствен", "менеджер"),
        "stages": ("этап",),
        "period": ("месяц", "квартал", "год", "дн", "недел"),
        "date_from": ("дат", "числ", "."),
        "date_to": ("дат", "числ", "."),
        "only_attention": ("просроч", "срочн"),
        "columns": ("колонк", "столбц", "полей"),
        "name": ("назови", "название", "именем"),
    }
    for field, words in optional.items():
        if any(word in message for word in words):
            fields.add(field)
    original = TOOL_BY_NAME["create_report"]["function"]["parameters"]["properties"]
    properties = {key: {part: value for part, value in original[key].items() if part != "description"}
                  for key in fields}
    return _tool("create_report", "Сформировать и скачать отчёт.", properties)


def _tools_for(message: str, role: str = "manager") -> list[dict]:
    """Send only relevant schemas so a small CPU model can answer before the browser times out."""
    text = message.lower().replace("ё", "е")
    if any(word in text for word in ("открой", "перейди", "зайди")):
        names = ("open_page", "open_interaction") if ("карточ" in text or "вуз" in text or re.search(r"\b[А-ЯЁ]{2,}\b", message)) else ("open_page",)
    elif any(word in text for word in ("отчет", "pdf", "excel", "xlsx", "xls", "выгруз", "скача")):
        if any(word in text for word in ("повтор", "последн", "заново")):
            return [TOOL_BY_NAME["repeat_last_report"]]
        return [_report_tool(text)]
    elif any(word in text for word in ("комментар", "примечан")):
        names = ("add_comment", "open_interaction")
    elif any(word in text for word in ("этап", "перевед", "пропуст", "доработ")):
        names = ("change_stage", "open_interaction", "interaction_details")
    elif any(word in text for word in ("контакт", "телефон", "почт")):
        names = ("university_contacts", "open_interaction")
    elif any(word in text for word in ("статист", "сколько", "нагрузк", "просроч", "план на день")):
        names = ("show_stats", "manager_workload", "daily_plan", "find_interactions")
    elif any(word in text for word in ("как дела", "что с ", "статус вуза")):
        names = ("interaction_details", "open_interaction")
    elif any(word in text for word in ("найди", "покажи", "список", "взаимодейств")):
        names = ("find_interactions", "open_interaction", "interaction_details")
    else:
        # Questions without an action verb need a text answer, not twelve tool schemas.
        if not any(word in text for word in ("сделай", "создай", "выполни", "открой", "дай ", "выведи")):
            return []
        names = ("find_interactions", "show_stats", "open_page", "create_report")
    selected = [TOOL_BY_NAME[name] for name in names]
    return [
        _tool("open_page", "Открыть доступный раздел CRM.",
              {"page": {"type": "string", "enum": allowed_pages(role)}}, ["page"])
        if tool["function"]["name"] == "open_page" else tool
        for tool in selected
    ]

# Помощник работает только с CRM. Очевидно посторонние запросы отсекаются до модели: так маленькая
# модель не решает примеры и не пишет код. Правила совпадают с frontend/.../engine/scope.js.
OFF_TOPIC = [
    re.compile(r"^[\s\d+\-*/×÷^().,=?%]*\d\s*[+\-*/×÷^%]\s*\d[\s\d+\-*/×÷^().,=?%]*$"),
    re.compile(r"сколько будет\s*\d|(реши|вычисли|посчитай)\s+(\d|уравнен|пример|задач|интеграл)|корень из|факториал|интеграл|производн"),
    re.compile(r"(python|питон|javascript|джаваскрипт|typescript|golang|kotlin|c\+\+|c#|php|регулярн[а-я]* выражен|regex)"),
    re.compile(r"(напиши|сгенерируй|создай|покажи|дай)\s+(мне\s+)?(код|скрипт|функци|класс|алгоритм|программу на|sql[- ]запрос)"),
    re.compile(r"(погод|анекдот|шутк|рецепт|стих|сочини|песн|гороскоп|курс (доллар|евро|валют|биткоин|рубл)|фильм|сериал|футбол|сочинени|реферат|эссе|переведи на (англ|немец|франц|китай)|translate)"),
]

OUT_OF_SCOPE = (
    "Я помогаю только с работой в системе ИТ Школы Ростелекома: отчёты, взаимодействия с вузами, "
    "этапы, статистика, контакты и справка. С этим вопросом не подскажу."
)

PHASE_LABELS = {
    "acquaintance": "Знакомство",
    "contract": "Договор",
    "rollout": "Внедрение",
    "teaching": "Обучение",
}


def _stage_overview(state: dict) -> str:
    workflows = state.get("workflows") or []
    if not workflows:
        return "Набор этапов пока не настроен."
    stages = workflows[0].get("stages") or []
    groups: dict[str, list[str]] = {}
    for stage in stages:
        if not isinstance(stage, dict):
            continue
        label = PHASE_LABELS.get(stage.get("phase"), str(stage.get("phase") or "Другая фаза"))
        name = str(stage.get("name") or "Этап")
        groups.setdefault(label, []).append(name + (" (необязательный)" if stage.get("optional") else ""))
    sections = " ".join(f"{phase}: {', '.join(names)}." for phase, names in groups.items())
    return f"Сейчас работа с вузом состоит из {len(stages)} этапов в {len(groups)} фазах. {sections}"


def is_out_of_scope(message: str) -> bool:
    text = message.lower().replace("ё", "е").strip()
    return any(pattern.search(text) for pattern in OFF_TOPIC)


def _names(items: object, *, key: str = "name", limit: int = 60) -> str:
    if not isinstance(items, list):
        return "—"
    names = []
    for item in items[:limit]:
        if not isinstance(item, dict) or not isinstance(item.get(key), str):
            continue
        name = item[key][:100]
        short = item.get("shortName")
        names.append(f"{name} ({short[:40]})" if isinstance(short, str) and short and short != name else name)
    return ", ".join(names) or "—"


def _workflow_context(state: dict) -> str:
    workflows = state.get("workflows", [])
    lines: list[str] = []
    for workflow in workflows[:4]:
        if not isinstance(workflow, dict):
            continue
        lines.append(f"Процесс: {str(workflow.get('name', 'Без названия'))[:100]}")
        for index, stage in enumerate(workflow.get("stages", [])[:30], start=1):
            if not isinstance(stage, dict):
                continue
            details = [f"{index}. {str(stage.get('name', 'Этап'))[:100]}"]
            if stage.get("optional"):
                details.append("необязательный")
            lines.append("; ".join(details))
    return "\n".join(lines) or "Сведения об этапах пока отсутствуют."


def _system_prompt(state: dict, payload: ChatRequest, role: str, articles: list[dict]) -> str:
    question = payload.message.lower()
    explanation = payload.mode == "guide" or _is_explanation(question)
    needs_stages = explanation and any(word in question for word in ("этап", "процесс", "переход", "внедрен", "обучен"))
    needs_transitions = explanation and (
        ("этап" in question and any(word in question for word in ("смен", "переход", "пропус", "верну", "назад", "перевед")))
        or any(word in question for word in ("пропус", "назад", "переход между"))
    )
    if payload.mode == "agent":
        role_instruction = (
            "Ты помощник CRM «ИТ Школа Ростелекома». Для действия вызови один инструмент; "
            "для вопроса дай словесный ответ. Аргументы бери из запроса."
        )
    else:
        role_instruction = (
            "Ты помощник CRM «ИТ Школа Ростелекома». Объясняй, как выполнить действие в интерфейсе."
        )
    return (
        f"{role_instruction}\n"
        "Отвечай по-русски своими словами, прямо и по делу. Описывай только функции из справки и доступные роли. "
        "Не придумывай кнопки и факты; при отсутствии сведений спроси уточнение. "
        f"{DETAIL_RULES[payload.detail]}\n"
        f"Сегодня {date.today().isoformat()}; раздел: {PAGE_NAMES[payload.page]}.\n"
        f"{role_context(role, include_pages=not articles and explanation)}\n"
        + (f"Справка CRM:\n{article_context(articles, detailed=payload.detail == 'detailed')}\n" if articles else "")
        + ("Помощник умеет открывать разделы, искать взаимодействия, показывать сводки, контакты и статистику, "
           "создавать отчёты, предлагать смену этапа и комментарии. Настройки CRM и сотрудников он только объясняет.\n"
           if not articles else "")
        + (f"Правила переходов: {TRANSITION_RULES}\n" if needs_transitions else "")
        + (f"Работа с отчётами: {REPORT_GUIDE}\n" if not articles and explanation and ("отчёт" in question or "отчет" in question) else "")
        + (f"Актуальные этапы:\n{_workflow_context(state)}" if needs_stages else "")
    )


def _is_explanation(message: str) -> bool:
    text = message.strip().lower()
    return ((text.startswith(("как ", "какие ", "объясни ", "расскажи ", "что ты умеешь"))
             or text.startswith(("что делать на этапе", "что нужно на этапе", "что означает этап", "что значит этап"))
             or "можешь помочь" in text
             or "что ты можешь" in text
             or "что умеешь" in text)
            and not text.startswith(("как дела", "расскажи про")))


def _parse_action(message: dict) -> AssistantAction | None:
    for call in message.get("tool_calls") or []:
        function = call.get("function") if isinstance(call, dict) else None
        if not isinstance(function, dict) or function.get("name") not in ACTION_NAMES:
            continue
        arguments = function.get("arguments") or {}
        if isinstance(arguments, str):
            try:
                arguments = json.loads(arguments)
            except ValueError:
                arguments = {}
        return AssistantAction(name=function["name"], arguments=arguments if isinstance(arguments, dict) else {})
    return None


def _require_enabled() -> None:
    if not settings.assistant_enabled:
        raise APIError(503, "assistant_disabled", "Помощник сейчас отключён.")


async def chat(payload: ChatRequest, state: dict, role: str = "manager") -> ChatResponse:
    _require_enabled()
    if is_out_of_scope(payload.message):
        return ChatResponse(message=OUT_OF_SCOPE)

    question = payload.message.lower().replace("ё", "е")
    if re.match(r"^(?:(?:какие|перечисли|назови|покажи)\s+этапы|(?:список|перечень)\s+этапов)", question):
        return ChatResponse(message=_stage_overview(state))
    if re.search(r"удал[а-я]*\s+(?:\w+\s+){0,2}(?:сотрудник|пользовател|менеджер|человек)", question):
        return ChatResponse(message="Удаление сотрудников в CRM не предусмотрено. Руководитель может заблокировать менеджера своей команды, администратор — управлять доступом всех сотрудников.")
    page = navigation_target(payload.message)
    if page:
        if page["id"] not in allowed_pages(role):
            return ChatResponse(message=f"Раздел «{page['label']}» недоступен для вашей роли.")
        return ChatResponse(type="action", action=AssistantAction(name="open_page", arguments={"page": page["id"]}))
    articles, restricted = retrieve(payload.message, role)
    if restricted:
        return ChatResponse(message=access_denial(restricted, role))

    messages = [{"role": "system", "content": _system_prompt(state, payload, role, articles)}]
    messages.extend({"role": turn.role, "content": turn.content[:500]} for turn in payload.history[-4:])
    messages.append({"role": "user", "content": payload.message.strip()})

    request: dict[str, Any] = {
        "model": settings.ollama_model,
        "messages": messages,
        "stream": False,
        "think": False,
        "options": {
            "num_predict": 220 if payload.detail == "detailed" else 115,
            "num_ctx": settings.assistant_context_tokens,
            "num_thread": 2,
            "temperature": 0.35,
        },
        "keep_alive": -1,
    }
    if payload.mode == "agent" and not _is_explanation(payload.message):
        relevant_tools = _tools_for(payload.message, role)
        if relevant_tools:
            request["tools"] = relevant_tools

    try:
        async with httpx.AsyncClient(timeout=settings.assistant_timeout_seconds, trust_env=False) as client:
            response = await client.post(f"{settings.ollama_base_url.rstrip('/')}/api/chat", json=request)
            response.raise_for_status()
            result = response.json()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise APIError(503, "assistant_model_missing", "Локальная модель помощника не установлена.") from exc
        raise APIError(503, "assistant_unavailable", "Помощник временно недоступен.") from exc
    except (httpx.RequestError, ValueError) as exc:
        raise APIError(503, "assistant_unavailable", "Помощник временно недоступен.") from exc

    response_message = result.get("message") if isinstance(result, dict) else None
    if not isinstance(response_message, dict):
        response_message = {}
    content = response_message.get("content")
    text = content.strip() if isinstance(content, str) else ""

    action = _parse_action(response_message) if payload.mode == "agent" else None
    if action:
        if action.name == "open_page" and action.arguments.get("page") not in allowed_pages(role):
            return ChatResponse(message="Этот раздел недоступен для вашей роли.")
        return ChatResponse(type="action", message=text, action=action)
    if not text:
        raise APIError(502, "assistant_empty_response", "Помощник не смог подготовить ответ. Попробуйте ещё раз.")
    return ChatResponse(message=text)


async def status() -> AssistantStatus:
    """Is the configured model pulled and reachable? Used by the chat header and the offline fallback."""

    if not settings.assistant_enabled:
        return AssistantStatus(enabled=False, available=False, model=settings.ollama_model)
    try:
        async with httpx.AsyncClient(timeout=3, trust_env=False) as client:
            response = await client.get(f"{settings.ollama_base_url.rstrip('/')}/api/tags")
            response.raise_for_status()
            models = response.json().get("models", [])
    except (httpx.HTTPError, ValueError, AttributeError):
        return AssistantStatus(enabled=True, available=False, model=settings.ollama_model)

    wanted = settings.ollama_model if ":" in settings.ollama_model else f"{settings.ollama_model}:latest"
    names = {model.get("name") for model in models if isinstance(model, dict)}
    return AssistantStatus(enabled=True, available=wanted in names, model=settings.ollama_model)
