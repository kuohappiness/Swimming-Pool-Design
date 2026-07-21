import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const inputs = process.argv.slice(2).map((input) => resolve(input));
if (inputs.length === 0) throw new TypeError('Provide one or more SVG paths to render.');

const browserCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

async function firstExisting(paths) {
  for (const path of paths) {
    try {
      await access(path, constants.X_OK);
      return path;
    } catch {
      // Try the next installed browser.
    }
  }
  throw new Error('Chrome or Edge executable was not found.');
}

const browser = await chromium.launch({ executablePath: await firstExisting(browserCandidates), headless: true });
try {
  for (const input of inputs) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(input).href, { waitUntil: 'load' });
    const output = resolve(dirname(input), basename(input, '.svg') + '.png');
    await page.screenshot({ path: output, fullPage: false });
    await page.close();
    process.stdout.write(`${output}\n`);
  }
} finally {
  await browser.close();
}
