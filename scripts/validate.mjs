#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const failures = [];

function fail(message) {
  failures.push(message);
}

function json(path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

const tools = json("catalog/tools.json");
const connections = json("catalog/connections.json");
const inventory = json("migrations/source-inventory.json");
const mcpSource = readFileSync(join(root, "packages/mcp/src/index.ts"), "utf8");
const skill = readFileSync(join(root, "skill/operations-pulse/SKILL.md"), "utf8");
const vendorLicense = readFileSync(join(root, "vendor/handoff-skills/LICENSE"), "utf8");

const catalogIds = tools.tools.map((tool) => tool.id).sort();
const registeredIds = [...mcpSource.matchAll(/server\.registerTool\(\s*"([^"]+)"/g)]
  .map((match) => match[1])
  .sort();

if (JSON.stringify(catalogIds) !== JSON.stringify(registeredIds)) {
  fail(`MCP tool IDs do not match catalog: ${registeredIds.join(", ")} vs ${catalogIds.join(", ")}`);
}

for (const tool of tools.tools) {
  for (const key of ["id", "summary", "whenToUse", "cost", "dataBoundary", "writes", "approval", "example"]) {
    if (!(key in tool)) fail(`Tool ${tool.id ?? "<unknown>"} is missing ${key}.`);
  }
}

if (!connections.connections.some((item) => item.default && item.class === "free-open-source")) {
  fail("Connection catalog has no free open-source default.");
}

if (!connections.connections.every((item) => "status" in item && "auth" in item && "permissions" in item)) {
  fail("Every connection must declare status, auth, and permissions.");
}

if (inventory.sources.length !== 24) {
  fail(`Expected 24 audited source repositories, found ${inventory.sources.length}.`);
}

if (inventory.sources.some((item) => item.visibility === "private")) {
  fail("Public inventory must not expose raw private source identifiers.");
}

if (!vendorLicense.includes("Copyright (c) 2026 Philip Borenstein")) {
  fail("Vendored handoff-skills copyright notice is missing.");
}

if (mcpSource.includes("console.log")) {
  fail("MCP stdio source must not write logs to stdout.");
}

if (skill.includes("TODO") || !skill.startsWith("---\nname: operations-pulse\n")) {
  fail("Canonical Operations Pulse skill is incomplete.");
}

for (const required of [
  "LICENSE",
  "NOTICE.md",
  "SECURITY.md",
  "apps/site/index.html",
  "apps/site/assets/openly-useful-lockup.svg",
  "skill/operations-pulse/agents/openai.yaml",
]) {
  if (!existsSync(join(root, required))) fail(`Missing required file: ${required}`);
}

const textExtensions = new Set([".md", ".json", ".ts", ".mjs", ".html", ".css", ".yaml", ".yml"]);
const privatePatterns = [
  /\/Users\/[^/]+\/(?:\.codex|\.claude|Documents)\//,
  /(?:linear|project)[_-]?id["':=\s]+[0-9a-f]{8}-[0-9a-f-]{27,}/i,
  /g-p-[a-z0-9]+/,
];

function walk(directory) {
  for (const name of readdirSync(directory)) {
    if (name === "node_modules" || name === "dist" || name === "vendor") continue;
    const path = join(directory, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      walk(path);
      continue;
    }
    const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
    if (!textExtensions.has(extension)) continue;
    if (path === join(root, "scripts/validate.mjs")) continue;
    const content = readFileSync(path, "utf8");
    for (const pattern of privatePatterns) {
      if (pattern.test(content)) fail(`Private identifier pattern found in ${path.slice(root.length + 1)}.`);
    }
  }
}

walk(root);

if (failures.length) {
  process.stderr.write(failures.map((item) => `- ${item}`).join("\n") + "\n");
  process.exit(1);
}

process.stdout.write(
  `Validated ${tools.tools.length} MCP tools, ${connections.connections.length} connections, and ${inventory.sources.length} source dispositions.\n`,
);
