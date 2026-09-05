import * as THREE from 'three';
import { earthGridWorldPointToLonLat, type HorizontalEarthGridFrame } from '@utils/earth_grid_coordinates';

export interface TerrainOsmOverlayOptions {
  readonly host: HTMLElement;
  readonly getFrame: () => HorizontalEarthGridFrame | null;
  readonly getCamera: () => THREE.PerspectiveCamera | null;
  readonly getMeshes: () => readonly THREE.Mesh[];
  readonly tileUrl?: string;
}
export interface TerrainOsmOverlay { update(): void; destroy(): void; }

// Detail is fixed in world space. Camera movement must never resize an atlas or
// change the geographic scale of an already displayed road or label.
export const TERRAIN_OSM_ZOOM = 19;
const MAX_TEXTURES = 192;
const MAX_CONCURRENT_REQUESTS = 4;

export function osmTilePoint(longitude: number, latitude: number, zoom: number): readonly [number, number] {
  const lat = Math.max(-85.05112878, Math.min(85.05112878, latitude)) * Math.PI / 180;
  return [(longitude + 180) / 360 * 2 ** zoom, (1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2 * 2 ** zoom];
}

export function osmWorldTilePoint(x: number, z: number, frame: HorizontalEarthGridFrame): readonly [number, number] {
  const [longitude, latitude] = earthGridWorldPointToLonLat(x, z, frame);
  return osmTilePoint(longitude, latitude, TERRAIN_OSM_ZOOM);
}

/** Compute local UVs in CPU double precision, before converting to GPU float32.
 * Adding a local point to a millions-of-metres origin inside GLSL quantized the
 * previous overlay and made its labels shimmer and warp as the camera moved.
 */
export function osmGeometryUvs(
  geometry: THREE.BufferGeometry,
  matrixWorld: THREE.Matrix4,
  frame: HorizontalEarthGridFrame,
  origin: readonly [number, number],
): Float32Array {
  const position = geometry.getAttribute('position');
  const uv = new Float32Array(position.count * 2);
  const point = new THREE.Vector3();
  const columns = new Map<number, number>(), rows = new Map<number, number>();
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i).applyMatrix4(matrixWorld);
    let x = columns.get(point.x), y = rows.get(point.z);
    if (x === undefined) {
      x = osmWorldTilePoint(point.x, 0, frame)[0] - origin[0];
      columns.set(point.x, x);
    }
    if (y === undefined) {
      y = osmWorldTilePoint(0, point.z, frame)[1] - origin[1];
      rows.set(point.z, y);
    }
    uv[i * 2] = x;
    uv[i * 2 + 1] = y;
  }
  return uv;
}

interface TerrainSource {
  readonly source: THREE.Mesh;
  readonly geometry: THREE.BufferGeometry;
  readonly bounds: THREE.Box3;
  readonly tileKeys: readonly string[];
  readonly overlays: Map<string, THREE.Mesh>;
}
interface MapTile {
  readonly x: number;
  readonly y: number;
  texture?: THREE.Texture;
  material?: THREE.MeshStandardMaterial;
  loading?: boolean;
  retryAt?: number;
  lastUsed: number;
}

function tileMaterial(texture: THREE.Texture, offset: THREE.Vector2): THREE.MeshStandardMaterial {
  // Use the scene's ordinary light, shadows and fog. An unlit map concealed
  // gentle slopes even when the underlying terrain geometry was correct.
  const material = new THREE.MeshStandardMaterial({
    map: texture, roughness: 1, metalness: 0, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.terrainTileOffset = { value: offset };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 terrainMapPoint; varying float terrainUpward;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nterrainMapPoint = uv; terrainUpward = (mat3(modelMatrix) * normal).y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec2 terrainTileOffset; varying vec2 terrainMapPoint; varying float terrainUpward;')
      .replace('#include <map_fragment>', `
        if (terrainUpward < 0.05) discard;
        vec2 terrainTileUv = terrainMapPoint - terrainTileOffset;
        if (any(lessThan(terrainTileUv, vec2(0.0))) || any(greaterThan(terrainTileUv, vec2(1.0)))) discard;
        diffuseColor *= texture2D(map, vec2(terrainTileUv.x, 1.0 - terrainTileUv.y));
      `);
  };
  material.customProgramCacheKey = () => 'terrain-osm-world-tiles.v2';
  return material;
}

/** Opt-in, fixed-detail tiles for loaded terrain currently in the viewport.
 * Requests use the browser HTTP cache/Referer and are limited to four in flight.
 * Each tile owns its texture: loading neighbours never clears or moves it.
 */
export function createTerrainOsmOverlay(options: TerrainOsmOverlayOptions): TerrainOsmOverlay {
  const panel = document.createElement('div');
  panel.className = 'terrain-map-control';
  panel.dataset.editorUiInteractive = 'true';
  panel.style.cssText = 'position:absolute;left:76px;bottom:18px;z-index:12;pointer-events:auto;background:rgba(255,255,255,.96);color:#18354d;border:1px solid #d8e2eb;border-radius:10px;padding:9px 12px;box-shadow:0 3px 14px #15354b20;font:12px system-ui;max-width:240px';
  const label = document.createElement('label');
  label.style.cssText = 'display:flex;align-items:center;gap:7px;cursor:pointer';
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.setAttribute('aria-label', 'OpenStreetMap als Geländetextur');
  label.append(toggle, document.createTextNode('OSM-Geländekarte (Test)'));
  panel.append(label);
  const status = document.createElement('div');
  status.style.cssText = 'font-size:10px;margin-top:5px;color:#5b7187';
  status.textContent = 'Kartentextur auf der Geländeoberfläche';
  panel.append(status);
  const attribution = document.createElement('a');
  attribution.href = 'https://www.openstreetmap.org/copyright';
  attribution.target = '_blank'; attribution.rel = 'noopener';
  attribution.textContent = '© OpenStreetMap-Mitwirkende';
  attribution.style.cssText = 'display:none;margin-top:5px;color:#155fa0;font-size:11px';
  panel.append(attribution); options.host.append(panel);
  panel.addEventListener('pointerdown', event => event.stopPropagation());
  panel.addEventListener('wheel', event => event.stopPropagation());

  const sources = new Map<THREE.Mesh, TerrainSource>();
  const tiles = new Map<string, MapTile>();
  let desiredTiles = new Set<string>();
  let frameKey = '', origin: readonly [number, number] = [0, 0];
  let destroyed = false, lastVisibilityUpdate = -Infinity, activeRequests = 0;
  let generation = 0;
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4();

  function detachSource(record: TerrainSource): void {
    for (const overlay of record.overlays.values()) overlay.removeFromParent();
    // Position/index buffers belong to the source. Dispose only our private UV
    // geometry after dropping shared attributes, so other tile layers stay live.
    record.geometry.deleteAttribute('position'); record.geometry.deleteAttribute('normal');
    record.geometry.setIndex(null); record.geometry.dispose();
  }

  function clear(): void {
    for (const record of sources.values()) detachSource(record);
    sources.clear();
    for (const tile of tiles.values()) { tile.texture?.dispose(); tile.material?.dispose(); }
    tiles.clear(); desiredTiles.clear();
    generation++;
  }

  function attachTile(record: TerrainSource, key: string): void {
    if (record.overlays.has(key)) return;
    const tile = tiles.get(key);
    if (!tile?.material) return;
    const overlay = new THREE.Mesh(record.geometry, tile.material);
    overlay.userData.terrainOsmOverlay = true;
    overlay.visible = toggle.checked;
    overlay.renderOrder = 3;
    overlay.receiveShadow = record.source.receiveShadow;
    overlay.raycast = () => undefined;
    record.source.add(overlay);
    record.overlays.set(key, overlay);
  }

  function syncSources(frame: HorizontalEarthGridFrame): boolean {
    const nextKey = [frame.worldWidthCells, frame.worldHeightCells, frame.centralMeridianDegrees, frame.storageOrigin.x, frame.storageOrigin.z].join(':');
    let changed = nextKey !== frameKey;
    if (changed) {
      clear(); frameKey = nextKey;
      const point = osmWorldTilePoint(0, 0, frame);
      origin = [Math.floor(point[0]), Math.floor(point[1])];
    }
    const live = new Set(options.getMeshes());
    for (const [source, record] of sources) if (!live.has(source)) {
      detachSource(record); sources.delete(source); changed = true;
    }
    for (const source of live) {
      if (sources.has(source) || !source.geometry.getAttribute('position')?.count) continue;
      changed = true;
      source.updateWorldMatrix(true, false);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', source.geometry.getAttribute('position'));
      geometry.setAttribute('normal', source.geometry.getAttribute('normal'));
      geometry.setIndex(source.geometry.index);
      geometry.setAttribute('uv', new THREE.BufferAttribute(osmGeometryUvs(source.geometry, source.matrixWorld, frame, origin), 2));
      geometry.boundingBox = source.geometry.boundingBox?.clone() ?? null;
      geometry.boundingSphere = source.geometry.boundingSphere?.clone() ?? null;
      source.geometry.computeBoundingBox();
      const bounds = source.geometry.boundingBox!.clone().applyMatrix4(source.matrixWorld);
      const [minX, maxY] = osmWorldTilePoint(bounds.min.x, bounds.min.z, frame);
      const [maxX, minY] = osmWorldTilePoint(bounds.max.x, bounds.max.z, frame);
      const tileKeys: string[] = [];
      for (let y = Math.floor(minY); y <= Math.floor(maxY); y++) {
        for (let x = Math.floor(minX); x <= Math.floor(maxX); x++) {
          const key = `${x}/${y}`; tileKeys.push(key);
          if (!tiles.has(key)) tiles.set(key, { x, y, lastUsed: 0 });
        }
      }
      const record = { source, geometry, bounds, tileKeys, overlays: new Map<string, THREE.Mesh>() };
      sources.set(source, record);
      // This runs every animation frame, independently of requests/throttles.
      // A replacement chunk receives its cached map before it is next drawn.
      for (const key of tileKeys) attachTile(record, key);
    }
    return changed;
  }

  function visible(source: THREE.Object3D): boolean {
    for (let object: THREE.Object3D | null = source; object; object = object.parent) if (!object.visible) return false;
    return true;
  }

  function updateVisibleTiles(camera: THREE.PerspectiveCamera): void {
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const candidates = new Map<string, number>();
    const center = new THREE.Vector3();
    for (const record of sources.values()) {
      if (!visible(record.source) || !frustum.intersectsBox(record.bounds)) continue;
      const distance = record.bounds.getCenter(center).distanceToSquared(camera.position);
      for (const key of record.tileKeys) candidates.set(key, Math.min(candidates.get(key) ?? Infinity, distance));
    }
    desiredTiles = new Set([...candidates].sort((a, b) => a[1] - b[1]).slice(0, MAX_TEXTURES).map(([key]) => key));
    const now = performance.now();
    for (const key of desiredTiles) tiles.get(key)!.lastUsed = now;
    const cached = [...tiles].filter(([, tile]) => tile.texture);
    const unused = cached.filter(([key]) => !desiredTiles.has(key)).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (let i = 0; i < cached.length - MAX_TEXTURES && i < unused.length; i++) {
      const [key, tile] = unused[i];
      for (const record of sources.values()) {
        record.overlays.get(key)?.removeFromParent(); record.overlays.delete(key);
      }
      tile.texture?.dispose(); tile.material?.dispose();
      tile.texture = undefined; tile.material = undefined;
    }
  }

  function updateStatus(): void {
    panel.dataset.loadedTiles = String([...desiredTiles].filter(key => tiles.get(key)?.texture).length);
    panel.dataset.requestedTiles = String(desiredTiles.size);
    panel.dataset.tileZoom = String(TERRAIN_OSM_ZOOM);
    panel.dataset.overlayMeshes = String([...sources.values()].reduce((sum, record) => sum + record.overlays.size, 0));
    if (!desiredTiles.size) status.textContent = 'Kein Gelände im Blickfeld';
    else if ([...desiredTiles].some(key => !tiles.get(key)?.texture)) status.textContent = activeRequests ? 'Kartenausschnitt wird geladen …' : 'Einige Kartenkacheln sind nicht erreichbar';
    else status.textContent = 'Kartentextur · Gelände bleibt bearbeitbar';
  }

  function requestTile(key: string, tile: MapTile): void {
    tile.loading = true; activeRequests++;
    const current = generation;
    const img = new Image();
    img.crossOrigin = 'anonymous'; img.referrerPolicy = 'strict-origin-when-cross-origin';
    let finished = false;
    const finish = (success: boolean): void => {
      if (finished) return; finished = true; window.clearTimeout(timeout);
      img.onload = null; img.onerror = null; activeRequests--; tile.loading = false;
      if (destroyed || generation !== current) { if (!destroyed) pump(); return; }
      if (success) {
        const texture = new THREE.Texture(img); texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true; texture.anisotropy = 8; texture.needsUpdate = true;
        tile.texture = texture;
        tile.material = tileMaterial(texture, new THREE.Vector2(tile.x - origin[0], tile.y - origin[1]));
        for (const record of sources.values()) if (record.tileKeys.includes(key)) attachTile(record, key);
      } else tile.retryAt = performance.now() + 30000;
      pump(); updateStatus();
    };
    const timeout = window.setTimeout(() => finish(false), 15000);
    img.onload = () => finish(true); img.onerror = () => finish(false);
    img.src = (options.tileUrl ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png')
      .replace('{z}', String(TERRAIN_OSM_ZOOM)).replace('{x}', String(tile.x)).replace('{y}', String(tile.y));
  }

  function pump(): void {
    if (destroyed || !toggle.checked) return;
    for (const key of desiredTiles) {
      if (activeRequests >= MAX_CONCURRENT_REQUESTS) break;
      const tile = tiles.get(key);
      if (tile && !tile.texture && !tile.loading && (tile.retryAt ?? 0) <= performance.now()) requestTile(key, tile);
    }
  }

  function update(): void {
    if (destroyed || !toggle.checked) return;
    const frame = options.getFrame(), camera = options.getCamera();
    if (!frame || !camera) { status.textContent = 'Georeferenz wird vorbereitet …'; return; }
    const changed = syncSources(frame);
    if (changed || performance.now() - lastVisibilityUpdate >= 250) {
      lastVisibilityUpdate = performance.now(); updateVisibleTiles(camera); pump(); updateStatus();
    }
  }

  toggle.addEventListener('change', () => {
    attribution.style.display = toggle.checked ? 'block' : 'none';
    for (const record of sources.values()) for (const overlay of record.overlays.values()) overlay.visible = toggle.checked;
    lastVisibilityUpdate = -Infinity;
    if (toggle.checked) update(); else status.textContent = 'Kartentextur auf der Geländeoberfläche';
  });
  return { update, destroy() { destroyed = true; clear(); panel.remove(); } };
}
