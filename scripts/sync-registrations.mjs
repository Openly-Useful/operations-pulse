#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const registrationRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const canonicalSkillRoot = join(registrationRoot, "skill", "operations-pulse");
const wrapperSkillRoots = ["openai", "claude"].map((host) =>
  join(registrationRoot, "plugins", host, "operations-pulse", "skills", "operations-pulse"),
);
const canonicalCatalogRoot = join(registrationRoot, "catalog");
const packagedCatalogRoot = join(registrationRoot, "packages", "mcp", "catalog");

function walkFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const path = join(directory, entry.name);
    if (lstatSync(path).isSymbolicLink()) {
      throw new Error(`Generated skill trees cannot contain symlinks: ${relative(registrationRoot, path)}`);
    }
    if (entry.isDirectory()) files.push(...walkFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function fileMap(directory) {
  if (!existsSync(directory)) return new Map();
  return new Map(walkFiles(directory).map((path) => [relative(directory, path), readFileSync(path)]));
}

export function registrationSyncErrors() {
  const errors = [];
  const trees = [
    ...wrapperSkillRoots.map((target) => ({ source: canonicalSkillRoot, target })),
    { source: canonicalCatalogRoot, target: packagedCatalogRoot },
  ];
  for (const { source: sourceRoot, target } of trees) {
    const expected = fileMap(sourceRoot);
    let actual;
    try {
      actual = fileMap(target);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    for (const [path, contents] of expected) {
      if (!actual.has(path)) errors.push(`Generated artifact is missing ${relative(registrationRoot, join(target, path))}`);
      else if (!actual.get(path).equals(contents)) errors.push(`Generated artifact drift: ${relative(registrationRoot, join(target, path))}`);
    }
    for (const path of actual.keys()) {
      if (!expected.has(path)) errors.push(`Unexpected generated artifact file: ${relative(registrationRoot, join(target, path))}`);
    }
  }
  return errors;
}

export function writeRegistrationSkillCopies() {
  const trees = [
    ...wrapperSkillRoots.map((target) => ({ source: canonicalSkillRoot, target })),
    { source: canonicalCatalogRoot, target: packagedCatalogRoot },
  ];
  let count = 0;
  for (const { source: sourceRoot, target } of trees) {
    if (existsSync(target) && lstatSync(target).isSymbolicLink()) {
      throw new Error(`Refusing to replace symlinked generated root: ${relative(registrationRoot, target)}`);
    }
    rmSync(target, { force: true, recursive: true });
    const sourceFiles = walkFiles(sourceRoot);
    for (const sourcePath of sourceFiles) {
      const destination = join(target, relative(sourceRoot, sourcePath));
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(sourcePath, destination);
      count += 1;
    }
  }
  return count;
}

export function main(argv = process.argv.slice(2)) {
  const command = argv[0] ?? "check";
  if (argv.length !== 1 || !["check", "write"].includes(command)) {
    throw new Error("Usage: sync-registrations.mjs <check|write>");
  }
  if (command === "write") {
    const count = writeRegistrationSkillCopies();
    process.stdout.write(`Generated ${count} provider wrapper and package metadata files from canonical sources.\n`);
  }
  const errors = registrationSyncErrors();
  if (errors.length) throw new Error(errors.join("\n"));
  process.stdout.write("Provider wrapper and package metadata copies match their canonical sources.\n");
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
