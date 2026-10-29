"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { sourceValidationDigest } = require("./source-validation-digest.js");

test("source validation digest is stable across Windows and Unix text line endings", t => {
  const roots = [fs.mkdtempSync(path.join(os.tmpdir(), "vanguard-digest-lf-")), fs.mkdtempSync(path.join(os.tmpdir(), "vanguard-digest-crlf-"))];
  t.after(() => roots.forEach(root => fs.rmSync(root, { recursive: true, force: true })));
  for (const root of roots) fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(roots[0], "src", "engine.js"), "const value = 1;\nconst next = 2;\n");
  fs.writeFileSync(path.join(roots[1], "src", "engine.js"), "const value = 1;\r\nconst next = 2;\r\n");
  assert.equal(sourceValidationDigest(roots[0]), sourceValidationDigest(roots[1]));
  fs.writeFileSync(path.join(roots[1], "src", "engine.js"), "const value = 1;\r\nconst next = 3;\r\n");
  assert.notEqual(sourceValidationDigest(roots[0]), sourceValidationDigest(roots[1]));
});
