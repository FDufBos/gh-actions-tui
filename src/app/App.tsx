import { useEffect, useMemo, useReducer, useRef } from "react";
import { useApp, useInput } from "ink";
import { useQueryClient } from "@tanstack/react-query";
import { saveConfig } from "../config/configStore";
import type { CheckCategory } from "../domain/types";
import { createGhClient } from "../github/ghClient";
import { MainScreen } from "../ui/layout/MainScreen";
import { parseRepoInput } from "../utils/repoInput";
import type { DetailData } from "./queries";
import { useBootstrapQuery, useDetailQuery, usePrsQuery, useRollupQueries } from "./queries";
import { initialState, prKey, reducer, rollupCacheKey } from "./state";

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const { exit } = useApp();
  const queryClient = useQueryClient();
  const client = useMemo(() => createGhClient(), []);

  // ── Queries ──────────────────────────────────────────────────

  const bootstrapQuery = useBootstrapQuery(client);
  const viewer = bootstrapQuery.data?.viewer ?? "";

  // Initialise repos / refreshSeconds from config (once)
  const configInitRef = useRef(false);
  useEffect(() => {
    if (bootstrapQuery.data && !configInitRef.current) {
      configInitRef.current = true;
      dispatch({
        type: "init-config",
        repos: bootstrapQuery.data.repos,
        refreshSeconds: bootstrapQuery.data.refreshSeconds,
      });
    }
  }, [bootstrapQuery.data]);

  const prsQuery = usePrsQuery(
    client,
    state.repos,
    viewer,
    state.refreshSeconds,
    !state.repoInputOpen,
  );
  const prs = prsQuery.data ?? [];

  // Keep the selected-index in sync when the PR list changes
  useEffect(() => {
    dispatch({ type: "reconcile-pr-index", prs });
  }, [prs]);

  const selectedPr = useMemo(() => {
    if (!state.selectedPrKey) return undefined;
    return prs.find((item) => prKey(item) === state.selectedPrKey);
  }, [prs, state.selectedPrKey]);

  const rollupQueries = useRollupQueries(client, prs);

  const computedRollups: Partial<Record<string, CheckCategory>> = {};
  for (let i = 0; i < prs.length; i++) {
    const rollup = rollupQueries[i]?.data;
    if (rollup) {
      computedRollups[rollupCacheKey(prs[i]!)] = rollup;
    }
  }

  const detailQuery = useDetailQuery(client, selectedPr);
  const detailData = detailQuery.data;

  // Sync the rollup cache when detail data arrives
  useEffect(() => {
    if (detailData && selectedPr) {
      queryClient.setQueryData(
        ["rollup", selectedPr.owner, selectedPr.repo, selectedPr.headSha],
        detailData.rollupCategory,
      );
    }
  }, [detailData, selectedPr, queryClient]);

  const selectedRollupCategory = useMemo<CheckCategory>(() => {
    if (detailData) return detailData.rollupCategory;
    if (!selectedPr) return "pending";
    return computedRollups[rollupCacheKey(selectedPr)] ?? "pending";
  }, [detailData, selectedPr, computedRollups]);

  // ── Derived loading states ──────────────────────────────────

  const booting =
    bootstrapQuery.isLoading || (bootstrapQuery.isSuccess && !state.configLoaded);
  const loadingOverview = prsQuery.isFetching || rollupQueries.some((q) => q.isFetching);
  const loadingDetail = detailQuery.isFetching;

  // ── Input handling ──────────────────────────────────────────

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
      return;
    }

    if (state.repoInputOpen) {
      if (key.escape) {
        dispatch({ type: "toggle-repo-input", open: false });
        return;
      }
      if (key.return) {
        void saveReposAndRefresh();
        return;
      }
      if (key.backspace || key.delete) {
        dispatch({
          type: "set-repo-input-value",
          value: state.repoInputValue.slice(0, -1),
        });
        return;
      }
      if (input) {
        dispatch({ type: "set-repo-input-value", value: state.repoInputValue + input });
      }
      return;
    }

    if (input === "q") {
      exit();
      return;
    }

    if (input === "s") {
      dispatch({ type: "toggle-repo-input", open: true });
      return;
    }

    if (input === "r") {
      void queryClient.invalidateQueries({ queryKey: ["prs"] });
      void queryClient.invalidateQueries({ queryKey: ["rollup"] });
      if (selectedPr) {
        void queryClient.invalidateQueries({ queryKey: ["detail"] });
      }
      return;
    }

    if (input === "o") {
      if (!selectedPr) return;
      void client.openPrInBrowser(selectedPr.owner, selectedPr.repo, selectedPr.number).catch((error) => {
        dispatch({ type: "set-error", errorText: normalizeError(error) });
      });
      return;
    }

    if (input === "f") {
      void rerunFailedActions();
      return;
    }

    if (key.tab) {
      dispatch({ type: "set-focus", focus: state.focus === "overview" ? "detail" : "overview" });
      return;
    }

    if (state.focus === "overview") {
      if (key.upArrow || input === "k") {
        dispatch({ type: "move-overview-cursor", delta: -1, prCount: prs.length });
      } else if (key.downArrow || input === "j") {
        dispatch({ type: "move-overview-cursor", delta: 1, prCount: prs.length });
      } else if (key.return) {
        dispatch({ type: "select-current-pr", prs });
        // Ensure a fresh detail fetch even when re-selecting the same PR
        void queryClient.invalidateQueries({ queryKey: ["detail"] });
      }
      return;
    }

    if (key.upArrow || input === "k") {
      const listLength = (detailData?.checks.length ?? 0) + (detailData?.runs.length ?? 0);
      dispatch({ type: "move-detail-cursor", delta: -1, listLength });
    } else if (key.downArrow || input === "j") {
      const listLength = (detailData?.checks.length ?? 0) + (detailData?.runs.length ?? 0);
      dispatch({ type: "move-detail-cursor", delta: 1, listLength });
    }
  });

  // ── Save repos ──────────────────────────────────────────────

  async function saveReposAndRefresh() {
    try {
      const repos = parseRepoInput(state.repoInputValue);
      const refreshSeconds = state.refreshSeconds > 0 ? state.refreshSeconds : 5;
      await saveConfig({ repos, refreshSeconds });
      dispatch({ type: "update-repos", repos, refreshSeconds });
      dispatch({ type: "set-info", infoText: "Saved watched repositories" });
    } catch (error) {
      dispatch({ type: "set-error", errorText: normalizeError(error) });
    }
  }

  async function rerunFailedActions() {
    if (!selectedPr) {
      dispatch({ type: "set-info", infoText: "Select a PR to rerun failed actions" });
      return;
    }

    const failedRunIds = (detailData?.runs ?? [])
      .filter((run) => run.category === "failed")
      .map((run) => run.id);

    if (!failedRunIds.length) {
      dispatch({ type: "set-info", infoText: "No failed workflow runs to rerun" });
      return;
    }

    try {
      const requested = await client.rerunFailedWorkflowRuns(selectedPr.owner, selectedPr.repo, failedRunIds);
      const suffix = requested === 1 ? "" : "s";
      dispatch({ type: "set-info", infoText: `Requested rerun for ${requested} failed workflow run${suffix}` });

      const detailKey = ["detail", selectedPr.owner, selectedPr.repo, selectedPr.number] as const;
      const failedRunIdSet = new Set(failedRunIds);
      queryClient.setQueryData<DetailData>(detailKey, (current) => {
        if (!current) return current;
        const runs = current.runs.map((run) => {
          if (!failedRunIdSet.has(run.id)) {
            return run;
          }
          return {
            ...run,
            status: "requested",
            conclusion: "",
            category: "pending" as const,
          };
        });
        return {
          ...current,
          runs,
          rollupCategory: "running",
        };
      });

      void queryClient.invalidateQueries({ queryKey: ["rollup"] });
      void queryClient.invalidateQueries({ queryKey: ["prs"] });
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: detailKey });
      }, 4000);
    } catch (error) {
      dispatch({ type: "set-error", errorText: normalizeError(error) });
    }
  }

  // ── Render ──────────────────────────────────────────────────

  const lastRefreshAt = prsQuery.dataUpdatedAt ? new Date(prsQuery.dataUpdatedAt) : null;

  return (
    <MainScreen
      viewer={viewer}
      repos={state.repos}
      lastRefreshAt={lastRefreshAt}
      loadingOverview={loadingOverview}
      loadingDetail={loadingDetail}
      errorText={state.errorText}
      infoText={state.infoText}
      prs={prs}
      selectedIndex={state.selectedPrIndex}
      selectedPrKey={state.selectedPrKey}
      selectedPr={selectedPr}
      checks={detailData?.checks ?? []}
      runs={detailData?.runs ?? []}
      reviewDecision={detailData?.reviewDecision ?? "UNKNOWN"}
      detailCursor={state.detailCursor}
      focus={state.focus}
      repoInputOpen={state.repoInputOpen}
      repoInputValue={state.repoInputValue}
      rollups={computedRollups}
      booting={booting}
      rollupCategory={selectedRollupCategory}
    />
  );
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
