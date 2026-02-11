import { describe, expect, test } from "bun:test";
import { mapCheckRun, mapStatusContext, rollupFromChecksAndRuns } from "../src/domain/rollup";
import type { Check, WorkflowRun } from "../src/domain/types";

describe("rollup mapping", () => {
  test("maps check-run states", () => {
    expect(mapCheckRun("queued", "")).toBe("queued");
    expect(mapCheckRun("completed", "success")).toBe("passed");
    expect(mapCheckRun("completed", "failure")).toBe("failed");
  });

  test("maps status-context states", () => {
    expect(mapStatusContext("success")).toBe("passed");
    expect(mapStatusContext("error")).toBe("failed");
    expect(mapStatusContext("pending")).toBe("pending");
  });

  test("rollup prioritizes in-progress over failures", () => {
    const checks: Check[] = [
      {
        name: "lint",
        source: "actions",
        url: "",
        status: "queued",
        conclusion: "",
        category: "queued",
        required: false,
      },
    ];
    const runs: WorkflowRun[] = [
      {
        id: 1,
        name: "CI",
        displayName: "CI",
        event: "pull_request",
        status: "completed",
        conclusion: "failure",
        url: "",
        createdAt: new Date(),
        updatedAt: new Date(),
        category: "failed",
      },
    ];
    expect(rollupFromChecksAndRuns(checks, runs)).toBe("running");
  });
});
