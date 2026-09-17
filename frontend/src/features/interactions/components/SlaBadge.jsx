import { formatDays } from '../../../domain/format.js';
import { SLA_STATE } from '../../../domain/workflow.js';
import { Badge } from '../../../ui/Badge.jsx';
import { SuccessIcon, TimeIcon, WarningIcon } from '../../../ui/icons.js';

/** Срок текущего этапа человеческим языком: «Просрочено на 4 дня», «Осталось 2 дня». */
export function SlaBadge({ sla, compact = false }) {
  switch (sla.state) {
    case SLA_STATE.overdue:
      return (
        <Badge tone="warning" icon={WarningIcon}>
          {compact ? `−${formatDays(-sla.daysLeft)}` : `Просрочено на ${formatDays(-sla.daysLeft)}`}
        </Badge>
      );
    case SLA_STATE.soon:
      return (
        <Badge tone="brand" icon={TimeIcon}>
          {sla.daysLeft === 0 ? 'Срок сегодня' : `Осталось ${formatDays(sla.daysLeft)}`}
        </Badge>
      );
    case SLA_STATE.done:
      return (
        <Badge tone="success" icon={SuccessIcon}>
          Завершено
        </Badge>
      );
    default:
      return (
        <Badge tone="neutral" icon={TimeIcon}>
          {compact ? formatDays(sla.daysLeft) : `В срок · ${formatDays(sla.daysLeft)}`}
        </Badge>
      );
  }
}
