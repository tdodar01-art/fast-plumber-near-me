const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  prepareJsonArtifact,
  writeJsonArtifact,
} = require("../scripts/lib/json-artifact");
test("compact JSON preserves review text, Unicode, counts and all fields", () => {
  const value = {
    reviews: [
      {
        text: 'A quote: "fair price"\nSecond line — ✓',
        rating: 5,
        source: "google",
      },
    ],
    extra: { nested: [null, 0, false] },
  };
  const artifact = prepareJsonArtifact("sample.json", value);
  assert.deepEqual(JSON.parse(artifact.content), value);
  assert.equal(artifact.bytes, Buffer.byteLength(artifact.content));
  assert.ok(artifact.bytes < Buffer.byteLength(JSON.stringify(value, null, 2)));
});
test("oversized export fails without replacing the existing artifact", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fpn-artifact-"));
  try {
    const file = path.join(dir, "sample.json");
    fs.writeFileSync(file, '{"old":true}');
    assert.throws(
      () =>
        writeJsonArtifact(
          prepareJsonArtifact(file, { reviews: "x".repeat(100) }, 20),
        ),
      /No evidence was truncated/,
    );
    assert.equal(fs.readFileSync(file, "utf8"), '{"old":true}');
    writeJsonArtifact(prepareJsonArtifact(file, { complete: true }));
    assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), {
      complete: true,
    });
    assert.deepEqual(fs.readdirSync(dir), ["sample.json"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
