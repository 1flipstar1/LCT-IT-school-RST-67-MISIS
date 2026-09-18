import { formatDays } from '../../../domain/format.js';
import { SLA_STATE } from '../../../domain/workflow.js';
import { Badge } from '../../../ui/Badge.jsx';

/** Срок текущего этапа человеческим языком: «Просрочено на 4 дня», «Осталось 2 дня». Без значков — смысл несут текст и цвет. */
export function SlaBadge({ sla, compact = false }) {
  switch (sla.state) {
    case SLA_STATE.overdue:
      return (
        <Badge tone="warning">
          {compact ? `−${formatDays(-sla.daysLeft)}` : `Просрочено на ${formatDays(-sla.daysLeft)}`}
        </Badge>
      );
    case SLA_STATE.soon:
      return (
        <Badge tone="brand">
          {sla.daysLeft === 0 ? 'Срок сегодня' : `Осталось ${formatDays(sla.daysLeft)}`}
        </Badge>
      );
    case SLA_STATE.done:
      return (
        <Badge tone="success">
          Завершено
        </Badge>
      );
    default:
      return (
        <Badge tone="neutral">
          {compact ? formatDays(sla.daysLeft) : `В срок · ${formatDays(sla.daysLeft)}`}
        </Badge>
      );
  }
}
