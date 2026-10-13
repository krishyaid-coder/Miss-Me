import type { Health, Store } from "./types.js";
import { publicAnchors } from "./store.js";

export function formatHealth(health: Health): string {
  switch (health) {
    case "green":
      return "green — still holding pinned facts";
    case "degrading":
      return "degrading — some pinned facts were missed. Re-paste key context or start a fresh session.";
    case "lost":
      return "lost — this session is not holding pinned facts. Start fresh or re-paste key context.";
    default:
      return "unknown — no successful check yet";
  }
}

export function checkNudge(store: Store, reason: string): string {
  const anchors = publicAnchors(store);
  if (anchors.length === 0) {
    return "";
  }
  const list = anchors
    .map((anchor) => (anchor.label === anchor.id ? anchor.id : `${anchor.id} (${anchor.label})`))
    .join(", ");
  const last = store.sessions;
  const healthHint = Object.values(last)
    .map((session) => session.lastCheck?.health)
    .find((health) => health && health !== "unknown");

  return [
    `Miss Me ${reason}.`,
    `Pinned anchors: ${list}.`,
    `Call miss_me_check now with your recollection of each fact.`,
    `Do not ask the user to repeat them. If you do not remember an anchor, pass an empty recalled string.`,
    `Never guess from this reminder — it does not contain the facts.`,
    healthHint ? `Last health: ${formatHealth(healthHint)}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function statusText(store: Store, sessionKey: string): string {
  const session = store.sessions[sessionKey];
  const health = session?.lastCheck?.health ?? "unknown";
  const anchors = publicAnchors(store);
  const lines = [
    `health: ${health}`,
    `anchors: ${anchors.length === 0 ? "(none)" : anchors.map((a) => (a.label === a.id ? a.id : `${a.id} ${a.label}`)).join("; ")}`,
    `turns: ${session?.turns ?? 0}`,
    `checkEvery: ${store.checkEvery}`,
  ];
  if (session?.lastCheck) {
    for (const recall of session.lastCheck.recalls) {
      lines.push(`  ${recall.id}: ${recall.hit ? "hit" : "miss"}`);
    }
  }
  return lines.join("\n");
}
