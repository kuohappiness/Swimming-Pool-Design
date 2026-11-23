// 印出年度能量的完整報告（JSON）。運算在 core/solar/solar-energy-analysis.mjs。
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildSolarEnergyReport } from '../../core/solar/solar-energy-analysis.mjs';

const root = resolve(import.meta.dirname, '../..');
const model = JSON.parse(await readFile(resolve(root, 'model/project-model.json'), 'utf8'));
const pvgis = JSON.parse(
  await readFile(resolve(root, 'source-materials/site/SRC-SITE-003_pvgis-5-3-tmy.json'), 'utf8'),
);
console.log(JSON.stringify(buildSolarEnergyReport(model, pvgis), null, 2));
