import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { RuntimeGraph, RuntimeNode, Channel, Session } from "@spiky-panda/core";
import { McpClient } from "@cyanmycelium/mcp-core/client";
import { LoopbackTransport, McpServerBuilder } from "@cyanmycelium/mcp-core/server";
import { DecisionGraphFactory, DecisionSession, buildDecisionGraph } from "../dist/decision/index.js";
import { loadHarnessGraph } from "../dist/graph/load.js";

const jsonResult = value => ({ content: [{ type: "text", text: JSON.stringify(value) }] });
const description = name => ({ name, connected: true, connectedSince: "2026-11-06T00:00:00Z",
  transport: "websocket", aggregate: true, connectedForMs: 0, clientCount: 0, sessionCount: 0, pendingCount: 0 });

async function clientFor(t, name, resources, tools, read, call) {
  const [serverTransport, clientTransport] = LoopbackTransport.createPair();
  const server = new McpServerBuilder().withName(name).withTransport(serverTransport).register({
    namespace: name, getResources: () => resources, getResourceTemplates: () => [], getTools: () => tools,
    readResourceAsync: async uri => read?.(uri), executeToolAsync: async (_uri, tool, args) => call(tool, args, serverTransport),
  }).build();
  await server.start();
  const client = new McpClient({ name: "decision-test", version: "1" }, clientTransport, 1000);
  t.after(async () => { client.disconnect(); await server.stop(); });
  return client;
}

async function fixture(t, graph = buildDecisionGraph(new DecisionGraphFactory()), id = "agent-one") {
  const state = { calls: [], reasonCalls: [], observed: 0, recorded: [], providers: [description("reasoner"), description("web")] };
  const abort = new AbortController();
  const broker = await clientFor(t, "broker", [{ uri: "broker://providers", name: "Providers" }], [],
    () => ({ uri: "broker://providers", text: JSON.stringify({ providers: state.providers }) }));
  await broker.connect();
  const services = {
    broker, signal: abort.signal,
    connect: async info => clientFor(t, info.name, [], [{ name: info.name === "reasoner" ? "decide" : "search",
      description: "Native test capability", inputSchema: { type: "object" } }], null, async (tool, args, transport) => {
      if (info.name === "reasoner") {
        state.reasonCalls.push(args);
        await state.reason?.(args);
        return jsonResult({ decision: { invocation: { capabilityId: "web.search", input: { query: id } } } });
      }
      state.calls.push({ tool, args });
      return await state.answer?.(args, transport) ?? jsonResult({ found: id });
    }),
    observe: async () => ({ agent: id, observation: ++state.observed }),
    guard: async () => ({ allowed: true, reason: "Allowed by test host" }),
    evaluate: async step => ({ continue: false, satisfied: step.outcome === "executed", reason: "One action evaluated" }),
    record: async step => { state.recorded.push(step); },
  };
  const session = new DecisionSession(graph, { sessionId: id, intention: { id: "search", description: "Find a source", parameters: {} } }, services);
  t.after(() => session.dispose());
  return { graph, session, state, services, abort };
}

test("One native runAsync traverses the graph feedback loop three times", async t => {
  const { graph, session, state, services } = await fixture(t);
  services.evaluate = async step => ({ continue: step.iteration < 3, satisfied: step.iteration === 3, reason: "Three observations needed" });
  await graph.runAsync(0, session);
  assert.equal(session.report.status, "completed");
  assert.equal(session.report.steps.length, 3);
  assert.equal(state.calls.length, 3);
  assert.equal(state.reasonCalls.length, 3);
  assert.equal(state.recorded.length, 3);
  assert.equal(session.tickIndex, 1, "loop iterations happen inside the native traversal");
  assert.equal(session.trace.filter(event => event.nodeId === "loop" && event.output === "body").length, 3);
  assert.equal(session.trace.filter(event => event.nodeId === "web.search" && event.output === "mcp.request").length, 3);
  assert.equal(state.reasonCalls[0].allowedCapabilities[0].id, "web.search");
  assert.equal(state.reasonCalls[2].recentFailures.length, 2);
});

test("The policy branch reaches the same action node without asking the reasoner", async t => {
  const { graph, session, state, services } = await fixture(t);
  services.lookup = async () => ({ nodeId: "web.search", input: { query: "deterministic" } });
  await graph.runAsync(0, session);
  assert.equal(session.report.steps[0].outcome, "executed");
  assert.equal(state.reasonCalls.length, 0);
  assert.equal(session.trace.find(event => event.nodeId === "gate").output, "policy");
});

test("Guard refusal follows graph links to evaluation without invoking the action", async t => {
  const { graph, session, state, services } = await fixture(t);
  services.guard = async () => ({ allowed: false, reason: "Human approval missing" });
  await graph.runAsync(0, session);
  assert.equal(state.calls.length, 0);
  assert.equal(session.report.steps[0].outcome, "refused");
  assert.equal(session.report.steps[0].evaluation.satisfied, false);
  assert(session.trace.some(event => event.nodeId === "execute" && event.output === "bypass"));
});

test("Native tool errors retain their content and are never retried", async t => {
  const { graph, session, state } = await fixture(t);
  state.answer = () => ({ isError: true, content: [{ type: "text", text: "Provider refused" }, { type: "image", data: "AA==", mimeType: "image/png" }] });
  await graph.runAsync(0, session);
  assert.equal(session.report.steps[0].outcome, "tool-error");
  assert.equal(session.report.steps[0].result.content.length, 2);
  assert.equal(state.calls.length, 1);
});

test("An absent provider stays unavailable instead of becoming a successful action", async t => {
  const { graph, session, state, services } = await fixture(t);
  state.providers = [];
  services.lookup = async () => ({ nodeId: "web.search", input: {} });
  await graph.runAsync(0, session);
  assert.equal(session.report.steps[0].outcome, "unavailable");
  assert.equal(state.calls.length, 0);
});

test("A dropped connection after dispatch keeps the effect indeterminate and never retries", async t => {
  const { graph, session, state } = await fixture(t);
  state.answer = (_args, transport) => { transport.close(); return jsonResult({ responseLost: true }); };
  await graph.runAsync(0, session);
  assert.equal(session.report.steps[0].outcome, "indeterminate");
  assert.equal(session.report.steps[0].evaluation.satisfied, false);
  assert.equal(state.calls.length, 1);
});

test("An evaluator cannot certify a refusal or continue blindly after an indeterminate effect", async t => {
  for (const uncertain of [false, true]) {
    const { graph, session, services, state } = await fixture(t);
    if (uncertain) state.answer = (_args, transport) => { transport.close(); return jsonResult({}); };
    else services.guard = async () => ({ allowed: false, reason: "Refused" });
    services.evaluate = async () => ({ continue: uncertain, satisfied: !uncertain, reason: "Invalid evaluation" });
    await graph.runAsync(0, session);
    assert.equal(session.report.status, "failed");
    assert.equal(state.calls.length, uncertain ? 1 : 0);
  }
});

test("A second agent progresses on the same nodes while the first awaits MCP", async t => {
  const graph = buildDecisionGraph(new DecisionGraphFactory());
  const first = await fixture(t, graph, "agent-a");
  const second = await fixture(t, graph, "agent-b");
  let release;
  let entered;
  const blocked = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { entered = resolve; });
  first.state.reason = async () => { entered(); await blocked; };
  const active = graph.runAsync(0, first.session);
  await ready;
  try {
    await assert.rejects(graph.runAsync(0, first.session), /active async/);
    await graph.runAsync(0, second.session);
    assert.equal(first.session.report, undefined);
    assert.equal(second.session.report.status, "completed");
    assert.equal(second.session.report.steps[0].action.input.query, "agent-b");
  } finally { release(); await active; }
  assert.equal(first.session.report.steps[0].action.input.query, "agent-a");
  assert.notEqual(first.session.slots, second.session.slots);
});

test("The JSON loop budget stops a continuing agent", async t => {
  const document = JSON.parse(readFileSync(new URL("../src/graphs/decision.json", import.meta.url), "utf8"));
  document.model.nodes.find(node => node.id === "loop").data.config.maxDecisions = 2;
  const graph = loadHarnessGraph(JSON.stringify(document), new DecisionGraphFactory());
  const { session, state, services } = await fixture(t, graph);
  services.evaluate = async () => ({ continue: true, satisfied: false, reason: "More work remains" });
  await graph.runAsync(0, session);
  assert.equal(session.report.status, "budget-exhausted");
  assert.equal(state.calls.length, 2);
});

test("Cancellation retains the returned action result and terminates via a fault edge", async t => {
  const { graph, session, state, abort } = await fixture(t);
  state.answer = () => { abort.abort("Stop after the issued action"); return jsonResult({ done: true }); };
  await graph.runAsync(0, session);
  assert.equal(session.report.status, "cancelled");
  assert.equal(session.report.steps[0].outcome, "executed");
  assert.equal(session.report.steps[0].result.content.length, 1);
  assert.equal(state.calls.length, 1);
});

test("Observer failures and journal failures follow fault links", async t => {
  for (const operation of ["observe", "record"]) {
    const { graph, session, services, state } = await fixture(t);
    services[operation] = async () => { throw new Error(`${operation} failed`); };
    await graph.runAsync(0, session);
    assert.equal(session.report.status, "failed");
    assert.match(session.report.error, /failed/);
    assert.equal(state.calls.length, operation === "observe" ? 0 : 1);
  }
});

test("An unavailable reasoner ends in an explicit failure without an action", async t => {
  const { graph, session, state } = await fixture(t);
  state.providers = state.providers.filter(item => item.name !== "reasoner");
  await graph.runAsync(0, session);
  assert.equal(session.report.status, "failed");
  assert.equal(state.calls.length, 0);
});

test("Core sync and async dynamic traversals share the queue semantics", async () => {
  class Source extends RuntimeNode {
    fire(session) { this.publishAll(session, "out", 42); }
  }
  class Sink extends RuntimeNode {
    fire(session) { session.nodeStateOf(this).value = this.consumeLatest(session, "in"); }
  }
  const source = new Source();
  const sink = new Sink();
  const link = new Channel(null, null, "out"); link.toSlot = "in";
  link.oini = source; link.ofin = sink;
  const graph = new RuntimeGraph([source, sink], [link], "dynamic");
  const sync = new Session(graph); const async = new Session(graph);
  sync.run(0); await graph.runAsync(0, async);
  assert.equal(sync.nodeStateOf(sink).value, 42);
  assert.equal(async.nodeStateOf(sink).value, 42);
  assert.equal(sync.tickIndex, async.tickIndex);
});
