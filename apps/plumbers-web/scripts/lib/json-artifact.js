/** Lossless, bounded JSON serialization for derived build artifacts. */
const fs = require("fs");
const path = require("path");
const MAX_ARTIFACT_BYTES = 90 * 1024 * 1024;
function prepareJsonArtifact(filePath, value, maxBytes = MAX_ARTIFACT_BYTES) {
  const content = JSON.stringify(value) + "\n";
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > maxBytes) {
    throw new Error(
      `${path.basename(filePath)} would be ${(bytes / 1048576).toFixed(2)} MiB; limit is ${(maxBytes / 1048576).toFixed(2)} MiB. No evidence was truncated. Split the export before publishing.`,
    );
  }
  return { filePath, content, bytes };
}
function writeJsonArtifact(artifact) {
  const temp = `${artifact.filePath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temp, artifact.content, { flag: "wx" });
    fs.renameSync(temp, artifact.filePath);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}
module.exports = { MAX_ARTIFACT_BYTES, prepareJsonArtifact, writeJsonArtifact };
