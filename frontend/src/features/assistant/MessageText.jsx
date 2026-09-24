import styles from './AssistantChat.module.css';

/**
 * Упрощённая разметка ответов: абзацы, списки «- » и «1. », **жирный** и `код`.
 * Строится из React-элементов, без innerHTML: текст модели не может внедрить разметку в страницу.
 */
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={index} className={styles.code}>{part.slice(1, -1)}</code>;
    return part;
  });
}

const BULLET = /^\s*[-•*]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

function toBlocks(text) {
  const blocks = [];
  for (const line of text.split('\n')) {
    const kind = BULLET.test(line) ? 'ul' : NUMBERED.test(line) ? 'ol' : line.trim() ? 'p' : null;
    const last = blocks.at(-1);
    if (!kind) {
      blocks.push({ kind: 'break' });
      continue;
    }
    const content = line.replace(kind === 'ul' ? BULLET : kind === 'ol' ? NUMBERED : '', '').trim();
    if (last?.kind === kind && kind !== 'p') last.items.push(content);
    else if (last?.kind === 'p' && kind === 'p') last.items.push(content);
    else blocks.push({ kind, items: [content] });
  }
  return blocks.filter((block) => block.kind !== 'break');
}

export function MessageText({ text }) {
  if (!text) return null;
  return (
    <div className={styles.text}>
      {toBlocks(text).map((block, index) => {
        if (block.kind === 'p') return <p key={index}>{block.items.map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 && <br />}{inline(line)}</span>)}</p>;
        const List = block.kind;
        return <List key={index} className={styles.list}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</List>;
      })}
    </div>
  );
}
