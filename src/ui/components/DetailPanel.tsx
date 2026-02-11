import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { displayRank, summaryByCategory } from "../../domain/rollup";
import type { Check, CheckCategory, PullRequest, ReviewDecision } from "../../domain/types";
import { colors } from "../theme";
import { ProgressBar } from "./ProgressBar";
import { reviewColor, reviewLabel, statusColor, statusToken } from "./status";

type Props = {
  selectedPr: PullRequest | undefined;
  checks: Check[];
  runs: import("../../domain/types").WorkflowRun[];
  reviewDecision: ReviewDecision;
  loading: boolean;
  focused: boolean;
  tab: "checks" | "runs";
  cursor: number;
  rollupCategory: import("../../domain/types").CheckCategory;
};

const MAX_VISIBLE = 12;

export function DetailPanel(props: Props) {
  if (!props.selectedPr) {
    return (
      <Box flexDirection="column" paddingX={1} minHeight={4}>
        <Text color={colors.dim}>Select a PR and press enter to load details.</Text>
      </Box>
    );
  }

  const pr = props.selectedPr;

  // Combined summary across checks AND runs so the progress bar reflects everything
  const allItems: { category: CheckCategory }[] = [...props.checks, ...props.runs];
  const summary = summaryByCategory(allItems);

  const listItems: DetailRow[] = (
    props.tab === "checks"
      ? props.checks.map((check, i) => ({
          key: `check-${check.name}-${i}`,
          label: check.name,
          category: check.category,
          required: check.required,
        }))
      : props.runs.map((run, i) => ({
          key: `run-${run.id}-${i}`,
          label: `${run.displayName || run.name} (#${run.id})`,
          category: run.category,
          required: false,
        }))
  ).sort((a, b) => displayRank(a.category) - displayRank(b.category));

  const safeCursor = Math.max(0, Math.min(props.cursor, Math.max(0, listItems.length - 1)));
  const inProgressCount = summary.running + summary.queued + summary.pending;

  const chartSegments = [
    { value: inProgressCount, color: colors.yellow },
    { value: summary.failed, color: colors.red },
    { value: summary.passed, color: colors.green },
    { value: summary.skipped + summary.cancelled, color: colors.border },
  ];

  // Windowed slice for the visible list
  const windowStart = Math.max(0, Math.min(safeCursor - Math.floor(MAX_VISIBLE / 2), listItems.length - MAX_VISIBLE));
  const visibleStart = Math.max(0, windowStart);
  const visibleItems = listItems.slice(visibleStart, visibleStart + MAX_VISIBLE);
  const hiddenBelow = Math.max(0, listItems.length - (visibleStart + MAX_VISIBLE));

  const rvLabel = reviewLabel(props.reviewDecision);
  const rvColor = reviewColor(props.reviewDecision);

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header row — PR title + review + open link */}
      <Box>
        <Text color={statusColor(props.rollupCategory)}>{statusToken(props.rollupCategory)}</Text>
        <Text>{" "}</Text>
        <Text color={colors.text} bold>
          {pr.title}
        </Text>
        {rvLabel ? (
          <Text>
            {"  "}
            <Text color={rvColor}>{rvLabel}</Text>
          </Text>
        ) : null}
        <Box flexGrow={1} />
        <Text color={colors.dim}>[o] open in Github</Text>
      </Box>

      {/* Progress bar */}
      <Box height={1} />
      <ProgressBar segments={chartSegments} />

      {/* Check list */}
      <Box flexDirection="column" marginTop={1}>
        {props.loading && listItems.length === 0 ? (
          <Text color={colors.dim}>
            <Spinner type="dots" /> loading…
          </Text>
        ) : listItems.length === 0 ? (
          <Text color={colors.dim}>No data for this tab.</Text>
        ) : (
          visibleItems.map((item) => {
            const isSelected = listItems.indexOf(item) === safeCursor;
            return (
              <Box key={item.key}>
                <Text color={isSelected ? colors.text : undefined}>
                  <Text color={statusColor(item.category)}>{statusToken(item.category)}</Text>
                  <Text color={isSelected ? colors.text : colors.dim}> {item.label}</Text>
                </Text>
                <Box flexGrow={1} />
                {item.required ? <Text color={colors.dim}>Required</Text> : null}
              </Box>
            );
          })
        )}
        {hiddenBelow > 0 ? (
          <Text color={colors.dim}>{"  \u02C5 "}{hiddenBelow} more</Text>
        ) : null}
      </Box>
    </Box>
  );
}

type DetailRow = {
  key: string;
  label: string;
  category: Check["category"];
  required: boolean;
};
