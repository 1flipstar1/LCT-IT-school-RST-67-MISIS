import { useEffect } from 'react';

const APP_NAME = 'CRM ИТ Школы Ростелекома';

/** Заголовок вкладки браузера: «Взаимодействия — CRM ИТ Школы Ростелекома». */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — ${APP_NAME}` : APP_NAME;
  }, [title]);
}
