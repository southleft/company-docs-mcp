import { build } from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

await build({
	entryPoints: ["cli/index.ts"],
	outfile: "dist/cli.js",
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node18",
	banner: { js: "#!/usr/bin/env node" },
	define: {
		__VERSION__: JSON.stringify(pkg.version),
	},
	external: [
		"@supabase/supabase-js",
		"openai",
		"dotenv",
		"dotenv/config",
		"zod",
	],
});

console.log(`Built dist/cli.js (v${pkg.version})`);
