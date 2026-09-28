"""Модель архитектуры CRM для Archi (ТЗ, требования к решению, п. 7: «функциональная и компонентная архитектура в Archi»).

Генерирует docs/architecture/rtk-it-school.archimate — родной формат Archi 4/5 (File → Open).
Модель описана здесь данными, поэтому её легко поддерживать вместе с кодом: python3 docs/architecture/generate_archi.py

Представления:
  1. «Функциональная архитектура» — роли, бизнес-процессы ТЗ и прикладные сервисы, которые их поддерживают.
  2. «Компонентная архитектура» — компоненты, хранилища, внешние системы, инфраструктура и требования 152-ФЗ / ФСТЭК № 117.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from xml.sax.saxutils import quoteattr

OUTPUT = Path(__file__).with_name("rtk-it-school.archimate")


def ident(key: str) -> str:
    """Стабильные id: повторная генерация не меняет файл без изменений в модели."""

    return "id-" + hashlib.sha1(key.encode()).hexdigest()[:24]


# key: (тип ArchiMate, папка, название, описание)
ELEMENTS: dict[str, tuple[str, str, str, str]] = {
    # --- Бизнес: роли ТЗ и процессы ---
    "manager": ("BusinessActor", "business", "Менеджер по вузам (КАМ)", "Ведёт свои взаимодействия с вузами."),
    "lead": ("BusinessActor", "business", "Руководитель", "Команда менеджеров: ответственные, этапы, импорт, интеграции."),
    "admin": ("BusinessActor", "business", "Администратор платформы", "Права, видимость данных, настройки."),
    "p_interaction": ("BusinessProcess", "business", "Ведение взаимодействия с вузом (14 этапов)", "Workflow из ТЗ: от поиска контактов до контроля исполнения."),
    "p_reports": ("BusinessProcess", "business", "Формирование отчётов", "Отчёты за период в XLSX, XLS, PDF и JSON."),
    "p_analytics": ("BusinessProcess", "business", "Анализ статистики", "Диаграммы и графики, выгрузка PNG и PDF."),
    "p_catalogs": ("BusinessProcess", "business", "Актуализация каталогов", "Загрузка XLSX/XLS/CSV по маппингу полей ТЗ."),
    "p_access": ("BusinessProcess", "business", "Управление доступом", "Учётные записи, роли, видимость данных."),
    "p_integration": ("BusinessProcess", "business", "Получение данных из LMS и сайта", "JSON по API с добавлением в workflow."),
    "p_workflow": ("BusinessProcess", "business", "Настройка workflow", "Создание и изменение наборов этапов."),
    # --- Прикладные сервисы ---
    "s_state": ("ApplicationService", "application", "Синхронизация данных CRM", "POST /state/changes, GET /state — изменения без перезагрузки страницы, кэш действий."),
    "s_attach": ("ApplicationService", "application", "Файлы этапов", "png, jpeg, pdf, zip, gzip, rar, doc(x), xls(x); шифрование при хранении."),
    "s_reports": ("ApplicationService", "application", "Конструктор отчётов", "Фильтры по периоду, вузам, направлениям, продуктам, ответственным."),
    "s_import": ("ApplicationService", "application", "Импорт каталогов", "POST /imports: план, проверка, атомарное применение и откат."),
    "s_integr": ("ApplicationService", "application", "Интеграции LMS / сайт", "POST /integrations/{source}/sync."),
    "s_auth": ("ApplicationService", "application", "Аутентификация и авторизация", "OIDC Authorization Code + PKCE, роли kam / manager_lead / admin."),
    "s_notify": ("ApplicationService", "application", "Уведомления о смене этапа", "Telegram, с минимизацией ПДн."),
    "s_assistant": ("ApplicationService", "application", "ИИ-помощник", "Локальная модель: ответы по справке и действия с правами пользователя."),
    "s_workflow": ("ApplicationService", "application", "Конструктор workflow", "Этапы, сроки, подсказки, необязательные этапы."),
    # --- Компоненты ---
    "c_web": ("ApplicationComponent", "application", "Веб-клиент (React 19 SPA)", "Интерфейс, фильтры, отчёты XLSX/XLS/PDF/JSON, импорт XLSX/XLS/CSV, офлайн-кэш."),
    "c_api": ("ApplicationComponent", "application", "CRM API (FastAPI)", "REST /api/v1, Swagger UI /docs, проверка прав при каждом сохранении, шифрование ПДн."),
    "c_bot": ("ApplicationComponent", "application", "Telegram-бот (worker)", "Long polling, очередь уведомлений в БД."),
    "c_kc": ("ApplicationComponent", "application", "Keycloak (realm it-school)", "Вход, политика паролей, защита от подбора, журналы событий."),
    "c_llm": ("ApplicationComponent", "application", "Ollama (локальная LLM)", "Qwen; данные не покидают сервер."),
    "x_lms": ("ApplicationComponent", "application", "LMS ИТ Школы", "Внешняя система: JSON по API."),
    "x_site": ("ApplicationComponent", "application", "Сайт ИТ Школы (CMS Laravel)", "Внешняя система: JSON по API."),
    "x_tg": ("ApplicationComponent", "application", "Telegram Bot API", "Внешний сервис за пределами РФ."),
    # --- Данные ---
    "d_state": ("DataObject", "application", "Снимок данных CRM", "state_snapshots: вузы, взаимодействия, события, пользователи. AES-256-GCM."),
    "d_files": ("DataObject", "application", "Вложения", "Файлы этапов на диске. AES-256-GCM потоком."),
    "d_imports": ("DataObject", "application", "История импортов", "import_jobs: для отката. AES-256-GCM."),
    "d_outbox": ("DataObject", "application", "Очередь уведомлений", "telegram_deliveries. AES-256-GCM."),
    # --- Инфраструктура ---
    "n_server": ("Node", "technology", "Linux-сервер (Docker Compose)", "Ubuntu; deploy/compose.yml, deploy/deploy.sh."),
    "t_proxy": ("SystemSoftware", "technology", "Caddy (HTTPS, TLS)", "Сертификат Let's Encrypt, обратный прокси."),
    "t_pg": ("SystemSoftware", "technology", "PostgreSQL 16", "Базы CRM и Keycloak."),
    "t_volume": ("TechnologyService", "technology", "Том вложений", "Docker volume attachments."),
    # --- Требования ---
    "r_152": ("Requirement", "motivation", "152-ФЗ «О персональных данных»", "Шифрование ПДн при хранении и передаче, минимизация, политика обработки, согласие на трансграничную передачу."),
    "r_117": ("Requirement", "motivation", "Приказ ФСТЭК № 117", "Идентификация и аутентификация, управление доступом, регистрация событий, защита веб-интерфейса."),
    "r_perf": ("Requirement", "motivation", "Отклик ≤ 1 с, 50 пользователей, 10 отчётов", "Нефункциональные требования ТЗ."),
}

# (тип связи, источник, приёмник, подпись)
RELATIONS: list[tuple[str, str, str, str]] = [
    *[("Assignment", actor, process, "") for actor, process in [
        ("manager", "p_interaction"), ("manager", "p_reports"), ("manager", "p_analytics"),
        ("lead", "p_interaction"), ("lead", "p_reports"), ("lead", "p_analytics"), ("lead", "p_catalogs"), ("lead", "p_integration"), ("lead", "p_workflow"),
        ("admin", "p_access"), ("admin", "p_workflow"),
    ]],
    *[("Serving", service, process, "") for service, process in [
        ("s_state", "p_interaction"), ("s_attach", "p_interaction"), ("s_notify", "p_interaction"), ("s_assistant", "p_interaction"),
        ("s_reports", "p_reports"), ("s_reports", "p_analytics"), ("s_import", "p_catalogs"), ("s_integr", "p_integration"),
        ("s_auth", "p_access"), ("s_workflow", "p_workflow"),
    ]],
    *[("Realization", component, service, "") for component, service in [
        ("c_api", "s_state"), ("c_api", "s_attach"), ("c_web", "s_reports"), ("c_api", "s_import"), ("c_api", "s_integr"),
        ("c_kc", "s_auth"), ("c_bot", "s_notify"), ("c_llm", "s_assistant"), ("c_api", "s_workflow"),
    ]],
    ("Serving", "c_api", "c_web", "REST /api/v1 (HTTPS)"),
    ("Serving", "c_kc", "c_web", "OIDC + PKCE"),
    ("Serving", "c_kc", "c_api", "JWKS: проверка RS256-токенов"),
    ("Serving", "c_llm", "c_api", "/api/chat"),
    ("Flow", "x_lms", "c_api", "JSON по API"),
    ("Flow", "x_site", "c_api", "JSON по API"),
    ("Flow", "c_bot", "x_tg", "уведомления (ПДн минимизированы)"),
    ("Access", "c_api", "d_state", ""),
    ("Access", "c_api", "d_files", ""),
    ("Access", "c_api", "d_imports", ""),
    ("Access", "c_api", "d_outbox", ""),
    ("Access", "c_bot", "d_outbox", ""),
    ("Access", "c_bot", "d_state", ""),
    ("Serving", "t_proxy", "c_web", "HTTPS"),
    ("Serving", "t_pg", "c_api", ""),
    ("Serving", "t_pg", "c_kc", ""),
    ("Serving", "t_volume", "c_api", ""),
    ("Composition", "n_server", "t_proxy", ""),
    ("Composition", "n_server", "t_pg", ""),
    ("Realization", "n_server", "t_volume", ""),
    ("Realization", "c_api", "r_152", "шифрование, права, заголовки"),
    ("Realization", "c_kc", "r_117", "аутентификация, журналы"),
    ("Realization", "c_api", "r_117", "управление доступом, аудит"),
    ("Realization", "c_api", "r_perf", "нагрузочный тест: 150 польз."),
]

W, H = 185, 60  # размер фигуры на схеме


def grid(keys: list[str], x: int, y: int, columns: int, dx: int = 205, dy: int = 85) -> dict[str, tuple[int, int]]:
    return {key: (x + (index % columns) * dx, y + (index // columns) * dy) for index, key in enumerate(keys)}


VIEWS = {
    "Функциональная архитектура": {
        **grid(["manager", "lead", "admin"], 250, 20, 3),
        **grid(["p_interaction", "p_reports", "p_analytics", "p_catalogs", "p_integration", "p_workflow", "p_access"], 20, 150, 4),
        **grid(["s_state", "s_attach", "s_notify", "s_assistant", "s_reports", "s_import", "s_integr", "s_workflow", "s_auth"], 20, 360, 5),
    },
    "Компонентная архитектура": {
        **grid(["x_lms", "x_site", "x_tg"], 20, 20, 3, dx=240),
        **grid(["c_web", "c_kc", "c_api", "c_llm", "c_bot"], 20, 150, 5, dx=240),
        **grid(["d_state", "d_files", "d_imports", "d_outbox"], 260, 280, 4, dx=240),
        **grid(["n_server", "t_proxy", "t_pg", "t_volume"], 20, 410, 4, dx=240),
        **grid(["r_152", "r_117", "r_perf"], 260, 540, 3, dx=240),
    },
}

FOLDERS = [
    ("strategy", "Strategy"), ("business", "Business"), ("application", "Application"),
    ("technology", "Technology &amp; Physical"), ("motivation", "Motivation"),
    ("implementation_migration", "Implementation &amp; Migration"), ("other", "Other"),
]


def build() -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
        'xmlns:archimate="http://www.archimatetool.com/archimate" '
        f'name="CRM ИТ Школы Ростелекома" id="{ident("model")}" version="5.0.0">',
    ]
    for folder_type, folder_name in FOLDERS:
        members = [(key, item) for key, item in ELEMENTS.items() if item[1] == folder_type]
        lines.append(f'  <folder name="{folder_name}" id="{ident("folder-" + folder_type)}" type="{folder_type}"{"/" if not members else ""}>')
        if members:
            for key, (kind, _, name, documentation) in members:
                lines.append(f'    <element xsi:type="archimate:{kind}" name={quoteattr(name)} id="{ident(key)}">')
                lines.append(f"      <documentation>{documentation.replace('&', '&amp;').replace('<', '&lt;')}</documentation>")
                lines.append("    </element>")
            lines.append("  </folder>")

    lines.append(f'  <folder name="Relations" id="{ident("folder-relations")}" type="relations">')
    for kind, source, target, label in RELATIONS:
        name = f" name={quoteattr(label)}" if label else ""
        access = ' accessType="3"' if kind == "Access" else ""  # чтение и запись
        lines.append(f'    <element xsi:type="archimate:{kind}Relationship"{name} id="{ident(f"{kind}:{source}:{target}")}" source="{ident(source)}" target="{ident(target)}"{access}/>')
    lines.append("  </folder>")

    lines.append(f'  <folder name="Views" id="{ident("folder-views")}" type="diagrams">')
    for view_name, positions in VIEWS.items():
        lines.append(f'    <element xsi:type="archimate:ArchimateDiagramModel" name={quoteattr(view_name)} id="{ident("view-" + view_name)}">')
        on_view = [relation for relation in RELATIONS if relation[1] in positions and relation[2] in positions]
        connection_id = lambda relation: ident(f"conn-{view_name}-{relation[0]}:{relation[1]}:{relation[2]}")  # noqa: E731
        for key, (x, y) in positions.items():
            node = ident(f"node-{view_name}-{key}")
            incoming = " ".join(connection_id(relation) for relation in on_view if relation[2] == key)
            target_attr = f' targetConnections="{incoming}"' if incoming else ""
            lines.append(f'      <child xsi:type="archimate:DiagramObject" id="{node}"{target_attr} archimateElement="{ident(key)}">')
            lines.append(f'        <bounds x="{x}" y="{y}" width="{W}" height="{H}"/>')
            for relation in (item for item in on_view if item[1] == key):
                kind, source, target, _ = relation
                lines.append(
                    f'        <sourceConnection xsi:type="archimate:Connection" id="{connection_id(relation)}" '
                    f'source="{node}" target="{ident(f"node-{view_name}-{target}")}" '
                    f'archimateRelationship="{ident(f"{kind}:{source}:{target}")}"/>'
                )
            lines.append("      </child>")
        lines.append("    </element>")
    lines.append("  </folder>")
    lines.append("</archimate:model>")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    OUTPUT.write_text(build(), encoding="utf-8")
    print(f"{OUTPUT} — элементов: {len(ELEMENTS)}, связей: {len(RELATIONS)}, представлений: {len(VIEWS)}")
