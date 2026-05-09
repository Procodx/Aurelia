import { readdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const memoriesDir = join(process.cwd(), "public-assets", "memories");
const outputPath = join(memoriesDir, "compliments.json");
const supportedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function naturalSort(left, right) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function titleFromFile(fileName) {
  return fileName
    .replace(extname(fileName), "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

try {
  const entries = await readdir(memoriesDir, { withFileTypes: true });
  const compliments = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => {
      const extension = extname(fileName).toLowerCase();
      return supportedExtensions.has(extension) && /^compliment[-_\s]?\d*/i.test(fileName);
    })
    .sort(naturalSort)
    .map((fileName) => ({
      id: fileName.replace(extname(fileName), "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      title: titleFromFile(fileName),
      fileName,
      source: `/memories/${fileName}`,
    }));

  await writeFile(`${outputPath}.tmp`, `${JSON.stringify({ compliments }, null, 2)}\n`);
  await writeFile(outputPath, `${JSON.stringify({ compliments }, null, 2)}\n`);
  console.log(`Synced ${compliments.length} compliment image${compliments.length === 1 ? "" : "s"} to public-assets/memories/compliments.json`);
} catch (error) {
  console.warn(`Could not sync compliment gallery: ${error instanceof Error ? error.message : String(error)}`);
}
