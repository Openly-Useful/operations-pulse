#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

export function publicationErrors(publisher) {
  const errors = [];
  if (publisher?.authorityManifest !== "https://openlyuseful.org/publisher/manifest.json") {
    errors.push("publisher authority endpoint is not canonical");
  }
  if (publisher?.mirrorRole !== "repository-consumer") {
    errors.push("repository publisher record is not a consumer mirror");
  }
  if (publisher?.legal?.status !== "active") {
    errors.push(`publisher legal status is ${publisher?.legal?.status ?? "missing"}`);
  }
  if (!publisher?.legal?.activeName || publisher.legal.activeName !== publisher.legal.plannedName) {
    errors.push("publisher active legal name is not verified");
  }
  if (publisher?.publication?.externalPublicationAllowed !== true) {
    errors.push("external publication is not allowed");
  }
  if (publisher?.publication?.authorization !== "authorized") {
    errors.push("publisher authorization is withheld");
  }
  if (!Array.isArray(publisher?.publication?.blockingRequirements)) {
    errors.push("publisher blocking requirements are missing");
  } else if (publisher.publication.blockingRequirements.length !== 0) {
    errors.push(`publisher blockers remain: ${publisher.publication.blockingRequirements.join(", ")}`);
  }
  return errors;
}

export function assertPublishReady() {
  const publisher = JSON.parse(readFileSync(resolve(root, "publisher/publisher.json"), "utf8"));
  const errors = publicationErrors(publisher);
  if (errors.length === 0) return publisher;
  throw new Error([
    "PUBLICATION BLOCKED: Openly Useful publisher activation is incomplete.",
    ...errors.map((error) => `- ${error}`),
    "Local build, test, package generation, and registration validation remain allowed.",
  ].join("\n"));
}

export function main(argv = process.argv.slice(2)) {
  if (argv.length !== 0) throw new Error("Usage: assert-publish-ready.mjs");
  assertPublishReady();
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
