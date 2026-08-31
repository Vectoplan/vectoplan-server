(function exposeCadSelectionGeometry(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VectoplanCadSelectionGeometry = api;
}(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  function normalizeRect(rect) {
    const left = Math.min(Number(rect?.left) || 0, Number(rect?.right) || 0);
    const right = Math.max(Number(rect?.left) || 0, Number(rect?.right) || 0);
    const top = Math.min(Number(rect?.top) || 0, Number(rect?.bottom) || 0);
    const bottom = Math.max(Number(rect?.top) || 0, Number(rect?.bottom) || 0);
    return {left, right, top, bottom, width: right - left, height: bottom - top};
  }

  function contains(container, candidate) {
    const outer = normalizeRect(container);
    const inner = normalizeRect(candidate);
    return inner.left >= outer.left && inner.right <= outer.right
      && inner.top >= outer.top && inner.bottom <= outer.bottom;
  }

  function intersects(first, second) {
    const left = normalizeRect(first);
    const right = normalizeRect(second);
    return left.left <= right.right && left.right >= right.left
      && left.top <= right.bottom && left.bottom >= right.top;
  }

  function refsInMarquee(entries, marquee, crossing = false) {
    return (Array.isArray(entries) ? entries : [])
      .filter((entry) => entry?.ref && (crossing
        ? intersects(marquee, entry.rect)
        : contains(marquee, entry.rect)))
      .map((entry) => entry.ref);
  }

  return {normalizeRect, contains, intersects, refsInMarquee};
}));
