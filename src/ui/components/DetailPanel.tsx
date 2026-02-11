import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { displayRank, summaryByCategory } from "../../domain/rollup";
import type { Check, CheckCategory, PullRequest, ReviewDecision } from "../../domain/types";
import { blendOnBg, colors } from "../theme";
import { ProgressBar } from "./ProgressBar";
import { reviewColor, reviewLabel, statusColor, statusToken } from "./status";

type Props = {
  selectedPr: PullRequest | undefined;
  checks: Check[];
  runs: import("../../domain/types").WorkflowRun[];
  reviewDecision: ReviewDecision;
  loading: boolean;
  focused: boolean;
  cursor: number;
  rollupCategory: import("../../domain/types").CheckCategory;
};

const MAX_VISIBLE = 12;

export function DetailPanel(props: Props) {
  const isFocused = props.focused;

  if (!props.selectedPr) {
    return (
      <Box flexDirection="column" paddingX={1} minHeight={4}>
        <Text color={isFocused ? colors.dim : colors.border}>Select a PR and press enter to load details.</Text>
      </Box>
    );
  }

  const pr = props.selectedPr;

  // Combined summary across checks AND runs so the progress bar reflects everything
  const allItems: { category: CheckCategory }[] = [...props.checks, ...props.runs];
  const summary = summaryByCategory(allItems);

  const listItems: DetailRow[] = [
    ...props.checks.map((check, i) => ({
      key: `check-${check.name}-${i}`,
      label: check.name,
      category: check.category,
      required: check.required,
    })),
    ...props.runs.map((run, i) => ({
      key: `run-${run.id}-${i}`,
      label: `${run.displayName || run.name} (#${run.id})`,
      category: run.category,
      required: false,
    })),
  ].sort((a, b) => displayRank(a.category) - displayRank(b.category));

  const safeCursor = Math.max(0, Math.min(props.cursor, Math.max(0, listItems.length - 1)));
  const inProgressCount = summary.running + summary.queued + summary.pending;
  const faded = (color: string) => blendOnBg(color, 0.2);

  const chartSegments = [
    { value: inProgressCount, color: isFocused ? colors.yellow : faded(colors.yellow) },
    { value: summary.failed, color: isFocused ? colors.red : faded(colors.red) },
    { value: summary.passed, color: isFocused ? colors.green : faded(colors.green) },
    { value: summary.skipped + summary.cancelled, color: isFocused ? colors.border : faded(colors.border) },
  ];

  // Windowed slice for the visible list
  const windowStart = Math.max(0, Math.min(safeCursor - Math.floor(MAX_VISIBLE / 2), listItems.length - MAX_VISIBLE));
  const visibleStart = Math.max(0, windowStart);
  const visibleItems = listItems.slice(visibleStart, visibleStart + MAX_VISIBLE);
  const hiddenBelow = Math.max(0, listItems.length - (visibleStart + MAX_VISIBLE));

  const rvLabel = reviewLabel(props.reviewDecision);
  const rvColor = reviewColor(props.reviewDecision);
  const headerColor = isFocused ? colors.text : colors.border;
  const linkColor = isFocused ? colors.dim : colors.border;
  const rollupBaseColor = statusColor(props.rollupCategory);
  const rollupTokenColor = isFocused ? rollupBaseColor : faded(rollupBaseColor);

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header row — PR title + review + open link */}
      <Box>
        <Text color={rollupTokenColor}>{statusToken(props.rollupCategory)}</Text>
        <Text>{" "}</Text>
        <Text color={headerColor} bold={isFocused}>
          {pr.title}
        </Text>
        {rvLabel ? (
          <Text>
            {"  "}
            <Text color={isFocused ? rvColor : faded(rvColor)}>{rvLabel}</Text>
          </Text>
        ) : null}
        <Box flexGrow={1} />
        <Text color={linkColor}>[o] Open PR</Text>
      </Box>

      {/* Progress bar */}
      <Box height={1} />
      <ProgressBar segments={chartSegments} />

      {/* Check list */}
      <Box flexDirection="column" marginTop={1}>
        {props.loading && listItems.length === 0 ? (
          <Text color={isFocused ? colors.dim : colors.border}>
            <Spinner type="dots" /> loading…
          </Text>
        ) : listItems.length === 0 ? (
          <Text color={isFocused ? colors.dim : colors.border}>No checks or workflow runs yet.</Text>
        ) : (
          visibleItems.map((item) => {
            const isSelected = isFocused && listItems.indexOf(item) === safeCursor;
            const itemBaseColor = statusColor(item.category);
            const itemStatusColor = isFocused ? itemBaseColor : faded(itemBaseColor);
            const itemLabelColor = isFocused ? (isSelected ? colors.text : colors.dim) : colors.border;
            return (
              <Box key={item.key}>
                <Text color={isSelected ? colors.text : undefined}>
                  <Text color={itemStatusColor}>{statusToken(item.category)}</Text>
                  <Text color={itemLabelColor}> {item.label}</Text>
                </Text>
                <Box flexGrow={1} />
                {item.required ? <Text color={isFocused ? colors.dim : colors.border}>Required</Text> : null}
              </Box>
            );
          })
        )}
        {hiddenBelow > 0 ? (
          <Text color={isFocused ? colors.dim : colors.border}>{"  \u02C5 "}{hiddenBelow} more</Text>
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
