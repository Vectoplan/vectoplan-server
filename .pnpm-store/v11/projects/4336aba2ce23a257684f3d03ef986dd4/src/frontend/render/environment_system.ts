import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import type { EditorBootstrap } from "@bootstrap/bootstrap_models";

export interface EnvironmentSnapshot {
  readonly simulatedTimeIso: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly sunElevationDegrees: number;
  readonly sunAzimuthDegrees: number;
  readonly running: boolean;
  readonly timeScale: number;
}

export interface EnvironmentSystem {
  update(deltaSeconds: number): void;
  getSnapshot(): EnvironmentSnapshot;
  destroy(): void;
}

export interface EnvironmentSystemOptions {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly controlsHost: HTMLElement;
  readonly bootstrap: EditorBootstrap;
}

interface SolarPosition {
  readonly elevation: number;
  readonly azimuth: number;
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const STATIC_SUN_MONTH_INDEX = 6;
const STATIC_SUN_DAY = 28;
const STATIC_SUN_HOUR = 16;
const STATIC_SUN_MINUTE = 48;
const DEFAULT_LATITUDE = 51.1657;
const DEFAULT_LONGITUDE = 10.4515;
const CLOUD_VERTEX_SHADER = `
  varying vec3 vCloudDirection;

  void main() {
    vCloudDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CLOUD_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uDaylight;
  varying vec3 vCloudDirection;

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float valueNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    float a = hash21(cell);
    float b = hash21(cell + vec2(1.0, 0.0));
    float c = hash21(cell + vec2(0.0, 1.0));
    float d = hash21(cell + vec2(1.0, 1.0));
    return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
  }

  float fbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.52;
    mat2 rotation = mat2(0.80, 0.60, -0.60, 0.80);
    for (int octave = 0; octave < 5; octave += 1) {
      value += amplitude * valueNoise(point);
      point = rotation * point * 2.03 + 17.17;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 direction = normalize(vCloudDirection);
    float longitude = atan(direction.z, direction.x) / 6.2831853 + 0.5;
    float latitude = asin(clamp(direction.y, -1.0, 1.0)) / 3.1415926 + 0.5;
    vec2 cloudUv = vec2(longitude * 8.0 + uTime, latitude * 4.2 - uTime * 0.18);
    float broad = fbm(cloudUv);
    float detail = fbm(cloudUv * 2.35 + vec2(7.4, -3.1));
    float density = smoothstep(0.49, 0.7, broad * 0.76 + detail * 0.34);
    float horizonMask = smoothstep(0.015, 0.15, direction.y);
    float zenithSoftening = 1.0 - smoothstep(0.82, 0.98, direction.y);
    float alpha = density * horizonMask * mix(1.0, 0.72, zenithSoftening) * 0.58;
    alpha *= mix(0.18, 1.0, uDaylight);

    vec3 shadowColor = vec3(0.55, 0.66, 0.75);
    vec3 lightColor = vec3(1.0, 0.985, 0.94);
    vec3 cloudColor = mix(shadowColor, lightColor, smoothstep(0.56, 0.82, broad));
    cloudColor *= mix(0.36, 1.0, uDaylight);
    gl_FragColor = vec4(cloudColor, alpha);
  }
`;

const ATMOSPHERE_TINT_FRAGMENT_SHADER = `
  varying vec3 vCloudDirection;

  void main() {
    vec3 direction = normalize(vCloudDirection);
    float elevation = clamp(direction.y, 0.0, 1.0);
    float gradient = pow(elevation, 0.58);
    vec3 horizonColor = vec3(0.47, 0.72, 0.88);
    vec3 zenithColor = vec3(0.10, 0.42, 0.75);
    vec3 atmosphereColor = mix(horizonColor, zenithColor, gradient);
    float alpha = mix(0.68, 0.82, gradient);
    gl_FragColor = vec4(atmosphereColor, alpha);
  }
`;

function createAtmosphereTintLayer(radius: number): {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  material: THREE.ShaderMaterial;
} {
  const material = new THREE.ShaderMaterial({
    name: "vectoplan-atmosphere-tint-material",
    vertexShader: CLOUD_VERTEX_SHADER,
    fragmentShader: ATMOSPHERE_TINT_FRAGMENT_SHADER,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), material);
  mesh.name = "vectoplan-atmosphere-tint";
  mesh.frustumCulled = false;
  mesh.renderOrder = -999.5;
  return { mesh, material };
}

function createCloudLayer(radius: number): {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  material: THREE.ShaderMaterial;
} {
  const material = new THREE.ShaderMaterial({
    name: "vectoplan-atmospheric-cloud-material",
    uniforms: {
      uTime: { value: 0 },
      uDaylight: { value: 1 },
    },
    vertexShader: CLOUD_VERTEX_SHADER,
    fragmentShader: CLOUD_FRAGMENT_SHADER,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 32),
    material,
  );
  mesh.name = "vectoplan-atmospheric-clouds";
  mesh.frustumCulled = false;
  mesh.renderOrder = -999;
  return { mesh, material };
}


function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function nestedNumber(root: unknown, paths: readonly (readonly string[])[]): number | null {
  for (const path of paths) {
    let cursor: unknown = root;
    for (const segment of path) {
      cursor = asRecord(cursor)?.[segment];
    }
    const number = Number(cursor);
    if (Number.isFinite(number)) {
      return number;
    }
  }
  return null;
}

function resolveGeoReference(bootstrap: EditorBootstrap): {
  latitude: number;
  longitude: number;
  trueNorthDegrees: number;
} {
  const latitude = nestedNumber(bootstrap, [
    ["environment", "latitude"],
    ["environment", "location", "latitude"],
    ["world", "earthReference", "latitude"],
    ["world", "globalReference", "latitude"],
    ["earthReference", "latitude"],
  ]) ?? DEFAULT_LATITUDE;
  const longitude = nestedNumber(bootstrap, [
    ["environment", "longitude"],
    ["environment", "location", "longitude"],
    ["world", "earthReference", "longitude"],
    ["world", "globalReference", "longitude"],
    ["earthReference", "longitude"],
  ]) ?? DEFAULT_LONGITUDE;
  const trueNorthDegrees = nestedNumber(bootstrap, [
    ["environment", "trueNorthDegrees"],
    ["world", "earthReference", "trueNorthDegrees"],
    ["world", "globalReference", "trueNorthDegrees"],
  ]) ?? 0;
  return {
    latitude: THREE.MathUtils.clamp(latitude, -89.9, 89.9),
    longitude: THREE.MathUtils.clamp(longitude, -180, 180),
    trueNorthDegrees,
  };
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

/** NOAA-style approximation used for interactive daylight preview. */
function solarPosition(date: Date, latitude: number, longitude: number): SolarPosition {
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3_600;
  const gamma = (2 * Math.PI / 365) * (dayOfYear(date) - 1 + (hours - 12) / 24);
  const equationOfTime = 229.18 * (
    0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma)
  );
  const declination = 0.006918 - 0.399912 * Math.cos(gamma)
    + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma)
    + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma)
    + 0.00148 * Math.sin(3 * gamma);
  const timezoneHours = -date.getTimezoneOffset() / 60;
  const trueSolarMinutes = (
    hours * 60 + equationOfTime + 4 * longitude - 60 * timezoneHours + 1_440
  ) % 1_440;
  const hourAngle = (trueSolarMinutes / 4 - 180) * DEG_TO_RAD;
  const latitudeRad = latitude * DEG_TO_RAD;
  const cosZenith = THREE.MathUtils.clamp(
    Math.sin(latitudeRad) * Math.sin(declination)
      + Math.cos(latitudeRad) * Math.cos(declination) * Math.cos(hourAngle),
    -1,
    1,
  );
  return {
    elevation: Math.asin(cosZenith),
    azimuth: Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(latitudeRad) - Math.tan(declination) * Math.cos(latitudeRad),
    ) + Math.PI,
  };
}

function createStaticSunTime(): Date {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    STATIC_SUN_MONTH_INDEX,
    STATIC_SUN_DAY,
    STATIC_SUN_HOUR,
    STATIC_SUN_MINUTE,
    0,
    0,
  );
}

export function createEnvironmentSystem(options: EnvironmentSystemOptions): EnvironmentSystem {
  const { scene, renderer, camera } = options;
  const geo = resolveGeoReference(options.bootstrap);
  const simulatedTimeMs = createStaticSunTime().getTime();
  const running = false;
  const timeScale = 0;
  let dirty = true;
  let destroyed = false;
  let lastUpdateAt = -Infinity;
  let solar = solarPosition(new Date(), geo.latitude, geo.longitude);

  const previousBackground = scene.background;
  const previousFog = scene.fog;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const sky = new Sky();
  sky.name = "vectoplan-physical-sky";
  const atmosphereRadius = Math.max(4, camera.far * 0.94);
  sky.scale.setScalar(atmosphereRadius);
  sky.frustumCulled = false;
  sky.renderOrder = -1_000;
  sky.material.uniforms.turbidity.value = 2.0;
  sky.material.uniforms.rayleigh.value = 4.0;
  sky.material.uniforms.mieCoefficient.value = 0.002;
  sky.material.uniforms.mieDirectionalG.value = 0.72;
  const clouds = createCloudLayer(atmosphereRadius * 0.82);
  const atmosphereTint = createAtmosphereTintLayer(atmosphereRadius * 0.88);

  const hemisphere = new THREE.HemisphereLight(0xc8e4ff, 0x4a4033, 0.7);
  hemisphere.name = "vectoplan-sky-fill-light";
  const sun = new THREE.DirectionalLight(0xfff1cf, 3.4);
  sun.name = "vectoplan-sun-light";
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 260;
  sun.shadow.camera.left = -72;
  sun.shadow.camera.right = 72;
  sun.shadow.camera.top = 72;
  sun.shadow.camera.bottom = -72;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.025;
  sun.target.name = "vectoplan-sun-target";

  const physicalBackground = new THREE.Color(0x5ca9de);
  const physicalFog = new THREE.FogExp2(0x8fc7e8, 0.00055);
  scene.background = physicalBackground;
  scene.fog = physicalFog;
  scene.add(sky, atmosphereTint.mesh, clouds.mesh, hemisphere, sun, sun.target);
  // The viewport overlay also owns the crosshair and editor HUD. Environment
  // controls must never clear or hide that shared host.
  options.controlsHost.hidden = false;
  options.controlsHost.removeAttribute("hidden");
  options.controlsHost.dataset.environmentMode = "physical-sky-clouds";
  options.controlsHost.dataset.environmentTime = "07-28T16:48";
  const direction = new THREE.Vector3();
  const center = new THREE.Vector3();
  const nightFog = new THREE.Color(0x111827);
  const dayFog = new THREE.Color(0x8fc7e8);

  function updateSolar(nowMs: number): void {
    const date = new Date(simulatedTimeMs);
    solar = solarPosition(date, geo.latitude, geo.longitude);
    const azimuth = solar.azimuth + geo.trueNorthDegrees * DEG_TO_RAD;
    const radius = Math.cos(solar.elevation);
    direction.set(
      Math.sin(azimuth) * radius,
      Math.sin(solar.elevation),
      Math.cos(azimuth) * radius,
    ).normalize();
    sky.material.uniforms.sunPosition.value.copy(direction);

    const daylight = THREE.MathUtils.smoothstep(solar.elevation * RAD_TO_DEG, -6, 8);
    sun.intensity = daylight * 3.4;
    hemisphere.intensity = 0.1 + daylight * 0.64;
    renderer.toneMappingExposure = 0.5 + daylight * 0.44;
    clouds.material.uniforms.uDaylight.value = daylight;
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(nightFog).lerp(dayFog, daylight);
    }

    center.set(camera.position.x, camera.position.y - 1.6, camera.position.z);
    sun.position.copy(center).addScaledVector(direction, 130);
    sun.target.position.copy(center);
    sun.target.updateMatrixWorld();

    lastUpdateAt = nowMs;
    dirty = false;
  }

  updateSolar(performance.now());
  return {
    update(deltaSeconds): void {
      if (destroyed) {
        return;
      }
      const safeDelta = THREE.MathUtils.clamp(deltaSeconds, 0, 0.1);
      clouds.material.uniforms.uTime.value += safeDelta * 0.012;
      sky.position.copy(camera.position);
      clouds.mesh.position.copy(camera.position);
      atmosphereTint.mesh.position.copy(camera.position);

      const nowMs = performance.now();
      if (dirty || nowMs - lastUpdateAt >= 200) {
        updateSolar(nowMs);
      } else {
        center.set(camera.position.x, camera.position.y - 1.6, camera.position.z);
        sun.position.copy(center).addScaledVector(direction, 130);
        sun.target.position.copy(center);
        sun.target.updateMatrixWorld();
      }
    },
    getSnapshot: () => ({
      simulatedTimeIso: new Date(simulatedTimeMs).toISOString(),
      latitude: geo.latitude,
      longitude: geo.longitude,
      sunElevationDegrees: solar.elevation * RAD_TO_DEG,
      sunAzimuthDegrees: solar.azimuth * RAD_TO_DEG,
      running,
      timeScale,
    }),
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      scene.remove(sky, atmosphereTint.mesh, clouds.mesh, hemisphere, sun, sun.target);
      if (scene.background === physicalBackground) {
        scene.background = previousBackground;
      }
      if (scene.fog === physicalFog) {
        scene.fog = previousFog;
      }
      sky.geometry.dispose();
      sky.material.dispose();
      clouds.mesh.geometry.dispose();
      atmosphereTint.mesh.geometry.dispose();
      atmosphereTint.material.dispose();
      clouds.material.dispose();
      sun.shadow.map?.dispose();
    },
  };
}
