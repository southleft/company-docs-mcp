/**
 * ID generation utilities
 */

import * as crypto from 'node:crypto';

/**
 * Generates a unique ID for content entries
 */
export function generateId(): string {
  return crypto.randomBytes(12).toString('base64url');
}

/**
 * Generates a deterministic ID based on content
 */
export function generateContentId(content: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(content);
  return hash.digest('base64url').substring(0, 16);
}

/**
 * Generates a timestamp-based ID
 */
export function generateTimestampId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('base64url');
  return `${timestamp}_${random}`;
}

/**
 * Generates a prefixed ID
 */
export function generatePrefixedId(prefix: string): string {
  const id = generateId();
  return `${prefix}_${id}`;
}
