from logging.config import fileConfig

from app.core.config import settings

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

from app.models import AttachmentModel, Base, StateSnapshotModel  # noqa: F401


# Настройки Alembic из alembic.ini.
config = context.config

# Логирование — по секциям alembic.ini.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Метаданные моделей — для автогенерации миграций (alembic revision --autogenerate).
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Миграции в режиме offline: без подключения к БД, только по адресу.

    Команды не выполняются, а выводятся как SQL-скрипт (alembic upgrade --sql).
    """
    url = settings.database_url
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Миграции в режиме online: подключение к БД из DATABASE_URL и выполнение команд."""

    config.set_main_option(
        "sqlalchemy.url",
        settings.database_url,
    )

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
