import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { HELP_ARTICLES } from '../src/features/help/articles/index.js';
import { PAGES } from '../src/features/assistant/engine/tools.js';
import { PERMISSION, ROLE, ROLE_INFO, can } from '../src/domain/roles.js';

const target = fileURLToPath(new URL('../../backend/app/assistant_knowledge.json', import.meta.url));
const roles = Object.values(ROLE);
const permissions = Object.values(PERMISSION);
const knowledge = {
  articles: HELP_ARTICLES.map(({ id, title, summary, steps, tips, keywords, permission, category }) => ({
    id, title, summary, steps, tips: tips ?? [], keywords: keywords ?? [], permission: permission ?? null, category,
  })),
  pages: PAGES.map(({ id, label, path, permission, stems }) => ({ id, label, path, permission: permission ?? null, stems })),
  roles: Object.fromEntries(roles.map((role) => [role, {
    label: ROLE_INFO[role].label,
    description: ROLE_INFO[role].description,
    permissions: permissions.filter((permission) => can(role, permission)),
  }])),
};
const serialized = `${JSON.stringify(knowledge, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = await readFile(target, 'utf8');
  if (current !== serialized) {
    throw new Error('assistant_knowledge.json устарел: выполните npm run export:assistant-knowledge');
  }
} else {
  await writeFile(target, serialized);
  process.stdout.write(`Сохранено ${knowledge.articles.length} статей справки и ${knowledge.pages.length} разделов.\n`);
}
