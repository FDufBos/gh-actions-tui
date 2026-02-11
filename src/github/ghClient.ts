import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseAuthoredPrs, parseChecksFromApis, parsePrDetailMeta, parseViewer, parseWorkflowRuns } from "./parsers";
import type { Check, PullRequest, ReviewDecision, WorkflowRun } from "../domain/types";

const execFileAsync = promisify(execFile);
const COMMAND_TIMEOUT_MS = 20_000;
const LIST_CONCURRENCY = 4;

export type GhClient = ReturnType<typeof createGhClient>;

export function createGhClient() {
  async function runGh(args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync("gh", args, {
        timeout: COMMAND_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024,
      });
      return stdout;
    } catch (error) {
      throw new Error(compactGhError(error));
    }
  }

  async function getViewer(): Promise<string> {
    const body = await runGh(["api", "user"]);
    return parseViewer(body);
  }

  async function getPrHeadSha(owner: string, repo: string, prNumber: number): Promise<string> {
    const body = await runGh(["api", `repos/${owner}/${repo}/pulls/${prNumber}`]);
    const payload = JSON.parse(body) as { head?: { sha?: unknown } };
    const sha = typeof payload.head?.sha === "string" ? payload.head.sha : "";
    if (!sha.trim()) {
      throw new Error("no head sha found");
    }
    return sha;
  }

  async function listAuthoredPrs(owner: string, repo: string, author: string): Promise<PullRequest[]> {
    const body = await runGh([
      "pr",
      "list",
      "-R",
      `${owner}/${repo}`,
      "--author",
      author,
      "--state",
      "open",
      "--limit",
      "100",
      "--json",
      "number,title,url,isDraft,updatedAt,headRefOid",
    ]);
    return parseAuthoredPrs(body, owner, repo);
  }

  async function listAuthoredPrsForIdentifiers(repoIdentifiers: string[], author: string): Promise<PullRequest[]> {
    const identifiers = repoIdentifiers.map((item) => item.trim()).filter(Boolean);
    if (!identifiers.length) {
      return [];
    }

    const queue = [...identifiers];
    const prs: PullRequest[] = [];
    const errors: string[] = [];

    async function worker() {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) {
          continue;
        }
        const parts = next.split("/");
        if (parts.length !== 2) {
          errors.push(`${next}: expected owner/repo`);
          continue;
        }
        const [owner, repo] = parts.map((part) => part.trim());
        if (!owner || !repo) {
          errors.push(`${next}: invalid owner/repo`);
          continue;
        }

        try {
          const items = await listAuthoredPrs(owner, repo, author);
          prs.push(...items);
        } catch (error) {
          errors.push(`${owner}/${repo}: ${normalizeError(error)}`);
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(LIST_CONCURRENCY, queue.length) }, () => worker()));
    prs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    if (errors.length) {
      throw new Error(errors.join("; "));
    }
    return prs;
  }

  async function getChecksForHeadSha(owner: string, repo: string, headSha: string): Promise<Check[]> {
    // First page of check-runs + statuses in parallel
    const [firstCheckRunsBody, statusesBody] = await Promise.all([
      runGh([
        "api",
        `repos/${owner}/${repo}/commits/${headSha}/check-runs?per_page=100&page=1`,
        "-H",
        "Accept: application/vnd.github+json",
      ]),
      runGh(["api", `repos/${owner}/${repo}/commits/${headSha}/status?per_page=100&page=1`]),
    ]);

    // Paginate check-runs if there are more than 100
    const firstPayload = JSON.parse(firstCheckRunsBody) as { total_count?: number; check_runs?: unknown[] };
    const totalCount = typeof firstPayload.total_count === "number" ? firstPayload.total_count : 0;
    const allCheckRuns: unknown[] = [...(firstPayload.check_runs ?? [])];

    if (totalCount > 100) {
      const totalPages = Math.ceil(totalCount / 100);
      const pagePromises: Promise<string>[] = [];
      for (let page = 2; page <= totalPages; page++) {
        pagePromises.push(
          runGh([
            "api",
            `repos/${owner}/${repo}/commits/${headSha}/check-runs?per_page=100&page=${page}`,
            "-H",
            "Accept: application/vnd.github+json",
          ]),
        );
      }
      const additionalBodies = await Promise.all(pagePromises);
      for (const body of additionalBodies) {
        const payload = JSON.parse(body) as { check_runs?: unknown[] };
        allCheckRuns.push(...(payload.check_runs ?? []));
      }
    }

    const mergedCheckRunsBody = JSON.stringify({ check_runs: allCheckRuns });
    return parseChecksFromApis(mergedCheckRunsBody, statusesBody);
  }

  async function getWorkflowRunsForHeadSha(owner: string, repo: string, headSha: string): Promise<WorkflowRun[]> {
    const body = await runGh(["api", `repos/${owner}/${repo}/actions/runs?head_sha=${headSha}&per_page=100`]);
    return parseWorkflowRuns(body);
  }

  async function getPrChecks(owner: string, repo: string, prNumber: number): Promise<Check[]> {
    const sha = await getPrHeadSha(owner, repo, prNumber);
    return getChecksForHeadSha(owner, repo, sha);
  }

  async function getPrWorkflowRuns(owner: string, repo: string, prNumber: number): Promise<WorkflowRun[]> {
    const sha = await getPrHeadSha(owner, repo, prNumber);
    return getWorkflowRunsForHeadSha(owner, repo, sha);
  }

  async function openPrInBrowser(owner: string, repo: string, prNumber: number): Promise<void> {
    await runGh(["pr", "view", String(prNumber), "-R", `${owner}/${repo}`, "--web"]);
  }

  async function getPrDetailMeta(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<{ reviewDecision: ReviewDecision; requiredCheckNames: string[] }> {
    const body = await runGh([
      "pr",
      "view",
      String(prNumber),
      "-R",
      `${owner}/${repo}`,
      "--json",
      "reviewDecision,statusCheckRollup",
    ]);
    return parsePrDetailMeta(body);
  }

  return {
    getViewer,
    listAuthoredPrsForIdentifiers,
    getPrChecks,
    getPrWorkflowRuns,
    getPrDetailMeta,
    getChecksForHeadSha,
    getWorkflowRunsForHeadSha,
    openPrInBrowser,
  };
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function compactGhError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const message = error.message || "";
  const lines = message.split("\n").map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? "";
    if (line.startsWith("gh: ")) {
      return line.replace(/^gh:\s*/, "");
    }
  }
  return message || "unknown gh command error";
}
