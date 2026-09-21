import { useMemo, useState } from 'react';
import { Link } from '../../../app/router.jsx';
import { getTransitionTargets, PHASES } from '../../../domain/workflow.js';
import { cn } from '../../../lib/cn.js';
import { useOffsetTop } from '../../../lib/useOffsetTop.js';
import { Avatar } from '../../../ui/Avatar.jsx';
import { Hint } from '../../../ui/Hint.jsx';
import { TransitionDialog } from '../TransitionDialog.jsx';
import { SlaBadge } from './SlaBadge.jsx';
import styles from './InteractionBoard.module.css';

/**
 * Доска этапов. Карточку можно перетащить на соседний этап — откроется окно перехода,
 * где можно добавить комментарий и файлы. Недоступные для перехода колонки приглушаются.
 * Без мыши (и на телефоне) этап меняется в карточке взаимодействия.
 * На компьютере доска дотягивается до низа окна: горизонтальная прокрутка — у нижнего края экрана.
 */
export function InteractionBoard({ workflow, rows }) {
  const [dragged, setDragged] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [pendingTransition, setPendingTransition] = useState(null);
  const [boardRef, boardTop] = useOffsetTop();

  const rowsByStage = useMemo(() => {
    const grouped = new Map(workflow.stages.map((stage) => [stage.id, []]));
    rows.forEach((row) => grouped.get(row.stageId)?.push(row));
    return grouped;
  }, [rows, workflow]);

  const allowedTargets = useMemo(
    () => new Set(dragged ? getTransitionTargets(workflow, dragged.stageId).map((target) => target.stage.id) : []),
    [dragged, workflow],
  );

  const endDrag = () => {
    setDragged(null);
    setDropTarget(null);
  };

  const handleDrop = (stageId) => {
    if (dragged && allowedTargets.has(stageId)) setPendingTransition({ row: dragged, stageId });
    endDrag();
  };

  return (
    <>
      <div ref={boardRef} className={styles.board} style={{ '--board-top': `${boardTop}px` }}>
        {PHASES.map((phase) => {
          const stages = workflow.stages.filter((stage) => stage.phase === phase.id);
          if (stages.length === 0) return null;
          const phaseCount = stages.reduce((sum, stage) => sum + rowsByStage.get(stage.id).length, 0);

          return (
            <section key={phase.id} className={styles.phase} aria-label={`Фаза «${phase.label}»`}>
              <header className={styles.phaseHeader}>
                <span>{phase.label}</span>
                <span className={styles.phaseCount}>{phaseCount}</span>
              </header>
              <div className={styles.columns}>
                {stages.map((stage) => {
                  const stageRows = rowsByStage.get(stage.id);
                  const isAllowed = allowedTargets.has(stage.id);
                  return (
                    <div
                      key={stage.id}
                      className={cn(
                        styles.column,
                        dragged && !isAllowed && dragged.stageId !== stage.id && styles.dimmed,
                        dropTarget === stage.id && isAllowed && styles.dropTarget,
                      )}
                      onDragOver={(event) => {
                        if (!isAllowed) return;
                        event.preventDefault();
                        setDropTarget(stage.id);
                      }}
                      onDragLeave={() => setDropTarget((current) => (current === stage.id ? null : current))}
                      onDrop={() => handleDrop(stage.id)}
                    >
                      <header className={styles.columnHeader}>
                        <Hint text={stage.hint}>
                          <h3 className={styles.columnTitle}>{stage.name}</h3>
                        </Hint>
                        <span className={styles.columnMeta}>
                          {stageRows.length} · срок {stage.slaDays} дн.{stage.optional && ' · необязательный'}
                        </span>
                      </header>
                      <ul className={styles.cards}>
                        {stageRows.map((row) => (
                          <li key={row.id}>
                            <Link
                              to={`/interactions/${row.id}`}
                              className={cn(styles.card, dragged?.id === row.id && styles.dragging)}
                              draggable
                              onDragStart={(event) => {
                                event.dataTransfer.effectAllowed = 'move';
                                setDragged(row);
                              }}
                              onDragEnd={endDrag}
                            >
                              <span className={styles.cardTitle}>{row.university.shortName}</span>
                              <span className={styles.cardMeta}>
                                {row.direction.name} · {row.product.name}
                              </span>
                              <span className={styles.cardFooter}>
                                <SlaBadge sla={row.sla} compact />
                                {row.manager && (
                                  <span title={row.manager.name}>
                                    <Avatar name={row.manager.name} size="s" />
                                  </span>
                                )}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                      {stageRows.length === 0 && <p className={styles.emptyColumn}>Нет взаимодействий</p>}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {pendingTransition && (
        <TransitionDialog
          key={`${pendingTransition.row.id}:${pendingTransition.stageId}`}
          row={pendingTransition.row}
          preferredStageId={pendingTransition.stageId}
          open
          onOpenChange={(open) => !open && setPendingTransition(null)}
        />
      )}
    </>
  );
}
