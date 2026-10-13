#!/usr/bin/env node
import { runHook } from "./cli/hook.js";
import { runInit } from "./cli/init.js";
import { runStatus } from "./cli/status.js";
import { pinAnchor, unpinAnchor } from "./core/store.js";
import { projectCwd } from "./core/cwd.js";
import { startMcp } from "./mcp/server.js";

const USAGE = `miss-me — know when your AI actually forgets

Usage:
  miss-me init          Wire Claude Code MCP + hooks (user scope)
  miss-me mcp           Start the local stdio MCP server
  miss-me hook          Claude Code hook entry (stdin JSON)
  miss-me status        Print health for this project
  miss-me pin <fact>    Pin an anchor from the terminal
  miss-me unpin <id>    Remove an anchor
`;

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "init":
      await runInit();
      return;
    case "mcp":
      await startMcp();
      return;
    case "hook":
      await runHook();
      return;
    case "status":
      await runStatus();
      return;
    case "pin": {
      const fact = rest.join(" ").trim();
      if (!fact) {
        console.error("usage: miss-me pin <fact>");
        process.exit(1);
      }
      const anchor = await pinAnchor(projectCwd(), fact);
      process.stdout.write(`${anchor.id} (${anchor.label})\n`);
      return;
    }
    case "unpin": {
      const id = rest[0];
      if (!id) {
        console.error("usage: miss-me unpin <id>");
        process.exit(1);
      }
      const removed = await unpinAnchor(projectCwd(), id);
      if (!removed) {
        console.error(`No anchor ${id}.`);
        process.exit(1);
      }
      return;
    }
    case "-h":
    case "--help":
    case "help":
    case undefined:
      process.stderr.write(USAGE);
      process.exit(command ? 0 : 1);
      return;
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
      process.exit(1);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
