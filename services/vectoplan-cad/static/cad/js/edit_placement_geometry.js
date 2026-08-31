(function initCadEditPlacementGeometry(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VectoplanCadEditPlacementGeometry = api;
}(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function aggregateBounds(items) {
    const bounds = (items || []).map((item) => {
      const source = item?.bounds;
      if (!source) return null;
      const translateX = finite(item?.edit?.translateX);
      const translateY = finite(item?.edit?.translateY);
      const x = finite(source.x) + translateX;
      const y = finite(source.y) + translateY;
      const width = Math.max(0, finite(source.width));
      const height = Math.max(0, finite(source.height));
      return {x, y, width, height};
    }).filter(Boolean);
    if (!bounds.length) return null;
    const left = Math.min(...bounds.map((entry) => entry.x));
    const top = Math.min(...bounds.map((entry) => entry.y));
    const right = Math.max(...bounds.map((entry) => entry.x + entry.width));
    const bottom = Math.max(...bounds.map((entry) => entry.y + entry.height));
    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
      center: {x: (left + right) / 2, y: (top + bottom) / 2},
    };
  }

  function pointerTarget(pointer, modelUnitsPerPixel = 1, offsetPixels = 18) {
    const offset = Math.max(0, finite(modelUnitsPerPixel, 1)) * Math.max(0, finite(offsetPixels, 18));
    return {x: finite(pointer?.x) + offset, y: finite(pointer?.y) - offset};
  }

  function translationDelta(anchor, pointer, modelUnitsPerPixel = 1, offsetPixels = 18) {
    const target = pointerTarget(pointer, modelUnitsPerPixel, offsetPixels);
    return {x: target.x - finite(anchor?.x), y: target.y - finite(anchor?.y), target};
  }

  function rotatePoint(point, center, degrees) {
    const radians = finite(degrees) * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const dx = finite(point?.x) - finite(center?.x);
    const dy = finite(point?.y) - finite(center?.y);
    return {
      x: finite(center?.x) + dx * cosine - dy * sine,
      y: finite(center?.y) + dx * sine + dy * cosine,
    };
  }

  function pointerAngle(center, pointer) {
    return Math.atan2(finite(pointer?.y) - finite(center?.y), finite(pointer?.x) - finite(center?.x)) * 180 / Math.PI;
  }

  function normalizeAngle(degrees) {
    let normalized = finite(degrees) % 360;
    if (normalized > 180) normalized -= 360;
    if (normalized <= -180) normalized += 360;
    return normalized;
  }

  function rotationDelta(center, startPointer, pointer, snapDegrees = 15) {
    const raw = normalizeAngle(pointerAngle(center, pointer) - pointerAngle(center, startPointer));
    const snap = Math.max(0, finite(snapDegrees));
    return snap ? Math.round(raw / snap) * snap : raw;
  }

  function mirrorAxis(center, pointer) {
    const dx = Math.abs(finite(pointer?.x) - finite(center?.x));
    const dy = Math.abs(finite(pointer?.y) - finite(center?.y));
    return dx >= dy ? "vertical" : "horizontal";
  }

  function reflectPoint(point, center, axis) {
    return axis === "horizontal"
      ? {x: finite(point?.x), y: 2 * finite(center?.y) - finite(point?.y)}
      : {x: 2 * finite(center?.x) - finite(point?.x), y: finite(point?.y)};
  }

  return {
    aggregateBounds,
    mirrorAxis,
    normalizeAngle,
    pointerTarget,
    reflectPoint,
    rotatePoint,
    rotationDelta,
    translationDelta,
  };
}));
