import { useId, useState } from 'react';
import { formatFileSize } from '../domain/format.js';
import { cn } from '../lib/cn.js';
import { IconButton } from './IconButton.jsx';
import { AttachmentIcon, CloseIcon, DocumentIcon } from './icons.js';
import styles from './FileDropzone.module.css';

/**
 * Зона загрузки файлов: перетаскивание или выбор. Каждый файл проходит validate(file) —
 * при ошибке файл не добавляется, а onError получает AppError с кодом.
 */
export function FileDropzone({ files, onChange, accept, multiple = true, validate, onError, title = 'Перетащите файлы сюда', hint }) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  const addFiles = (fileList) => {
    const accepted = [];
    for (const file of fileList) {
      try {
        validate?.(file);
        accepted.push(file);
      } catch (error) {
        onError?.(error);
      }
    }
    if (accepted.length > 0) onChange(multiple ? [...files, ...accepted] : accepted.slice(0, 1));
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };

  return (
    <div className={styles.root}>
      <label
        htmlFor={inputId}
        className={cn(styles.zone, dragging && styles.dragging)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <AttachmentIcon size={24} fill="currentColor" className={styles.zoneIcon} />
        <span className={styles.zoneTitle}>
          {title} или <span className={styles.pick}>выберите на компьютере</span>
        </span>
        {hint && <span className={styles.zoneHint}>{hint}</span>}
        <input
          id={inputId}
          type="file"
          className="visually-hidden"
          accept={accept}
          multiple={multiple}
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </label>

      {files.length > 0 && (
        <ul className={styles.list}>
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className={styles.file}>
              <DocumentIcon size={20} fill="currentColor" className={styles.fileIcon} />
              <span className={styles.fileName}>{file.name}</span>
              <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
              <IconButton
                icon={CloseIcon}
                size="s"
                label={`Убрать файл ${file.name}`}
                onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
