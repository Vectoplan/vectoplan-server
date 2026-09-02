import type {
  WorldEditSystem,
  WorldEditSystemRegistry,
  WorldEditTool,
} from "./contracts";

const REQUIRED_TOOLS: readonly WorldEditTool[] = [
  "selection",
  "room",
  "stair",
  "paint",
  "sculpt",
  "parcel",
  "parcel-grid",
  "ruler",
  "copy-paste",
  "cut-paste",
  "tentacle",
  "roof",
  "storey",
];

function normalizedAlias(value: unknown): string {
  return String(value ?? "selection").trim().toLowerCase().replaceAll("_", "-");
}

export function createWorldEditSystemRegistry(
  systems: readonly WorldEditSystem[],
): WorldEditSystemRegistry {
  const byTool = new Map<WorldEditTool, WorldEditSystem>();
  for (const system of systems) {
    if (byTool.has(system.tool)) throw new Error(`WorldEdit-System doppelt registriert: ${system.tool}`);
    const protectedSystem = Object.freeze({
      ...system,
      aliases: Object.freeze([...system.aliases]),
      ui: Object.freeze({ ...system.ui }),
      behavior: Object.freeze({ ...system.behavior }),
    });
    byTool.set(system.tool, protectedSystem);
  }
  for (const tool of REQUIRED_TOOLS) {
    if (!byTool.has(tool)) throw new Error(`WorldEdit-System fehlt: ${tool}`);
  }

  const protectedSystems = [...byTool.values()];
  const aliasOwners = new Map<string, WorldEditTool>();
  const orderedMatchers = protectedSystems
    .filter((system) => system.tool !== "selection")
    .flatMap((system) => [system.tool, ...system.aliases]
      .map(normalizedAlias)
      .map((alias) => ({ alias, tool: system.tool })))
    .sort((first, second) => second.alias.length - first.alias.length);
  for (const matcher of orderedMatchers) {
    const owner = aliasOwners.get(matcher.alias);
    if (owner && owner !== matcher.tool) {
      throw new Error(`WorldEdit-Alias doppelt registriert: ${matcher.alias} (${owner}, ${matcher.tool})`);
    }
    aliasOwners.set(matcher.alias, matcher.tool);
  }

  return Object.freeze({
    systems: Object.freeze(protectedSystems),
    get(tool: WorldEditTool): WorldEditSystem {
      const system = byTool.get(tool);
      if (!system) throw new Error(`Unbekanntes WorldEdit-System: ${tool}`);
      return system;
    },
    match(value: unknown): WorldEditTool {
      const normalized = normalizedAlias(value);
      const exact = byTool.get(normalized as WorldEditTool);
      if (exact) return exact.tool;
      return orderedMatchers.find(({ alias }) => normalized.includes(alias))?.tool ?? "selection";
    },
  });
}
