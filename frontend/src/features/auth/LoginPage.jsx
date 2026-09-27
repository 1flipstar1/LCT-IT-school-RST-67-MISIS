import { useRef, useState } from 'react';
import logoUrl from '../../../logo/logo.svg';
import { apiErrorToAppError } from '../../api/client.js';
import { useSession } from '../../auth/SessionProvider.jsx';
import { keycloakConfigured } from '../../auth/keycloak.js';
import { ROLE, ROLE_INFO } from '../../domain/roles.js';
import { useDocumentTitle } from '../../lib/useDocumentTitle.js';
import { Button } from '../../ui/Button.jsx';
import { ArrowRightIcon, CheckIcon, UserIcon, UsersIcon, SettingsIcon } from '../../ui/icons.js';
import { ErrorAlert, InlineAlert } from '../../ui/InlineAlert.jsx';
import styles from './LoginPage.module.css';

const ROLE_ICONS = { [ROLE.manager]: UserIcon, [ROLE.lead]: UsersIcon, [ROLE.admin]: SettingsIcon };

const BENEFITS = [
  'Весь путь работы с вузом — от первого контакта до занятий — на одном экране',
  'Сроки этапов под контролем: система подскажет, что просрочено',
  'Отчёты в XLSX и PDF за пару кликов',
];

export function LoginPage() {
  useDocumentTitle('Вход');
  const keycloakAvailable = keycloakConfigured && Boolean(globalThis.crypto?.getRandomValues);
  const { login, loginWithKeycloak, keycloakError } = useSession();
  const [ssoUnavailable, setSsoUnavailable] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [loggingInAs, setLoggingInAs] = useState(null);
  const rolesRef = useRef(null);

  const handleSso = async () => {
    setLoginError(null);
    try {
      const redirected = await loginWithKeycloak();
      if (!redirected) {
        setSsoUnavailable(true);
        rolesRef.current?.querySelector('button')?.focus();
      }
    } catch (error) {
      setLoginError(error);
    }
  };

  const handleDemoLogin = async (role) => {
    setLoginError(null);
    setLoggingInAs(role);
    try {
      await login(role);
    } catch (error) {
      setLoginError(apiErrorToAppError(error));
    } finally {
      setLoggingInAs(null);
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.promo} aria-hidden="true">
        <img src={logoUrl} alt="" className={styles.promoLogo} />
        <div className={styles.promoText}>
          <h2 className={styles.promoTitle}>CRM ИТ Школы Ростелекома</h2>
          <p className={styles.promoLead}>Система контроля взаимодействия с вузами по ИТ-направлениям</p>
          <ul className={styles.benefits}>
            {BENEFITS.map((benefit) => (
              <li key={benefit}>
                <CheckIcon size={20} fill="currentColor" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <main className={styles.formSide}>
        <div className={styles.card}>
          <img src={logoUrl} alt="Ростелеком" className={styles.cardLogo} />
          <h1 className={styles.title}>Вход в систему</h1>
          <p className={styles.subtitle}>
            Выберите демо-роль для входа. Корпоративная учётная запись не требуется для тестового доступа.
          </p>
          {(loginError || keycloakError) && <ErrorAlert error={loginError || keycloakError} />}

          <ul className={styles.roles} ref={rolesRef}>
            {Object.values(ROLE).map((role) => {
              const Icon = ROLE_ICONS[role];
              return (
                <li key={role}>
                  <button
                    type="button"
                    className={styles.role}
                    onClick={() => handleDemoLogin(role)}
                    disabled={loggingInAs !== null}
                    aria-busy={loggingInAs === role}
                  >
                    <span className={styles.roleIcon}>
                      <Icon size={20} fill="currentColor" />
                    </span>
                    <span className={styles.roleText}>
                      <span className={styles.roleLabel}>{ROLE_INFO[role].label}</span>
                      <span className={styles.roleDescription}>{ROLE_INFO[role].description}</span>
                    </span>
                    <ArrowRightIcon size={20} fill="currentColor" className={styles.roleArrow} />
                  </button>
                </li>
              );
            })}
          </ul>

          <div className={styles.divider}>
            <span>Корпоративный вход</span>
          </div>
          <Button variant="outline" size="l" fullWidth onClick={handleSso} disabled={!keycloakAvailable}>
            Войти через Keycloak
          </Button>
          {!keycloakAvailable && (
            <InlineAlert tone="info" title="Корпоративный вход недоступен">
              Выберите демо-роль выше для входа.
            </InlineAlert>
          )}
          {ssoUnavailable && (
            <InlineAlert tone="info" title="Корпоративный вход не настроен">
              Выберите демо-роль выше для входа.
            </InlineAlert>
          )}
        </div>
        <p className={styles.legal}>Обработка персональных данных — в соответствии с 152-ФЗ</p>
      </main>
    </div>
  );
}
