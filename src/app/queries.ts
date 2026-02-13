import { useQueries, useQuery } from "@tanstack/react-query";
import { loadConfig } from "../config/configStore";
import { rollupFromChecksAndRuns } from "../domain/rollup";
import type { Check, CheckCategory, PullRequest, ReviewDecision, WorkflowRun } from "../domain/types";
import type { GhClient } from "../github/ghClient";

const ROLLUP_STALE_MS = 20_000;

/* ─── Bootstrap: viewer + config in one round-trip ────────── */

export function useBootstrapQuery(client: GhClient) {
  return useQuery({
    queryKey: ["bootstrap"],
    queryFn: async () => {
      const [viewer, config] = await Promise.all([client.getViewer(), loadConfig()]);
      return {
        viewer,
        repos: config.repos,
        refreshSeconds: config.refreshSeconds > 0 ? config.refreshSeconds : 5,
      };
    },
    staleTime: Infinity,
    retry: 2,
  });
}

/* ─── PR list with polling ────────────────────────────────── */

export function usePrsQuery(
  client: GhClient,
  repos: string[],
  viewer: string,
  refreshSeconds: number,
  pollingEnabled: boolean,
) {
  return useQuery({
    queryKey: ["prs", repos, viewer] as const,
    queryFn: () => client.listAuthoredPrsForIdentifiers(repos, viewer),
    enabled: !!viewer && repos.length > 0,
    refetchInterval: pollingEnabled ? refreshSeconds * 1000 : false,
  });
}

/* ─── Rollup per PR (stale-while-revalidate) ──────────────── */

export function useRollupQueries(client: GhClient, prs: PullRequest[]) {
  return useQueries({
    queries: prs.map((pr) => ({
      queryKey: ["rollup", pr.owner, pr.repo, pr.headSha] as const,
      queryFn: async (): Promise<CheckCategory> => {
        const [checks, runs] = await Promise.all([
          client.getChecksForHeadSha(pr.owner, pr.repo, pr.headSha),
          client.getWorkflowRunsForHeadSha(pr.owner, pr.repo, pr.headSha),
        ]);
        return rollupFromChecksAndRuns(checks, runs);
      },
      staleTime: ROLLUP_STALE_MS,
      retry: 1,
    })),
  });
}

/* ─── Detail data for the selected PR ─────────────────────── */

export type DetailData = {
  checks: Check[];
  runs: WorkflowRun[];
  reviewDecision: ReviewDecision;
  rollupCategory: CheckCategory;
};

export function useDetailQuery(client: GhClient, selectedPr: PullRequest | undefined) {
  return useQuery<DetailData>({
    queryKey: selectedPr
      ? ["detail", selectedPr.owner, selectedPr.repo, selectedPr.number]
      : ["detail"],
    queryFn: async (): Promise<DetailData> => {
      if (!selectedPr) throw new Error("No PR selected");
      const [checks, runs, meta] = await Promise.all([
        client.getPrChecks(selectedPr.owner, selectedPr.repo, selectedPr.number),
        client.getPrWorkflowRuns(selectedPr.owner, selectedPr.repo, selectedPr.number),
        client.getPrDetailMeta(selectedPr.owner, selectedPr.repo, selectedPr.number),
      ]);
      const checksWithRequired = markRequiredChecks(checks, meta.requiredCheckNames);
      const rollupCategory = rollupFromChecksAndRuns(checksWithRequired, runs);
      return { checks: checksWithRequired, runs, reviewDecision: meta.reviewDecision, rollupCategory };
    },
    enabled: !!selectedPr,
    refetchInterval: 15_000,
    staleTime: 0,
    retry: 1,
  });
}

/* ─── Helpers ─────────────────────────────────────────────── */

function markRequiredChecks(checks: Check[], requiredCheckNames: string[]): Check[] {
  if (!requiredCheckNames.length) return checks;
  const requiredSet = new Set(requiredCheckNames.map((name) => name.trim()).filter(Boolean));
  return checks.map((check) => {
    const statusContextPrefix = check.name.split(" - ")[0] ?? check.name;
    const required = requiredSet.has(check.name) || requiredSet.has(statusContextPrefix);
    return { ...check, required };
  });
}
