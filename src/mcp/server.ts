import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { projectCwd, sessionId } from "../core/cwd.js";
import { formatCheckReport, statusText } from "../core/nudge.js";
import { scoreCheck } from "../core/score.js";
import { loadStore, pinAnchor, publicAnchors, recordCheck, unpinAnchor } from "../core/store.js";

function textResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
  };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "miss-me",
    version: "0.1.0",
  });

  server.tool(
    "miss_me_pin",
    "Pin an anchor fact this session must keep. Use for constraints, stack choices, audience, or names the user cares about. Do not pin secrets.",
    {
      fact: z.string().describe("The fact to remember, in the user's words."),
      label: z.string().optional().describe("Short handle, e.g. stack or audience. Not a substitute for the fact."),
    },
    async ({ fact, label }) => {
      try {
        const anchor = await pinAnchor(projectCwd(), fact, label);
        return textResult({
          pinned: { id: anchor.id, label: anchor.label },
          note: "Miss Me stored this locally. It will re-probe recall later without showing the fact back to you.",
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : "Pin failed.");
      }
    },
  );

  server.tool(
    "miss_me_list",
    "List pinned Miss Me anchors. Returns ids and labels only — not the facts — so this is not a cheat sheet.",
    {},
    async () => {
      const store = await loadStore(projectCwd());
      return textResult({ anchors: publicAnchors(store) });
    },
  );

  server.tool(
    "miss_me_unpin",
    "Remove a pinned anchor by id.",
    {
      id: z.string().describe("Anchor id, e.g. a1."),
    },
    async ({ id }) => {
      const removed = await unpinAnchor(projectCwd(), id);
      if (!removed) {
        return errorResult(`No anchor ${id}.`);
      }
      return textResult({ unpinned: id });
    },
  );

  server.tool(
    "miss_me_status",
    "Show the last Miss Me health for this project: green, degrading, lost, or unknown.",
    {},
    async () => {
      const cwd = projectCwd();
      const store = await loadStore(cwd);
      const sid = sessionId();
      return textResult({
        health: store.sessions[sid]?.lastCheck?.health ?? "unknown",
        detail: statusText(store, sid),
      });
    },
  );

  server.tool(
    "miss_me_check",
    "Report whether this session still holds pinned anchors. Pass your recollection of each id. Do not ask the user to repeat the facts. If you do not remember one, pass an empty recalled string. The tool never tells you the stored facts. After it returns, you must show the report to the user in your reply: that a Miss Me check ran, what you recalled, and the health.",
    {
      recollections: z
        .array(
          z.object({
            id: z.string().describe("Anchor id such as a1."),
            recalled: z
              .string()
              .describe("What you currently believe the fact is. Empty if you do not remember."),
          }),
        )
        .describe("One entry per pinned anchor."),
    },
    async ({ recollections }) => {
      const cwd = projectCwd();
      const store = await loadStore(cwd);
      if (store.anchors.length === 0) {
        return textResult({ health: "unknown", note: "No anchors pinned." });
      }
      const check = scoreCheck(store.anchors, recollections);
      const saved = await recordCheck(cwd, sessionId(), check);
      const report = formatCheckReport(saved, check);
      return {
        content: [
          {
            type: "text" as const,
            text: `${report}\n\nShow this Miss Me result to the user in your reply. Quote what you recalled and the health. Do not skip it.`,
          },
        ],
      };
    },
  );

  return server;
}

export async function startMcp(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("miss-me MCP server running on stdio");
}
