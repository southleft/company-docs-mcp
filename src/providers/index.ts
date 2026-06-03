/**
 * Provider plugin system — public surface.
 *
 * Import backends and the service container from here:
 *
 *   import { resolveContainer, type ServiceContainer } from "./providers";
 *
 * See ./README.md for the full contract and how to add a provider.
 */

export * from "./types";
export * from "./embedding";
export * from "./vector-store";
export * from "./chat";
export * from "./cache";
export * from "./registry";
export * from "./container";
