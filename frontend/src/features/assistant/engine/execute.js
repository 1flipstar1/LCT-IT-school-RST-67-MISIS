import { EMPTY_FILTERS, filterInteractionRows } from '../../../domain/filters.js';
import { formatDate, plural } from '../../../domain/format.js';
import { DEFAULT_REPORT_COLUMNS, REPORT_FORMATS } from '../../../domain/reports.js';
import { getTransitionTargets, isFinalStage, PHASES, requiresComment, SLA_STATE, TRANSITION_KIND } from '../../../domain/workflow.js';
import { describeFilters } from '../../filters/describeFilters.js';
import { pageById, STAGE_MOVE, TOOL } from './tools.js';

/**
 * Выполнение действий помощника над данными, которые пользователь и так видит.
 * Функции чистые: получают строки и справочники, возвращают ответ — текст, карточку и эффект.
 * Эффекты (переход, скачивание, изменение данных) применяет useAssistant: так их легко проверить тестами.
 *
 * Ответ: { text, card?, effect?, suggestions?, filters? }.
 * suggestions — строки (отправляются как сообщение) или { label, call } с уже разобранным действием.
 * filters — условия ответа: на них ссылаются следующие команды «…по ним».
 */

const PREVIEW_LIMIT = 6;

const interactionsWord = (count) => `${count} ${plural(count, ['взаимодействие', 'взаимодействия', 'взаимодействий'])}`;
export const rowLabel = (row) => `${row.university.shortName ?? row.university.name} · ${row.direction.name}`;
const byUrgency = (a, b) => (a.sla.daysLeft ?? Infinity) - (b.sla.daysLeft ?? Infinity);
const withFilters = (filters) => ({ ...EMPTY_FILTERS, ...filters, period: { ...EMPTY_FILTERS.period, ...filters?.period } });

function unknownNote(unknown = []) {
  return unknown.length ? `\n\nНе нашёл в справочниках: ${unknown.map((name) => `«${name}»`).join(', ')} — это условие не учтено.` : '';
}

function reportResult({ filters, columns, format, name }, context) {
  const rows = filterInteractionRows(context.rows, filters, context.now);
  const summary = describeFilters(filters, context.index);
  if (rows.length === 0) {
    return {
      text: `Под условия «${summary}» не попало ни одного взаимодействия — отчёт получился бы пустым. Попробуйте расширить период или убрать часть фильтров.`,
      suggestions: ['Сформируй отчёт за всё время'],
    };
  }

  const spec = {
    filters,
    columns: columns?.length ? columns : DEFAULT_REPORT_COLUMNS,
    format: format ?? context.settings.reportFormat,
    name: (name || `Взаимодействия с вузами — ${formatDate(context.now)}`).slice(0, 120),
    summary,
  };
  const formatLabel = REPORT_FORMATS.find((item) => item.id === spec.format).label;
  return {
    text: `Готово! Отчёт собран: ${rows.length} ${plural(rows.length, ['строка', 'строки', 'строк'])}, формат ${formatLabel}. Нажмите «Скачать», чтобы сохранить файл.`,
    card: { kind: 'report', spec, rowCount: rows.length, downloadedAt: null },
    effect: context.settings.autoDownload ? { type: 'download' } : undefined,
    filters,
    suggestions: [{ label: 'Статистика по этим условиям', call: { name: TOOL.showStats, args: { filters } } }, 'Открой отчёты'],
  };
}

const reportSuggestion = (filters) => ({ label: 'Сделать отчёт по ним', call: { name: TOOL.createReport, args: { filters } } });

function statsOf(rows) {
  const active = rows.filter((row) => !row.completedAt);
  const stageCounts = new Map();
  active.forEach((row) => stageCounts.set(row.stage.name, (stageCounts.get(row.stage.name) ?? 0) + 1));
  return {
    total: rows.length,
    active: active.length,
    completed: rows.length - active.length,
    overdue: active.filter((row) => row.sla.state === SLA_STATE.overdue).length,
    soon: active.filter((row) => row.sla.state === SLA_STATE.soon).length,
    phases: PHASES.map((phase) => ({ label: phase.label, count: active.filter((row) => row.stage.phase === phase.id).length })),
    topStages: [...stageCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label, count]) => ({ label, count })),
  };
}

/** Взаимодействия, к которым относится команда. Одно — выполняем, несколько — просим выбрать. */
function pickInteraction(args, context, call) {
  if (args.interactionId) {
    const row = context.rows.find((item) => item.id === args.interactionId);
    return row ? { row } : { result: { text: 'Это взаимодействие больше недоступно. Возможно, его перевели или у вас изменились права.' } };
  }
  const filters = withFilters(args.filters);
  const hasTarget = filters.universityIds.length + filters.directionIds.length + filters.productIds.length + filters.managerIds.length > 0;
  if (!hasTarget) {
    return { result: { text: 'Уточните, с каким вузом работать. Например: «…для КФУ по DevOps».' } };
  }
  const rows = filterInteractionRows(context.rows, { ...filters, period: EMPTY_FILTERS.period }, context.now).filter((row) => !row.completedAt);
  if (rows.length === 0) return { result: { text: `Не нашёл активных взаимодействий: ${describeFilters(filters, context.index)}. Проверьте название вуза или направления.` } };
  if (rows.length === 1) return { row: rows[0] };
  return {
    result: {
      text: `Нашёл ${interactionsWord(rows.length)}. Выберите нужное:`,
      card: {
        kind: 'choice',
        options: rows.slice(0, 8).map((row) => ({ label: rowLabel(row), description: row.stage.name, call: { name: call, args: { ...args, interactionId: row.id } } })),
      },
    },
  };
}

function stageTransition(row, move) {
  const { workflow } = row;
  if (move === STAGE_MOVE.next && isFinalStage(workflow, row.stageId)) return { complete: true };
  const kind = { [STAGE_MOVE.next]: TRANSITION_KIND.next, [STAGE_MOVE.back]: TRANSITION_KIND.back, [STAGE_MOVE.skip]: TRANSITION_KIND.skip }[move];
  const target = getTransitionTargets(workflow, row.stageId).find((item) => item.kind === kind);
  return target ? { target } : null;
}

const MOVE_REFUSAL = {
  [STAGE_MOVE.back]: 'Это первый этап — возвращать некуда.',
  [STAGE_MOVE.skip]: 'Пропустить можно только необязательный этап, а следующий этап обязательный.',
  [STAGE_MOVE.next]: 'Следующего этапа нет.',
};

const HANDLERS = {
  [TOOL.createReport]: (args, context) => reportResult(args, context),

  [TOOL.repeatReport]: (_args, context) => {
    const last = [...context.reports].filter((report) => report.userId === context.userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      ?? [...context.reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!last) return { text: 'Отчётов пока не было. Скажите, какой отчёт собрать, — например: «Отчёт за последний месяц в PDF».' };
    return reportResult({ filters: withFilters(last.filters), columns: last.columns, format: last.format, name: last.name }, context);
  },

  [TOOL.findInteractions]: ({ filters }, context) => {
    const rows = filterInteractionRows(context.rows, filters, context.now).sort(byUrgency);
    const summary = describeFilters(filters, context.index);
    if (rows.length === 0) return { text: `Ничего не нашёл: ${summary}.`, suggestions: ['Покажи просроченные', 'Статистика'] };
    const overdue = rows.filter((row) => row.sla.state === SLA_STATE.overdue).length;
    return {
      text: `Нашёл ${interactionsWord(rows.length)} (${summary})${overdue ? `, из них просрочено: ${overdue}` : ''}.${rows.length > PREVIEW_LIMIT ? ' Сначала самые срочные.' : ''}`,
      card: { kind: 'interactions', filters, ids: rows.slice(0, PREVIEW_LIMIT).map((row) => row.id), total: rows.length },
      filters,
      suggestions: [reportSuggestion(filters), { label: 'Статистика по ним', call: { name: TOOL.showStats, args: { filters } } }],
    };
  },

  [TOOL.showStats]: ({ filters }, context) => {
    const rows = filterInteractionRows(context.rows, filters, context.now);
    const stats = statsOf(rows);
    const summary = describeFilters(filters, context.index);
    return {
      text: stats.total
        ? `${summary}: ${interactionsWord(stats.total)}, в работе ${stats.active}, завершено ${stats.completed}. Просрочено ${stats.overdue}, скоро срок у ${stats.soon}.`
        : `${summary}: взаимодействий нет.`,
      card: stats.total ? { kind: 'stats', filters, summary, stats } : undefined,
      filters,
      suggestions: [
        ...(stats.overdue ? [{ label: 'Показать просроченные', call: { name: TOOL.findInteractions, args: { filters: { ...filters, onlyAttention: true } } } }] : []),
        reportSuggestion(filters),
      ],
    };
  },

  [TOOL.openPage]: ({ page: pageId }, context) => {
    const page = pageById(pageId);
    if (!page) return { text: 'Не понял, какой раздел открыть. Доступны: дашборд, взаимодействия, доска, аналитика, отчёты, справочники, справка.' };
    if (page.permission && !context.can(page.permission)) return { text: `Раздел «${page.label}» недоступен для вашей роли.` };
    return { text: `Открываю «${page.label}».`, effect: { type: 'navigate', path: page.path, view: page.view } };
  },

  [TOOL.openInteraction]: (args, context) => {
    const { row, result } = pickInteraction(args, context, TOOL.openInteraction);
    if (!row) return result;
    return { text: `Открываю ${rowLabel(row)} — этап «${row.stage.name}».`, effect: { type: 'navigate', path: `/interactions/${row.id}` } };
  },

  [TOOL.changeStage]: (args, context) => {
    const { row, result } = pickInteraction(args, context, TOOL.changeStage);
    if (!row) return result;
    const transition = stageTransition(row, args.move ?? STAGE_MOVE.next);
    if (!transition) return { text: `${rowLabel(row)}: ${MOVE_REFUSAL[args.move ?? STAGE_MOVE.next]}` };

    const card = {
      kind: 'transition',
      interactionId: row.id,
      expectedStageId: row.stageId,
      toStageId: transition.target?.stage.id ?? null,
      transitionKind: transition.target?.kind ?? null,
      complete: Boolean(transition.complete),
      comment: args.comment ?? '',
      status: 'pending',
    };
    const needsComment = transition.target && requiresComment(transition.target.kind) && !card.comment.trim();
    const destination = transition.complete ? 'завершить взаимодействие' : `перевести на «${transition.target.stage.name}»`;
    return {
      text: needsComment
        ? `${rowLabel(row)}: ${destination}. По правилам нужен комментарий — напишите причину в карточке ниже.`
        : `${rowLabel(row)}: ${destination}. Проверьте и подтвердите.`,
      card,
      effect: !needsComment && !context.settings.confirmChanges ? { type: 'commit' } : undefined,
    };
  },

  [TOOL.addComment]: (args, context) => {
    if (!args.text?.trim()) return { text: 'Что написать в комментарии? Например: «Добавь комментарий к КФУ: созвонились с проректором».' };
    const { row, result } = pickInteraction(args, context, TOOL.addComment);
    if (!row) return result;
    return {
      text: `Добавлю комментарий к ${rowLabel(row)}.`,
      card: { kind: 'comment', interactionId: row.id, text: args.text.trim(), status: 'pending' },
      effect: context.settings.confirmChanges ? undefined : { type: 'commit' },
    };
  },
};

/**
 * context: { rows, index, reports, settings, can, userId, now }.
 * call: { name, args, unknown? } — из локального разбора или от локальной модели.
 */
export function executeTool(call, context) {
  const handler = HANDLERS[call.name];
  if (!handler) return { text: 'Это действие я пока не умею выполнять.' };
  const args = call.args.filters ? { ...call.args, filters: withFilters(call.args.filters) } : call.args;
  const result = handler(args, context);
  return { ...result, text: result.text + unknownNote(call.unknown) };
}
