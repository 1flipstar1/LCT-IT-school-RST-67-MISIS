"""Switch an existing IP deployment to the HTTPS domain after DNS and TLS work."""

import json
import os
import shutil
import socket
import subprocess
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


DOMAIN = "rtk-itschool.ru"
SERVER_IP = "158.160.222.79"
PUBLIC_URL = f"https://{DOMAIN}"
ROOT = Path(__file__).resolve().parents[1]
DEPLOY = ROOT / "deploy"
COMPOSE = ["docker", "compose", "--env-file", str(DEPLOY / ".env"), "-f", str(DEPLOY / "compose.yml")]
KCADM = [*COMPOSE, "exec", "-T", "keycloak", "/opt/keycloak/bin/kcadm.sh"]


def run(args: list[str], *, input_text: str | None = None) -> str:
    result = subprocess.run(args, input=input_text, text=True, capture_output=True, check=False)
    if result.returncode:
        raise RuntimeError(f"Command failed ({result.returncode}): {args[0]} {args[1]}\n{result.stderr}")
    return result.stdout


def main() -> None:
    addresses = {item[4][0] for item in socket.getaddrinfo(DOMAIN, 443, type=socket.SOCK_STREAM)}
    if SERVER_IP not in addresses:
        raise SystemExit(f"DNS for {DOMAIN} does not point to {SERVER_IP}: {sorted(addresses)}")

    env_path = DEPLOY / ".env"
    realm_path = DEPLOY / "generated/realm-it-school.json"
    if not env_path.exists() or not realm_path.exists():
        raise SystemExit("Existing deployment configuration is missing")
    backup = DEPLOY / "generated" / f"before-domain-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}"
    backup.mkdir(mode=0o700)
    shutil.copy2(env_path, backup / ".env")
    shutil.copy2(realm_path, backup / "realm-it-school.json")

    proxy_config = DEPLOY / "generated/Caddyfile"
    shutil.copy2(DEPLOY / "Caddyfile.domain", proxy_config)
    run([*COMPOSE, "up", "-d", "--no-deps", "--force-recreate", "proxy"])
    for attempt in range(36):
        try:
            with urllib.request.urlopen(f"{PUBLIC_URL}/api/v1/health", timeout=10) as response:
                if response.status == 200:
                    break
        except Exception:
            pass
        time.sleep(5)
    else:
        shutil.copy2(DEPLOY / "Caddyfile", proxy_config)
        run([*COMPOSE, "up", "-d", "--no-deps", "--force-recreate", "proxy"])
        raise SystemExit("Could not obtain and verify the HTTPS certificate; IP proxy restored")

    run([*COMPOSE, "exec", "-T", "keycloak", "sh", "-c",
         '/opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080/auth --realm master '
         '--user "$KC_BOOTSTRAP_ADMIN_USERNAME" --password "$KC_BOOTSTRAP_ADMIN_PASSWORD" >/dev/null'])
    realm = json.loads(run([*KCADM, "get", "realms/it-school"]))
    clients = json.loads(run([*KCADM, "get", "clients", "-r", "it-school", "-q", "clientId=rtk-it-school-web"]))
    if len(clients) != 1:
        raise SystemExit("Expected exactly one web client in Keycloak")
    client = json.loads(run([*KCADM, "get", f"clients/{clients[0]['id']}", "-r", "it-school"]))
    for name, value in (("keycloak-realm.json", realm), ("keycloak-web-client.json", client)):
        path = backup / name
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
        os.chmod(path, 0o600)

    updated_client = client.copy()
    updated_client["rootUrl"] = PUBLIC_URL
    updated_client["redirectUris"] = [f"{PUBLIC_URL}/*"]
    updated_client["webOrigins"] = [PUBLIC_URL]
    updated_client["attributes"] = {**client.get("attributes", {}),
                                    "post.logout.redirect.uris": f"{PUBLIC_URL}/*"}
    run([*KCADM, "update", f"clients/{client['id']}", "-r", "it-school", "-f", "-"],
        input_text=json.dumps(updated_client))
    run([*KCADM, "update", "realms/it-school", "-s", "sslRequired=external"])

    realm_file = json.loads(realm_path.read_text())
    realm_file["sslRequired"] = "external"
    web = next(item for item in realm_file["clients"] if item["clientId"] == "rtk-it-school-web")
    for key in ("rootUrl", "redirectUris", "webOrigins", "attributes"):
        web[key] = updated_client[key]
    realm_path.write_text(json.dumps(realm_file, ensure_ascii=False, indent=2) + "\n")
    os.chmod(realm_path, 0o600)

    replacements = {"PUBLIC_URL": PUBLIC_URL, "CORS_ORIGINS": PUBLIC_URL, "PUBLIC_APP_URL": PUBLIC_URL}
    lines = env_path.read_text().splitlines()
    found = set()
    for index, line in enumerate(lines):
        key = line.split("=", 1)[0]
        if key in replacements:
            lines[index] = f"{key}={replacements[key]}"
            found.add(key)
    if found != replacements.keys():
        raise SystemExit(f"Missing environment settings: {sorted(replacements.keys() - found)}")
    env_path.write_text("\n".join(lines) + "\n")
    os.chmod(env_path, 0o600)

    print(f"Configuration backed up to {backup}; deploying {PUBLIC_URL}")
    subprocess.run(["bash", str(DEPLOY / "deploy.sh")], cwd=ROOT, check=True)
    with urllib.request.urlopen(f"{PUBLIC_URL}/auth/realms/it-school/.well-known/openid-configuration", timeout=15) as response:
        discovery = json.load(response)
    if discovery.get("issuer") != f"{PUBLIC_URL}/auth/realms/it-school":
        raise SystemExit("Keycloak advertises the wrong issuer after deployment")
    (DEPLOY / "generated/domain-active").touch()
    print(f"Domain active: {PUBLIC_URL}")


if __name__ == "__main__":
    main()
