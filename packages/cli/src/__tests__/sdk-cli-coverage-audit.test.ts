import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Tracks which SDK functions the CLI uses vs what's available.
 * Snapshot diffs surface new endpoints, removed endpoints,
 * and changes in CLI coverage as openapi.json evolves.
 */

const SDK_PATH = resolve(__dirname, "../generated/sdk.gen.ts");
const COMMANDS_DIR = resolve(__dirname, "../commands");
const SHARED_DIR = resolve(__dirname, "../shared");

function getExportedSdkFunctions(): string[] {
	const content = readFileSync(SDK_PATH, "utf-8");
	const exportRegex = /^export const (\w+)\s*=/gm;
	const functions: string[] = [];
	let match: RegExpExecArray | null = null;

	match = exportRegex.exec(content);
	while (match !== null) {
		const name = match[1];
		// Skip the client export — it's infrastructure, not an endpoint function
		if (name !== "client") {
			functions.push(name);
		}
		match = exportRegex.exec(content);
	}

	return functions.sort();
}

function getAllTsFiles(dir: string): string[] {
	const files: string[] = [];
	const entries = readdirSync(dir);

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);
		if (stat.isDirectory()) {
			files.push(...getAllTsFiles(fullPath));
		} else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts") && !entry.endsWith(".spec.ts")) {
			files.push(fullPath);
		}
	}

	return files;
}

function getImportedSdkFunctions(): { functions: Set<string>; byFile: Record<string, string[]> } {
	const functions = new Set<string>();
	const byFile: Record<string, string[]> = {};
	const srcRoot = resolve(__dirname, "..");

	const dirs = [COMMANDS_DIR, SHARED_DIR];

	for (const dir of dirs) {
		const files = getAllTsFiles(dir);
		for (const file of files) {
			const content = readFileSync(file, "utf-8");

			const importRegex = /import\s*\{([^}]+)\}\s*from\s*["'][^"']*generated\/sdk\.gen["']/g;
			let importMatch = importRegex.exec(content);

			while (importMatch !== null) {
				const importBlock = importMatch[1];
				const identifiers = importBlock.split(",").map((s) => s.trim()).filter(Boolean);

				for (const identifier of identifiers) {
					// "originalName as alias" → extract originalName
					const originalName = identifier.split(/\s+as\s+/)[0].trim();
					if (originalName) {
						functions.add(originalName);
						const relPath = file.replace(`${srcRoot}/`, "");
						if (!byFile[relPath]) byFile[relPath] = [];
						byFile[relPath].push(originalName);
					}
				}

				importMatch = importRegex.exec(content);
			}
		}
	}

	return { functions, byFile };
}

describe("SDK ↔ CLI Coverage Audit", () => {
	const allSdkFunctions = getExportedSdkFunctions();
	const { functions: importedFunctions, byFile: importsByFile } = getImportedSdkFunctions();

	const unusedFunctions = allSdkFunctions.filter((fn) => !importedFunctions.has(fn));
	// "client" is an infrastructure export, not an endpoint function
	const endpointImports = [...importedFunctions].filter((fn) => fn !== "client");
	const importedButMissing = endpointImports.filter((fn) => !allSdkFunctions.includes(fn));

	it("should match the snapshot of all SDK endpoint functions", () => {
		expect(allSdkFunctions).toMatchSnapshot();
	});

	it("should match the snapshot of CLI-imported SDK functions", () => {
		expect([...importedFunctions].sort()).toMatchSnapshot();
	});

	it("should match the snapshot of unused SDK functions (available but not used by CLI)", () => {
		expect(unusedFunctions).toMatchSnapshot();
	});

	it("should match the snapshot of SDK imports by file", () => {
		const sortedImports = Object.fromEntries(
			Object.entries(importsByFile)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([file, fns]) => [file, fns.sort()]),
		);
		expect(sortedImports).toMatchSnapshot();
	});

	it("should not have any CLI imports referencing non-existent SDK functions", () => {
		expect(importedButMissing).toEqual([]);
	});

	it("should track coverage metrics", () => {
		const metrics = {
			totalSdkFunctions: allSdkFunctions.length,
			importedByCliCount: importedFunctions.size,
			unusedCount: unusedFunctions.length,
			coveragePercent: Math.round((importedFunctions.size / allSdkFunctions.length) * 100),
		};
		expect(metrics).toMatchSnapshot();
	});
});
