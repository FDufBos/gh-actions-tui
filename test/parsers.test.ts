import { describe, expect, test } from "bun:test";
import { parseAuthoredPrs, parseChecksFromApis, parsePrDetailMeta, parseViewer, parseWorkflowRuns } from "../src/github/parsers";

describe("github parsers", () => {
  test("parses viewer payload", () => {
    expect(parseViewer(JSON.stringify({ login: "octocat" }))).toBe("octocat");
  });

  test("parses authored prs payload", () => {
    const prs = parseAuthoredPrs(
      JSON.stringify([{ number: 10, title: "Add feature", url: "https://x", isDraft: false, updatedAt: "2026-01-01T10:00:00Z", headRefOid: "abc" }]),
      "foo",
      "bar",
    );
    expect(prs).toHaveLength(1);
    expect(prs[0]?.owner).toBe("foo");
    expect(prs[0]?.repo).toBe("bar");
  });

  test("parses checks and status contexts", () => {
    const checks = parseChecksFromApis(
      JSON.stringify({
        check_runs: [
          {
            name: "CI",
            html_url: "https://x",
            status: "completed",
            conclusion: "success",
            app: { name: "github-actions" },
          },
        ],
      }),
      JSON.stringify({
        statuses: [{ context: "build", description: "ok", target_url: "https://y", state: "success" }],
      }),
    );
    expect(checks).toHaveLength(2);
  });

  test("parses workflow runs", () => {
    const runs = parseWorkflowRuns(
      JSON.stringify({
        workflow_runs: [
          {
            id: 1,
            name: "CI",
            display_title: "CI",
            event: "pull_request",
            status: "completed",
            conclusion: "success",
            html_url: "https://z",
            created_at: "2026-01-01T10:00:00Z",
            updated_at: "2026-01-01T10:01:00Z",
          },
        ],
      }),
    );
    expect(runs).toHaveLength(1);
    expect(runs[0]?.category).toBe("passed");
  });

  test("parses review decision and required checks", () => {
    const meta = parsePrDetailMeta(
      JSON.stringify({
        reviewDecision: "APPROVED",
        statusCheckRollup: [
          { __typename: "CheckRun", name: "CI", isRequired: true },
          { __typename: "StatusContext", context: "lint", isRequired: false },
        ],
      }),
    );
    expect(meta.reviewDecision).toBe("APPROVED");
    expect(meta.requiredCheckNames).toEqual(["CI"]);
  });
});
