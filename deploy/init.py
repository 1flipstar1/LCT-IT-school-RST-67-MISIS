"""Create server-only secrets and a safe first-import Keycloak realm."""

import json
import os
import secrets
import sys
from pathlib import Path


def token() -> str:
    return secrets.token_urlsafe(36)


def main() -> None:
    if len(sys.argv) != 2 or not sys.argv[1].startswith(("http://", "https://")):
        raise SystemExit("usage: python3 deploy/init.py http://SERVER_IP")
    public_url = sys.argv[1].rstrip("/")
    deploy_dir = Path(__file__).resolve().parent
    env_path = deploy_dir / ".env"
    realm_path = deploy_dir / "generated" / "realm-it-school.json"
    if env_path.exists() or realm_path.exists():
        raise SystemExit("Deployment configuration already exists; refusing to replace credentials")

    realm = json.loads((deploy_dir.parent / "backend/deploy/keycloak/realm-it-school.json").read_text())
    realm["sslRequired"] = "none" if public_url.startswith("http://") else "external"
    web = next(client for client in realm["clients"] if client["clientId"] == "rtk-it-school-web")
    web["rootUrl"] = public_url
    web["redirectUris"] = [f"{public_url}/*"]
    web["webOrigins"] = [public_url]
    web["attributes"]["post.logout.redirect.uris"] = f"{public_url}/*"
    admin_client = next(client for client in realm["clients"] if client["clientId"] == "rtk-it-school-admin")
    client_secret = token()
    admin_client["secret"] = client_secret

    credentials = {}
    for user in realm["users"]:
        password = "A1!" + token()
        credentials[user["username"]] = password
        for item in user.get("credentials", []):
            if item.get("type") == "password":
                item["value"] = password
                item["temporary"] = True

    env = {
        "PUBLIC_URL": public_url,
        "POSTGRES_PASSWORD": token(),
        "KC_ADMIN_PASSWORD": token(),
        "KEYCLOAK_ADMIN_CLIENT_ID": "rtk-it-school-admin",
        "KEYCLOAK_ADMIN_CLIENT_SECRET": client_secret,
        "APP_ENV": "production",
        "CORS_ORIGINS": public_url,
        "JWT_SECRET": token(),
        "DEMO_AUTH_ENABLED": "true",
        "ASSISTANT_ENABLED": "true",
        "OLLAMA_MODEL": "qwen2.5:1.5b-instruct",
        "ASSISTANT_CONTEXT_TOKENS": "2048",
        "ASSISTANT_TIMEOUT_SECONDS": "60",
        "PUBLIC_APP_URL": public_url,
    }
    deploy_dir.joinpath("generated").mkdir(mode=0o700, exist_ok=True)
    realm_path.write_text(json.dumps(realm, ensure_ascii=False, indent=2) + "\n")
    env_path.write_text("".join(f"{key}={value}\n" for key, value in env.items()))
    deploy_dir.joinpath("generated/initial-credentials.json").write_text(
        json.dumps({"keycloak_admin": env["KC_ADMIN_PASSWORD"], "users": credentials}, ensure_ascii=False, indent=2) + "\n"
    )
    for path in (env_path, realm_path, deploy_dir / "generated/initial-credentials.json"):
        os.chmod(path, 0o600)


if __name__ == "__main__":
    main()
