import assert from "node:assert/strict";
import { test } from "node:test";
import { startTestBroker } from "@cyanmycelium/mcp-broker/testing";
import { McpClient } from "@cyanmycelium/mcp-core/client";
import { StreamableHttpTransport } from "@cyanmycelium/mcp-core/node";
import { LoopbackTransport, McpServerBuilder } from "@cyanmycelium/mcp-core/server";
import { AgentSession, AgentGraphFactory, buildAgentGraph } from "../dist/index.js";

test("A delegated agent uses its own broker identity and cannot inherit the commander's access", async () => {
  const broker = await startTestBroker({ callers: { commander: {}, analyst: {} }, policy: {
    roles: { all: { capabilities: ["*"] } },
    assignments: ["commander", "analyst"].map(name => ({ id: name, subject: `user:${name}`, role: "all", resource: "/**" })),
    slotResources: { web: "/test/web" },
    denies: [{ id: "analyst-no-web-call", subject: "user:analyst", capabilities: ["mcp.tools.call"], resource: "/test/web" }],
  } });
  const cleanups = [];
  let providerCalls = 0;
  try {
    const [serverEnd, brokerEnd] = LoopbackTransport.createPair();
    const provider = new McpServerBuilder().withName("web").withTransport(serverEnd).register({
      namespace: "web", getResources: () => [], getResourceTemplates: () => [],
      getTools: () => [{ name: "search", description: "Controlled tool", inputSchema: { type: "object" } }],
      executeToolAsync: async () => { providerCalls++; return { content: [{ type: "text", text: "Result" }] }; },
    }).build();
    await provider.start(); broker.tunnel.registerLoopbackProvider("web", brokerEnd);
    cleanups.push(() => provider.stop());
    const graph = buildAgentGraph(new AgentGraphFactory());
    async function servicesFor(caller) {
      const client = slot => new McpClient({ name: caller, version: "1" }, new StreamableHttpTransport(broker.mcpUrl(slot), {
        headers: broker.bearer(caller), enableGetStream: false,
      }), 2000);
      const discovery = client("_broker"); await discovery.connect();
      cleanups.push(() => discovery.disconnect());
      return {
        broker: discovery, connect: info => client(info.name), signal: new AbortController().signal,
        observe: async () => ({ caller }), conductEvidence: async () => ({
          "inputs.ready": true, "delegation.authorized": true, "delegation.attempts": 0 }),
        lookup: async () => caller === "commander" ? { nodeId: "delegate.analysis", input: { objective: "Read sources" } }
          : { nodeId: "worker.web.search", input: { query: "moon" } },
        guard: async () => ({ allowed: true, reason: "Local guard permits" }),
        evaluate: async step => ({ continue: false, satisfied: step.outcome === "executed", reason: "Check actual result" }),
        createDelegateServices: async request => { assert.equal(request.role, "analyst"); return servicesFor("analyst"); },
      };
    }
    const session = new AgentSession(graph, { sessionId: "commander-run", intention: { id: "analysis", description: "Delegate", parameters: {} } }, await servicesFor("commander"));
    cleanups.push(() => session.dispose());
    await graph.runAsync(0, session);
    assert.equal(session.report.steps[0].outcome, "tool-error");
    assert.equal(session.report.steps[0].evaluation.satisfied, false);
    const child = [...session.delegations.values()][0].child;
    assert.equal(child.report.steps[0].outcome, "indeterminate");
    assert.equal(providerCalls, 0, "Real broker policy rejects the child's call before provider execution");
  } finally {
    for (const cleanup of cleanups.reverse()) await cleanup();
    await broker.stop();
  }
});
