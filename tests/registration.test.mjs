import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { publicationErrors } from "../scripts/assert-publish-ready.mjs";
import { registrationSyncErrors } from "../scripts/sync-registrations.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

function json(path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

test("publisher mirror keeps the one-entity activation boundary formation-pending", () => {
  const publisher = json("publisher/publisher.json");
  assert.equal(publisher.displayName, "Openly Useful");
  assert.equal(publisher.authorityManifest, "https://openlyuseful.org/publisher/manifest.json");
  assert.equal(publisher.mirrorRole, "repository-consumer");
  assert.equal(publisher.legal.plannedName, "Openly Useful LLC");
  assert.equal(publisher.legal.activeName, null);
  assert.equal(publisher.legal.status, "formation-pending");
  assert.equal(publisher.publication.externalPublicationAllowed, false);
  assert.equal(publisher.publication.authorization, "withheld");
  assert.deepEqual(publisher.publication.blockingRequirements, [
    "formation-active",
    "publisher-authorization",
    "namespace-verification",
    "public-policy-url-verification",
  ]);
});

test("Codex and Claude catalogs point to self-contained generated skill wrappers", () => {
  const codex = json(".agents/plugins/marketplace.json");
  const claude = json(".claude-plugin/marketplace.json");
  const version = json("package.json").version;

  assert.deepEqual(codex.plugins[0].source, {
    path: "./plugins/openai/operations-pulse",
    source: "local",
  });
  assert.deepEqual(codex.plugins[0].policy, {
    authentication: "ON_INSTALL",
    installation: "AVAILABLE",
  });
  assert.equal(claude.$schema, "https://json.schemastore.org/claude-code-marketplace.json");
  assert.equal(claude.plugins[0].source, "./plugins/claude/operations-pulse");
  assert.equal(claude.plugins[0].strict, true);
  assert.equal(claude.plugins[0].version, version);
  assert.deepEqual(registrationSyncErrors(), []);
});

test("provider wrapper manifests derive publisher identity and policy URLs", () => {
  const publisher = json("publisher/publisher.json");
  const version = json("package.json").version;
  const openai = json("plugins/openai/operations-pulse/.codex-plugin/plugin.json");
  const claude = json("plugins/claude/operations-pulse/.claude-plugin/plugin.json");
  const author = {
    email: publisher.contacts.public,
    name: publisher.displayName,
    url: publisher.domains.openSource,
  };

  for (const manifest of [openai, claude]) {
    assert.equal(manifest.name, "operations-pulse");
    assert.equal(manifest.version, version);
    assert.equal(manifest.skills, "./skills/");
    assert.deepEqual(manifest.author, author);
    assert.equal("mcpServers" in manifest, false);
  }
  assert.equal(openai.interface.privacyPolicyURL, publisher.policies.privacy);
  assert.equal(openai.interface.termsOfServiceURL, publisher.policies.terms);
  assert.equal(openai.interface.supportURL, publisher.policies.support);
});

test("official MCP Registry and npm identities agree", () => {
  const publisher = json("publisher/publisher.json");
  const packageManifest = json("packages/mcp/package.json");
  const registry = json("mcp-registry/operations-pulse/server.json");
  const expectedName = `${publisher.namespaces.openSourceMcp}/operations-pulse`;
  const expectedPackage = `${publisher.namespaces.npm}/operations-pulse-mcp`;

  assert.equal(packageManifest.mcpName, expectedName);
  assert.equal(packageManifest.name, expectedPackage);
  assert.equal(registry.name, packageManifest.mcpName);
  assert.equal(registry.version, packageManifest.version);
  assert.equal(registry.packages[0].identifier, packageManifest.name);
  assert.equal(registry.packages[0].version, packageManifest.version);
  assert.equal(registry.packages[0].transport.type, "stdio");
});

test("external package publication fails closed until activation and blocker clearance", () => {
  const pending = json("publisher/publisher.json");
  assert.notDeepEqual(publicationErrors(pending), []);

  for (const packagePath of ["packages/core/package.json", "packages/mcp/package.json"]) {
    assert.equal(
      json(packagePath).scripts.prepublishOnly,
      "node ../../scripts/assert-publish-ready.mjs",
    );
  }

  const blocked = spawnSync(process.execPath, [join(root, "scripts/assert-publish-ready.mjs")], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /PUBLICATION BLOCKED/);
  assert.match(blocked.stderr, /formation-pending/);

  const active = structuredClone(pending);
  active.legal.status = "active";
  active.legal.activeName = active.legal.plannedName;
  active.publication.externalPublicationAllowed = true;
  active.publication.authorization = "authorized";
  active.publication.blockingRequirements = [];
  assert.deepEqual(publicationErrors(active), []);

  active.publication.blockingRequirements = ["namespace-verification"];
  assert.match(publicationErrors(active).join("\n"), /publisher blockers remain/);
});

test("registration check is read-only and clean", () => {
  const checked = spawnSync(process.execPath, [join(root, "scripts/sync-registrations.mjs"), "check"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  assert.match(checked.stdout, /match their canonical sources/);
});
