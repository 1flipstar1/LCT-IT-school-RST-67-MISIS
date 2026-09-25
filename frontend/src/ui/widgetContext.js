import { createContext, useContext } from 'react';

/**
 * Контекст карточки на панели (график или плитка показателя).
 * action — дополнительная кнопка в шапке карточки (например, «В отчёт»);
 * exportMode — карточка рисуется для выгрузки: всегда вид «График», без кнопок управления.
 * Вне панели контекста нет, и карточки выглядят как обычно.
 */
export const WidgetContext = createContext({ action: null, exportMode: false });

export const useWidgetContext = () => useContext(WidgetContext);
