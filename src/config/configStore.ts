import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { AppConfig } from "../domain/types";

const DEFAULT_CONFIG: AppConfig = {
  repos: [],
  refreshSeconds: 5,
};

function configPath(): string {
  return join(homedir(), ".config", "gh-actions-tui", "config.json");
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const raw = await readFile(configPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    const repos = Array.isArray(parsed.repos) ? parsed.repos.filter((item): item is string => typeof item === "string") : [];
    const refreshSeconds =
      typeof parsed.refreshSeconds === "number" && parsed.refreshSeconds > 0
        ? Math.floor(parsed.refreshSeconds)
        : DEFAULT_CONFIG.refreshSeconds;
    return {
      repos,
      refreshSeconds,
    };
  } catch (error) {
    if (isNotFound(error)) {
      return DEFAULT_CONFIG;
    }
    throw error;
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const path = configPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(config, null, 2), "utf8");
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
}
