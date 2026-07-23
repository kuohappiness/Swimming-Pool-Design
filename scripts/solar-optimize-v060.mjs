import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  buildPvgisWeatherSamples,
  evaluateEnergySensitivity,
  evaluateMirrorEnergy,
  scanMirrorEnergyAngles,
} from './solar-energy-analysis.mjs';

const root = resolve(import.meta.dirname, '..');
const model = JSON.parse(await readFile(resolve(root, 'model/project-model.json'), 'utf8'));
const pvgis = JSON.parse(await readFile(resolve(root, 'source-materials/site/SRC-SITE-003_pvgis-5-3-tmy.json'), 'utf8'));
const weather = buildPvgisWeatherSamples(model, pvgis);
const range = (start, end, step) => Array.from({ length: Math.floor((end - start) / step) + 1 }, (_, index) => Number((start + index * step).toFixed(3)));
const coarse = scanMirrorEnergyAngles(model, weather, {
  planRotations: range(-20, 40, 2),
  leanAngles: range(10, 40, 2),
});
if (!coarse.bestStrictWarmZero) throw new Error('No coarse strict-warm-zero current-model candidate was found.');
const seed = coarse.bestStrictWarmZero.input;
const fine = scanMirrorEnergyAngles(model, weather, {
  planRotations: range(Math.max(-20, seed.planRotation - 2), Math.min(40, seed.planRotation + 2), 0.5),
  leanAngles: range(Math.max(-10, seed.mirrorLeanFromVertical - 2), Math.min(40, seed.mirrorLeanFromVertical + 2), 0.5),
});
if (!fine.bestStrictWarmZero) throw new Error('No fine strict-warm-zero current-model candidate was found.');
const best = fine.bestStrictWarmZero.input;
const current = evaluateMirrorEnergy(model, weather, {
  planRotation: best.planRotation,
  mirrorLeanFromVertical: best.mirrorLeanFromVertical,
});
const sensitivity = evaluateEnergySensitivity(model, weather, {
  planRotation: best.planRotation,
  mirrorLeanFromVertical: best.mirrorLeanFromVertical,
});
console.log(JSON.stringify({
  coarseCandidateCount: coarse.candidateCount,
  coarseStrictWarmZeroCount: coarse.strictWarmZeroCount,
  coarseBest: coarse.bestStrictWarmZero,
  fineCandidateCount: fine.candidateCount,
  fineStrictWarmZeroCount: fine.strictWarmZeroCount,
  best: current,
  pivotSensitivity: sensitivity.results.map((result) => ({
    pivotX: result.input.pivotX,
    warmPoolAddedKWh: result.warm.poolAddedKWh,
    coolPoolAddedKWh: result.cool.poolAddedKWh,
    coolPoolIncreasePercent: result.cool.poolIncreasePercent,
  })),
}, null, 2));
