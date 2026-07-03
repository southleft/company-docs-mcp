/**
 * Supabase/pgvector VectorStore implementation (Wave 2).
 *
 * Absorbs the Supabase access that previously lived inline in
 * lib/search-handler.ts: the search_content RPC, the category/tags table
 * queries, and the row → ContentEntry mapping. Backend-specific concerns
 * (RPC name, row shape, similarity quality filter) stay inside this adapter.
 */

import type { ContentEntry, Category } from "../types";
import type { VectorStore, VectorSearchParams } from "../vector-store";
import { ProviderError } from "../types";
import type { ProviderConfig } from "../types";

/** Postgres vector column dimension the shipped schema is provisioned for. */
const SCHEMA_DIMENSIONS = 1024;

function rowToEntry(row: any): ContentEntry {
	return {
		id: row.id,
		title: row.title,
		content: row.content || "",
		source: {
			type: row.source_type || "database",
			location: row.source_location || "supabase",
			ingested_at: row.ingested_at || new Date().toISOString(),
		},
		chunks: [],
		metadata: {
			category: row.category || "general",
			tags: row.tags || [],
			confidence: row.confidence || "medium",
			system: row.system_name || row.metadata?.system_name || "",
			last_updated: row.updated_at || new Date().toISOString(),
			source_url: row.source_location || "",
		},
	};
}

export function createSupabaseVectorStore(config: ProviderConfig): VectorStore {
	const supabaseUrl = config.SUPABASE_URL;
	// Prefer service key (bypasses RLS) — appropriate for server-side use
	const supabaseKey = config.SUPABASE_SERVICE_KEY || config.SUPABASE_ANON_KEY;

	if (!supabaseUrl || !supabaseKey) {
		throw new ProviderError(
			"SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) are required for the supabase vector store",
			"supabase",
		);
	}

	// The supabase client is lightweight to construct, but memoize anyway so a
	// long-lived container reuses one instance.
	let clientPromise: Promise<any> | null = null;
	async function client() {
		if (!clientPromise) {
			clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
				createClient(supabaseUrl!, supabaseKey!),
			);
		}
		return clientPromise;
	}

	return {
		id: "supabase",
		dimensions: SCHEMA_DIMENSIONS,

		async search(params: VectorSearchParams): Promise<ContentEntry[]> {
			const { queryEmbedding, queryText, threshold = 0.15, limit = 10, category, tags } = params;
			const supabase = await client();

			const { data, error } = await supabase.rpc("search_content", {
				query_embedding: queryEmbedding,
				query_text: queryText,
				match_threshold: threshold,
				match_count: limit,
				filter_category: category,
				filter_tags: tags,
			});

			if (error) {
				throw new ProviderError(`search_content RPC failed: ${error.message}`, "supabase", error);
			}
			if (!data || data.length === 0) return [];

			// Quality filter (preserved from the pre-plugin search-handler): keep
			// rows above the similarity threshold; for rows without a similarity
			// score, require a literal text match so junk can't slip through.
			const lowerQuery = (queryText || "").toLowerCase();
			const qualityRows = data.filter((row: any) => {
				if (row.similarity !== undefined) return row.similarity >= threshold;
				return (
					row.title?.toLowerCase().includes(lowerQuery) ||
					row.content?.toLowerCase().includes(lowerQuery)
				);
			});

			return qualityRows.map(rowToEntry);
		},

		async getByCategory(category: Category): Promise<ContentEntry[]> {
			const supabase = await client();
			const { data, error } = await supabase
				.from("content_entries")
				.select(
					"id, title, content, source_type, source_location, category, tags, confidence, metadata, ingested_at, updated_at",
				)
				.eq("category", category)
				.order("title", { ascending: true });

			if (error) {
				throw new ProviderError(`category query failed: ${error.message}`, "supabase", error);
			}
			return (data || []).map(rowToEntry);
		},

		async getAllTags(): Promise<string[]> {
			const supabase = await client();
			const { data, error } = await supabase.from("content_entries").select("tags");

			if (error) {
				throw new ProviderError(`tags query failed: ${error.message}`, "supabase", error);
			}
			const tagSet = new Set<string>();
			for (const row of data || []) {
				if (Array.isArray(row.tags)) {
					for (const tag of row.tags) tagSet.add(tag);
				}
			}
			return Array.from(tagSet).sort();
		},

		async upsertEntry(entry: ContentEntry): Promise<void> {
			const supabase = await client();
			const { error } = await supabase.from("content_entries").upsert({
				id: entry.id,
				title: entry.title,
				content: entry.content,
				source_type: entry.source?.type,
				source_location: entry.source?.location,
				category: entry.metadata?.category,
				tags: entry.metadata?.tags || [],
				confidence: entry.metadata?.confidence || "medium",
				metadata: entry.metadata,
				ingested_at: entry.source?.ingested_at || new Date().toISOString(),
			});
			if (error) {
				throw new ProviderError(`upsert failed for ${entry.id}: ${error.message}`, "supabase", error);
			}
		},

		async healthCheck(): Promise<boolean> {
			try {
				const supabase = await client();
				const { error } = await supabase.from("content_entries").select("id").limit(1);
				return !error;
			} catch {
				return false;
			}
		},
	};
}
