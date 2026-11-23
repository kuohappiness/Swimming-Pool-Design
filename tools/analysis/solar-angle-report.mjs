// 印出日照角度與池面路徑的完整報告（JSON）。運算在 core/solar/solar-angle-analysis.mjs。
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildSolarAngleReport } from '../../core/solar/solar-angle-analysis.mjs';

const root = resolve(import.meta.dirname, '../..');
const model = JSON.parse(await readFile(resolve(root, 'model/project-model.json'), 'utf8'));
console.log(JSON.stringify(buildSolarAngleReport(model), null, 2));
