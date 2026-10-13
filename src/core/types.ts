export type Health = "green" | "degrading" | "lost" | "unknown";

export type Anchor = {
  id: string;
  label: string;
  fact: string;
  createdAt: string;
};

export type AnchorRecall = {
  id: string;
  hit: boolean;
  recalled: string;
};

export type CheckResult = {
  at: string;
  health: Health;
  recalls: AnchorRecall[];
};

export type SessionState = {
  turns: number;
  lastCheck: CheckResult | null;
};

export type Store = {
  version: 1;
  checkEvery: number;
  anchors: Anchor[];
  sessions: Record<string, SessionState>;
};

export const DEFAULT_CHECK_EVERY = 8;
export const MAX_ANCHORS = 5;
