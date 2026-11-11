/** Types publics natifs du broker, aucune copie du catalogue dans le harness. */
export type { IBrokerProviderInfo, IBrokerContext } from "@cyanmycelium/mcp-broker";

/** Opérations existantes sur la session MCP du slot réservé _broker. */
export const BROKER_DISCOVERY = {
  slot: "_broker",
  listTool: "providers_list",
  statusTool: "provider_status",
  providersResource: "broker://providers",
  providerResourceTemplate: "broker://providers/{name}",
} as const;
