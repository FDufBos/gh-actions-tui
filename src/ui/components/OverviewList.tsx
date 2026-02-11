import { Box, Text } from "ink";
import type { CheckCategory, PullRequest } from "../../domain/types";
import { compactRelativeTime } from "../../utils/timers";
import { colors } from "../theme";
import { statusColor, statusToken } from "./status";

type RollupMap = Partial<Record<string, CheckCategory>>;

type Props = {
  prs: PullRequest[];
  selectedIndex: number;
  selectedPrKey: string | null;
  rollups: RollupMap;
  focused: boolean;
};

export function OverviewList({ prs, selectedIndex, rollups }: Props) {
  if (prs.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1} minHeight={6}>
        <Text color={colors.dim}>No PRs yet. Press s to set watched repositories.</Text>
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
        const cursor = isCursor ? ">" : " ";
        const time = compactRelativeTime(pr.updatedAt);
        const draftTag = pr.draft ? "[draft] " : "";

        return (
          <Box key={`${pr.owner}/${pr.repo}#${pr.number}`}>
            <Text color={isCursor ? colors.text : colors.dim}>
              {cursor}{"  "}
            </Text>
            <Text color={dotColor}>{statusToken("pending")}</Text>
            <Text>{" "}</Text>
            <Box flexGrow={1}>
              <Text color={isCursor ? colors.text : colors.dim}>
                {draftTag}{pr.title}
              </Text>
            </Box>
            <Text color={colors.dim}>{" "}{time}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
