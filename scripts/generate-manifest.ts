#!/usr/bin/env tsx
/**
 * Generate content/manifest.json from files in content/entries/
 *
 * This manifest is read at runtime by the Cloudflare Worker to discover
 * which JSON entry files to import. Run this after any ingestion step
 * and before deploying the worker.
 *
 * Usage:
 *   npm run manifest
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

const CONTENT_DIR = path.join(process.cwd(), "content");
const ENTRIES_DIR = path.join(CONTENT_DIR, "entries");
const MANIFEST_PATH = path.join(CONTENT_DIR, "manifest.json");

async function main() {
	try {
		await fs.stat(ENTRIES_DIR);
	} catch {
		console.error(`No content/entries/ directory found at ${ENTRIES_DIR}`);
		console.error("Run an ingestion command first (e.g., npm run ingest:markdown)");
		process.exit(1);
	}

	const allFiles = await fs.readdir(ENTRIES_DIR);
	const jsonFiles = allFiles
		.filter((f) => f.endsWith(".json") && !f.startsWith("."))
		.sort();

	const manifest = {
		files: jsonFiles,
		total_files: jsonFiles.length,
		generated_at: new Date().toISOString(),
	};

	await fs.mkdir(CONTENT_DIR, { recursive: true });
	await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");

	console.log(`Manifest generated: ${jsonFiles.length} entries → content/manifest.json`);
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
