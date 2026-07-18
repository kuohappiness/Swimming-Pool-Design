import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveReferenceGeometry } from './reference-geometry.mjs';
import { buildViewerModel, hashData } from './viewer-data.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN_PATTERN = /\{\{(model|derived):([A-Za-z0-9_.]+)\|([a-zA-Z]+)\}\}/g;
const SCENE_PATTERN = /^<!--\s*scene:([a-z0-9-]+)\s*-->$/;

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const formatNumber = (value, digits = 3) => Number(value).toFixed(digits)
  .replace(/\.0+$/, '')
  .replace(/(\.\d*?)0+$/, '$1');

function formatToken(value, format) {
  const numeric = typeof value === 'object' && value !== null && 'value' in value ? value.value : value;
  if (!Number.isFinite(numeric)) throw new TypeError(`Model token format ${format} requires a finite number.`);
  if (format === 'degree') return `${formatNumber(numeric, 1)}°`;
  if (format === 'metre') return `${formatNumber(numeric, 3)} m`;
  if (format === 'elevation') return `${numeric >= 0 ? '+' : ''}${Number(numeric).toFixed(3)} m`;
  if (format === 'number') return formatNumber(numeric, 3);
  throw new TypeError(`Unknown model token format: ${format}`);
}

function getPath(owner, path) {
  const value = path.split('.').reduce((current, segment) => current?.[segment], owner);
  if (value === undefined) throw new TypeError(`Model token path does not exist: ${path}`);
  return value;
}

export function injectModelTokens(markdown, model) {
  const derived = deriveReferenceGeometry(model);
  const output = markdown.replace(TOKEN_PATTERN, (_, owner, path, format) =>
    formatToken(getPath(owner === 'model' ? model : derived, path), format));
  const unresolved = output.match(/\{\{[^}]+\}\}/g);
  if (unresolved) throw new TypeError(`Unresolved model token: ${unresolved[0]}`);
  return output;
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/  $/, '<br>');
}

function markdownToHtml(lines) {
  const html = [];
  let paragraph = [];
  let listType = null;

  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (listType) html.push(`</${listType}>`);
    listType = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const unordered = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (!line.trim()) {
      flushParagraph();
      closeList();
    } else if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
    } else if (line.startsWith('> ')) {
      flushParagraph();
      closeList();
      html.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
    } else if (unordered || ordered) {
      flushParagraph();
      const nextType = unordered ? 'ul' : 'ol';
      if (listType !== nextType) {
        closeList();
        listType = nextType;
        html.push(`<${listType}>`);
      }
      html.push(`<li>${inlineMarkdown((unordered ?? ordered)[1])}</li>`);
    } else if (line === '---') {
      flushParagraph();
      closeList();
      html.push('<hr>');
    } else {
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  closeList();
  return html.join('\n');
}

export function compilePublicContent(markdown, model, sceneManifest) {
  const renderedMarkdown = injectModelTokens(markdown, model);
  const sceneIds = new Set(sceneManifest.scenes.map((scene) => scene.id));
  if (sceneIds.size !== sceneManifest.scenes.length) throw new TypeError('Scene manifest IDs must be unique.');

  const sceneLines = new Map();
  const references = new Set();
  let currentScene = null;
  for (const line of renderedMarkdown.split(/\r?\n/)) {
    const sceneMatch = line.trim().match(SCENE_PATTERN);
    if (sceneMatch) {
      const sceneId = sceneMatch[1];
      if (!sceneIds.has(sceneId)) throw new TypeError(`Markdown references unknown scene ID: ${sceneId}`);
      if (references.has(sceneId)) throw new TypeError(`Markdown references scene ID more than once: ${sceneId}`);
      references.add(sceneId);
      currentScene = sceneId;
      sceneLines.set(sceneId, []);
    } else if (currentScene) {
      sceneLines.get(currentScene).push(line);
    } else if (line.trim()) {
      throw new TypeError('Public Markdown must begin with an explicit scene reference.');
    }
  }

  const missing = [...sceneIds].filter((sceneId) => !references.has(sceneId));
  if (missing.length) throw new TypeError(`Markdown is missing scene IDs: ${missing.join(', ')}`);

  const scenes = sceneManifest.scenes.map((scene) => {
    const lines = sceneLines.get(scene.id);
    const titleLine = lines.find((line) => /^#{1,3}\s+/.test(line));
    return {
      id: scene.id,
      label: scene.label,
      title: titleLine?.replace(/^#{1,3}\s+/, '') ?? scene.label,
      html: markdownToHtml(lines),
    };
  });
  const compiled = {
    schemaVersion: '1.0.0',
    modelVersion: model.modelVersion,
    modelHash: hashData(model),
    sourceHash: hashData(markdown),
    scenes,
  };
  return { ...compiled, contentHash: hashData(compiled) };
}

export async function buildPublicContent({ root = repoRoot } = {}) {
  const [modelText, markdown, manifestText, registryText] = await Promise.all([
    readFile(resolve(root, 'model/project-model.json'), 'utf8'),
    readFile(resolve(root, 'docs/public/swimming-pool-renovation-design-concept.md'), 'utf8'),
    readFile(resolve(root, 'reference/src/3d-viewer/scene-manifest.json'), 'utf8'),
    readFile(resolve(root, 'model/analysis-registry.json'), 'utf8').catch(() => '{}'),
  ]);
  const model = JSON.parse(modelText);
  const sceneManifest = JSON.parse(manifestText);
  const analysisRegistry = JSON.parse(registryText);
  const content = compilePublicContent(markdown, model, sceneManifest);
  const viewerModel = buildViewerModel(model, analysisRegistry);
  const outputDirectory = resolve(root, 'reference/generated');
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(resolve(outputDirectory, 'concept-content.json'), `${JSON.stringify(content, null, 2)}\n`),
    writeFile(resolve(outputDirectory, 'viewer-model.json'), `${JSON.stringify(viewerModel, null, 2)}\n`),
  ]);
  return { content, viewerModel };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { content, viewerModel } = await buildPublicContent();
  process.stdout.write(`Built Viewer data ${viewerModel.modelVersion} · ${viewerModel.modelHash.slice(0, 12)} · content ${content.contentHash.slice(0, 12)}\n`);
}
