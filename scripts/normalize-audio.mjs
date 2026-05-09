import { readdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const audioDir = path.resolve(process.cwd(), "public-assets", "audio");
const convertibleExtensions = new Set([".aac", ".aiff", ".aif", ".flac", ".m4a", ".mp4", ".m4v", ".mov", ".oga", ".ogg", ".opus", ".wav", ".webm", ".wma"]);
const deleteOriginals = process.argv.includes("--delete-originals");
const require = createRequire(import.meta.url);

function resolveFfmpegCommand() {
  try {
    const localFfmpegPath = require("ffmpeg-static");
    if (typeof localFfmpegPath === "string" && localFfmpegPath.length > 0) {
      return localFfmpegPath;
    }
  } catch {
    // Fall back to a system ffmpeg on PATH.
  }

  return "ffmpeg";
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", windowsHide: true });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function toUniqueMp3Path(filePath) {
  const parsed = path.parse(filePath);
  let candidate = path.join(parsed.dir, `${parsed.name}.mp3`);
  let index = 2;

  while (candidate.toLowerCase() === filePath.toLowerCase()) {
    candidate = path.join(parsed.dir, `${parsed.name}-${index}.mp3`);
    index += 1;
  }

  return candidate;
}

const ffmpegCommand = resolveFfmpegCommand();

try {
  await run(ffmpegCommand, ["-version"]);
} catch {
  console.error("ffmpeg is not installed or is not on PATH.");
  console.error("Run npm install -D ffmpeg-static, or install ffmpeg on your system, then run: npm run normalize-audio");
  process.exit(1);
}

const entries = await readdir(audioDir, { withFileTypes: true });
let converted = 0;
let skipped = 0;

for (const entry of entries) {
  if (!entry.isFile()) {
    continue;
  }

  const extension = path.extname(entry.name).toLowerCase();
  if (!convertibleExtensions.has(extension)) {
    skipped += 1;
    continue;
  }

  const sourcePath = path.resolve(audioDir, entry.name);
  if (!sourcePath.startsWith(`${audioDir}${path.sep}`)) {
    throw new Error(`Refusing to process file outside audio dir: ${sourcePath}`);
  }

  const outputPath = toUniqueMp3Path(sourcePath);
  if (outputPath.toLowerCase() === sourcePath.toLowerCase()) {
    skipped += 1;
    continue;
  }

  await run(ffmpegCommand, [
    "-y",
    "-i",
    sourcePath,
    "-vn",
    "-codec:a",
    "libmp3lame",
    "-q:a",
    "2",
    outputPath,
  ]);

  converted += 1;

  if (deleteOriginals) {
    await rm(sourcePath, { force: true });
  }
}

await run("node", ["scripts/sync-audio-library.mjs"]);

console.log(
  `Converted ${converted} audio file${converted === 1 ? "" : "s"} to MP3. Skipped ${skipped}. ${
    deleteOriginals ? "Original converted files were removed." : "Original files were kept."
  }`,
);
