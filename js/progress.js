const KEY = "aero-shot-cleared";
export const CORE_STAGES = ["planet", "canyon", "space"];

export function loadCleared() {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function markCleared(id) {
  const set = loadCleared();
  const hadStorm = stormUnlocked(set);
  set.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
  return { set, unlockedStorm: !hadStorm && stormUnlocked(set) };
}

export function stormUnlocked(set = loadCleared()) {
  return CORE_STAGES.every((id) => set.has(id));
}
