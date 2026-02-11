const GITHUB_PREFIX = "https://github.com/";

export function parseRepoInput(input: string): string[] {
  const tokens = input
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const repos = new Set<string>();
  for (const token of tokens) {
    const normalized = normalizeRepoIdentifier(token);
    repos.add(normalized);
  }
  return [...repos];
}

export function normalizeRepoIdentifier(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("empty repository identifier");
  }

  let repo = trimmed;
  if (repo.startsWith(GITHUB_PREFIX)) {
    repo = repo.slice(GITHUB_PREFIX.length);
  }
  repo = repo.replace(/^\//, "").replace(/\/$/, "");

  const parts = repo.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`invalid repository identifier: ${value}`);
  }

  return `${parts[0]}/${parts[1]}`;
}
