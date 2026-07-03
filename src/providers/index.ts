/**
 * Provider plugin system — public surface.
 *
 * Import backends and the service container from here:
 *
 *   import { resolveContainer, type ServiceContainer } from "./providers";
 *
 * See ./README.md for the full contract and how to add a provider.
 */

import { registerDefaultProviders } from "./register";

// Importing the barrel registers the built-in providers (idempotent), so
// `resolveContainer(env)` works out of the box in every host.
registerDefaultProviders();

export * from "./types";
export * from "./embedding";
export * from "./vector-store";
export * from "./chat";
export * from "./cache";
export * from "./registry";
export * from "./container";
export { registerDefaultProviders } from "./register";
