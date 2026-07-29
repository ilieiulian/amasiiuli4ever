import { readFile, writeFile } from "node:fs/promises";

const configPath = new URL("../dist/server/wrangler.json", import.meta.url);
const config = JSON.parse(await readFile(configPath, "utf8"));
const existingBuckets = Array.isArray(config.r2_buckets) ? config.r2_buckets : [];

config.r2_buckets = [
  ...existingBuckets.filter((bucket) => bucket.binding !== "DRAWINGS"),
  {
    binding: "DRAWINGS",
    bucket_name: "amasiiuli4ever-drawings",
  },
];

await writeFile(configPath, `${JSON.stringify(config)}\n`, "utf8");
