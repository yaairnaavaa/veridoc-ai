/**
 * Persistencia local (localStorage) de análisis completados en el wizard.
 * Los análisis se mantienen hasta que el usuario los borre.
 */

const STORAGE_KEY = "veridoc-analyses";

export type SavedReport = {
  summary: string;
  keyItems: string[];
  nextSteps: string[];
  questions: string[];
  extraInfo?: string;
  disclaimer?: string;
};

export type SavedAnalysis = {
  id: string;
  createdAt: string; // ISO
  labFileName: string;
  report: SavedReport;
};

function getStored(): SavedAnalysis[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is SavedAnalysis =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as SavedAnalysis).id === "string" &&
        typeof (x as SavedAnalysis).createdAt === "string" &&
        typeof (x as SavedAnalysis).labFileName === "string" &&
        typeof (x as SavedAnalysis).report === "object"
    );
  } catch {
    return [];
  }
}

function setStored(items: SavedAnalysis[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function getAnalyses(): SavedAnalysis[] {
  const items = getStored();
  return items.slice().sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

export function addAnalysis(analysis: Omit<SavedAnalysis, "id" | "createdAt">): SavedAnalysis {
  const items = getStored();
  const now = new Date().toISOString();
  const id = crypto.randomUUID?.() ?? `a-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const newItem: SavedAnalysis = {
    ...analysis,
    id,
    createdAt: now,
  };
  items.unshift(newItem);
  setStored(items);
  return newItem;
}

export function removeAnalysis(id: string): void {
  const items = getStored().filter((a) => a.id !== id);
  setStored(items);
}

export function clearAnalyses(): void {
  setStored([]);
}
