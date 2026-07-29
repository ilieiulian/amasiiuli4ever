import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

test("uses the public drawing API instead of browser-only storage", async () => {
  const [experience, css] = await Promise.all([
    read("app/HomeExperience.tsx"),
    read("app/experience.css"),
  ]);

  assert.match(experience, /fetch\("\/api\/drawings"/);
  assert.match(experience, /method:\s*"POST"/);
  assert.match(experience, /Mesaj atașat \(opțional\)/);
  assert.match(experience, /type="password"/);
  assert.match(experience, /Record<string, PublicDrawing>/);
  assert.doesNotMatch(experience, /localStorage|STORAGE_KEY/);
  assert.match(css, /\.publication-fields/);
  assert.match(css, /\.drawing-message/);
});

test("protects writes and stores one image plus message per month in R2", async () => {
  const [storage, listRoute, drawingRoute, hosting, workflow, deployScript] =
    await Promise.all([
      read("lib/drawings-storage.ts"),
      read("app/api/drawings/route.ts"),
      read("app/api/drawings/[monthId]/route.ts"),
      read(".openai/hosting.json"),
      read(".github/workflows/deploy.yml"),
      read("scripts/configure-cloudflare-r2.mjs"),
    ]);

  assert.equal(JSON.parse(hosting).r2, "DRAWINGS");
  assert.match(storage, /DRAWINGS_PREFIX = "months\/"/);
  assert.match(storage, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(storage, /MAX_MESSAGE_LENGTH = 300/);
  assert.match(listRoute, /include:\s*\["customMetadata"\]/);
  assert.match(listRoute, /imageUrl:/);
  assert.match(drawingRoute, /verifyUploadCode\(code\)/);
  assert.match(drawingRoute, /customMetadata:\s*\{ message \}/);
  assert.match(drawingRoute, /X-Content-Type-Options/);
  assert.match(workflow, /wrangler r2 bucket create amasiiuli4ever-drawings/);
  assert.match(deployScript, /binding:\s*"DRAWINGS"/);
  assert.match(deployScript, /bucket_name:\s*"amasiiuli4ever-drawings"/);
});