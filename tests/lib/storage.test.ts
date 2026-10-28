// File-path safety: a Meeting.audioPath is only ever resolved inside storage/uploads/.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveUploadPath } from "@/lib/storage";

describe("resolveUploadPath", () => {
  it("resolves a stored path to the project's storage/uploads folder", () => {
    const stored = path.join("storage", "uploads", "1b4e28ba-2fa1-11d2-883f-0016d3cca427.m4a");
    expect(resolveUploadPath(stored)).toBe(path.join(process.cwd(), stored));
  });

  it.each([
    ["a path that climbs out of the folder", path.join("storage", "uploads", "..", "..", "package.json")],
    ["a relative path elsewhere", path.join("..", "secrets.txt")],
    ["an absolute path", path.resolve("/", "Windows", "win.ini")],
    ["a subfolder of uploads", path.join("storage", "uploads", "tmp", "question.webm")],
    ["a bare file name", "meeting.m4a"],
  ])("refuses %s", (_label, audioPath) => {
    expect(() => resolveUploadPath(audioPath)).toThrow(/outside/);
  });
});
