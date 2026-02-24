declare const __VERSION__: string;

const version = typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev";

const HELP = `
company-docs v${version}

Usage:
  company-docs <command> [options]

Commands:
  ingest markdown   Ingest markdown files into content/entries/
  ingest supabase   Push content/entries/ to Supabase with embeddings
  publish           Alias for "ingest supabase"
  manifest          Generate content/manifest.json for Workers deployment

Options:
  --help, -h        Show help for a command
  --version, -V     Show version

Examples:
  npx company-docs ingest markdown --dir=./docs --category=components
  npx company-docs ingest supabase
  npx company-docs publish
  npx company-docs manifest
`;

async function run() {
	const [cmd, sub, ...rest] = process.argv.slice(2);

	if (!cmd || cmd === "--help" || cmd === "-h") {
		console.log(HELP);
		process.exit(0);
	}

	if (cmd === "--version" || cmd === "-V") {
		console.log(version);
		process.exit(0);
	}

	if (cmd === "ingest" && sub === "markdown") {
		// Strip "ingest markdown" from argv so the script sees only its own flags
		process.argv = [process.argv[0], process.argv[1], ...rest];
		const { main } = await import("../scripts/ingest/ingest-markdown.js");
		return main();
	}

	if (cmd === "ingest" && sub === "supabase") {
		process.argv = [process.argv[0], process.argv[1], ...rest];
		const { main } = await import("../scripts/ingest/ingest-supabase.js");
		return main();
	}

	if (cmd === "publish") {
		// "publish" is an alias — everything after "publish" goes to ingest-supabase
		process.argv = [process.argv[0], process.argv[1], sub, ...rest].filter(Boolean);
		const { main } = await import("../scripts/ingest/ingest-supabase.js");
		return main();
	}

	if (cmd === "manifest") {
		process.argv = [process.argv[0], process.argv[1], sub, ...rest].filter(Boolean);
		const { main } = await import("../scripts/generate-manifest.js");
		return main();
	}

	console.error(`Unknown command: ${cmd}`);
	console.log(HELP);
	process.exit(1);
}

run().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
