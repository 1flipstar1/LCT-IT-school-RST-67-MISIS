import React, { useState } from 'react';
import { Lock, PasswordHide, PasswordShow, SecurityCheck, Settings } from '@atomaro/icons/24/action';
import { User, Users } from '@atomaro/icons/24/communication';
import { CheckSmall } from '@atomaro/icons/24/navigation';

const demoRoles = [
  { id: 'Пользователь', label: 'Пользователь', icon: <User size={16} fill="currentColor"/> },
  { id: 'Руководитель', label: 'Руководитель', icon: <Users size={16} fill="currentColor"/> },
  { id: 'Администратор', label: 'Администратор', icon: <Settings size={16} fill="currentColor"/> }
];

export default function LoginPage({ onLogin }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');

  const submit = (e) => {
    e?.preventDefault();
    if (!login.trim() || !password.trim()) {
      setError('Введите логин и пароль');
      return;
    }
    setError('');
    onLogin('Пользователь');
  };

  return (
    <div className="login-page">
      <div className="login-bg"><i/><i/><i/></div>
      <div className="login-card">
        <img className="login-logo" src="/logo/logo.svg" alt="Ростелеком" />
        <h1 className="login-title">Вход в систему</h1>
        <p className="login-subtitle">Система контроля и обработки статистических данных по обучению студентов ВУЗов и школ по ИТ-направлениям</p>

        <form className="login-form" onSubmit={submit} noValidate>
          <label className="login-field">
            <span>Логин</span>
            <div className="login-input-wrap">
              <User size={17} fill="currentColor"/>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="example@rt.ru"
                autoComplete="username"
              />
            </div>
          </label>
          <label className="login-field">
            <span>Пароль</span>
            <div className="login-input-wrap">
              <Lock size={17} fill="currentColor"/>
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button type="button" className="login-toggle" onClick={() => setShowPwd((v) => !v)} aria-label="Показать пароль">
                {showPwd ? <PasswordHide size={17} fill="currentColor"/> : <PasswordShow size={17} fill="currentColor"/>}
              </button>
            </div>
          </label>

          <div className="login-row">
            <label className="login-checkbox">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span><CheckSmall size={12} fill="currentColor"/></span>
              Запомнить меня
            </label>
            <button type="button" className="login-link" onClick={() => setError('Демо-режим: восстановление пароля не реализовано')}>Забыли пароль?</button>
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-submit" disabled={!login.trim() || !password.trim()}>
            <SecurityCheck size={17} fill="currentColor"/> Войти
          </button>
        </form>

        <div className="login-divider"><span>или</span></div>

        <div className="login-demo">
          <span>Демо-режим — войти как:</span>
          <div className="login-demo-chips">
            {demoRoles.map((r) => (
              <button key={r.id} className="login-demo-chip" onClick={() => onLogin(r.id)}>
                {r.icon}{r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="login-footer">
          <span>© 2026 Ростелеком</span>
          <a href="mailto:design@rt.ru">design@rt.ru</a>
        </div>
      </div>
    </div>
  );
}