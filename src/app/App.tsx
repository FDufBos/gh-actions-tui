import { useEffect, useMemo, useReducer, useRef } from "react";
import { useApp, useInput, useStdin } from "ink";
import { useQueryClient } from "@tanstack/react-query";
import { saveConfig } from "../config/configStore";
import type { CheckCategory } from "../domain/types";
import { createGhClient } from "../github/ghClient";
import { MainScreen } from "../ui/layout/MainScreen";
import { computeOverviewTitleLines } from "../ui/components/OverviewList";
import { MAX_TUI_WIDTH_CHARS } from "../ui/theme";
import { parseRepoInput } from "../utils/repoInput";
import type { DetailData } from "./queries";
import { useBootstrapQuery, useDetailQuery, usePrsQuery, useRollupQueries } from "./queries";
import { initialState, prKey, reducer, rollupCacheKey } from "./state";

const REFRESH_SECONDS = 15;
const MAIN_PADDING_TOP = 2;
const MAIN_PADDING_LEFT = 3;
const MAX_DETAIL_VISIBLE = 12;
const DETAIL_PANEL_HEIGHT = 17;
const WHEEL_STEP_MIN_INTERVAL_MS = 55;
const RERUN_FAILED_LABEL = "[f] Rerun failed";
const OPEN_PR_LABEL = "[o] Open PR";
const DETAIL_HINT_SEPARATOR = "  |  ";
const OVERVIEW_PREFIX_WIDTH = 2;
const OVERVIEW_TIME_WIDTH = 7;

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const { exit } = useApp();
  const { stdin } = useStdin();
  const lastWheelAtRef = useRef(0);
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
        refreshSeconds: REFRESH_SECONDS,
      });
    }
  }, [bootstrapQuery.data]);

  const prsQuery = usePrsQuery(
    client,
    state.repos,
    viewer,
    REFRESH_SECONDS,
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
        dispatch({ type: "set-focus", focus: "detail" });
        // Ensure a fresh detail fetch even when re-selecting the same PR
        void queryClient.invalidateQueries({ queryKey: ["detail"] });
      }
      return;
    }

    if (key.upArrow || input === "k") {
      const listLength = detailData?.checks.length ?? 0;
      dispatch({ type: "move-detail-cursor", delta: -1, listLength });
    } else if (key.downArrow || input === "j") {
      const listLength = detailData?.checks.length ?? 0;
      dispatch({ type: "move-detail-cursor", delta: 1, listLength });
    }
  });

  // ── Save repos ──────────────────────────────────────────────

  async function saveReposAndRefresh() {
    try {
      const repos = parseRepoInput(state.repoInputValue);
      const refreshSeconds = REFRESH_SECONDS;
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

  const latestRefreshTs = Math.max(prsQuery.dataUpdatedAt ?? 0, detailQuery.dataUpdatedAt ?? 0);
  const lastRefreshAt = latestRefreshTs > 0 ? new Date(latestRefreshTs) : null;

  useEffect(() => {
    if (!process.stdout.isTTY) return;
    process.stdout.write("\u001B[?1000h\u001B[?1006h");
    return () => {
      process.stdout.write("\u001B[?1000l\u001B[?1006l");
    };
  }, []);

  useEffect(() => {
    const onData = (chunk: Buffer | string) => {
      const input = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      const events = parseMouseEvents(input);
      if (!events.length) return;

      for (const event of events) {
        if (event.kind === "left_release") {
          handleMouseClick(event.x, event.y);
          continue;
        }
        if (event.kind === "wheel_up" || event.kind === "wheel_down") {
          handleMouseWheel(event.x, event.y, event.kind);
        }
      }
    };

    stdin.on("data", onData);
    return () => {
      stdin.off("data", onData);
    };
  }, [stdin, prs, checksLength(detailData), selectedPr, state.focus, state.errorText, state.infoText, state.detailCursor, booting, state.repoInputOpen]);

  function handleMouseClick(x: number, y: number) {
    if (state.repoInputOpen || booting) return;

    const totalWidth = Math.min(process.stdout.columns ?? MAX_TUI_WIDTH_CHARS, MAX_TUI_WIDTH_CHARS);
    const contentWidth = Math.max(1, totalWidth - MAIN_PADDING_LEFT);
    const hasBanner = Boolean(state.errorText || state.infoText);
    const overviewHeights = getOverviewHeights(prs, totalWidth);
    const overviewHeight = Math.max(
      6,
      prs.length > 0 ? overviewHeights.reduce((sum, height) => sum + height, 0) : 1,
    );

    const statusBarY = 1 + MAIN_PADDING_TOP;
    const bannerY = statusBarY + 1;
    const overviewStartY = (hasBanner ? bannerY + 1 : statusBarY + 1) + 1;
    const overviewEndY = overviewStartY + overviewHeight - 1;
    const detailStartY = overviewEndY + 4;

    const isOverviewClick = y >= overviewStartY && y <= overviewEndY;
    if (isOverviewClick) {
      const clickedOverviewLine = findOverviewLineForY(y, overviewStartY, overviewHeights);
      const wasOverviewFocused = state.focus === "overview";
      if (!wasOverviewFocused) {
        dispatch({ type: "set-focus", focus: "overview" });
        return;
      }
      if (clickedOverviewLine) {
        const isRowTextClick = isOverviewRowTextClick(
          x,
          clickedOverviewLine,
          prs,
          totalWidth,
        );
        if (isRowTextClick) {
          dispatch({ type: "select-pr-at-index", index: clickedOverviewLine.rowIndex, prs });
          dispatch({ type: "set-focus", focus: "detail" });
          void queryClient.invalidateQueries({ queryKey: ["detail"] });
          return;
        }
        dispatch({ type: "set-focus", focus: "overview" });
      } else {
        dispatch({ type: "set-focus", focus: "overview" });
      }
      return;
    }

    const detailHeight = DETAIL_PANEL_HEIGHT;
    const detailEndY = detailStartY + detailHeight - 1;
    const isDetailClick = y >= detailStartY && y <= detailEndY;
    if (!isDetailClick) return;

    const isOpenPrClick =
      selectedPr !== undefined &&
      y === detailStartY &&
      (() => {
        const fullHints = `${RERUN_FAILED_LABEL}${DETAIL_HINT_SEPARATOR}${OPEN_PR_LABEL}`;
        const hintsStartX = MAIN_PADDING_LEFT + contentWidth - fullHints.length;
        const rerunStartX = hintsStartX;
        const rerunEndX = rerunStartX + RERUN_FAILED_LABEL.length - 1;
        const openStartX = hintsStartX + (fullHints.length - OPEN_PR_LABEL.length);
        const openEndX = openStartX + OPEN_PR_LABEL.length - 1;

        if (x >= rerunStartX && x <= rerunEndX) {
          void rerunFailedActions();
          return true;
        }
        if (x >= openStartX && x <= openEndX) {
          void client.openPrInBrowser(selectedPr.owner, selectedPr.repo, selectedPr.number).catch((error) => {
            dispatch({ type: "set-error", errorText: normalizeError(error) });
          });
          return true;
        }
        return false;
      })();
    if (isOpenPrClick) {
      return;
    }

    const wasDetailFocused = state.focus === "detail";
    dispatch({ type: "set-focus", focus: "detail" });
    if (!wasDetailFocused || !selectedPr) return;

    const checksLen = checksLength(detailData);
    const detailIndex = findDetailIndexForLine(y, detailStartY, checksLen, state.detailCursor);
    if (detailIndex >= 0) {
      dispatch({ type: "set-detail-cursor", index: detailIndex, listLength: checksLen });
    }
  }

  function handleMouseWheel(x: number, y: number, direction: "wheel_up" | "wheel_down") {
    if (state.repoInputOpen || booting) return;
    const now = Date.now();
    if (now - lastWheelAtRef.current < WHEEL_STEP_MIN_INTERVAL_MS) {
      return;
    }
    lastWheelAtRef.current = now;

    const totalWidth = Math.min(process.stdout.columns ?? MAX_TUI_WIDTH_CHARS, MAX_TUI_WIDTH_CHARS);
    const hasBanner = Boolean(state.errorText || state.infoText);
    const overviewHeights = getOverviewHeights(prs, totalWidth);
    const overviewHeight = Math.max(
      6,
      prs.length > 0 ? overviewHeights.reduce((sum, height) => sum + height, 0) : 1,
    );

    const statusBarY = 1 + MAIN_PADDING_TOP;
    const bannerY = statusBarY + 1;
    const overviewStartY = (hasBanner ? bannerY + 1 : statusBarY + 1) + 1;
    const overviewEndY = overviewStartY + overviewHeight - 1;
    const detailStartY = overviewEndY + 4;
    const detailEndY = detailStartY + DETAIL_PANEL_HEIGHT - 1;
    const delta = direction === "wheel_up" ? -1 : 1;

    if (y >= overviewStartY && y <= overviewEndY) {
      dispatch({ type: "set-focus", focus: "overview" });
      dispatch({ type: "move-overview-cursor", delta, prCount: prs.length });
      return;
    }

    if (y >= detailStartY && y <= detailEndY) {
      dispatch({ type: "set-focus", focus: "detail" });
      dispatch({ type: "move-detail-cursor", delta, listLength: checksLength(detailData) });
      return;
    }
    // Keep x consumed to make intent explicit and avoid lint noise.
    void x;
  }

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

function parseMouseEvents(input: string): MouseEvent[] {
  const events: MouseEvent[] = [];
  const pattern = /\u001B\[<(\d+);(\d+);(\d+)([mM])/g;
  for (const match of input.matchAll(pattern)) {
    const code = Number.parseInt(match[1] ?? "", 10);
    const x = Number.parseInt(match[2] ?? "", 10);
    const y = Number.parseInt(match[3] ?? "", 10);
    const suffix = match[4];
    if (!Number.isFinite(code) || !Number.isFinite(x) || !Number.isFinite(y) || !suffix) continue;
    const isWheel = (code & 0b1000000) !== 0;
    if (isWheel) {
      events.push({
        kind: (code & 0b1) === 0 ? "wheel_up" : "wheel_down",
        x,
        y,
      });
      continue;
    }

    const isLeftButton = (code & 0b11) === 0;
    if (isLeftButton && suffix === "m") {
      events.push({
        kind: "left_release",
        x,
        y,
      });
    }
  }
  return events;
}

function getOverviewHeights(prs: import("../domain/types").PullRequest[], totalWidth: number): number[] {
  if (!prs.length) return [];
  const listWidth = Math.max(20, totalWidth - 5);
  const firstWidth = Math.max(10, listWidth - OVERVIEW_PREFIX_WIDTH - OVERVIEW_TIME_WIDTH);
  const nextWidth = Math.max(10, listWidth - OVERVIEW_PREFIX_WIDTH);
  return prs.map((pr) => {
    const draftTag = pr.draft ? "[draft] " : "";
    const lines = computeOverviewTitleLines(`${draftTag}${pr.title}`, firstWidth, nextWidth);
    return Math.max(1, lines.length);
  });
}

function findOverviewLineForY(
  lineY: number,
  overviewStartY: number,
  rowHeights: number[],
): { rowIndex: number; lineOffset: number } | null {
  let cursorY = overviewStartY;
  for (let i = 0; i < rowHeights.length; i++) {
    const rowHeight = rowHeights[i] ?? 1;
    if (lineY >= cursorY && lineY <= cursorY + rowHeight - 1) {
      return { rowIndex: i, lineOffset: lineY - cursorY };
    }
    cursorY += rowHeight;
  }
  return null;
}

function isOverviewRowTextClick(
  clickX: number,
  line: { rowIndex: number; lineOffset: number },
  prs: import("../domain/types").PullRequest[],
  totalWidth: number,
): boolean {
  const pr = prs[line.rowIndex];
  if (!pr) return false;

  const listWidth = Math.max(20, totalWidth - 5);
  const firstWidth = Math.max(10, listWidth - OVERVIEW_PREFIX_WIDTH - OVERVIEW_TIME_WIDTH);
  const nextWidth = Math.max(10, listWidth - OVERVIEW_PREFIX_WIDTH);
  const draftTag = pr.draft ? "[draft] " : "";
  const titleLines = computeOverviewTitleLines(`${draftTag}${pr.title}`, firstWidth, nextWidth);
  const lineText = titleLines[line.lineOffset] ?? "";

  // MainScreen paddingLeft(3) + OverviewList paddingX left(1) + 1-indexed terminal column.
  const contentStartX = MAIN_PADDING_LEFT + 2;
  const mainTitleStartX = contentStartX + OVERVIEW_PREFIX_WIDTH;

  if (line.lineOffset === 0) {
    const dotStartX = contentStartX;
    const dotEndX = contentStartX + OVERVIEW_PREFIX_WIDTH - 1;
    if (clickX >= dotStartX && clickX <= dotEndX) return true;

    const titleEndX = mainTitleStartX + Math.max(0, lineText.length - 1);
    if (lineText.length > 0 && clickX >= mainTitleStartX && clickX <= titleEndX) return true;

    const timeStartX = contentStartX + listWidth - OVERVIEW_TIME_WIDTH;
    const timeEndX = contentStartX + listWidth - 1;
    return clickX >= timeStartX && clickX <= timeEndX;
  }

  const continuationStartX = contentStartX + OVERVIEW_PREFIX_WIDTH;
  const continuationEndX = continuationStartX + Math.max(0, lineText.length - 1);
  return lineText.length > 0 && clickX >= continuationStartX && clickX <= continuationEndX;
}

function checksLength(detailData: DetailData | undefined): number {
  return detailData?.checks.length ?? 0;
}

function findDetailIndexForLine(
  lineY: number,
  detailStartY: number,
  checksLen: number,
  detailCursor: number,
): number {
  if (!checksLen) return -1;
  const safeCursor = Math.max(0, Math.min(detailCursor, Math.max(0, checksLen - 1)));
  const windowStart = Math.max(0, Math.min(safeCursor - Math.floor(MAX_DETAIL_VISIBLE / 2), checksLen - MAX_DETAIL_VISIBLE));
  const visibleStart = Math.max(0, windowStart);
  const visibleItems = Math.min(MAX_DETAIL_VISIBLE, checksLen - visibleStart);
  const firstItemY = detailStartY + 4;
  const lastItemY = firstItemY + visibleItems - 1;
  if (lineY < firstItemY || lineY > lastItemY) return -1;
  return visibleStart + (lineY - firstItemY);
}

type MouseEvent = {
  kind: "left_release" | "wheel_up" | "wheel_down";
  x: number;
  y: number;
};
