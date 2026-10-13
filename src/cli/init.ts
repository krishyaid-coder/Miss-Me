import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type JsonObject = Record<string, unknown>;

function distIndex(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "index.js");
}

async function readJsonObject(path: string): Promise<JsonObject | null> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${path} is not a JSON object. Miss Me will not overwrite it.`);
    }
    return parsed as JsonObject;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function hookGroup(command: string, matcher?: string): JsonObject {
  const group: JsonObject = {
    hooks: [
      {
        type: "command",
        command,
        timeout: 10,
      },
    ],
  };
  if (matcher) {
    group.matcher = matcher;
  }
  return group;
}

function ensureHook(hooks: JsonObject, event: string, command: string, matcher?: string): void {
  const existing = hooks[event];
  const list = Array.isArray(existing) ? existing : [];
  const already = list.some((entry) => JSON.stringify(entry).includes("miss-me"));
  if (!already) {
    list.push(hookGroup(command, matcher));
  }
  hooks[event] = list;
}

async function writeJson(path: string, data: JsonObject): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function registerMcpWithClaudeCli(bin: string): boolean {
  const result = spawnSync(
    "claude",
    ["mcp", "add", "--scope", "user", "--transport", "stdio", "miss-me", "--", "node", bin, "mcp"],
    { encoding: "utf8" },
  );
  if (result.error) {
    return false;
  }
  if (result.status !== 0) {
    if (result.stderr) {
      console.error(result.stderr.trim());
    }
    return false;
  }
  if (result.stdout.trim()) {
    console.error(result.stdout.trim());
  }
  return true;
}

async function registerMcpInClaudeJson(bin: string): Promise<void> {
  const claudeJsonPath = join(homedir(), ".claude.json");
  const existing = await readJsonObject(claudeJsonPath);
  const claudeJson = existing ?? {};
  const mcpServers =
    claudeJson.mcpServers && typeof claudeJson.mcpServers === "object" && !Array.isArray(claudeJson.mcpServers)
      ? (claudeJson.mcpServers as JsonObject)
      : {};
  mcpServers["miss-me"] = {
    type: "stdio",
    command: "node",
    args: [bin, "mcp"],
  };
  claudeJson.mcpServers = mcpServers;
  await writeJson(claudeJsonPath, claudeJson);
  console.error(`MCP registered in ${claudeJsonPath}`);
}

export async function runInit(): Promise<void> {
  const bin = distIndex();
  const hookCommand = `node ${JSON.stringify(bin)} hook`;

  const settingsPath = join(homedir(), ".claude", "settings.json");
  const existingSettings = await readJsonObject(settingsPath);
  const settings = existingSettings ?? {};
  const hooks =
    settings.hooks && typeof settings.hooks === "object" && !Array.isArray(settings.hooks)
      ? (settings.hooks as JsonObject)
      : {};
  ensureHook(hooks, "UserPromptSubmit", hookCommand);
  ensureHook(hooks, "SessionStart", hookCommand, "compact|resume");
  ensureHook(hooks, "PreCompact", hookCommand);
  settings.hooks = hooks;
  await writeJson(settingsPath, settings);

  const viaCli = registerMcpWithClaudeCli(bin);
  if (!viaCli) {
    await registerMcpInClaudeJson(bin);
  }

  const gitignorePath = join(process.cwd(), ".gitignore");
  try {
    const current = await readFile(gitignorePath, "utf8");
    if (!current.split("\n").some((line) => line.trim() === ".miss-me/")) {
      const suffix = current.endsWith("\n") || current.length === 0 ? "" : "\n";
      await writeFile(gitignorePath, `${current}${suffix}.miss-me/\n`, "utf8");
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw error;
    }
    await writeFile(gitignorePath, ".miss-me/\n", "utf8");
  }

  console.error("Miss Me hooked into Claude Code (user scope).");
  console.error(`  server: node ${bin} mcp`);
  console.error(`  hooks: ${settingsPath}`);
  console.error("Pin facts with miss_me_pin. State is .miss-me/state.json in each project.");
  console.error("Restart Claude Code so it picks up the server.");
}
