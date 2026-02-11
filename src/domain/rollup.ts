import type { Check, CheckCategory, WorkflowRun } from "./types";
import { DISPLAY_ORDER } from "./types";

export function mapCheckRun(status: string, conclusion: string): CheckCategory {
  if (status !== "completed") {
    switch (status) {
      case "queued":
        return "queued";
      case "waiting":
      case "pending":
      case "requested":
        return "pending";
      default:
        return "running";
    }
  }

  switch (conclusion) {
    case "success":
      return "passed";
    case "neutral":
    case "skipped":
      return "skipped";
    case "cancelled":
      return "cancelled";
    default:
      return "failed";
  }
}

export function mapStatusContext(state: string): CheckCategory {
  switch (state) {
    case "success":
      return "passed";
    case "pending":
      return "pending";
    case "failure":
    case "error":
      return "failed";
    default:
      return "pending";
  }
}

export function mapWorkflowRun(status: string, conclusion: string): CheckCategory {
  if (status !== "completed") {
    switch (status) {
      case "queued":
        return "queued";
      case "waiting":
      case "requested":
      case "pending":
        return "pending";
      default:
        return "running";
    }
  }
  return mapCheckRun("completed", conclusion);
}

export function categoryRank(category: CheckCategory): number {
  return DISPLAY_ORDER.indexOf(category);
}

export function inProgress(category: CheckCategory): boolean {
  return category === "running" || category === "queued" || category === "pending";
}

export function rollupFromChecksAndRuns(checks: Check[], runs: WorkflowRun[]): CheckCategory {
  let hasFailed = false;

  for (const check of checks) {
    if (inProgress(check.category)) {
      return "running";
    }
    if (check.category === "failed") {
      hasFailed = true;
    }
  }

  for (const run of runs) {
    if (inProgress(run.category)) {
      return "running";
    }
    if (run.category === "failed") {
      hasFailed = true;
    }
  }

  if (hasFailed) {
    return "failed";
  }
  return "passed";
}

export function summaryByCategory(items: { category: CheckCategory }[]): Record<CheckCategory, number> {
  return items.reduce<Record<CheckCategory, number>>(
    (acc, item) => {
      acc[item.category] += 1;
      return acc;
    },
    {
      running: 0,
      queued: 0,
      pending: 0,
      failed: 0,
      cancelled: 0,
      passed: 0,
      skipped: 0,
    },
  );
}

/** Sort rank grouping categories by visual severity: yellow → red → green → gray. */
export function displayRank(category: CheckCategory): number {
  switch (category) {
    case "running":
      return 0;
    case "queued":
      return 1;
    case "pending":
      return 2;
    case "failed":
      return 3;
    case "passed":
      return 4;
    case "cancelled":
      return 5;
    case "skipped":
      return 6;
    default:
      return 7;
  }
}
