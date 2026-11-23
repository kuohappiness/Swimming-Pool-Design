import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSourceRegistry } from './source-registry.mjs';
import { entryStatus, validateBacklog, validateRoadmap } from './workflow-docs.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const errors = [];

async function collectMarkdown(relativeDir) {
  const absoluteDir = path.join(repoRoot, relativeDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdown(relativePath)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(relativePath);
    }
  }

  return files;
}

async function collectFiles(relativeDir) {
  const entries = await readdir(path.join(repoRoot, relativeDir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(relativePath)));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function markdownTargets(content) {
  const targets = [];
  const pattern = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of content.matchAll(pattern)) {
    let target = match[1].trim();
    if (target.startsWith('<') && target.endsWith('>')) {
      target = target.slice(1, -1);
    }
    targets.push(target);
  }
  return targets;
}

function resolveLocalLink(sourceRelativePath, rawTarget) {
  if (
    rawTarget.startsWith('#') ||
    /^[a-z][a-z\d+.-]*:/i.test(rawTarget) ||
    rawTarget.startsWith('//')
  ) {
    return null;
  }

  const withoutFragment = rawTarget.split('#', 1)[0];
  if (!withoutFragment) return null;

  let decoded;
  try {
    decoded = decodeURIComponent(withoutFragment);
  } catch {
    errors.push(`${sourceRelativePath}: malformed link encoding: ${rawTarget}`);
    return null;
  }

  return path.resolve(repoRoot, path.dirname(sourceRelativePath), decoded);
}

function tableDeclarations(content, prefix) {
  const pattern = new RegExp(`^\\|\\s*(${prefix}-\\d{3})\\s*\\|`, 'gm');
  return [...content.matchAll(pattern)].map((match) => match[1]);
}

function ensureUnique(ids, namespace, source) {
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push(`${source}: duplicate ${namespace} declaration ${id}`);
    }
    seen.add(id);
  }
}

function metadata(content) {
  const result = new Map();
  const header = content.split(/\n##\s/, 1)[0];
  const pattern = /^-\s*(日期|類型|狀態|任務|目標版本|完成日期)：\s*(.+)$/gm;
  for (const match of header.matchAll(pattern)) {
    result.set(match[1], match[2].trim());
  }
  return result;
}

export function validateTaskConcurrency({
  taskRows,
  decisionContent,
  activeSpecContents,
  source = 'docs/roadmap.md',
}) {
  const concurrencyErrors = [];
  const inProgressRows = taskRows.filter((row) => row[2] === 'in_progress');
  if (inProgressRows.length <= 1) return concurrencyErrors;

  const targets = inProgressRows.map((row) => row[3]);
  for (const [index, target] of targets.entries()) {
    if (!/^\d+\.\d+\.\d+$/.test(target)) {
      concurrencyErrors.push(
        `${source}: ${inProgressRows[index][0]} has unknown parallel target ${target}`,
      );
    }
  }

  const targetCounts = new Map();
  for (const target of targets) targetCounts.set(target, (targetCounts.get(target) ?? 0) + 1);
  for (const [target, count] of targetCounts) {
    if (count > 1) {
      concurrencyErrors.push(
        `${source}: parallel workflow allows at most one in_progress task for ${target}; found ${count}`,
      );
    }
  }

  const approvedTargets = new Set(['0.7.0', '0.8.0']);
  if (targets.some((target) => !approvedTargets.has(target))) {
    concurrencyErrors.push(`${source}: parallel workflow is approved only for 0.7.0 and 0.8.0`);
  }

  const integrationTasks = new Set(['TASK-059', 'TASK-065']);
  const conflictingIntegrationTask = inProgressRows.find((row) => integrationTasks.has(row[0]));
  if (conflictingIntegrationTask) {
    concurrencyErrors.push(
      `${source}: shared integration task ${conflictingIntegrationTask[0]} must be the only in_progress task`,
    );
  }

  const decisionApproved =
    /^\|\s*DEC-120\s*\|.*平行.*\|\s*confirmed parallel-development boundary\s*\|/m.test(
      decisionContent,
    ) && /獨立 branch[／/]worktree/.test(decisionContent);
  if (!decisionApproved) {
    concurrencyErrors.push(
      `${source}: parallel tasks require confirmed DEC-120 isolation approval`,
    );
  }

  const hasActiveVisualSpec = activeSpecContents.some((content) => {
    const fields = metadata(content);
    return (
      fields.get('目標版本') === '0.8.0' && ['approved', 'in_progress'].includes(fields.get('狀態'))
    );
  });
  const activeSpecCorpus = activeSpecContents.join('\n');
  const specApproved =
    hasActiveVisualSpec &&
    activeSpecCorpus.includes('平行開發邊界') &&
    activeSpecCorpus.includes('隔離工作區') &&
    activeSpecCorpus.includes('integration-owned files');
  if (!specApproved) {
    concurrencyErrors.push(`${source}: parallel tasks require an active approved isolation spec`);
  }

  return concurrencyErrors;
}

const skillDirectories = [
  path.join('.claude', 'skills', 'swimming-pool-design'),
  path.join('.agents', 'skills', 'swimming-pool-design'),
];

const markdownFiles = [
  'README.md',
  'AGENTS.md',
  ...(await collectMarkdown('docs')),
  ...(await collectMarkdown('content')),
  ...(await collectMarkdown('drawings')),
  ...(await collectMarkdown('source-materials')),
  ...(await Promise.all(skillDirectories.map((directory) => collectMarkdown(directory)))).flat(),
];

const contents = new Map();
for (const relativePath of markdownFiles) {
  contents.set(relativePath, await readFile(path.join(repoRoot, relativePath), 'utf8'));
}

// 網站文案（content/）裡的站內連結是網址，不是檔案路徑：`./` 是首頁，`?view=<view id>` 必須是路由登錄表裡的分頁。
const routerSource = await readFile(path.join(repoRoot, 'web/src/app/router.ts'), 'utf8');
const registeredViewIds = new Set(
  [
    ...(routerSource.match(/export const viewIds = \[([^\]]*)\]/)?.[1] ?? '').matchAll(
      /'([^']+)'/g,
    ),
  ].map(([, id]) => id),
);
if (registeredViewIds.size === 0) errors.push('web/src/app/router.ts: viewIds could not be read');

function isSiteRouteLink(relativePath, target) {
  if (!relativePath.split(path.sep).join('/').startsWith('content/')) return false;
  const withoutFragment = target.split('#', 1)[0];
  if (withoutFragment === './') return true;
  const viewMatch = withoutFragment.match(/^\?view=([a-z0-9-]+)$/);
  if (!viewMatch) return false;
  if (!registeredViewIds.has(viewMatch[1])) {
    errors.push(`${relativePath}: link to unknown view ${target}`);
  }
  return true;
}

for (const [relativePath, content] of contents) {
  for (const target of markdownTargets(content)) {
    if (isSiteRouteLink(relativePath, target)) continue;
    const resolved = resolveLocalLink(relativePath, target);
    if (resolved && !(await exists(resolved))) {
      errors.push(`${relativePath}: broken local link ${target}`);
    }
  }
}

const decisionPath = path.join('docs', 'decisions.md');
const backlogPath = path.join('docs', 'backlog.md');
const sourcePath = path.join('docs', 'site-and-sources.md');
const taskPath = path.join('docs', 'roadmap.md');
const decisionContent = contents.get(decisionPath);
const backlogContent = contents.get(backlogPath);
const sourceContent = contents.get(sourcePath);
const taskContent = contents.get(taskPath);

ensureUnique(tableDeclarations(decisionContent, 'DEC'), 'DEC', decisionPath);
ensureUnique(tableDeclarations(backlogContent, 'OPEN'), 'OPEN', backlogPath);
errors.push(...validateBacklog({ text: backlogContent, source: backlogPath }));
for (const id of tableDeclarations(decisionContent, 'OPEN')) {
  errors.push(`${decisionPath}: ${id} belongs in ${backlogPath}`);
}
ensureUnique(tableDeclarations(sourceContent, 'SRC-(?:SITE|CONCEPT)'), 'SRC', sourcePath);
const canonicalModel = JSON.parse(
  await readFile(path.join(repoRoot, 'model', 'project-model.json'), 'utf8'),
);
errors.push(
  ...validateSourceRegistry({ text: sourceContent, source: sourcePath, model: canonicalModel }),
);

const taskRows = taskContent
  .split(/\r?\n/)
  .filter((line) => /^\|\s*TASK-\d{3}\s*\|/.test(line))
  .map((line) =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim()),
  );
const taskIds = taskRows.map((row) => row[0]);

// roadmap 的三節與狀態板（TASK-110）：每一列的狀態對得上入口的狀態行。
const roadmap = validateRoadmap({
  text: taskContent,
  source: taskPath,
  resolveEntry(href) {
    const resolved = resolveLocalLink(taskPath, href);
    if (!resolved) return undefined;
    const relativePath = path.relative(repoRoot, resolved);
    if (!contents.has(relativePath)) return undefined;
    return { path: relativePath, ...entryStatus(contents.get(relativePath)) };
  },
});
errors.push(...roadmap.errors);
ensureUnique([...taskIds, ...roadmap.taskIds], 'TASK', taskPath);

const allowedTaskStates = new Set(['queued', 'ready', 'in_progress', 'blocked', 'done']);
const taskIdSet = new Set(taskIds);
const taskLinkedFiles = new Set();

for (const row of taskRows) {
  const [taskId, , state, , ownerCell, dependencyCell] = row;
  if (!allowedTaskStates.has(state)) {
    errors.push(`${taskPath}: ${taskId} has invalid state ${state}`);
  }
  for (const dependency of dependencyCell.match(/TASK-\d{3}/g) ?? []) {
    if (!taskIdSet.has(dependency)) {
      errors.push(`${taskPath}: ${taskId} depends on undeclared ${dependency}`);
    }
  }

  for (const target of markdownTargets(ownerCell)) {
    const resolved = resolveLocalLink(taskPath, target);
    if (resolved) taskLinkedFiles.add(path.normalize(resolved));
  }
}

// 2026-11-22 以前的任務說明照舊格式（欄位清單）檢查，只限凍結清單裡的檔；新的任務說明寫狀態行（TASK-110）。
const legacyStatusDocs = new Set(
  JSON.parse(
    await readFile(path.join(repoRoot, 'tools', 'check', 'legacy-status-docs.json'), 'utf8'),
  ).map((file) => path.normalize(file)),
);
for (const file of legacyStatusDocs) {
  if (!contents.has(file))
    errors.push(`tools/check/legacy-status-docs.json: ${file} does not exist`);
}
const requiredSpecFields = ['日期', '類型', '狀態', '任務', '目標版本'];
const activeStatus = new Set(['draft', 'approved', 'in_progress']);
const archiveStatus = new Set(['completed', 'superseded']);
const taskDocs = markdownFiles.filter((file) => path.dirname(file) === path.join('docs', 'tasks'));
const archiveSpecs = markdownFiles.filter(
  (file) => path.dirname(file) === path.join('docs', 'archive', 'specs'),
);
for (const file of archiveSpecs) {
  if (!legacyStatusDocs.has(file)) {
    errors.push(
      `${file}: 完成的任務說明留在 docs/tasks/，只改狀態行，不再搬到 docs/archive/specs/`,
    );
  }
}
const activeSpecs = [];
for (const file of taskDocs) {
  const status = entryStatus(contents.get(file));
  if (status.missing) {
    if (legacyStatusDocs.has(file)) activeSpecs.push(file);
    else
      errors.push(
        `${file}: 標題下第一行要寫狀態行（狀態：<狀態值>｜下一步：<一句>｜等誰：<值>），見 docs/agents/workflow.md`,
      );
  } else if (status.error) {
    errors.push(`${file}: ${status.error}`);
  } else if (!roadmap.entries.has(file)) {
    errors.push(
      `${file}: 有狀態行的任務說明要在 ${taskPath} 的〈現在在哪裡〉、〈等觸發點〉或〈已完成〉有一列`,
    );
  }
}

errors.push(
  ...validateTaskConcurrency({
    taskRows,
    decisionContent,
    activeSpecContents: activeSpecs.map((file) => contents.get(file)),
    source: taskPath,
  }),
);

for (const file of [...activeSpecs, ...archiveSpecs]) {
  const fields = metadata(contents.get(file));
  for (const field of requiredSpecFields) {
    if (!fields.has(field)) errors.push(`${file}: missing spec metadata ${field}`);
  }

  const status = fields.get('狀態');
  if (activeSpecs.includes(file) && !activeStatus.has(status)) {
    errors.push(`${file}: active spec status must be draft, approved, or in_progress`);
  }
  if (archiveSpecs.includes(file)) {
    if (!archiveStatus.has(status)) {
      errors.push(`${file}: archived spec status must be completed or superseded`);
    }
    if (!fields.has('完成日期')) {
      errors.push(`${file}: archived spec requires 完成日期`);
    }
  }
}

for (const file of activeSpecs) {
  const absolute = path.normalize(path.join(repoRoot, file));
  if (!taskLinkedFiles.has(absolute)) {
    errors.push(`${file}: active spec is not referenced by a TASK owner/spec cell`);
  }
}

const readme = contents.get('README.md');
if (/\]\(docs\/tasks\//.test(readme) || /\]\(docs\/archive\/specs\//.test(readme)) {
  errors.push(
    'README.md: link through owner documents or the roadmap instead of individual task specs',
  );
}
if (/\b(?:DEC|OPEN|TASK)-\d{3}\b/.test(readme)) {
  errors.push('README.md: detailed DEC, OPEN, or TASK status belongs in owner documents');
}

// The public copy snapshot is regenerated only by release PRs (DEC-200); a release that bumps
// package.json must also run npm run build:copy. build-copy.mjs writes this line.
const packageVersion = JSON.parse(
  await readFile(path.join(repoRoot, 'package.json'), 'utf8'),
).version;
const snapshotVersion = /^- 對應網站版本：`([^`]+)`$/m.exec(
  await readFile(path.join(repoRoot, 'content', 'website-copy.md'), 'utf8'),
)?.[1];
if (snapshotVersion !== packageVersion) {
  errors.push(
    `content/website-copy.md: snapshot is for ${snapshotVersion ?? 'an unknown version'} but package.json is ${packageVersion}; ` +
      'the release PR must run npm run build:copy (DEC-200)',
  );
}

// The repo skill is kept as two real copies (no symlinks, for Windows);
// both tools must read the same bytes.
const [primarySkill, mirrorSkill] = await Promise.all(
  skillDirectories.map((directory) => collectFiles(directory)),
);
const primaryNames = primarySkill.map((file) => path.relative(skillDirectories[0], file)).sort();
const mirrorNames = mirrorSkill.map((file) => path.relative(skillDirectories[1], file)).sort();
if (primaryNames.join('\n') !== mirrorNames.join('\n')) {
  errors.push(`${skillDirectories[1]}: file list differs from ${skillDirectories[0]}`);
} else {
  for (const name of primaryNames) {
    const [first, second] = await Promise.all(
      skillDirectories.map((directory) => readFile(path.join(repoRoot, directory, name))),
    );
    if (!first.equals(second)) {
      errors.push(
        `${path.join(skillDirectories[1], name)}: differs from ${path.join(skillDirectories[0], name)}`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error('Documentation checks failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Documentation checks passed: ${markdownFiles.length} Markdown files, ` +
      `${taskRows.length} legacy tasks, ${roadmap.entries.size} roadmap entries, ` +
      `${taskDocs.length} task docs, ${archiveSpecs.length} archived specs.`,
  );
}
