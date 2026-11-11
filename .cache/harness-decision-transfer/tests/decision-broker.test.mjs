import assert from "node:assert/strict";
import { test } from "node:test";
import { startTestBroker } from "@cyanmycelium/mcp-broker/testing";
import { McpClient } from "@cyanmycelium/mcp-core/client";
import { StreamableHttpTransport } from "@cyanmycelium/mcp-core/node";
import { LoopbackTransport, McpServerBuilder } from "@cyanmycelium/mcp-core/server";
import { DecisionGraphFactory, DecisionSession, buildDecisionGraph } from "../dist/decision/index.js";

test("Native graph uses real broker discovery, HTTP routing and caller authorization", { timeout: 20000 }, async () => {
  const broker = await startTestBroker({
    callers: { agent: {}, restricted: {} },
    policy: {
      roles: { harness: { capabilities: ["*"] } },
      assignments: ["agent", "restricted"].map(name => ({ id: name, subject: `user:${name}`, role: "harness", resource: "/**" })),
      slotResources: { web: "/test/web" },
      denies: [{ id: "deny-web-call", subject: "user:restricted", capabilities: ["mcp.tools.call"], resource: "/test/web" }],
    },
  });
  const cleanups = [];
  let calls = 0;
  try {
    const [serverEnd, brokerEnd] = LoopbackTransport.createPair();
    const provider = new McpServerBuilder().withName("web").withTransport(serverEnd).register({
      namespace: "web", getResources: () => [], getResourceTemplates: () => [],
      getTools: () => [{ name: "search", description: "A controlled provider", inputSchema: { type: "object" } }],
      executeToolAsync: async () => { calls++; return { content: [{ type: "text", text: "Found a source" }] }; },
    }).build();
    await provider.start();
    broker.tunnel.registerLoopbackProvider("web", brokerEnd);
    cleanups.push(() => provider.stop());
    const graph = buildDecisionGraph(new DecisionGraphFactory());
    for (const caller of ["agent", "restricted"]) {
      const client = slot => new McpClient({ name: caller, version: "1" }, new StreamableHttpTransport(broker.mcpUrl(slot), {
        headers: broker.bearer(caller), enableGetStream: false,
      }), 3000);
      const discovery = client("_broker");
      await discovery.connect();
      cleanups.push(() => discovery.disconnect());
      const session = new DecisionSession(graph, { sessionId: caller, intention: { id: "lookup", description: "Read a source", parameters: {} } }, {
        broker: discovery, connect: info => client(info.name), signal: new AbortController().signal,
        observe: async () => ({ caller }), lookup: async () => ({ nodeId: "web.search", input: { query: "moon" } }),
        guard: async () => ({ allowed: true, reason: "Local guard permits, broker remains authoritative" }),
        evaluate: async step => ({ continue: false, satisfied: step.outcome === "executed", reason: "Inspect actual result" }),
      });
      cleanups.push(() => session.dispose());
      await graph.runAsync(0, session);
      assert.equal(session.report.status, "completed");
      if (caller === "agent") assert.equal(session.report.steps[0].outcome, "executed");
      else {
        assert.notEqual(session.report.steps[0].outcome, "executed");
        assert.equal(session.report.steps[0].evaluation.satisfied, false);
      }
    }
    assert.equal(calls, 1, "The broker stops the restricted caller before the provider, without retry");
  } finally {
    for (const cleanup of cleanups.reverse()) await cleanup();
    await broker.stop();
  }
});
