#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { registrationSyncErrors } from "./sync-registrations.mjs";

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
const notice = readFileSync(join(root, "NOTICE.md"), "utf8");
const rootPackage = json("package.json");
const corePackage = json("packages/core/package.json");
const mcpPackage = json("packages/mcp/package.json");
const publisher = json("publisher/publisher.json");
const registry = json("mcp-registry/operations-pulse/server.json");
const codexMarketplace = json(".agents/plugins/marketplace.json");
const claudeMarketplace = json(".claude-plugin/marketplace.json");
const codexPlugin = json("plugins/openai/operations-pulse/.codex-plugin/plugin.json");
const claudePlugin = json("plugins/claude/operations-pulse/.claude-plugin/plugin.json");

const expectedPublisher = {
  name: "Openly Useful",
  email: "hello@openlyuseful.org",
  url: "https://openlyuseful.org",
};
const expectedPolicies = {
  privacy: "https://openlyuseful.org/legal/privacy",
  terms: "https://openlyuseful.org/legal/terms",
  security: "https://openlyuseful.org/security",
  support: "https://openlyuseful.org/support",
};
const expectedRepository = "https://github.com/Openly-Useful/operations-pulse";
const expectedMcpName = "org.openlyuseful/operations-pulse";
const expectedMcpPackage = "@openly-useful/operations-pulse-mcp";

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateAuthor(value, label) {
  if (!value
    || value.name !== expectedPublisher.name
    || value.email !== expectedPublisher.email
    || value.url !== expectedPublisher.url
    || !same(Object.keys(value).sort(), Object.keys(expectedPublisher).sort())) {
    fail(`${label} must derive from the Openly Useful publisher record.`);
  }
}

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
for (const id of ["imap-email", "github", "linear", "sentry", "posthog"]) {
  const connection = connections.connections.find((item) => item.id === id);
  if (connection?.status !== "available" || !Array.isArray(connection?.modes) || !connection.disconnect) {
    fail(`Connection ${id} must document an available adapter, modes, and disconnect path.`);
  }
}
if (corePackage.dependencies?.imapflow !== "1.7.2") {
  fail("Core package must pin the supported IMAP adapter version exactly.");
}
if (!notice.includes("imapflow` 1.7.2") || !notice.includes("Andris Reinman")) {
  fail("NOTICE must retain provenance for the optional IMAP adapter.");
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

if (publisher.schemaVersion !== 1 || publisher.id !== "openly-useful" || publisher.displayName !== expectedPublisher.name) {
  fail("Publisher mirror identity is invalid.");
}
if (publisher.authorityManifest !== "https://openlyuseful.org/publisher/manifest.json"
  || publisher.mirrorRole !== "repository-consumer") {
  fail("Publisher record must remain a consumer mirror of the public authority endpoint.");
}
if (publisher.legal?.plannedName !== "Openly Useful LLC"
  || publisher.legal?.status !== "formation-pending"
  || publisher.legal?.activeName !== null) {
  fail("Planned legal entity must remain explicitly formation-pending with no active legal name.");
}
if (!same(publisher.legal?.currentOperator, {
  type: "founder-individual",
  displayName: "Founder of Openly Useful",
  operatingAs: "Openly Useful",
})) {
  fail("Current operator must be the founder-individual operating as Openly Useful.");
}
if (publisher.domains?.studio !== "https://openlyuseful.com"
  || publisher.domains?.openSource !== expectedPublisher.url
  || publisher.domains?.publicAuthority !== "openlyuseful.org") {
  fail("Publisher domain roles are invalid.");
}
if (publisher.organization?.github !== "https://github.com/Openly-Useful"
  || publisher.namespaces?.npm !== "@openly-useful"
  || publisher.namespaces?.openSourceMcp !== "org.openlyuseful"
  || publisher.namespaces?.reservedStudioMcp !== "com.openlyuseful") {
  fail("Publisher organization or namespace metadata is invalid.");
}
if (publisher.contacts?.public !== expectedPublisher.email || !same(publisher.policies, expectedPolicies)) {
  fail("Publisher contact or canonical policy URLs are invalid.");
}
if (!same(publisher.policyMirrors, {
  privacy: "https://github.com/Openly-Useful/openlyuseful.org/blob/main/legal/privacy.html",
  terms: "https://github.com/Openly-Useful/openlyuseful.org/blob/main/legal/terms.html",
  security: "https://github.com/Openly-Useful/openlyuseful.org/blob/main/security.html",
  support: "https://github.com/Openly-Useful/openlyuseful.org/blob/main/support.html",
}) || publisher.authorityManifestMirror
  !== "https://github.com/Openly-Useful/openlyuseful.org/blob/main/publisher/manifest.json") {
  fail("Publisher policy or authority source mirrors are invalid.");
}
const expectedGenericRequirements = [
  "namespace-verification",
  "provider-account-authentication",
  "provider-review",
];
if (publisher.publication?.localGenerationAllowed !== true
  || publisher.publication?.localTestingAllowed !== true
  || publisher.publication?.externalPublicationAllowed !== true
  || publisher.publication?.authorization !== "granted"
  || publisher.publication?.authorizationBasis !== "founder-owner-direct"
  || publisher.publication?.effectiveWhileFormationPending !== true
  || !same(publisher.publication?.blockingRequirements, expectedGenericRequirements)) {
  fail("Founder-authorized publisher publication controls are not canonical.");
}
if (!publisher.artifactPolicy?.authorityEndpoint?.includes("published authority endpoint")
  || !publisher.artifactPolicy?.derivation?.includes("must derive")
  || !publisher.artifactPolicy?.activation?.includes("founder-operated")
  || !publisher.artifactPolicy?.activation?.includes("must not be represented as formed")) {
  fail("Publisher artifact policy is incomplete.");
}
if (publisher.lastUpdated !== "2026-08-23") {
  fail("Publisher mirror projection date is not current.");
}

if (rootPackage.version !== corePackage.version || rootPackage.version !== mcpPackage.version) {
  fail("Root, core, and MCP package versions must agree.");
}
if (mcpPackage.name !== expectedMcpPackage || mcpPackage.mcpName !== expectedMcpName) {
  fail("MCP npm package name or official MCP Registry identity is invalid.");
}
if (registry.name !== mcpPackage.mcpName
  || registry.version !== mcpPackage.version
  || registry.packages?.[0]?.identifier !== mcpPackage.name
  || registry.packages?.[0]?.version !== mcpPackage.version
  || registry.packages?.[0]?.registryType !== "npm"
  || registry.packages?.[0]?.transport?.type !== "stdio") {
  fail("MCP Registry server.json and npm package identity/version must agree.");
}
if (registry.$schema !== "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json"
  || registry.repository?.url !== expectedRepository
  || registry.repository?.source !== "github") {
  fail("MCP Registry schema or planned repository metadata is invalid.");
}
for (const [label, packageManifest] of [["core", corePackage], ["MCP", mcpPackage]]) {
  const expectedPrepublish = `node ../../scripts/assert-publish-ready.mjs --package ${label === "core" ? "core" : "mcp"}`;
  const expectedBin = label === "core"
    ? { "operations-pulse": "dist/cli.js" }
    : { "operations-pulse-mcp": "dist/index.js" };
  if (packageManifest.private !== false
    || packageManifest.scripts?.prepublishOnly !== expectedPrepublish
    || !same(packageManifest.bin, expectedBin)
    || packageManifest.publishConfig?.access !== "public"
    || packageManifest.homepage !== expectedPublisher.url
    || packageManifest.bugs !== expectedPolicies.support) {
    fail(`${label} package publication boundary or publisher URLs are invalid.`);
  }
  if (readFileSync(join(root, `packages/${label === "core" ? "core" : "mcp"}/LICENSE`), "utf8")
    !== readFileSync(join(root, "LICENSE"), "utf8")) {
    fail(`${label} package license copy differs from the repository license.`);
  }
}
if (!readFileSync(join(root, "packages/mcp/README.md"), "utf8").includes(`mcp-name: ${expectedMcpName}`)) {
  fail("MCP package README is missing the official registry name marker.");
}

if (codexMarketplace.name !== "operations-pulse"
  || codexMarketplace.interface?.displayName !== expectedPublisher.name
  || codexMarketplace.plugins?.length !== 1
  || codexMarketplace.plugins[0]?.name !== "operations-pulse"
  || codexMarketplace.plugins[0]?.source?.source !== "local"
  || codexMarketplace.plugins[0]?.source?.path !== "./plugins/openai/operations-pulse") {
  fail("Codex marketplace metadata is invalid.");
}
if (!same(codexMarketplace.plugins?.[0]?.policy, { authentication: "ON_INSTALL", installation: "AVAILABLE" })) {
  fail("Codex marketplace policy is invalid.");
}
if (claudeMarketplace.$schema !== "https://json.schemastore.org/claude-code-marketplace.json"
  || claudeMarketplace.name !== "operations-pulse"
  || claudeMarketplace.version !== rootPackage.version
  || claudeMarketplace.plugins?.length !== 1
  || claudeMarketplace.plugins[0]?.source !== "./plugins/claude/operations-pulse"
  || claudeMarketplace.plugins[0]?.strict !== true) {
  fail("Claude marketplace metadata is invalid.");
}
validateAuthor(claudeMarketplace.owner, "Claude marketplace owner");
validateAuthor(claudeMarketplace.plugins?.[0]?.author, "Claude marketplace plugin author");

for (const [label, manifest] of [["Codex", codexPlugin], ["Claude", claudePlugin]]) {
  if (manifest.name !== "operations-pulse"
    || manifest.version !== rootPackage.version
    || manifest.license !== "MIT"
    || manifest.homepage !== expectedPublisher.url
    || manifest.repository !== expectedRepository
    || manifest.skills !== "./skills/"
    || "mcpServers" in manifest) {
    fail(`${label} plugin manifest identity or skill-only boundary is invalid.`);
  }
  validateAuthor(manifest.author, `${label} plugin author`);
}
if (codexPlugin.interface?.developerName !== expectedPublisher.name
  || codexPlugin.interface?.privacyPolicyURL !== expectedPolicies.privacy
  || codexPlugin.interface?.termsOfServiceURL !== expectedPolicies.terms
  || codexPlugin.interface?.supportURL !== expectedPolicies.support
  || codexPlugin.interface?.websiteURL !== expectedPublisher.url) {
  fail("Codex public interface URLs must derive from the publisher record.");
}
if (claudePlugin.$schema !== "https://json.schemastore.org/claude-code-plugin-manifest.json") {
  fail("Claude plugin manifest schema is invalid.");
}

for (const error of registrationSyncErrors()) fail(error);

for (const required of [
  "LICENSE",
  "NOTICE.md",
  "SECURITY.md",
  "apps/site/index.html",
  "apps/site/assets/openly-useful-lockup.svg",
  "skill/operations-pulse/agents/openai.yaml",
  "publisher/publisher.json",
  ".agents/plugins/marketplace.json",
  ".claude-plugin/marketplace.json",
  "mcp-registry/operations-pulse/server.json",
  "packages/mcp/README.md",
  "packages/mcp/LICENSE",
  "packages/core/README.md",
  "packages/core/LICENSE",
  "packages/core/src/connections.ts",
  "packages/core/src/scheduler.ts",
  "apps/site/connections.js",
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
