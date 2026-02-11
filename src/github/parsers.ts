import { categoryRank, mapCheckRun, mapStatusContext, mapWorkflowRun } from "../domain/rollup";
import type { Check, PullRequest, ReviewDecision, WorkflowRun } from "../domain/types";

type ViewerPayload = { login?: unknown };

export function parseViewer(body: string): string {
  const payload = JSON.parse(body) as ViewerPayload;
  const login = typeof payload.login === "string" ? payload.login : "";
  if (!login.trim()) {
    throw new Error("viewer login is empty");
  }
  return login;
}

type PrListItem = {
  number?: unknown;
  title?: unknown;
  url?: unknown;
  isDraft?: unknown;
  updatedAt?: unknown;
  headRefOid?: unknown;
};

export function parseAuthoredPrs(body: string, owner: string, repo: string): PullRequest[] {
  const payload = JSON.parse(body) as PrListItem[];
  const prs: PullRequest[] = [];

  for (const item of payload) {
    if (typeof item.number !== "number" || typeof item.title !== "string" || typeof item.url !== "string") {
      continue;
    }

    const updatedAt =
      typeof item.updatedAt === "string" ? new Date(item.updatedAt) : new Date(0);
    prs.push({
      number: item.number,
      title: item.title,
      url: item.url,
      owner,
      repo,
      headSha: typeof item.headRefOid === "string" ? item.headRefOid : "",
      draft: Boolean(item.isDraft),
      updatedAt: Number.isNaN(updatedAt.getTime()) ? new Date(0) : updatedAt,
    });
  }

  prs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return prs;
}

type CheckRunsPayload = {
  check_runs?: Array<{
    name?: unknown;
    html_url?: unknown;
    status?: unknown;
    conclusion?: unknown;
    app?: { name?: unknown };
  }>;
};

type StatusPayload = {
  statuses?: Array<{
    context?: unknown;
    description?: unknown;
    target_url?: unknown;
    state?: unknown;
  }>;
};

export function parseChecksFromApis(checkRunsBody: string, statusesBody: string): Check[] {
  const checkRuns = JSON.parse(checkRunsBody) as CheckRunsPayload;
  const statuses = JSON.parse(statusesBody) as StatusPayload;
  const out: Check[] = [];

  for (const run of checkRuns.check_runs ?? []) {
    const status = typeof run.status === "string" ? run.status : "";
    const conclusion = typeof run.conclusion === "string" ? run.conclusion : "";
    out.push({
      name: typeof run.name === "string" ? run.name : "unnamed check",
      source: typeof run.app?.name === "string" ? run.app.name : "check-run",
      url: typeof run.html_url === "string" ? run.html_url : "",
      status,
      conclusion,
      category: mapCheckRun(status, conclusion),
      required: false,
    });
  }

  for (const statusItem of statuses.statuses ?? []) {
    const state = typeof statusItem.state === "string" ? statusItem.state : "";
    const context = typeof statusItem.context === "string" ? statusItem.context : "status";
    const description = typeof statusItem.description === "string" ? statusItem.description : "";
    out.push({
      name: description ? `${context} - ${description}` : context,
      source: "status",
      url: typeof statusItem.target_url === "string" ? statusItem.target_url : "",
      status: state,
      conclusion: state,
      category: mapStatusContext(state),
      required: false,
    });
  }

  out.sort((a, b) => {
    const left = categoryRank(a.category);
    const right = categoryRank(b.category);
    if (left !== right) {
      return left - right;
    }
    return a.name.localeCompare(b.name);
  });
  return out;
}

type WorkflowRunsPayload = {
  workflow_runs?: Array<{
    id?: unknown;
    name?: unknown;
    display_title?: unknown;
    event?: unknown;
    status?: unknown;
    conclusion?: unknown;
    html_url?: unknown;
    created_at?: unknown;
    updated_at?: unknown;
  }>;
};

export function parseWorkflowRuns(body: string): WorkflowRun[] {
  const payload = JSON.parse(body) as WorkflowRunsPayload;
  const runs: WorkflowRun[] = [];

  for (const item of payload.workflow_runs ?? []) {
    if (typeof item.id !== "number") {
      continue;
    }
    const status = typeof item.status === "string" ? item.status : "";
    const conclusion = typeof item.conclusion === "string" ? item.conclusion : "";
    const createdAt =
      typeof item.created_at === "string" ? new Date(item.created_at) : new Date(0);
    const updatedAt =
      typeof item.updated_at === "string" ? new Date(item.updated_at) : new Date(0);

    runs.push({
      id: item.id,
      name: typeof item.name === "string" ? item.name : "",
      displayName: typeof item.display_title === "string" ? item.display_title : "",
      event: typeof item.event === "string" ? item.event : "",
      status,
      conclusion,
      url: typeof item.html_url === "string" ? item.html_url : "",
      createdAt: Number.isNaN(createdAt.getTime()) ? new Date(0) : createdAt,
      updatedAt: Number.isNaN(updatedAt.getTime()) ? new Date(0) : updatedAt,
      category: mapWorkflowRun(status, conclusion),
    });
  }

  runs.sort((a, b) => {
    const left = categoryRank(a.category);
    const right = categoryRank(b.category);
    if (left !== right) {
      return left - right;
    }
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
  return runs;
}

type PrDetailMeta = {
  reviewDecision: ReviewDecision;
  requiredCheckNames: string[];
};

export function parsePrDetailMeta(body: string): PrDetailMeta {
  const payload = JSON.parse(body) as {
    reviewDecision?: unknown;
    statusCheckRollup?: unknown;
  };

  const reviewDecision = normalizeReviewDecision(payload.reviewDecision);
  const requiredCheckNames = collectRequiredCheckNames(payload.statusCheckRollup);

  return { reviewDecision, requiredCheckNames };
}

function normalizeReviewDecision(value: unknown): ReviewDecision {
  if (value === "APPROVED" || value === "REVIEW_REQUIRED" || value === "CHANGES_REQUESTED") {
    return value;
  }
  return "UNKNOWN";
}

function collectRequiredCheckNames(statusCheckRollup: unknown): string[] {
  const names = new Set<string>();

  const candidates: unknown[] = [];
  if (Array.isArray(statusCheckRollup)) {
    candidates.push(...statusCheckRollup);
  } else if (statusCheckRollup && typeof statusCheckRollup === "object") {
    const rollupObj = statusCheckRollup as Record<string, unknown>;
    if (Array.isArray(rollupObj.contexts)) {
      candidates.push(...rollupObj.contexts);
    }
    if (rollupObj.contexts && typeof rollupObj.contexts === "object") {
      const contextsObj = rollupObj.contexts as Record<string, unknown>;
      if (Array.isArray(contextsObj.nodes)) {
        candidates.push(...contextsObj.nodes);
      }
    }
  }

  for (const item of candidates) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const node = item as Record<string, unknown>;
    const isRequired = node.isRequired === true || node.required === true;
    if (!isRequired) {
      continue;
    }
    const candidateName =
      typeof node.name === "string"
        ? node.name
        : typeof node.context === "string"
          ? node.context
          : "";
    if (candidateName.trim()) {
      names.add(candidateName.trim());
    }
  }

  return [...names];
}
