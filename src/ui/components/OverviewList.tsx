import { Box, Text } from "ink";
import type { CheckCategory, PullRequest } from "../../domain/types";
import { compactRelativeTime } from "../../utils/timers";
import { blendOnBg, colors } from "../theme";
import { statusColor, statusToken } from "./status";

type RollupMap = Partial<Record<string, CheckCategory>>;

type Props = {
  prs: PullRequest[];
  selectedIndex: number;
  selectedPrKey: string | null;
  rollups: RollupMap;
  focused: boolean;
};

export function OverviewList({ prs, selectedIndex, rollups, focused }: Props) {
  if (prs.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1} minHeight={6}>
        <Text color={focused ? colors.dim : colors.border}>No PRs yet. Press s to set watched repositories.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1} minHeight={6}>
      {prs.map((pr, index) => {
        const rollupKey = `${pr.owner}/${pr.repo}@${pr.headSha}`;
        const rollup = rollups[rollupKey];
        const dotColor = rollup ? statusColor(rollup) : colors.dim;
        const isCursor = index === selectedIndex;
        const isFocused = focused;
        const cursor = isCursor ? ">" : " ";
        const rowColor = isFocused ? (isCursor ? colors.text : colors.dim) : colors.border;
        const rowDotColor = isFocused ? dotColor : blendOnBg(dotColor, 0.2);
        const time = compactRelativeTime(pr.updatedAt);
        const draftTag = pr.draft ? "[draft] " : "";

        return (
          <Box key={`${pr.owner}/${pr.repo}#${pr.number}`}>
            <Text color={rowColor}>
              {cursor}{"  "}
            </Text>
            <Text color={rowDotColor}>{statusToken("pending")}</Text>
            <Text>{" "}</Text>
            <Box flexGrow={1}>
              <Text color={rowColor}>
                {draftTag}{pr.title}
              </Text>
            </Box>
            <Text color={isFocused ? colors.dim : colors.border}>{" "}{time}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
