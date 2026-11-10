/**
 * The unit projection layer.
 *
 * Importing this barrel is what registers the implemented projections, QUDT
 * being the only one today. The unimplemented targets export their type and
 * their documentation and register nothing, so `unitProjectionIds()` lists
 * what works rather than what is planned.
 *
 * See `docs/architecture/unit-projection.md`.
 */
export * from "./projection.interfaces";
export * from "./projection.registry";
export * from "./projection.qudt";
export * from "./projection.opcua";
export * from "./projection.sparkplug";
export * from "./projection.om";
