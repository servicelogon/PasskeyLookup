import type { AaguidMeta, AaguidRegistry } from "./types";
import { HARDWARE_KEY_REGISTRY } from "./hardwareKeys";

export const HARDWARE_AAGUIDS = new Set(Object.keys(HARDWARE_KEY_REGISTRY));

export async function loadRegistry(): Promise<AaguidRegistry> {
  const response = await fetch("./aaguids.json");
  if (!response.ok) {
    throw new Error(`The AAGUID registry could not be loaded (HTTP ${response.status}).`);
  }
  const upstream: AaguidRegistry = await response.json();
  return { ...upstream, ...HARDWARE_KEY_REGISTRY };
}

export async function loadMeta(): Promise<AaguidMeta | null> {
  try {
    const response = await fetch("./aaguids-meta.json");
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}
