import type { McpTool, McpToolResult } from "@cyanmycelium/mcp-core";
import { McpClient } from "@cyanmycelium/mcp-core/client";
import type { IBrokerProviderInfo } from "@cyanmycelium/mcp-broker";
import { BROKER_DISCOVERY } from "../contracts/discovery.js";

/** The host supplies native MCP clients and owns credentials and transports. */
export interface IBrokerSlotsOptions {
  /** An initialized client of the broker's reserved discovery slot. */
  readonly broker: McpClient;
  /** Create a separate native MCP session for this provider and caller identity. */
  readonly connect: (provider: Readonly<IBrokerProviderInfo>) => McpClient | Promise<McpClient>;
}

interface ISlotConnection {
  readonly provider: Readonly<IBrokerProviderInfo>;
  readonly opening: Promise<McpClient>;
}

/** Rejection before dispatch, with no tool invocation sent. */
export class SlotUnavailableError extends Error {}

/**
 * Resolves any broker slot through native discovery and native MCP sessions.
 * It owns neither a parallel provider catalogue nor the services themselves.
 * Mutations are never retried after a connection failure.
 */
export class BrokerSlots {
  private readonly sessions = new Map<string, ISlotConnection>();
  private closed = false;

  public constructor(private readonly options: IBrokerSlotsOptions) {}

  /** Read current provider metadata, retiring sessions whose provider changed. */
  public async providers(): Promise<ReadonlyArray<Readonly<IBrokerProviderInfo>>> {
    this.assertOpen();
    if (!this.options.broker.isConnected) throw new SlotUnavailableError("Broker discovery is disconnected");
    const resource = await this.options.broker.readResource(BROKER_DISCOVERY.providersResource);
    if (typeof resource.text !== "string") throw new Error("Broker discovery must return JSON text");
    const snapshot: unknown = JSON.parse(resource.text);
    const providers = snapshot && typeof snapshot === "object" && "providers" in snapshot
      ? (snapshot as { providers: unknown }).providers : undefined;
    if (!Array.isArray(providers)) throw new Error("Invalid native broker providers snapshot");
    const names = new Set<string>();
    for (const provider of providers) {
      if (!provider || typeof provider !== "object" || typeof provider.name !== "string"
        || typeof provider.connected !== "boolean" || names.has(provider.name)
        || (provider.connectedSince !== null && typeof provider.connectedSince !== "string")) {
        throw new Error("Invalid native broker provider metadata");
      }
      names.add(provider.name);
    }
    const current = providers as IBrokerProviderInfo[];
    for (const [name, session] of this.sessions) {
      const live = current.find(provider => provider.name === name && provider.connected);
      if (!live || live.connectedSince !== session.provider.connectedSince) this.retire(name, session);
    }
    return current.map(provider => Object.freeze({ ...provider }));
  }

  /** Discover the actual schemas this caller can see on a live provider. */
  public async tools(slot: string): Promise<McpTool[]> {
    return this.invoke(slot, client => client.listTools());
  }

  /** Preserve the native tool result, including refusals and all content blocks. */
  public async call(slot: string, tool: string, input: Record<string, unknown>): Promise<McpToolResult> {
    return this.invoke(slot, client => client.callTool(tool, input));
  }

  /** Release only sessions created here; the caller owns the discovery client. */
  public close(): void {
    this.closed = true;
    for (const [name, session] of this.sessions) this.retire(name, session);
  }

  private assertOpen(): void {
    if (this.closed) throw new Error("Broker slot directory is closed");
  }

  private retire(name: string, session: ISlotConnection): void {
    if (this.sessions.get(name) === session) this.sessions.delete(name);
    void session.opening.then(client => client.disconnect(), () => undefined);
  }

  private async invoke<T>(slot: string, operation: (client: McpClient) => Promise<T>): Promise<T> {
    const providers = await this.providers();
    this.assertOpen();
    const provider = providers.find(item => item.name === slot && item.connected);
    if (!provider || !provider.connectedSince || slot.startsWith("_")) throw new SlotUnavailableError(`Slot unavailable: ${slot}`);
    let session = this.sessions.get(slot);
    if (!session) {
      const opening = Promise.resolve().then(async () => {
        const client = await this.options.connect(provider);
        if (client === this.options.broker) throw new Error("A provider requires its own MCP session");
        try {
          if (!client.isConnected) await client.connect();
          return client;
        } catch (error) {
          client.disconnect();
          throw error;
        }
      });
      session = { provider, opening };
      this.sessions.set(slot, session);
    }
    const current = session;
    try {
      const client = await current.opening;
      this.assertOpen();
      if (this.sessions.get(slot) !== current) throw new SlotUnavailableError(`Provider changed before dispatch: ${slot}`);
      return await operation(client);
    } catch (error) {
      this.retire(slot, current);
      throw error;
    }
  }
}
