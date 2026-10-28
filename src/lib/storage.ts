// Uploaded audio on disk: storage/uploads/ under the project root, outside public/ so it is never
// served statically. Meeting.audioPath holds the path relative to the project root, as in prisma/seed.ts.
import "server-only";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

const UPLOADS_DIR = path.join("storage", "uploads");

// The folder is spelled out (not built from a variable) so Turbopack's file tracing stays
// scoped to it instead of pulling the whole project into the build output.
function uploadsFile(fileName: string): string {
  return path.join(process.cwd(), "storage", "uploads", fileName);
}

// Saves the file under a generated name, so the user's file name never reaches the file system.
// `extension` must come from validateAudioUpload's allow-list. Returns the value for Meeting.audioPath.
export async function saveUpload(file: File, extension: string): Promise<string> {
  const fileName = `${randomUUID()}.${extension}`;
  const fullPath = uploadsFile(fileName);
  await mkdir(path.dirname(fullPath), { recursive: true });
  // "wx" fails rather than overwrite an existing file.
  await writeFile(fullPath, Buffer.from(await file.arrayBuffer()), { flag: "wx" });
  return path.join(UPLOADS_DIR, fileName);
}

// Turns a stored Meeting.audioPath into an absolute path. Only "storage/uploads/<file>" is
// accepted, so a bad value can never point anywhere else on disk.
export function resolveUploadPath(audioPath: string): string {
  const fileName = path.basename(audioPath);
  if (path.normalize(audioPath) !== path.join(UPLOADS_DIR, fileName)) {
    throw new Error(`Audio path is outside ${UPLOADS_DIR}: ${audioPath}`);
  }
  return uploadsFile(fileName);
}

export async function deleteUpload(audioPath: string): Promise<void> {
  await rm(resolveUploadPath(audioPath), { force: true });
}

// Size of a stored upload in bytes, or null when the file is missing.
export async function getUploadSize(audioPath: string): Promise<number | null> {
  try {
    const info = await stat(resolveUploadPath(audioPath));
    return info.isFile() ? info.size : null;
  } catch {
    return null;
  }
}

// Streams bytes start..end (both inclusive) of a stored upload, for a Response body.
export function streamUpload(audioPath: string, start: number, end: number): ReadableStream<Uint8Array> {
  const file = createReadStream(resolveUploadPath(audioPath), { start, end });
  return Readable.toWeb(file) as ReadableStream<Uint8Array>;
}
