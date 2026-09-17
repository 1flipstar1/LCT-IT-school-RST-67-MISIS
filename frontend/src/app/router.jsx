import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Минимальный hash-роутер: у каждой страницы есть адрес, работают «Назад» и ссылки в новой вкладке,
 * а статический хостинг прототипа не требует настройки fallback на index.html.
 */
const RouterContext = createContext(null);

const readPath = () => window.location.hash.replace(/^#/, '') || '/';

export function RouterProvider({ children }) {
  const [path, setPath] = useState(readPath);

  useEffect(() => {
    const handleChange = () => {
      setPath(readPath());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', handleChange);
    return () => window.removeEventListener('hashchange', handleChange);
  }, []);

  const navigate = useCallback((to) => {
    window.location.hash = to;
  }, []);

  const value = useMemo(() => {
    const [pathname, search = ''] = path.split('?');
    return { path, pathname, query: new URLSearchParams(search), navigate };
  }, [path, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  const router = useContext(RouterContext);
  if (!router) throw new Error('useRouter нужно вызывать внутри <RouterProvider>');
  return router;
}

/** matchPath('/interactions/:id', '/interactions/i1') → { id: 'i1' }; нет совпадения → null. */
export function matchPath(pattern, path) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('?')[0].split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const part = patternParts[index];
    if (part.startsWith(':')) params[part.slice(1)] = decodeURIComponent(pathParts[index]);
    else if (part !== pathParts[index]) return null;
  }
  return params;
}

export function Link({ to, children, ...rest }) {
  return (
    <a href={`#${to}`} {...rest}>
      {children}
    </a>
  );
}
