import type { AaguidEntry, AaguidRegistry } from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function normalizeAaguid(input: string): string | null {
  const trimmed = input.trim().toLowerCase().replace(/^\{|\}$/g, "");
  if (UUID_RE.test(trimmed)) {
    return trimmed;
  }

  if (!/^[0-9a-f-]+$/.test(trimmed)) {
    return null;
  }

  const hex = trimmed.replace(/-/g, "");
  if (hex.length !== 32) {
    return null;
  }

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function lookupAaguid(
  registry: AaguidRegistry,
  aaguid: string,
): AaguidEntry | null {
  return registry[aaguid] ?? null;
}

export interface RegistryRow {
  aaguid: string;
  entry: AaguidEntry;
}

export function listEntries(registry: AaguidRegistry): RegistryRow[] {
  return Object.entries(registry)
    .map(([aaguid, entry]) => ({ aaguid, entry }))
    .sort((a, b) => a.entry.name.localeCompare(b.entry.name));
}

export function filterEntries(rows: RegistryRow[], query: string): RegistryRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;

  return rows.filter(
    ({ aaguid, entry }) =>
      aaguid.includes(q) || entry.name.toLowerCase().includes(q),
  );
}

export function pickIcon(entry: AaguidEntry, prefersDark: boolean): string | undefined {
  return prefersDark
    ? entry.icon_dark ?? entry.icon_light
    : entry.icon_light ?? entry.icon_dark;
}

export function resolveProviderName(
  registry: AaguidRegistry,
  rawValue: string,
): string {
  const normalized = normalizeAaguid(rawValue);
  if (!normalized) return "";
  return lookupAaguid(registry, normalized)?.name ?? "Unknown";
}

export interface ProviderGroup {
  name: string;
  entry: AaguidEntry;
  aaguids: string[];
}

// One row per provider name. Some providers ship several AAGUIDs (Windows Hello,
// every YubiKey family), and listing each as its own row buries the directory.
export function groupEntries(rows: RegistryRow[]): ProviderGroup[] {
  const groups = new Map<string, ProviderGroup>();
  for (const { aaguid, entry } of rows) {
    const group = groups.get(entry.name);
    if (group) {
      group.aaguids.push(aaguid);
      if (!group.entry.icon_dark && entry.icon_dark) group.entry = entry;
    } else {
      groups.set(entry.name, { name: entry.name, entry, aaguids: [aaguid] });
    }
  }
  return [...groups.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

// Matches a provider by name, or by any fragment of one of its AAGUIDs with or
// without hyphens, so "bada5566a7aa" finds 1Password just like "bada5566-a7aa".
export function filterGroups(groups: ProviderGroup[], query: string): ProviderGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  const hex = q.replace(/-/g, "");
  const hexOnly = /^[0-9a-f]+$/.test(hex);
  return groups.filter(
    (group) =>
      group.name.toLowerCase().includes(q) ||
      (hexOnly && group.aaguids.some((aaguid) => aaguid.replace(/-/g, "").includes(hex))),
  );
}

export const ZERO_AAGUID = "00000000-0000-0000-0000-000000000000";

// How far through an AAGUID a partial entry is, for the "keep typing" hint.
// Returns null when the text is not shaped like hex at all.
export function hexProgress(input: string): number | null {
  const trimmed = input.trim().toLowerCase().replace(/^\{|\}$/g, "");
  if (!trimmed || !/^[0-9a-f-]+$/.test(trimmed)) return null;
  return trimmed.replace(/-/g, "").length;
}
