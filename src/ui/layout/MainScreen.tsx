import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { CheckCategory, PullRequest, ReviewDecision } from "../../domain/types";
import { colors, MAX_TUI_WIDTH_CHARS } from "../theme";
import { Border } from "../components/Border";
import { DetailPanel } from "../components/DetailPanel";
import { Logo } from "../components/Logo";
import { OverviewList } from "../components/OverviewList";
import { StatusBar } from "../components/StatusBar";

type Props = {
  viewer: string;
  repos: string[];
  lastRefreshAt: Date | null;
  loadingOverview: boolean;
  loadingDetail: boolean;
  errorText: string;
  infoText: string;
  prs: PullRequest[];
  selectedIndex: number;
  selectedPrKey: string | null;
  selectedPr: PullRequest | undefined;
  checks: import("../../domain/types").Check[];
  runs: import("../../domain/types").WorkflowRun[];
  reviewDecision: ReviewDecision;
  detailTab: "checks" | "runs";
  detailCursor: number;
  focus: "overview" | "detail";
  repoInputOpen: boolean;
  repoInputValue: string;
  rollups: Partial<Record<string, CheckCategory>>;
  booting: boolean;
  rollupCategory: CheckCategory;
};

/* ─── Full-screen: Repo input ─────────────────────────────────── */

function RepoInputScreen({ value }: { value: string }) {
  const rows = process.stdout.rows ?? 24;
  const topPad = Math.max(1, Math.floor((rows - 6) / 2));
  const width = Math.min(process.stdout.columns ?? MAX_TUI_WIDTH_CHARS, MAX_TUI_WIDTH_CHARS);

  return (
    <Box width="100%" height={rows}>
      <Box flexDirection="column" width={width} height={rows}>
        <Border width={width} />
        <Box flexDirection="column" height={topPad} />
        <Box justifyContent="center">
          <Text color={colors.text}>Enter repo to watch</Text>
        </Box>
        <Box height={1} />
        <Box justifyContent="center">
          <Text color={colors.text}>{">"} </Text>
          <Text color={value ? colors.text : colors.dim}>{value || "org/repo"}</Text>
        </Box>
        <Box flexGrow={1} />
        <Border width={width} />
      </Box>
    </Box>
  );
}

/* ─── Full-screen: Splash / loading ───────────────────────────── */

function SplashScreen({ message }: { message: string }) {
  const rows = process.stdout.rows ?? 24;
  const topPad = Math.max(1, Math.floor((rows - 12) / 2));
  const width = Math.min(process.stdout.columns ?? MAX_TUI_WIDTH_CHARS, MAX_TUI_WIDTH_CHARS);

  return (
    <Box width="100%" height={rows}>
      <Box flexDirection="column" width={width} height={rows}>
        <Border width={width} />
        <Box flexDirection="column" height={topPad} />
        <Logo />
        <Box height={1} />
        <Box justifyContent="center">
          <Text color={colors.dim}>
            <Spinner type="dots" /> {message}
          </Text>
        </Box>
        <Box flexGrow={1} />
        <Border width={width} />
      </Box>
    </Box>
  );
}

/* ─── Main view (PR list + detail) ────────────────────────────── */

export function MainScreen(props: Props) {
  const width = Math.min(process.stdout.columns ?? MAX_TUI_WIDTH_CHARS, MAX_TUI_WIDTH_CHARS);

  // Full-screen: repo input
  if (props.repoInputOpen) {
    return <RepoInputScreen value={props.repoInputValue} />;
  }

  // Full-screen: splash while booting / initial fetch
  if (props.booting || (props.loadingOverview && props.prs.length === 0 && props.repos.length > 0)) {
    return <SplashScreen message="Fetching PRs" />;
  }

  // Normal dashboard
  return (
    <Box width="100%">
      <Box flexDirection="column" width={width} paddingTop={2} paddingLeft={3}>
        <StatusBar
          repos={props.repos}
          lastRefreshAt={props.lastRefreshAt}
          loadingOverview={props.loadingOverview}
          loadingDetail={props.loadingDetail}
        />
        <Box height={1} />
        <OverviewList
          prs={props.prs}
          selectedIndex={props.selectedIndex}
          selectedPrKey={props.selectedPrKey}
          rollups={props.rollups}
          focused={props.focus === "overview" && !props.repoInputOpen}
        />
        <Box height={1} />
        <Border width={width} />
        <Box height={1} />
        <DetailPanel
          selectedPr={props.selectedPr}
          checks={props.checks}
          runs={props.runs}
          reviewDecision={props.reviewDecision}
          loading={props.loadingDetail}
          focused={props.focus === "detail" && !props.repoInputOpen}
          tab={props.detailTab}
          cursor={props.detailCursor}
          rollupCategory={props.rollupCategory}
        />
      </Box>
    </Box>
  );
}
