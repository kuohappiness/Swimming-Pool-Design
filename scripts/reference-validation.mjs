import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const closeTo = (actual, expected, tolerance = 0.002) =>
  Math.abs(actual - expected) <= tolerance;

const duplicateValues = (values) => {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
};

export function validateModel(model) {
  const errors = [];
  const entityIds = model.entities.map((entity) => entity.id);
  const sheetIds = model.sheets.map((sheet) => sheet.id);
  const sourceIds = model.sources.map((source) => source.id);

  for (const [label, ids] of [
    ['entity', entityIds],
    ['sheet', sheetIds],
    ['source', sourceIds],
  ]) {
    for (const duplicate of duplicateValues(ids)) {
      errors.push(`${label} ID 重複：${duplicate}`);
    }
  }

  const entitySet = new Set(entityIds);
  const sourceSet = new Set(sourceIds);
  for (const sheet of model.sheets) {
    for (const entityId of sheet.referencedEntityIds) {
      if (!entitySet.has(entityId)) {
        errors.push(`${sheet.id} 引用了不存在的 entity：${entityId}`);
      }
    }
  }
  for (const entity of model.entities) {
    for (const sourceId of entity.sourceIds) {
      if (!sourceSet.has(sourceId)) {
        errors.push(`${entity.id} 引用了不存在的 source：${sourceId}`);
      }
    }
  }

  const { building, pool, roof, stair, combinedCubicle } = model.geometry;
  if (!closeTo(building.length.value, building.poolHallLength.value + building.serviceCoreLength.value)) {
    errors.push('整體建築長度必須等於泳池大廳與服務核心長度總和');
  }
  const poolRight = pool.origin[0] + pool.length.value;
  const poolTop = pool.origin[1] + pool.width.value;
  if (pool.origin[0] <= 0 || pool.origin[1] <= 0 || poolRight >= building.poolHallLength.value || poolTop >= building.width.value) {
    errors.push('主泳池必須完整位於泳池大廳內，且四周池畔淨寬必須大於零');
  }

  const expectedRoofHigh = roof.lowElevation.value
    + building.poolHallLength.value * Math.tan(roof.pitch.value * Math.PI / 180);
  if (!closeTo(roof.highElevation.value, expectedRoofHigh)) {
    errors.push(`屋頂高側標高與 ${roof.pitch.value}° 坡度不一致；應為 ${expectedRoofHigh.toFixed(3)} m`);
  }
  if (roof.coverageZoneId !== 'Z-PH-01') errors.push('玻璃屋頂只能覆蓋 Z-PH-01 泳池大廳');
  if (roof.highEdge !== 'service-core-end' || roof.lowEdge !== 'far-pool-end') {
    errors.push('玻璃屋頂必須服務核心端高、泳池遠端低');
  }

  if (stair.runs !== 2 || stair.risersPerRun * stair.runs !== stair.riserCount) {
    errors.push('ST-01 必須是兩段等階數樓梯，階數總和須一致');
  }
  if (stair.stringers !== 2 || stair.underStair !== 'fully-open' || stair.supportedByRoof !== false) {
    errors.push('ST-01 必須使用雙鋼梯梁、梯下完全開放，且不得由玻璃屋頂承重');
  }
  if (stair.guardrail !== 'transparent' || stair.enclosure !== 'dry-glass-gallery') {
    errors.push('ST-01 必須具有透明欄杆並位於乾式玻璃樓梯廊');
  }

  if (!combinedCubicle.integratedChangingShower || !combinedCubicle.wallMountedCabinet) {
    errors.push('每一單元必須整合更衣、淋浴及壁掛置物櫃');
  }
  if (combinedCubicle.centralLockerArea) errors.push('不得設置集中式置物櫃區');
  if (!model.program.l2.strictGenderSeparation) errors.push('L2 男女更衣淋浴區必須完全分離');

  const allCubicleIds = [];
  for (const [label, area] of Object.entries({
    male: model.program.l2.male,
    female: model.program.l2.female,
  })) {
    if (area.baseCount !== 15 || area.activeIds.length !== 15) {
      errors.push(`${label} 必須配置 15 間正式更衣淋浴單元`);
    }
    if (area.maximumCount !== 20 || area.activeIds.length + area.expansionIds.length !== 20) {
      errors.push(`${label} 必須保留擴充至 20 間的空間`);
    }
    allCubicleIds.push(...area.activeIds, ...area.expansionIds);
  }
  for (const duplicate of duplicateValues(allCubicleIds)) errors.push(`更衣淋浴單元 ID 重複：${duplicate}`);

  const requiredSheetIds = ['REF-001', 'REF-101', 'REF-201', 'REF-301', 'REF-401', 'REF-501'];
  for (const id of requiredSheetIds) {
    if (!sheetIds.includes(id)) errors.push(`缺少必要圖面：${id}`);
  }
  if (model.referenceSystem.worldOriginEntityId !== 'O-SITE-01') errors.push('世界座標原點必須綁定 O-SITE-01');
  if (model.referenceSystem.axes.x !== 'east' || model.referenceSystem.axes.y !== 'north' || model.referenceSystem.axes.z !== 'up') {
    errors.push('世界座標軸必須為 +X 東、+Y 北、+Z 上');
  }

  return errors;
}

export async function validateSourceFiles(model, repoRoot) {
  const errors = [];
  for (const source of model.sources) {
    const fullPath = resolve(repoRoot, source.path);
    try {
      const bytes = await readFile(fullPath);
      const hash = createHash('sha256').update(bytes).digest('hex').toUpperCase();
      if (hash !== source.sha256) errors.push(`${source.id} SHA-256 不一致`);
    } catch (error) {
      errors.push(`${source.id} 圖檔不存在或無法讀取：${error.message}`);
    }
  }
  return errors;
}
