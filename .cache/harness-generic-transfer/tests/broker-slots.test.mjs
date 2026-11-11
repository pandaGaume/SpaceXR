import assert from "node:assert/strict";
import { test } from "node:test";
import { McpClient } from "@cyanmycelium/mcp-core/client";
import { LoopbackTransport, McpServerBuilder } from "@cyanmycelium/mcp-core/server";
import { BrokerSlots } from "../dist/broker/slots.js";

const provider = (name, connectedSince = "2026-11-06T12:00:00Z") => ({
  name, connected: true, connectedSince, transport: "websocket", aggregate: true,
  connectedForMs: 0, clientCount: 0, sessionCount: 0, pendingCount: 0,
});
const result = value => ({ content: [{ type: "text", text: JSON.stringify(value) }] });

async function nativeSession(t, namespace, resources, tools, read, call) {
  const [serverTransport, clientTransport] = LoopbackTransport.createPair();
  const behavior = {
    namespace, getResources: () => resources, getResourceTemplates: () => [], getTools: () => tools,
    readResourceAsync: async uri => read?.(uri),
    executeToolAsync: async (_uri, name, input) => call?.(name, input) ?? result({}),
  };
  const server = new McpServerBuilder().withName(namespace).withTransport(serverTransport).register(behavior).build();
  await server.start();
  const client = new McpClient({ name: "harness-test", version: "1" }, clientTransport);
  t.after(async () => { client.disconnect(); await server.stop(); });
  return client;
}

async function fixture(t) {
  const state = { providers: [provider("cache"), provider("history"), provider("vault"), provider("web"), provider("explorer")], calls: [], connections: [] };
  const broker = await nativeSession(t, "broker", [{ uri: "broker://providers", name: "Providers" }], [],
    () => ({ uri: "broker://providers", mimeType: "application/json", text: JSON.stringify({ providers: state.providers }) }));
  await broker.connect();
  const slots = new BrokerSlots({ broker, connect: async info => {
    state.connections.push(info.name);
    return nativeSession(t, info.name, [], [{ name: "inspect", description: "Inspect", inputSchema: { type: "object" } }], null,
      (name, input) => { state.calls.push({ slot: info.name, name, input }); return state.answer?.(name, input) ?? result({ source: info.name }); });
  } });
  t.after(() => slots.close());
  return { state, slots, broker };
}

test("MCP family services and Explorer use the same native slot discovery", async t => {
  const { state, slots } = await fixture(t);
  assert.equal((await slots.providers()).length, 5);
  for (const info of state.providers) {
    assert.equal((await slots.tools(info.name))[0].name, "inspect");
    const answer = await slots.call(info.name, "inspect", { key: "one" });
    assert.equal(JSON.parse(answer.content[0].text).source, info.name);
  }
  assert.equal(state.connections.length, 5, "one native session per slot");
});

test("Disconnected providers and disconnected discovery do not use cached tools", async t => {
  const { state, slots, broker } = await fixture(t);
  await slots.tools("cache");
  state.providers = state.providers.map(info => info.name === "cache" ? { ...info, connected: false, connectedSince: null } : info);
  await assert.rejects(slots.call("cache", "inspect", {}), /unavailable/);
  assert.equal(state.calls.length, 0);
  broker.disconnect();
  await assert.rejects(slots.tools("history"), /disconnected/);
});

test("Replaced providers receive a new session; refusals retain all content and never retry", async t => {
  const { state, slots } = await fixture(t);
  await slots.tools("explorer");
  state.providers = state.providers.map(info => info.name === "explorer" ? provider("explorer", "2026-11-06T12:01:00Z") : info);
  state.answer = () => ({ isError: true, content: [{ type: "text", text: "Operation refused" }, { type: "image", data: "AA==", mimeType: "image/png" }] });
  const answer = await slots.call("explorer", "inspect", {});
  assert.equal(answer.isError, true);
  assert.equal(answer.content.length, 2);
  assert.equal(state.connections.filter(name => name === "explorer").length, 2);
  assert.equal(state.calls.length, 1);
});

test("Closing the directory leaves its caller-owned broker intact", async t => {
  const { slots, broker } = await fixture(t);
  await slots.tools("cache");
  slots.close();
  assert.equal(broker.isConnected, true);
  await assert.rejects(slots.tools("cache"), /closed/);
});
