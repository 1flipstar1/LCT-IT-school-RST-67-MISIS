import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client.js';
import { describeError } from '../../domain/errors.js';
import { formatRelativeDateTime } from '../../domain/format.js';
import { downloadBlob } from '../../lib/download.js';
import { useActions } from '../../store/useActions.js';
import { Badge } from '../../ui/Badge.jsx';
import { Button } from '../../ui/Button.jsx';
import { Card, CardHeader } from '../../ui/Card.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Dialog } from '../../ui/Dialog.jsx';
import { EmptyState } from '../../ui/EmptyState.jsx';
import { DownloadIcon, HistoryIcon, RefreshIcon } from '../../ui/icons.js';
import { InlineAlert } from '../../ui/InlineAlert.jsx';
import { useToast } from '../../ui/Toast.jsx';
import styles from './ImportPage.module.css';

const statsLine = ({ stats }) =>
  [
    stats.updatedContracts && `договоров ${stats.updatedContracts}`,
    stats.newInteractions && `взаимодействий +${stats.newInteractions}`,
    stats.newUniversities && `вузов +${stats.newUniversities}`,
    stats.newContacts && `контактов +${stats.newContacts}`,
  ].filter(Boolean).join(' · ') || `строк ${stats.rows ?? 0}`;

/**
 * История импортов с сервера: кто, когда и что загрузил, исходный файл и отмена импорта целиком.
 * version — меняется после нового импорта, чтобы список перечитался.
 */
export function ImportHistory({ version, onRolledBack }) {
  const actions = useActions();
  const toast = useToast();
  const [jobs, setJobs] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    apiClient.listImports({ signal: controller.signal })
      .then((items) => {
        setJobs(items);
        setLoadError(null);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(error);
      });
    return () => controller.abort();
  }, [version, reload]);

  const downloadSource = async (job) => {
    try {
      downloadBlob(await apiClient.downloadAttachment(job.attachmentId), job.fileName);
    } catch (error) {
      toast.error(describeError(error).title);
    }
  };

  const rollback = async () => {
    setBusy(true);
    try {
      await actions.rollbackImport(confirming.id, { force: !confirming.canRollback });
      toast.success(`Импорт «${confirming.fileName}» отменён`);
      onRolledBack?.(confirming.id);
      setConfirming(null);
      setReload((value) => value + 1);
    } catch (error) {
      toast.error(error?.message || describeError(error).title);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="none" className={styles.history}>
      <CardHeader
        title="История импортов"
        hint="Каждая загрузка сохраняется вместе с исходным файлом. Импорт можно отменить целиком — справочники и договоры вернутся к состоянию до него."
        description="Последние загрузки из Excel и CSV"
        actions={<Button size="s" variant="ghost" icon={RefreshIcon} onClick={() => setReload((value) => value + 1)}>Обновить</Button>}
      />
      {loadError ? (
        <div className={styles.historyNote}><InlineAlert tone="warning" title="История недоступна">{describeError(loadError).hint}</InlineAlert></div>
      ) : (
        <DataTable
          caption="История импортов"
          rows={jobs ?? []}
          empty={<EmptyState icon={HistoryIcon} title={jobs ? 'Импортов пока не было' : 'Загружаем историю…'} description={jobs ? 'Здесь появится каждая загрузка файла.' : ''} />}
          columns={[
            {
              id: 'file',
              header: 'Файл',
              primary: true,
              cell: (job) => (
                <span className={styles.historyFile}>
                  <span>{job.fileName}</span>
                  <span className={styles.historyMeta}>{statsLine(job)}{job.issueCount ? ` · замечаний ${job.issueCount}` : ''}</span>
                </span>
              ),
            },
            { id: 'author', header: 'Кто загрузил', cell: (job) => job.createdByName || '—' },
            { id: 'date', header: 'Когда', cell: (job) => formatRelativeDateTime(job.createdAt) },
            {
              id: 'status',
              header: 'Статус',
              cell: (job) => (job.status === 'applied'
                ? <Badge tone="success">Применён</Badge>
                : <Badge tone="neutral" title={job.rolledBackByName ? `Отменил ${job.rolledBackByName}` : undefined}>Отменён</Badge>),
            },
            {
              id: 'actions',
              header: '',
              align: 'right',
              cell: (job) => (
                <span className={styles.historyActions}>
                  {job.attachmentId && <Button size="s" variant="ghost" icon={DownloadIcon} onClick={() => downloadSource(job)}>Файл</Button>}
                  {job.status === 'applied' && <Button size="s" variant="ghost" tone="warning" onClick={() => setConfirming(job)}>Отменить</Button>}
                </span>
              ),
            },
          ]}
        />
      )}

      <Dialog
        open={Boolean(confirming)}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Отменить импорт?"
        description={confirming ? `«${confirming.fileName}», ${formatRelativeDateTime(confirming.createdAt)}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)} disabled={busy}>Оставить</Button>
            <Button variant="primary" tone="warning" onClick={rollback} disabled={busy}>{busy ? 'Отменяем…' : 'Отменить импорт'}</Button>
          </>
        }
      >
        {confirming && (confirming.canRollback ? (
          <p className={styles.dialogText}>Вузы, продукты, программы, договоры и созданные импортом взаимодействия вернутся к состоянию до загрузки.</p>
        ) : (
          <InlineAlert tone="warning" title="После импорта данные уже меняли">
            Отмена вернёт справочники и взаимодействия к состоянию до импорта — изменения, сделанные после него, тоже пропадут.
          </InlineAlert>
        ))}
      </Dialog>
    </Card>
  );
}
