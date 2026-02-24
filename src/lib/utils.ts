/**
 * Shared utility functions for the Company Docs MCP server
 */

/**
 * Race a promise against a timeout
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
}

/**
 * Detect if an error is a Cloudflare Workers resource limit error
 */
export function isResourceLimitError(error: any): boolean {
  const errorMessage = error?.message?.toLowerCase() || '';

  const resourceLimitPatterns = [
    'resource limit',
    'cpu time limit',
    'memory limit',
    'worker exceeded',
    'script execution time',
    'memory usage',
    'out of memory',
    'maximum execution time',
    'exceeded cpu',
    'timeout during request',
  ];

  return resourceLimitPatterns.some(pattern =>
    errorMessage.includes(pattern)
  );
}

/**
 * Create a helpful resource limit error message
 */
export function createResourceLimitErrorMessage(): string {
  return `Resource limit exceeded. The MCP server has hit Cloudflare Workers resource limits. Try breaking complex questions into smaller parts, or wait a moment and retry your request.`;
}
