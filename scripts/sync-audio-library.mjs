import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const audioDir = path.join(process.cwd(), "public-assets", "audio");
const outputFile = path.join(audioDir, "library.json");
const supportedExtensions = new Set([".mp3", ".m4a", ".mp4", ".wav", ".ogg", ".aac", ".flac"]);

function toTitleCase(value) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseAudioName(fileName) {
  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension).replace(/\s+/g, " ").trim();
  const byMatch = baseName.match(/^(.+?)\s+by\s+(.+)$/i);
  const dashMatch = baseName.match(/^(.+?)\s+-\s+(.+)$/);

  if (byMatch) {
    return {
      title: toTitleCase(byMatch[1]),
      artist: toTitleCase(byMatch[2]),
    };
  }

  if (dashMatch) {
    return {
      artist: toTitleCase(dashMatch[1]),
      title: toTitleCase(dashMatch[2]),
    };
  }

  return {
    title: toTitleCase(baseName),
    artist: "Aurelia's Echo Moon",
  };
}

const entries = await readdir(audioDir, { withFileTypes: true });
const audioFiles = entries
  .filter((entry) => entry.isFile())
  .filter((entry) => supportedExtensions.has(path.extname(entry.name).toLowerCase()))
  .sort((first, second) => {
    const firstBase = path.basename(first.name, path.extname(first.name));
    const secondBase = path.basename(second.name, path.extname(second.name));
    if (firstBase === secondBase) {
      return path.extname(first.name) === ".mp3" ? -1 : 1;
    }

    return first.name.localeCompare(second.name);
  });

const seenIds = new Set();
const tracks = audioFiles
  .map((entry) => {
    const parsed = parseAudioName(entry.name);
    const id = slugify(path.basename(entry.name, path.extname(entry.name)));

    return {
      id,
      title: parsed.title,
      artist: parsed.artist,
      source: `/audio/${encodeURIComponent(entry.name)}`,
      fileName: entry.name,
    };
  })
  .filter((track) => {
    if (seenIds.has(track.id)) {
      return false;
    }

    seenIds.add(track.id);
    return true;
  });

await writeFile(
  outputFile,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), tracks }, null, 2)}\n`,
  "utf8",
);

console.log(`Synced ${tracks.length} audio track${tracks.length === 1 ? "" : "s"} to public-assets/audio/library.json`);
