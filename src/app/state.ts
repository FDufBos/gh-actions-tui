import type { PullRequest } from "../domain/types";

export type DetailTab = "checks" | "runs";
export type FocusArea = "overview" | "detail";

export type AppState = {
  configLoaded: boolean;
  repos: string[];
  refreshSeconds: number;
  selectedPrIndex: number;
  selectedPrKey: string | null;
  detailTab: DetailTab;
  focus: FocusArea;
  detailCursor: number;
  repoInputOpen: boolean;
  repoInputValue: string;
  infoText: string;
  errorText: string;
};

export type AppAction =
  | { type: "init-config"; repos: string[]; refreshSeconds: number }
  | { type: "set-info"; infoText: string }
  | { type: "set-error"; errorText: string }
  | { type: "move-overview-cursor"; delta: number; prCount: number }
  | { type: "toggle-repo-input"; open: boolean }
  | { type: "set-repo-input-value"; value: string }
  | { type: "set-focus"; focus: FocusArea }
  | { type: "set-detail-tab"; tab: DetailTab }
  | { type: "move-detail-cursor"; delta: number; listLength: number }
  | { type: "select-current-pr"; prs: PullRequest[] }
  | { type: "update-repos"; repos: string[]; refreshSeconds: number }
  | { type: "reconcile-pr-index"; prs: PullRequest[] };

export function initialState(): AppState {
  return {
    configLoaded: false,
    repos: [],
    refreshSeconds: 5,
    selectedPrIndex: 0,
    selectedPrKey: null,
    detailTab: "checks",
    focus: "overview",
    detailCursor: 0,
    repoInputOpen: false,
    repoInputValue: "",
    infoText: "",
    errorText: "",
  };
}

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "init-config":
      return {
        ...state,
        configLoaded: true,
        repos: action.repos,
        refreshSeconds: action.refreshSeconds,
        repoInputValue: action.repos.join(", "),
        repoInputOpen: action.repos.length === 0,
        infoText: action.repos.length
          ? `Loaded ${action.repos.length} watched repos`
          : "",
      };
    case "set-info":
      return { ...state, infoText: action.infoText };
    case "set-error":
      return { ...state, errorText: action.errorText };
    case "move-overview-cursor": {
      if (!action.prCount) return state;
      const nextIndex = clamp(state.selectedPrIndex + action.delta, 0, action.prCount - 1);
      return { ...state, selectedPrIndex: nextIndex };
    }
    case "toggle-repo-input":
      return {
        ...state,
        repoInputOpen: action.open,
        repoInputValue: action.open ? state.repos.join(", ") : state.repoInputValue,
      };
    case "set-repo-input-value":
      return { ...state, repoInputValue: action.value };
    case "set-focus":
      return { ...state, focus: action.focus };
    case "set-detail-tab":
      return { ...state, detailTab: action.tab, detailCursor: 0 };
    case "move-detail-cursor": {
      if (!action.listLength) return state;
      const next = clamp(state.detailCursor + action.delta, 0, action.listLength - 1);
      return { ...state, detailCursor: next };
    }
    case "select-current-pr": {
      const selected = action.prs[state.selectedPrIndex];
      if (!selected) return state;
      return {
        ...state,
        selectedPrKey: prKey(selected),
        detailCursor: 0,
      };
    }
    case "update-repos":
      return {
        ...state,
        repos: action.repos,
        refreshSeconds: action.refreshSeconds,
        repoInputOpen: false,
        repoInputValue: action.repos.join(", "),
        selectedPrIndex: 0,
        selectedPrKey: null,
      };
    case "reconcile-pr-index": {
      const { prs } = action;
      if (!prs.length) {
        return state.selectedPrIndex === 0 ? state : { ...state, selectedPrIndex: 0 };
      }
      let nextIndex = state.selectedPrIndex;
      if (state.selectedPrKey) {
        const match = prs.findIndex((item) => prKey(item) === state.selectedPrKey);
        if (match >= 0) {
          nextIndex = match;
        } else {
          nextIndex = Math.min(state.selectedPrIndex, prs.length - 1);
        }
      } else {
        nextIndex = Math.min(state.selectedPrIndex, prs.length - 1);
      }
      return nextIndex === state.selectedPrIndex ? state : { ...state, selectedPrIndex: nextIndex };
    }
    default:
      return state;
  }
}

export function prKey(pr: PullRequest): string {
  return `${pr.owner}/${pr.repo}#${pr.number}`;
}

export function rollupCacheKey(pr: PullRequest): string {
  return `${pr.owner}/${pr.repo}@${pr.headSha}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
