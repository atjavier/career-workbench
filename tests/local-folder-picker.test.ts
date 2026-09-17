import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { chooseLocalEvidenceFolder, type FolderPickerExecutor } from "../src/files/local-folder-picker";
import { privateAppDataRoot } from "../src/files/app-data";

test("chooseLocalEvidenceFolder is a defined function supporting local folder selection", () => {
  assert.equal(typeof chooseLocalEvidenceFolder, "function");
});

test("macOS folder picker executes osascript and strips trailing slash on successful selection", async () => {
  const originalPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
  try {
    let calledFile = "";
    let calledArgs: string[] = [];
    const mockExecutor: FolderPickerExecutor = async (file, args) => {
      calledFile = file;
      calledArgs = args;
      return { stdout: "/Users/adrian/Projects/Resume/\n" };
    };

    const result = await chooseLocalEvidenceFolder(mockExecutor);
    assert.equal(calledFile, "osascript");
    assert.deepEqual(calledArgs, [
      "-e",
      'POSIX path of (choose folder with prompt "Choose a local Project or Experience folder")',
    ]);
    assert.equal(result, "/Users/adrian/Projects/Resume");
  } finally {
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
  }
});

test("macOS folder picker returns undefined when user cancels (-128)", async () => {
  const originalPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
  try {
    const mockCancelExecutor: FolderPickerExecutor = async () => {
      const error = new Error("execution error: User canceled. (-128)") as any;
      error.stderr = "execution error: User canceled. (-128)";
      throw error;
    };

    const result = await chooseLocalEvidenceFolder(mockCancelExecutor);
    assert.equal(result, undefined);
  } finally {
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
  }
});

test("macOS folder picker fails safe on unexpected script error", async () => {
  const originalPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
  try {
    const mockErrorExecutor: FolderPickerExecutor = async () => {
      throw new Error("osascript: Not authorized to send Apple events.");
    };

    await assert.rejects(
      chooseLocalEvidenceFolder(mockErrorExecutor),
      { code: "EVIDENCE_DOCUMENTER_INVALID" },
    );
  } finally {
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
  }
});

test("Linux folder picker executes zenity and returns selected path or undefined on cancel", async () => {
  const originalPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "linux", configurable: true });
  try {
    let calledFile = "";
    const mockSuccess: FolderPickerExecutor = async (file) => {
      calledFile = file;
      return { stdout: "/home/adrian/Projects/Resume\n" };
    };
    const result = await chooseLocalEvidenceFolder(mockSuccess);
    assert.equal(calledFile, "zenity");
    assert.equal(result, "/home/adrian/Projects/Resume");

    const mockCancel: FolderPickerExecutor = async () => {
      const err = new Error("Canceled") as any;
      err.code = 1;
      throw err;
    };
    const cancelResult = await chooseLocalEvidenceFolder(mockCancel);
    assert.equal(cancelResult, undefined);
  } finally {
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
  }
});

test("privateAppDataRoot respects LOCALAPPDATA when present", () => {
  const original = process.env.LOCALAPPDATA;
  try {
    process.env.LOCALAPPDATA = "C:\\CustomAppData";
    assert.equal(privateAppDataRoot(), join("C:\\CustomAppData", "PersonalJobDiscovery"));
  } finally {
    if (original === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = original;
  }
});

test("privateAppDataRoot falls back to macOS Library/Application Support on darwin", () => {
  const originalEnv = process.env.LOCALAPPDATA;
  const originalPlatform = process.platform;
  delete process.env.LOCALAPPDATA;
  Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
  try {
    const root = privateAppDataRoot();
    assert.equal(root, join(homedir(), "Library", "Application Support", "PersonalJobDiscovery"));
  } finally {
    if (originalEnv !== undefined) process.env.LOCALAPPDATA = originalEnv;
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
  }
});
