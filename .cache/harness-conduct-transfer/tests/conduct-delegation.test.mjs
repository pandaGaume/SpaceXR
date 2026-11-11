import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { AgentGraphFactory, AgentSession, DelegationLink, loadHarnessGraph } from "../dist/index.js";
import { HarnessGraphNode } from "../dist/graph/nodes.js";
import { agentFixture } from "./agent-fixture.mjs";

const source = () => JSON.parse(readFileSync(new URL("../src/graphs/agents.json", import.meta.url), "utf8"));

test("Conduct and delegated agent execute on the same graph and distinct Core sessions", async t => {
  const { graph, session, state } = await agentFixture(t);
  await graph.runAsync(0, session);
  assert.equal(session.report.status, "completed");
  assert.equal(session.report.steps.length, 2);
  assert.equal(session.conduct.get(1).stage.id, "stage.acquire");
  assert.equal(session.conduct.get(2).stage.id, "stage.delegate");
  const attempt = [...session.delegations.values()][0];
  assert.equal(attempt.child.graph, graph);
  assert.notEqual(attempt.child, session);
  assert.equal(attempt.child.report.status, "completed");
  assert.equal(attempt.child.report.steps.length, 1);
  assert.equal(attempt.returned, true);
  assert.equal(session.report.steps[1].outcome, "executed");
  assert.deepEqual(state.requests[0].context.projected, { publicFacts: { body: "moon" } });
  assert(!JSON.stringify(state.requests[0]).includes("parent-private"));
  assert(state.identities.some(item => item.identity === attempt.child.input.sessionId && item.slot === "_broker"));
  const offered = state.reasonCalls.map(call => call.args.allowedCapabilities.map(item => item.id));
  assert.deepEqual(offered, [["parent.web.search"], ["delegate.analysis"], ["worker.web.search"]]);
  assert.equal(state.reasonCalls[1].args.state.features.conduct.stage.id, "stage.delegate");
});

test("Unknown evidence closes delegation and cannot be bypassed by a deterministic decision", async t => {
  const { graph, session, services, state } = await agentFixture(t);
  state.factOverrides = { "inputs.ready": true, "delegation.authorized": null };
  services.lookup = async () => ({ nodeId: "delegate.analysis", input: { objective: "Skip evidence" } });
  await graph.runAsync(0, session);
  assert.equal(session.report.steps[0].outcome, "refused");
  assert.equal(session.conduct.get(1).closed[0].unknown, true);
  assert.equal(state.requests.length, 0);
  assert.equal(state.calls.length, 0);
});

test("A count bound in the conduct graph closes an exhausted delegation", async t => {
  const { graph, session, services, state } = await agentFixture(t);
  state.factOverrides = { "inputs.ready": true, "delegation.attempts": 2 };
  services.lookup = async () => ({ nodeId: "delegate.analysis", input: { objective: "Try again" } });
  await graph.runAsync(0, session);
  assert.equal(session.conduct.get(1).stage.id, "stage.delegate");
  assert.deepEqual(session.conduct.get(1).allowed, []);
  assert.equal(session.report.steps[0].outcome, "refused");
});

test("A malformed conduct with multiple active stages fails before any action", async t => {
  const doc = source();
  doc.model.connections.find(link => link.to.node === "stage.delegate" && link.to.port === "entered").from = { node: "conduct.ingress", port: "tick" };
  const graph = loadHarnessGraph(JSON.stringify(doc), new AgentGraphFactory());
  const { session, state } = await agentFixture(t, graph);
  await graph.runAsync(0, session);
  assert.equal(session.report.status, "failed");
  assert.match(session.report.error, /exactly one active stage/);
  assert.equal(state.calls.length, 0);
});

test("Parent's independent branch progresses while the delegated agent awaits MCP", async t => {
  const doc = source();
  doc.model.nodes.push({ id: "parent.independent", typeId: "test.independent", data: {
    resolver: "test.independent", region: "independent", inputPorts: [{ slot: "in", optional: false }], outputPorts: [],
    config: {}, activation: "each-message", needs: [],
  } });
  doc.model.connections.push({ typeId: "harness.link", from: { node: "delegate.analysis", port: "launched" },
    to: { node: "parent.independent", port: "in" }, data: { mode: "continue", context: "project" } });
  const factory = new AgentGraphFactory();
  const progressed = new Set();
  class IndependentNode extends HarnessGraphNode {
    isReady(session) { return this.inputChannels("in").some(link => session.linkStateOf(link)?.ready); }
    fire(session) { this.consumeLatest(session, "in"); progressed.add(session.input.sessionId); }
  }
  factory.nodes.register("test.independent", () => new IndependentNode(), { label: "Independent branch" });
  const graph = loadHarnessGraph(JSON.stringify(doc), factory);
  const { session, state } = await agentFixture(t, graph);
  let release;
  const entered = new Promise(resolve => { state.childEntered = resolve; });
  state.holdChild = new Promise(resolve => { release = resolve; });
  const running = graph.runAsync(0, session);
  await entered;
  try {
    assert(progressed.has(session.input.sessionId));
    assert.equal(session.report, undefined);
    const attempt = [...session.delegations.values()][0];
    assert.equal(attempt.child.report, undefined);
  } finally { release(); await running; }
  assert.equal(session.report.status, "completed");
});

test("Wrong, late and duplicate delegation results cannot satisfy a join", async t => {
  const { graph, session, state } = await agentFixture(t);
  let release;
  state.holdChild = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { state.childEntered = resolve; });
  const running = graph.runAsync(0, session);
  await entered;
  const link = graph.links.find(link => link instanceof DelegationLink && link.mode === "result");
  const index = graph.links.indexOf(link);
  const attempt = [...session.delegations.values()][0];
  session.publish(index, { step: { iteration: 2 }, delegation: { attemptId: attempt.request.attemptId,
    parentSessionId: "another-agent", childSessionId: attempt.request.childSessionId, delegateId: "delegate.analysis" } });
  release(); await running;
  session.publish(index, { step: { iteration: 2 }, delegation: structuredClone(attempt.result) });
  assert.equal(session.report.steps.length, 2);
  assert.equal(session.trace.filter(event => event.output === "delegation.ignored").length, 2);
});

test("A failed child result never becomes a successful parent action", async t => {
  const { graph, session, state } = await agentFixture(t);
  state.childError = true;
  await graph.runAsync(0, session);
  assert.equal(session.report.steps[1].outcome, "tool-error");
  assert.equal(session.report.steps[1].evaluation.satisfied, false);
});

test("Cancellation propagates from the parent to the child session", async t => {
  const { graph, session, state, abort } = await agentFixture(t);
  let release;
  state.holdChild = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { state.childEntered = resolve; });
  const running = graph.runAsync(0, session);
  await entered;
  abort.abort("User interrupted"); release(); await running;
  assert.equal(session.report.status, "cancelled");
  const child = [...session.delegations.values()][0].child;
  assert.equal(child.report.status, "cancelled");
  assert.equal(child.services.signal.aborted, true);
});

test("Child sessions cannot discover or dispatch their parent's action nodes", async t => {
  const { graph, session, services, state } = await agentFixture(t);
  const original = services.createDelegateServices;
  services.createDelegateServices = async request => {
    const childServices = await original(request);
    childServices.lookup = async () => ({ nodeId: "parent.web.search", input: {} });
    return childServices;
  };
  await graph.runAsync(0, session);
  const child = [...session.delegations.values()][0].child;
  assert.equal(child.report.status, "failed");
  assert.match(child.report.error, /accessible action/);
  assert.equal(state.calls.length, 1);
});

test("Delegation depth is bounded by graph configuration", async t => {
  const { graph, services, state } = await agentFixture(t);
  const session = new AgentSession(graph, { sessionId: "at-depth-limit", lineage: {
    parentSessionId: "ancestor", attemptId: "prior", depth: 2 }, intention: { id: "limit", description: "Verify depth", parameters: {} } }, services);
  t.after(() => session.dispose());
  state.inputsReady = true;
  await graph.runAsync(0, session);
  assert.equal(session.report.status, "failed");
  assert.match(session.report.error, /depth budget/);
  assert.equal(state.requests.length, 0);
});

test("A child's services cannot silently reuse the parent's broker session", async t => {
  const { graph, session, services, state } = await agentFixture(t);
  state.inputsReady = true;
  services.createDelegateServices = async () => services;
  await graph.runAsync(0, session);
  assert.equal(session.report.status, "failed");
  assert.match(session.report.error, /own broker MCP session/);
  assert.equal(state.calls.length, 0);
});
