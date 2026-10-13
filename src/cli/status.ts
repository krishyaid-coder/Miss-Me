import { projectCwd, sessionId } from "../core/cwd.js";
import { statusText } from "../core/nudge.js";
import { loadStore } from "../core/store.js";

export async function runStatus(): Promise<void> {
  const cwd = projectCwd();
  const store = await loadStore(cwd);
  process.stdout.write(`${statusText(store, sessionId())}\n`);
}
