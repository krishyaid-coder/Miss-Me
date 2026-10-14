import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DEFAULT_CHECK_EVERY, MAX_ANCHORS, type Anchor, type CheckResult, type Store } from "./types.js";

export function storePath(cwd: string): string {
  return join(cwd, ".miss-me", "state.json");
}

export function emptyStore(): Store {
  return {
    version: 1,
    checkEvery: DEFAULT_CHECK_EVERY,
    anchors: [],
    lastCheck: null,
    sessions: {},
  };
}

export async function loadStore(cwd: string): Promise<Store> {
  const path = storePath(cwd);
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Store;
    if (parsed.version !== 1 || !Array.isArray(parsed.anchors)) {
      return emptyStore();
    }
    return {
      version: 1,
      checkEvery: parsed.checkEvery > 0 ? parsed.checkEvery : DEFAULT_CHECK_EVERY,
      anchors: parsed.anchors,
      lastCheck: parsed.lastCheck ?? latestSessionCheck(parsed.sessions ?? {}),
      sessions: parsed.sessions ?? {},
    };
  } catch {
    return emptyStore();
  }
}

export async function saveStore(cwd: string, store: Store): Promise<void> {
  const path = storePath(cwd);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function nextId(anchors: Anchor[]): string {
  const used = new Set(anchors.map((anchor) => anchor.id));
  for (let i = 1; i <= MAX_ANCHORS + 8; i += 1) {
    const id = `a${i}`;
    if (!used.has(id)) {
      return id;
    }
  }
  return `a${anchors.length + 1}`;
}

export async function pinAnchor(
  cwd: string,
  fact: string,
  label?: string,
): Promise<Anchor> {
  const trimmed = fact.trim();
  if (!trimmed) {
    throw new Error("Anchor fact is empty.");
  }
  const store = await loadStore(cwd);
  if (store.anchors.length >= MAX_ANCHORS) {
    throw new Error(`At most ${MAX_ANCHORS} anchors. Unpin one first.`);
  }
  const id = nextId(store.anchors);
  const shortLabel = (label ?? "").trim().slice(0, 24);
  const anchor: Anchor = {
    id,
    label: shortLabel || id,
    fact: trimmed,
    createdAt: new Date().toISOString(),
  };
  store.anchors.push(anchor);
  await saveStore(cwd, store);
  return anchor;
}

export async function unpinAnchor(cwd: string, id: string): Promise<boolean> {
  const store = await loadStore(cwd);
  const next = store.anchors.filter((anchor) => anchor.id !== id);
  if (next.length === store.anchors.length) {
    return false;
  }
  store.anchors = next;
  await saveStore(cwd, store);
  return true;
}

function latestSessionCheck(sessions: Store["sessions"]): CheckResult | null {
  let best: CheckResult | null = null;
  for (const session of Object.values(sessions)) {
    if (session.lastCheck && (!best || session.lastCheck.at > best.at)) {
      best = session.lastCheck;
    }
  }
  return best;
}

export function latestCheck(store: Store): CheckResult | null {
  if (store.lastCheck) {
    return store.lastCheck;
  }
  return latestSessionCheck(store.sessions);
}

function busiestSessionId(store: Store, fallback: string): string {
  let bestId = fallback;
  let bestTurns = store.sessions[fallback]?.turns ?? -1;
  for (const [id, session] of Object.entries(store.sessions)) {
    if (session.turns > bestTurns) {
      bestTurns = session.turns;
      bestId = id;
    }
  }
  return bestId;
}

export async function recordCheck(cwd: string, sessionId: string, check: CheckResult): Promise<Store> {
  const store = await loadStore(cwd);
  const stamped = { ...check, announced: false };
  store.lastCheck = stamped;
  const session = store.sessions[sessionId] ?? { turns: 0, lastCheck: null };
  session.lastCheck = stamped;
  store.sessions[sessionId] = session;
  const activeId = busiestSessionId(store, sessionId);
  if (activeId !== sessionId) {
    const active = store.sessions[activeId] ?? { turns: 0, lastCheck: null };
    active.lastCheck = stamped;
    store.sessions[activeId] = active;
  }
  await saveStore(cwd, store);
  return store;
}

export async function markCheckAnnounced(cwd: string): Promise<void> {
  const store = await loadStore(cwd);
  const check = latestCheck(store);
  if (!check || check.announced) {
    return;
  }
  const announced = { ...check, announced: true };
  store.lastCheck = announced;
  for (const session of Object.values(store.sessions)) {
    if (session.lastCheck && session.lastCheck.at === check.at) {
      session.lastCheck = announced;
    }
  }
  await saveStore(cwd, store);
}

export async function bumpTurn(cwd: string, sessionId: string): Promise<{ turns: number; due: boolean; store: Store }> {
  const store = await loadStore(cwd);
  if (store.anchors.length === 0) {
    return { turns: 0, due: false, store };
  }
  const session = store.sessions[sessionId] ?? { turns: 0, lastCheck: null };
  session.turns += 1;
  store.sessions[sessionId] = session;
  await saveStore(cwd, store);
  const due = session.turns % store.checkEvery === 0;
  return { turns: session.turns, due, store };
}

export function publicAnchors(store: Store): Array<{ id: string; label: string }> {
  return store.anchors.map((anchor) => ({ id: anchor.id, label: anchor.label }));
}
