import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

async function collectMarkdown(relativeDir) {
  const absoluteDir = path.join(repoRoot, relativeDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectMarkdown(relativePath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(relativePath);
    }
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
    rawTarget.startsWith('#')
    || /^[a-z][a-z\d+.-]*:/i.test(rawTarget)
    || rawTarget.startsWith('//')
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
  source = 'docs/07_ACTIVE_WORK.md',
}) {
  const concurrencyErrors = [];
  const inProgressRows = taskRows.filter((row) => row[2] === 'in_progress');
  if (inProgressRows.length <= 1) return concurrencyErrors;

  const targets = inProgressRows.map((row) => row[3]);
  for (const [index, target] of targets.entries()) {
    if (!/^\d+\.\d+\.\d+$/.test(target)) {
      concurrencyErrors.push(`${source}: ${inProgressRows[index][0]} has unknown parallel target ${target}`);
    }
  }

  const targetCounts = new Map();
  for (const target of targets) targetCounts.set(target, (targetCounts.get(target) ?? 0) + 1);
  for (const [target, count] of targetCounts) {
    if (count > 1) {
      concurrencyErrors.push(`${source}: parallel workflow allows at most one in_progress task for ${target}; found ${count}`);
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

  const decisionApproved = /^\|\s*DEC-120\s*\|.*平行.*\|\s*confirmed parallel-development boundary\s*\|/m.test(decisionContent)
    && /獨立 branch[／/]worktree/.test(decisionContent);
  if (!decisionApproved) {
    concurrencyErrors.push(`${source}: parallel tasks require confirmed DEC-120 isolation approval`);
  }

  const hasActiveVisualSpec = activeSpecContents.some((content) => {
    const fields = metadata(content);
    return fields.get('目標版本') === '0.8.0'
      && ['approved', 'in_progress'].includes(fields.get('狀態'));
  });
  const activeSpecCorpus = activeSpecContents.join('\n');
  const specApproved = hasActiveVisualSpec
    && activeSpecCorpus.includes('平行開發邊界')
    && activeSpecCorpus.includes('隔離工作區')
    && activeSpecCorpus.includes('integration-owned files');
  if (!specApproved) {
    concurrencyErrors.push(`${source}: parallel tasks require an active approved isolation spec`);
  }

  return concurrencyErrors;
}

const markdownFiles = [
  'README.md',
  ...await collectMarkdown('docs'),
  ...await collectMarkdown('versions'),
  ...await collectMarkdown(path.join('.codex', 'skill')),
];

const contents = new Map();
for (const relativePath of markdownFiles) {
  contents.set(relativePath, await readFile(path.join(repoRoot, relativePath), 'utf8'));
}

for (const [relativePath, content] of contents) {
  for (const target of markdownTargets(content)) {
    const resolved = resolveLocalLink(relativePath, target);
    if (resolved && !await exists(resolved)) {
      errors.push(`${relativePath}: broken local link ${target}`);
    }
  }
}

const decisionPath = path.join('docs', '04_DECISIONS_AND_OPEN_ITEMS.md');
const sourcePath = path.join('docs', '02_SITE_AND_SOURCES.md');
const taskPath = path.join('docs', '07_ACTIVE_WORK.md');
const decisionContent = contents.get(decisionPath);
const sourceContent = contents.get(sourcePath);
const taskContent = contents.get(taskPath);

ensureUnique(tableDeclarations(decisionContent, 'DEC'), 'DEC', decisionPath);
ensureUnique(tableDeclarations(decisionContent, 'OPEN'), 'OPEN', decisionPath);
ensureUnique(tableDeclarations(sourceContent, 'SRC-(?:SITE|CONCEPT)'), 'SRC', sourcePath);

const taskRows = taskContent
  .split(/\r?\n/)
  .filter((line) => /^\|\s*TASK-\d{3}\s*\|/.test(line))
  .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
const taskIds = taskRows.map((row) => row[0]);
ensureUnique(taskIds, 'TASK', taskPath);

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

const requiredSpecFields = ['日期', '類型', '狀態', '任務', '目標版本'];
const activeStatus = new Set(['draft', 'approved', 'in_progress']);
const archiveStatus = new Set(['completed', 'superseded']);
const activeSpecs = markdownFiles.filter((file) =>
  path.dirname(file) === path.join('docs', 'specs')
);
const archiveSpecs = markdownFiles.filter((file) =>
  path.dirname(file) === path.join('docs', 'archive', 'specs')
);

errors.push(...validateTaskConcurrency({
  taskRows,
  decisionContent,
  activeSpecContents: activeSpecs.map((file) => contents.get(file)),
  source: taskPath,
}));

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
if (/\]\(docs\/specs\//.test(readme) || /\]\(docs\/archive\/specs\//.test(readme)) {
  errors.push('README.md: link through owner documents or Active Work instead of individual specs');
}
if (/\b(?:DEC|OPEN|TASK)-\d{3}\b/.test(readme)) {
  errors.push('README.md: detailed DEC, OPEN, or TASK status belongs in owner documents');
}

if (errors.length > 0) {
  console.error('Documentation checks failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Documentation checks passed: ${markdownFiles.length} Markdown files, `
    + `${taskRows.length} tasks, ${activeSpecs.length} active specs, `
    + `${archiveSpecs.length} archived specs.`,
  );
}
