export type NavigationCompassMarkerKind = "player" | "project" | "waypoint";

export interface NavigationCompassMarker {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly kind: NavigationCompassMarkerKind;
  readonly position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
}

export interface NavigationCompassUpdate {
  readonly yaw: number;
  readonly playerPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly markers: readonly NavigationCompassMarker[];
}

export interface NavigationCompassHandle {
  readonly element: HTMLElement;
  update(input: NavigationCompassUpdate): void;
  setVisible(visible: boolean): void;
  destroy(): void;
}

interface CompassTick {
  readonly bearing: number;
  readonly element: HTMLSpanElement;
}

interface CompassMarkerElement {
  readonly element: HTMLDivElement;
  readonly label: HTMLSpanElement;
}

const COMPASS_VISIBLE_HALF_ANGLE = 105;
const COMPASS_MAX_MARKERS = 32;
const DIRECTION_LABELS = new Map<number, string>([
  [0, "N"],
  [45, "NE"],
  [90, "E"],
  [135, "SE"],
  [180, "S"],
  [225, "SW"],
  [270, "W"],
  [315, "NW"],
]);

function normalizeDegrees(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function signedAngleDegrees(value: number): number {
  return ((value + 540) % 360) - 180;
}

function headingFromYaw(yaw: number): number {
  return normalizeDegrees(-(Number.isFinite(yaw) ? yaw : 0) * 180 / Math.PI);
}

function bearingTo(
  from: NavigationCompassUpdate["playerPosition"],
  to: NavigationCompassMarker["position"],
): number {
  return normalizeDegrees(Math.atan2(to.x - from.x, -(to.z - from.z)) * 180 / Math.PI);
}

function horizontalDistance(
  from: NavigationCompassUpdate["playerPosition"],
  to: NavigationCompassMarker["position"],
): number {
  return Math.hypot(to.x - from.x, to.z - from.z);
}

function horizontalPosition(relativeBearing: number): number {
  return 50 + relativeBearing / COMPASS_VISIBLE_HALF_ANGLE * 50;
}

function safeMarkerId(marker: NavigationCompassMarker): string {
  return `${marker.kind}:${String(marker.id).trim() || "unknown"}`;
}

function cleanLabel(value: string): string {
  return String(value || "").trim().slice(0, 32) || "Markierung";
}

export function createNavigationCompass(rootHost: HTMLElement): NavigationCompassHandle {
  const element = document.createElement("nav");
  element.className = "editor-navigation-compass";
  element.dataset.editorNavigationCompass = "true";
  element.setAttribute("aria-label", "Kompass");
  element.setAttribute("role", "navigation");

  const viewport = document.createElement("div");
  viewport.className = "editor-navigation-compass__viewport";
  viewport.setAttribute("aria-hidden", "true");

  const ticksLayer = document.createElement("div");
  ticksLayer.className = "editor-navigation-compass__ticks";
  const ticks: CompassTick[] = [];

  for (let bearing = 0; bearing < 360; bearing += 22.5) {
    const tick = document.createElement("span");
    const label = DIRECTION_LABELS.get(bearing) ?? "";
    tick.className = [
      "editor-navigation-compass__tick",
      label.length === 1
        ? "editor-navigation-compass__tick--cardinal"
        : label
          ? "editor-navigation-compass__tick--ordinal"
          : "editor-navigation-compass__tick--minor",
    ].join(" ");
    tick.textContent = label;
    tick.dataset.bearing = String(bearing);
    ticksLayer.append(tick);
    ticks.push({ bearing, element: tick });
  }

  const markerLayer = document.createElement("div");
  markerLayer.className = "editor-navigation-compass__markers";

  const center = document.createElement("span");
  center.className = "editor-navigation-compass__center";
  center.setAttribute("aria-hidden", "true");

  viewport.append(ticksLayer, markerLayer, center);
  element.append(viewport);
  rootHost.append(element);

  const markerElements = new Map<string, CompassMarkerElement>();
  let destroyed = false;

  function removeMarker(id: string): void {
    markerElements.get(id)?.element.remove();
    markerElements.delete(id);
  }

  return {
    element,
    update(input): void {
      if (destroyed) return;

      const heading = headingFromYaw(input.yaw);
      const roundedHeading = Math.round(heading) % 360;
      element.dataset.heading = heading.toFixed(2);
      element.setAttribute("aria-label", `Kompass, ${roundedHeading} Grad`);

      for (const tick of ticks) {
        const relativeBearing = signedAngleDegrees(tick.bearing - heading);
        const visible = Math.abs(relativeBearing) <= COMPASS_VISIBLE_HALF_ANGLE;
        tick.element.hidden = !visible;
        if (visible) {
          tick.element.style.left = `${horizontalPosition(relativeBearing).toFixed(3)}%`;
        }
      }

      const activeMarkerIds = new Set<string>();
      for (const marker of input.markers.slice(0, COMPASS_MAX_MARKERS)) {
        if (
          !Number.isFinite(marker.position.x)
          || !Number.isFinite(marker.position.z)
        ) {
          continue;
        }

        const id = safeMarkerId(marker);
        activeMarkerIds.add(id);
        let markerElement = markerElements.get(id);
        if (!markerElement) {
          const markerRoot = document.createElement("div");
          markerRoot.className = "editor-navigation-compass__marker";
          markerRoot.dataset.kind = marker.kind;
          markerRoot.setAttribute("role", "img");

          const icon = document.createElement("span");
          icon.className = "editor-navigation-compass__marker-icon";
          icon.textContent = marker.kind === "player" ? "●" : "◆";

          const label = document.createElement("span");
          label.className = "editor-navigation-compass__marker-label";

          markerRoot.append(icon, label);
          markerLayer.append(markerRoot);
          markerElement = { element: markerRoot, label };
          markerElements.set(id, markerElement);
        }

        const label = cleanLabel(marker.label);
        const distance = horizontalDistance(input.playerPosition, marker.position);
        const markerBearing = bearingTo(input.playerPosition, marker.position);
        const relativeBearing = signedAngleDegrees(markerBearing - heading);
        const visible =
          distance > 0.35
          && Math.abs(relativeBearing) <= COMPASS_VISIBLE_HALF_ANGLE;

        markerElement.element.hidden = !visible;
        markerElement.element.dataset.kind = marker.kind;
        markerElement.element.style.setProperty(
          "--editor-compass-marker-color",
          marker.color || "#ffffff",
        );
        markerElement.element.setAttribute(
          "aria-label",
          `${label}, ${Math.round(distance)} Meter`,
        );
        markerElement.label.textContent = label;
        markerElement.label.hidden = Math.abs(relativeBearing) > 24;

        if (visible) {
          markerElement.element.style.left =
            `${horizontalPosition(relativeBearing).toFixed(3)}%`;
        }
      }

      for (const id of [...markerElements.keys()]) {
        if (!activeMarkerIds.has(id)) removeMarker(id);
      }
    },
    setVisible(visible): void {
      if (!destroyed) element.hidden = !visible;
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      markerElements.clear();
      element.remove();
    },
  };
}