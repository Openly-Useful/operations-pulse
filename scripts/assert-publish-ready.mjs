#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const genericProviderRequirements = [
  "namespace-verification",
  "provider-account-authentication",
  "provider-review",
];
const expectedPolicies = {
  privacy: "https://openlyuseful.org/legal/privacy",
  terms: "https://openlyuseful.org/legal/terms",
  security: "https://openlyuseful.org/security",
  support: "https://openlyuseful.org/support",
};
const expectedPolicyMirrors = {
  privacy: "https://github.com/Openly-Useful/openlyuseful.org/blob/main/legal/privacy.html",
  terms: "https://github.com/Openly-Useful/openlyuseful.org/blob/main/legal/terms.html",
  security: "https://github.com/Openly-Useful/openlyuseful.org/blob/main/security.html",
  support: "https://github.com/Openly-Useful/openlyuseful.org/blob/main/support.html",
};

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function publicationErrors(publisher) {
  const errors = [];
  if (publisher?.schemaVersion !== 1
    || publisher?.id !== "openly-useful"
    || publisher?.displayName !== "Openly Useful") {
    errors.push("publisher identity is not canonical");
  }
  if (publisher?.authorityManifest !== "https://openlyuseful.org/publisher/manifest.json") {
    errors.push("publisher authority endpoint is not canonical");
  }
  if (publisher?.mirrorRole !== "repository-consumer") {
    errors.push("repository publisher record is not a consumer mirror");
  }
  if (publisher?.legal?.plannedName !== "Openly Useful LLC"
    || publisher?.legal?.status !== "formation-pending"
    || publisher?.legal?.activeName !== null
    || !same(publisher?.legal?.plannedRoles, ["publisher", "operator", "licensee"])) {
    errors.push("planned LLC must remain formation-pending with no active legal name");
  }
  if (!same(publisher?.legal?.currentOperator, {
    type: "founder-individual",
    displayName: "Founder of Openly Useful",
    operatingAs: "Openly Useful",
  })) {
    errors.push("current operator must be the founder-individual operating as Openly Useful");
  }
  if (!same(publisher?.domains, {
    studio: "https://openlyuseful.com",
    openSource: "https://openlyuseful.org",
    publicAuthority: "openlyuseful.org",
  }) || !same(publisher?.organization, { github: "https://github.com/Openly-Useful" })) {
    errors.push("publisher domains or source organization are not canonical");
  }
  if (!same(publisher?.namespaces, {
    npm: "@openly-useful",
    openSourceMcp: "org.openlyuseful",
    reservedStudioMcp: "com.openlyuseful",
  })) {
    errors.push("publisher namespaces are not canonical");
  }
  if (publisher?.contacts?.public !== "hello@openlyuseful.org"
    || publisher?.contacts?.routing
      !== "Use the email subject to route publishing, security, legal, and support requests."
    || !same(publisher?.policies, expectedPolicies)
    || !same(publisher?.policyMirrors, expectedPolicyMirrors)) {
    errors.push("publisher contact or policy sources are not canonical");
  }
  if (publisher?.authorityManifestMirror
    !== "https://github.com/Openly-Useful/openlyuseful.org/blob/main/publisher/manifest.json") {
    errors.push("publisher authority source mirror is not canonical");
  }
  if (publisher?.publication?.externalPublicationAllowed !== true) {
    errors.push("external publication is not allowed");
  }
  if (publisher?.publication?.localGenerationAllowed !== true
    || publisher?.publication?.localTestingAllowed !== true) {
    errors.push("local publisher generation or testing controls are not canonical");
  }
  if (publisher?.publication?.authorization !== "granted") {
    errors.push("founder publication authorization is not granted");
  }
  if (publisher?.publication?.authorizationBasis !== "founder-owner-direct") {
    errors.push("publication authorization basis is not founder-owner-direct");
  }
  if (publisher?.publication?.effectiveWhileFormationPending !== true) {
    errors.push("founder authorization is not effective while formation is pending");
  }
  if (!Array.isArray(publisher?.publication?.blockingRequirements)) {
    errors.push("publisher blocking requirements are missing");
  } else if (!same(publisher.publication.blockingRequirements, genericProviderRequirements)) {
    errors.push("generic provider requirements differ from the public authority");
  }
  if (!same(publisher?.artifactPolicy, {
    authorityEndpoint: "This manifest is the published authority endpoint for Openly Useful publisher and marketplace verification. It is projected from the governed editable publisher source.",
    derivation: "Provider-specific skills, MCP manifests, packages, and marketplace listings must derive publisher identity, domains, policy URLs, contacts, and namespaces from this published authority endpoint.",
    activation: "Openly Useful is founder-operated while Openly Useful LLC formation is pending. External source and registry publication is authorized by the founder-owner. The planned LLC must not be represented as formed, active, or the operator until formation is accepted; later LLC operation does not require a transfer of RunGlance ownership.",
  }) || publisher?.lastUpdated !== "2026-08-23") {
    errors.push("publisher artifact policy or projection date is not canonical");
  }
  return errors;
}

function packageErrors(packageId) {
  const errors = [];
  const expected = {
    core: {
      name: "@openly-useful/operations-pulse-core",
      directory: "packages/core",
    },
    mcp: {
      name: "@openly-useful/operations-pulse-mcp",
      directory: "packages/mcp",
    },
  }[packageId];
  if (!expected) return [`unsupported package target: ${packageId ?? "missing"}`];
  const manifest = JSON.parse(readFileSync(join(root, expected.directory, "package.json"), "utf8"));
  if (manifest.name !== expected.name
    || manifest.version !== "0.1.0"
    || manifest.private !== false
    || manifest.bin?.[packageId === "core" ? "operations-pulse" : "operations-pulse-mcp"]
      !== (packageId === "core" ? "dist/cli.js" : "dist/index.js")
    || manifest.repository?.url !== "git+https://github.com/Openly-Useful/operations-pulse.git"
    || manifest.repository?.directory !== expected.directory
    || manifest.homepage !== "https://openlyuseful.org"
    || manifest.bugs !== "https://openlyuseful.org/support"
    || manifest.publishConfig?.access !== "public") {
    errors.push(`${packageId} npm identity or repository provenance is not canonical`);
  }
  if (packageId === "mcp") {
    const registry = JSON.parse(readFileSync(join(root, "mcp-registry/operations-pulse/server.json"), "utf8"));
    if (manifest.mcpName !== "org.openlyuseful/operations-pulse"
      || registry.name !== manifest.mcpName
      || registry.version !== manifest.version
      || registry.repository?.url !== "https://github.com/Openly-Useful/operations-pulse"
      || registry.packages?.[0]?.identifier !== manifest.name
      || registry.packages?.[0]?.version !== manifest.version) {
      errors.push("MCP package and registry identity, version, or source do not agree");
    }
  }
  return errors;
}

export function assertPublishReady(packageId) {
  const publisher = JSON.parse(readFileSync(resolve(root, "publisher/publisher.json"), "utf8"));
  const errors = [...publicationErrors(publisher), ...packageErrors(packageId)];
  if (errors.length === 0) return publisher;
  throw new Error([
    "PUBLICATION BLOCKED: Openly Useful npm artifact readiness is incomplete.",
    ...errors.map((error) => `- ${error}`),
    "Local build, test, package generation, and registration validation remain allowed.",
  ].join("\n"));
}

export function main(argv = process.argv.slice(2)) {
  if (argv.length !== 2 || argv[0] !== "--package" || !["core", "mcp"].includes(argv[1])) {
    throw new Error("Usage: assert-publish-ready.mjs --package <core|mcp>");
  }
  assertPublishReady(argv[1]);
  process.stdout.write("PUBLICATION READY\n");
  return 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
