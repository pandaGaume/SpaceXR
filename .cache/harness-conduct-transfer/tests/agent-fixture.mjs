import { McpClient } from "@cyanmycelium/mcp-core/client";
import { McpServerBuilder, LoopbackTransport } from "@cyanmycelium/mcp-core/server";
import { AgentSession, AgentGraphFactory, buildAgentGraph } from "../dist/index.js";

export const jsonResult = value => ({ content: [{ type: "text", text: JSON.stringify(value) }] });
export async function agentFixture(t, graph = buildAgentGraph(new AgentGraphFactory()), rootId = "commander") {
  const state = { inputsReady: false, calls: [], reasonCalls: [], requests: [], identities: [], childServices: [] };
  const abort = new AbortController();
  const providers = ["reasoner", "web"].map(name => ({ name, connected: true, connectedSince: "2026-11-06T00:00:00Z",
    transport: "loopback", aggregate: false, connectedForMs: 0, clientCount: 0, sessionCount: 0, pendingCount: 0 }));
  async function client(identity, slot) {
    const [serverTransport, clientTransport] = LoopbackTransport.createPair();
    const server = new McpServerBuilder().withName(slot).withTransport(serverTransport).register({
      namespace: slot, getResources: () => slot === "_broker" ? [{ uri: "broker://providers", name: "Providers" }] : [],
      getResourceTemplates: () => [], getTools: () => slot === "_broker" ? [] : [{ name: slot === "web" ? "search" : "decide",
        description: "Controlled native provider", inputSchema: { type: "object" } }],
      readResourceAsync: async () => ({ uri: "broker://providers", text: JSON.stringify({ providers }) }),
      executeToolAsync: async (_uri, tool, args) => {
        const child = identity !== rootId;
        if (slot === "reasoner") {
          state.reasonCalls.push({ identity, args });
          const id = args.allowedCapabilities[0]?.id;
          return jsonResult({ decision: { invocation: { capabilityId: id, input: id?.startsWith("delegate.")
            ? { objective: "Verify the collected sources", context: { requested: "analysis" } } : { query: identity } } } });
        }
        state.calls.push({ identity, tool, args });
        if (child) {
          state.childEntered?.();
          await state.holdChild;
          if (state.childError) return { isError: true, content: [{ type: "text", text: "Analysis refused" }] };
        } else state.inputsReady = true;
        return jsonResult({ source: identity, measured: true });
      },
    }).build();
    await server.start();
    const client = new McpClient({ name: identity, version: "1" }, clientTransport, 2000);
    t.after(async () => { client.disconnect(); await server.stop(); });
    state.identities.push({ identity, slot });
    return client;
  }
  async function servicesFor(identity) {
    const broker = await client(identity, "_broker");
    await broker.connect();
    const services = {
      broker, connect: info => client(identity, info.name), signal: identity === rootId ? abort.signal : new AbortController().signal,
      observe: async () => ({ inputsReady: state.inputsReady, publicFacts: { body: "moon" }, privateFacts: "parent-private" }),
      conductEvidence: async () => ({ "inputs.ready": state.inputsReady, "delegation.authorized": true,
        "delegation.attempts": 0, ...state.factOverrides }),
      guard: async () => ({ allowed: true, reason: "Local operation allowed" }),
      evaluate: async step => ({ continue: identity === rootId && step.action.nodeId === "parent.web.search",
        satisfied: step.outcome === "executed" && (identity !== rootId || step.action.nodeId.startsWith("delegate.")),
        reason: "Verify observed results" }),
      createDelegateServices: async request => {
        state.requests.push(request);
        const child = await servicesFor(request.childSessionId);
        state.childServices.push(child);
        return child;
      },
    };
    return services;
  }
  const services = await servicesFor(rootId);
  const session = new AgentSession(graph, { sessionId: rootId, intention: {
    id: "research", description: "Collect sources and delegate their analysis", parameters: {} } }, services);
  t.after(() => session.dispose());
  return { graph, session, services, state, abort };
}
