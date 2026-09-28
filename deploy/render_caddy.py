"""Собирает конфигурацию прокси Caddy по публичному адресу сервера из deploy/.env."""

import os
import shutil
from pathlib import Path


deploy = Path(__file__).resolve().parent
settings = dict(line.split("=", 1) for line in (deploy / ".env").read_text().splitlines() if "=" in line)
source = deploy / ("Caddyfile.domain" if settings.get("PUBLIC_URL") == "https://rtk-itschool.ru" else "Caddyfile")
target = deploy / "generated/Caddyfile"
target.parent.mkdir(mode=0o700, exist_ok=True)
shutil.copyfile(source, target)
os.chmod(target, 0o600)
