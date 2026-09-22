const CALLBACK_KEY = 'crm.keycloak.callback';

const env = import.meta.env ?? {};
const keycloakUrl = String(env.VITE_KEYCLOAK_URL ?? '').replace(/\/$/, '');
const realm = String(env.VITE_KEYCLOAK_REALM ?? '');
const clientId = String(env.VITE_KEYCLOAK_CLIENT_ID ?? '');

export const keycloakConfigured = Boolean(keycloakUrl && realm && clientId);

const issuer = keycloakConfigured ? `${keycloakUrl}/realms/${encodeURIComponent(realm)}` : '';
const redirectUri = () => `${window.location.origin}${window.location.pathname}`;

function base64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomValue(length = 48) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function decodeToken(token) {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('Keycloak returned an invalid token');
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function roleFromClaims(claims) {
  const candidates = [
    claims.role,
    ...(claims.realm_access?.roles ?? []),
    ...(claims.resource_access?.[clientId]?.roles ?? []),
  ]
    .filter(Boolean)
    .map((role) => String(role).toLowerCase().replace(/-/g, '_'));
  if (candidates.some((role) => role === 'admin')) return 'admin';
  if (candidates.some((role) => ['lead', 'manager_lead'].includes(role))) return 'lead';
  if (candidates.some((role) => ['manager', 'kam'].includes(role))) return 'manager';
  return null;
}

export async function beginKeycloakLogin() {
  if (!keycloakConfigured) return false;
  const state = randomValue(24);
  const verifier = randomValue(64);
  sessionStorage.setItem(CALLBACK_KEY, JSON.stringify({ state, verifier }));
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid profile email',
    state,
    code_challenge: await challengeFor(verifier),
    code_challenge_method: 'S256',
  });
  window.location.assign(`${issuer}/protocol/openid-connect/auth?${query}`);
  return true;
}

export function hasKeycloakCallback() {
  const query = new URLSearchParams(window.location.search);
  return query.has('code') || query.has('error');
}

export async function finishKeycloakLogin(fetchImpl = fetch) {
  if (!keycloakConfigured || !hasKeycloakCallback()) return null;
  const query = new URLSearchParams(window.location.search);
  const saved = JSON.parse(sessionStorage.getItem(CALLBACK_KEY) ?? 'null');
  sessionStorage.removeItem(CALLBACK_KEY);
  if (query.get('error')) throw new Error(query.get('error_description') || query.get('error'));
  if (!saved || query.get('state') !== saved.state) throw new Error('Не удалось проверить ответ Keycloak. Повторите вход.');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: redirectUri(),
    code: query.get('code'),
    code_verifier: saved.verifier,
  });
  const response = await fetchImpl(`${issuer}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const tokens = await response.json();
  if (!response.ok || !tokens.access_token) throw new Error(tokens.error_description || 'Keycloak не выдал токен доступа.');
  const claims = decodeToken(tokens.access_token);
  const role = roleFromClaims(claims);
  if (!role) throw new Error('Для пользователя не назначена роль KAM, MANAGER_LEAD или ADMIN.');
  window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash || '#/'}`);
  return {
    role,
    user: {
      id: claims.sub,
      name: claims.name ?? claims.preferred_username ?? claims.email,
      email: claims.email ?? null,
      role,
      active: true,
    },
    accessToken: tokens.access_token,
    idToken: tokens.id_token ?? null,
    tokenType: tokens.token_type ?? 'Bearer',
    expiresAt: Date.now() + Number(tokens.expires_in ?? 300) * 1_000,
    provider: 'keycloak',
  };
}

export function keycloakLogoutUrl(session) {
  if (!keycloakConfigured || session?.provider !== 'keycloak') return null;
  const query = new URLSearchParams({
    client_id: clientId,
    post_logout_redirect_uri: redirectUri(),
  });
  if (session.idToken) query.set('id_token_hint', session.idToken);
  return `${issuer}/protocol/openid-connect/logout?${query}`;
}
