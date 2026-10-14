import { checkNudge, formatCheckReport } from "../core/nudge.js";
import { bumpTurn, latestCheck, loadStore, markCheckAnnounced } from "../core/store.js";

type HookInput = {
  hook_event_name?: string;
  cwd?: string;
  session_id?: string;
  source?: string;
};

function extraContext(eventName: string, text: string, extra?: Record<string, unknown>): string {
  return JSON.stringify({
    ...extra,
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: text,
    },
  });
}

export async function runHook(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  let input: HookInput = {};
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (raw) {
    try {
      input = JSON.parse(raw) as HookInput;
    } catch {
      process.exit(0);
    }
  }

  const cwd = input.cwd || process.cwd();
  const sessionId = input.session_id || "default";
  const event = input.hook_event_name || "";

  if (event === "UserPromptSubmit") {
    const { due, store } = await bumpTurn(cwd, sessionId);
    if (due) {
      const text = checkNudge(store, "retention check is due");
      if (text) {
        process.stdout.write(extraContext("UserPromptSubmit", text));
      }
    }
    process.exit(0);
  }

  if (event === "SessionStart") {
    const store = await loadStore(cwd);
    const why =
      input.source === "compact"
        ? "context just compacted — verify recall before continuing"
        : "session resumed — verify recall before continuing";
    const text = checkNudge(store, why);
    if (text) {
      process.stdout.write(extraContext("SessionStart", text));
    }
    process.exit(0);
  }

  if (event === "PreCompact") {
    const store = await loadStore(cwd);
    const text = checkNudge(
      store,
      "context is about to compact, which is when recall usually drops — check before it happens",
    );
    if (text) {
      process.stdout.write(extraContext("PreCompact", text));
    }
    process.exit(0);
  }

  if (event === "Stop") {
    const store = await loadStore(cwd);
    const check = latestCheck(store);
    if (check && !check.announced) {
      const report = formatCheckReport(store, check);
      await markCheckAnnounced(cwd);
      process.stdout.write(
        extraContext(
          "Stop",
          `${report}\n\nTell the user this Miss Me result in your next message. Quote what you recalled and the health. Do not skip it.`,
          { systemMessage: report },
        ),
      );
    }
    process.exit(0);
  }

  process.exit(0);
}
