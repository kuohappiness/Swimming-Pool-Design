import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createWebModuleServer } from '../../../../../../support/web-modules.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../../../../..');
const vite = await createWebModuleServer();
test.after(async () => vite.close());

const { createCloudNoise } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/lighting/cloud-noise.ts',
);
const { deriveSkyParameters } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/lighting/sky-parameters.ts',
);
const { SkyDome } = await vite.ssrLoadModule('/src/views/3d-viewer/rendering/lighting/sky-dome.ts');
const { isReflectionCapture, markReflectionCapture } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/lighting/reflection-capture.ts',
);
const { computeSunLighting } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/lighting/sun-lighting.ts',
);
const { toSceneLighting } = await vite.ssrLoadModule(
  '/src/views/3d-viewer/rendering/lighting/scene-lighting.ts',
);

const model = JSON.parse(readFileSync(resolve(repoRoot, 'model/project-model.json'), 'utf8'));
const siteLocation = model.referenceSystem.siteLocation;
const at = (month, day, time, weather = 'clear') => {
  const [hour, minute] = time.split(':').map(Number);
  return computeSunLighting({
    moment: { year: 2026, month, day, minutes: hour * 60 + minute },
    location: {
      latitude: siteLocation.latitude.value,
      longitude: siteLocation.longitude.value,
      utcOffsetHours: siteLocation.utcOffsetHours,
    },
    positiveXAxisBearingFromTrueNorth:
      model.referenceSystem.siteOrientation.positiveXAxisBearingFromTrueNorth,
    weather,
  });
};
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const fragmentShader = readFileSync(
  resolve(repoRoot, 'web/src/views/3d-viewer/rendering/lighting/shaders/sky-dome.frag.glsl'),
  'utf8',
);
const vertexShader = readFileSync(
  resolve(repoRoot, 'web/src/views/3d-viewer/rendering/lighting/shaders/sky-dome.vert.glsl'),
  'utf8',
);

test('cloud noise is reproducible, tiles in both directions and uses the whole range', () => {
  const noise = createCloudNoise(64, 8, 7);
  assert.equal(noise.data.length, 64 * 64);
  assert.deepEqual(createCloudNoise(64, 8, 7).data, noise.data);
  assert.notDeepEqual(createCloudNoise(64, 8, 8).data, noise.data);
  // 接縫：最後一行、列接回第一行、列時，差距和圖裡相鄰像素的差距同一個量級。
  let seam = 0;
  let inside = 0;
  for (let index = 0; index < 64; index += 1) {
    seam = Math.max(
      seam,
      Math.abs(noise.data[index * 64 + 63] - noise.data[index * 64]),
      Math.abs(noise.data[63 * 64 + index] - noise.data[index]),
    );
    inside = Math.max(
      inside,
      Math.abs(noise.data[index * 64 + 31] - noise.data[index * 64 + 32]),
      Math.abs(noise.data[31 * 64 + index] - noise.data[32 * 64 + index]),
    );
  }
  assert.ok(seam <= Math.max(inside, 12) + 12, `seam ${seam} vs inside ${inside}`);
  const values = [...noise.data];
  assert.ok(Math.min(...values) < 40 && Math.max(...values) > 215);
  for (const bad of [
    [0, 8],
    [64, 0],
    [64, 7],
    [64.5, 8],
  ]) {
    assert.throws(() => createCloudNoise(...bad), RangeError);
  }
});

test('the sky follows the same lighting state as the scene', () => {
  const noon = deriveSkyParameters(at(6, 21, '12:00'));
  const overcast = deriveSkyParameters(at(6, 21, '12:00', 'overcast'));
  const rain = deriveSkyParameters(at(6, 21, '12:00', 'rain'));
  const night = deriveSkyParameters(at(12, 21, '22:00'));
  const cloudyNight = deriveSkyParameters(at(12, 21, '22:00', 'overcast'));

  // 晴天：少雲、看得到日面、沒有星星。
  assert.ok(noon.cloudCover > 0.1 && noon.cloudCover < 0.5);
  assert.ok(luminance(noon.sunDiscColor) > 20);
  assert.equal(noon.stars, 0);
  assert.deepEqual(noon.moonColor, [0, 0, 0]);
  assert.deepEqual(noon.nightColor, [0, 0, 0]);
  assert.deepEqual(noon.twilightColor, [0, 0, 0]);
  // 受光的雲比雲底亮，也比天空的平均亮度亮。
  assert.ok(luminance(noon.cloudLit) > luminance(noon.cloudShade) * 2);

  // 陰天與雨天：滿天雲；雲層的亮度就是天光的亮度，雨天比陰天暗。
  assert.equal(overcast.cloudCover, 1);
  assert.equal(rain.cloudCover, 1);
  assert.ok(luminance(overcast.cloudLit) < luminance(noon.cloudLit) * 0.6);
  assert.ok(luminance(rain.cloudLit) < luminance(overcast.cloudLit));
  assert.ok(luminance(rain.groundColor) < luminance(noon.groundColor) * 0.5);

  // 夜裡：沒有日面，有月亮；星星只在沒有雲的地方看得到。
  assert.deepEqual(night.sunDiscColor, [0, 0, 0]);
  assert.equal(night.stars, 1 - night.cloudCover);
  assert.equal(cloudyNight.stars, 0);
  assert.ok(luminance(night.moonColor) > 1);
  assert.ok(luminance(night.nightColor) > 0 && luminance(night.nightColor) < 0.05);
  assert.ok(luminance(night.groundColor) < luminance(noon.groundColor) * 0.1);
});

test('twilight glow appears only while the sun is just below the horizon', () => {
  const glow = (time) => luminance(deriveSkyParameters(at(12, 21, time)).twilightColor);
  assert.equal(glow('16:30'), 0);
  assert.ok(glow('17:30') > 0.05, `17:30 ${glow('17:30')}`);
  assert.equal(glow('19:00'), 0);
  // 滿天雲時餘暉幾乎被擋掉。
  const cloudy = luminance(deriveSkyParameters(at(12, 21, '17:30', 'overcast')).twilightColor);
  assert.ok(cloudy < glow('17:30') * 0.3);
});

test('sky values stay finite and non-negative through a whole day, and clouds drift with time', () => {
  let previous = null;
  for (let minutes = 0; minutes < 1440; minutes += 10) {
    for (const weather of ['clear', 'overcast', 'rain']) {
      const sky = deriveSkyParameters(
        computeSunLighting({
          moment: { year: 2026, month: 9, day: 23, minutes },
          location: {
            latitude: siteLocation.latitude.value,
            longitude: siteLocation.longitude.value,
            utcOffsetHours: siteLocation.utcOffsetHours,
          },
          positiveXAxisBearingFromTrueNorth:
            model.referenceSystem.siteOrientation.positiveXAxisBearingFromTrueNorth,
          weather,
        }),
      );
      for (const value of [
        ...sky.sunDiscColor,
        ...sky.twilightColor,
        ...sky.nightColor,
        ...sky.moonColor,
        ...sky.cloudLit,
        ...sky.cloudShade,
        ...sky.groundColor,
        sky.stars,
        sky.cloudCover,
      ]) {
        assert.ok(Number.isFinite(value) && value >= 0, `${weather} ${minutes}: ${value}`);
      }
      assert.ok(sky.cloudOffset.every((value) => value >= 0 && value < 1));
      if (weather === 'clear') {
        if (previous) assert.notDeepEqual(sky.cloudOffset, previous);
        previous = sky.cloudOffset;
      }
    }
  }
  // 不同日期的雲不一樣。
  assert.notDeepEqual(
    deriveSkyParameters(at(3, 20, '10:00')).cloudOffset,
    deriveSkyParameters(at(3, 21, '10:00')).cloudOffset,
  );
});

test('the sky dome is drawn at infinity, after opaque geometry, and never casts shadows or fog', () => {
  const dome = new SkyDome();
  try {
    const { mesh } = dome;
    assert.equal(mesh.name, 'SKY-DOME');
    assert.equal(mesh.frustumCulled, false);
    assert.equal(mesh.castShadow, false);
    assert.equal(mesh.receiveShadow, false);
    assert.equal(mesh.userData.visualOnly, true);
    assert.equal(mesh.userData.collisionExcluded, true);
    assert.ok(mesh.renderOrder > 0);
    assert.equal(mesh.material.side, THREE.BackSide);
    assert.equal(mesh.material.depthWrite, false);
    assert.equal(mesh.material.fog, false);
    // 位置只取鏡頭的旋轉，深度固定在最遠處。
    assert.match(vertexShader, /mat3\(viewMatrix\) \* position/);
    assert.match(vertexShader, /gl_Position = clip\.xyww;/);
    // 輸出交給和場景相同的色調映射與色彩空間轉換。
    assert.match(fragmentShader, /#include <tonemapping_fragment>/);
    assert.match(fragmentShader, /#include <colorspace_fragment>/);
    for (const name of Object.keys(mesh.material.uniforms)) {
      assert.match(fragmentShader, new RegExp(`uniform \\w+ ${name};`), name);
    }
  } finally {
    dome.dispose();
    dome.dispose();
  }
});

test('the environment source shares the sky but leaves out the sun disc, the moon and the stars', () => {
  const dome = new SkyDome();
  const scene = new THREE.Scene();
  scene.add(dome.mesh);
  const siteRoot = new THREE.Group();
  siteRoot.scale.set(1, 1, -1);
  siteRoot.updateMatrixWorld(true);
  const focus = { centre: new THREE.Vector3(), radius: 30 };
  try {
    const [source] = dome.environmentScene.children;
    assert.ok(source instanceof THREE.Mesh);
    assert.notEqual(source.material, dome.mesh.material);
    assert.equal(source.geometry, dome.mesh.geometry);

    const day = toSceneLighting(at(12, 21, '09:30'), siteRoot, focus);
    dome.update(day);
    const visible = dome.mesh.material.uniforms;
    const environment = source.material.uniforms;
    assert.ok(visible.uSunDirection.value.distanceTo(day.sunDirection) < 1e-12);
    assert.ok(visible.uSunDiscColor.value.length() > 10);
    assert.equal(environment.uSunDiscColor.value.length(), 0);
    for (const name of [
      'uSunDirection',
      'uCloudCover',
      'uCloudLit',
      'uNightColor',
      'uGroundColor',
      'uNoise',
    ]) {
      assert.equal(environment[name], visible[name], name);
    }

    const night = toSceneLighting(at(12, 21, '22:00'), siteRoot, focus);
    dome.update(night);
    assert.ok(visible.uStars.value > 0.5);
    assert.ok(visible.uMoonColor.value.length() > 1);
    assert.ok(
      visible.uSunDirection.value.y < 0,
      'the sky uses the real sun, below the horizon at night',
    );
    assert.ok(visible.uMoonDirection.value.y > 0.5);
    assert.equal(visible.uSunDiscColor.value.length(), 0);
    assert.equal(environment.uStars.value, 0);
    assert.equal(environment.uMoonColor.value.length(), 0);

    dome.setCloudDetail(false);
    assert.equal(visible.uCloudDetail.value, 0);
    dome.setCloudDetail(true);
    assert.equal(visible.uCloudDetail.value, 1);
  } finally {
    dome.dispose();
  }
  assert.equal(dome.mesh.parent, null);
  assert.equal(dome.environmentScene.children.length, 0);
});

test('reflection cameras see the sky without the sun disc, moon and stars, and only while drawing', () => {
  const dome = new SkyDome();
  const siteRoot = new THREE.Group();
  siteRoot.scale.set(1, 1, -1);
  siteRoot.updateMatrixWorld(true);
  const focus = { centre: new THREE.Vector3(), radius: 30 };
  try {
    const uniforms = dome.mesh.material.uniforms;
    dome.update(toSceneLighting(at(12, 21, '22:00'), siteRoot, focus));
    const night = { moon: uniforms.uMoonColor.value.clone(), stars: uniforms.uStars.value };
    dome.update(toSceneLighting(at(12, 21, '09:30'), siteRoot, focus));
    const disc = uniforms.uSunDiscColor.value.clone();
    assert.ok(disc.length() > 10);

    // 一般的鏡頭照常畫日面。
    const viewer = new THREE.PerspectiveCamera();
    dome.mesh.onBeforeRender(null, null, viewer);
    assert.ok(uniforms.uSunDiscColor.value.equals(disc));
    dome.mesh.onAfterRender(null, null, viewer);
    assert.ok(uniforms.uSunDiscColor.value.equals(disc));

    // 反射探針（CubeCamera 底下的六支都標了）畫的那一次沒有日面，畫完還原。
    const cube = new THREE.CubeCamera(0.1, 10, new THREE.WebGLCubeRenderTarget(4));
    assert.equal(isReflectionCapture(cube.children[0]), false);
    markReflectionCapture(cube);
    assert.ok(cube.children.length === 6 && cube.children.every(isReflectionCapture));
    dome.mesh.onBeforeRender(null, null, cube.children[3]);
    assert.equal(uniforms.uSunDiscColor.value.length(), 0);
    dome.mesh.onAfterRender(null, null, cube.children[3]);
    assert.ok(uniforms.uSunDiscColor.value.equals(disc), 'restored right after the capture draw');

    dome.update(toSceneLighting(at(12, 21, '22:00'), siteRoot, focus));
    dome.mesh.onBeforeRender(null, null, cube.children[0]);
    assert.equal(uniforms.uMoonColor.value.length(), 0);
    assert.equal(uniforms.uStars.value, 0);
    dome.mesh.onAfterRender(null, null, cube.children[0]);
    assert.ok(uniforms.uMoonColor.value.equals(night.moon));
    assert.equal(uniforms.uStars.value, night.stars);
    cube.renderTarget.dispose();
  } finally {
    dome.dispose();
  }
});
