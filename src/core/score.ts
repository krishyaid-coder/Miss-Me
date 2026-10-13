import type { Anchor, AnchorRecall, CheckResult, Health } from "./types.js";

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "our",
  "plus",
  "the",
  "this",
  "to",
  "we",
  "with",
]);

export function significantTokens(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(" ")
      .filter((token) => token.length > 2 && !STOPWORDS.has(token)),
  );
}

export function recallHit(stored: string, recalled: string | null | undefined): boolean {
  if (!recalled || !normalize(recalled)) {
    return false;
  }

  const storedNorm = normalize(stored);
  const recalledNorm = normalize(recalled);
  if (recalledNorm.includes(storedNorm) || storedNorm.includes(recalledNorm)) {
    return true;
  }

  const storedTokens = significantTokens(stored);
  const recalledTokens = significantTokens(recalled);
  if (storedTokens.size === 0) {
    return storedNorm === recalledNorm;
  }

  let overlap = 0;
  for (const token of storedTokens) {
    if (recalledTokens.has(token)) {
      overlap += 1;
    }
  }

  const unionSize = new Set([...storedTokens, ...recalledTokens]).size;
  const coverage = overlap / storedTokens.size;
  const jaccard = unionSize === 0 ? 0 : overlap / unionSize;
  return coverage >= 0.55 || jaccard >= 0.45;
}

export function healthFromHits(hits: boolean[]): Health {
  if (hits.length === 0) {
    return "unknown";
  }
  const hitCount = hits.filter(Boolean).length;
  if (hitCount === hits.length) {
    return "green";
  }
  if (hitCount === 0) {
    return "lost";
  }
  return "degrading";
}

export function scoreCheck(
  anchors: Anchor[],
  recollections: ReadonlyArray<{ id: string; recalled?: string | null }>,
  at: string = new Date().toISOString(),
): CheckResult {
  const byId = new Map(recollections.map((item) => [item.id, item.recalled ?? ""]));
  const recalls: AnchorRecall[] = anchors.map((anchor) => {
    const recalled = byId.get(anchor.id) ?? "";
    return {
      id: anchor.id,
      recalled,
      hit: recallHit(anchor.fact, recalled),
    };
  });

  return {
    at,
    health: healthFromHits(recalls.map((item) => item.hit)),
    recalls,
  };
}
