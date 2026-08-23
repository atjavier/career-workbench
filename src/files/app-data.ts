import { mkdir, lstat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { WorkspaceError } from "@/domain/workspace/types";

export type AppDataPaths = {
  root: string;
  databasePath: string;
};

function defaultAppDataRoot(): string {
  const windowsLocalAppData = process.env.LOCALAPPDATA;
  const parent = windowsLocalAppData ?? join(homedir(), "AppData", "Local");
  return join(parent, "PersonalJobDiscovery");
}

export function privateAppDataRoot(): string {
  return resolve(defaultAppDataRoot());
}

export async function resolveAppDataPaths(appDataRoot?: string): Promise<AppDataPaths> {
  if (appDataRoot !== undefined && appDataRoot.trim().length === 0) {
    throw new WorkspaceError("APP_DATA_PATH_INVALID", "The private workspace location is unavailable.", "Choose a private local folder and try workspace setup again.");
  }
  const root = resolve(/* turbopackIgnore: true */ appDataRoot ?? defaultAppDataRoot());

  try {
    const metadata = await lstat(root);
    if (!metadata.isDirectory()) {
      throw new WorkspaceError(
        "APP_DATA_PATH_INVALID",
        "The private workspace location is unavailable.",
        "Choose a private local folder and try workspace setup again.",
      );
    }
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }

    const fileError = error as NodeJS.ErrnoException;
    if (fileError.code !== "ENOENT") {
      throw new WorkspaceError(
        "APP_DATA_PATH_INVALID",
        "The private workspace location cannot be checked.",
        "Check that your Windows account can use its local app-data folder, then try again.",
      );
    }

    try {
      await mkdir(root, { recursive: true });
    } catch {
      throw new WorkspaceError(
        "APP_DATA_PATH_INVALID",
        "The private workspace location cannot be created.",
        "Check that your Windows account can use its local app-data folder, then try again.",
      );
    }
  }

  return { root, databasePath: join(root, "workspace.sqlite") };
}
