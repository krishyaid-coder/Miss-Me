import { resolve } from "node:path";

export function projectCwd(override?: string): string {
  const fromEnv = process.env.CLAUDE_PROJECT_DIR ?? process.env.MISS_ME_CWD;
  return resolve(override || fromEnv || process.cwd());
}

export function sessionId(override?: string): string {
  return override || process.env.CLAUDE_SESSION_ID || "default";
}
