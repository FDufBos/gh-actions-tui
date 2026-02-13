import { Box, Text } from "ink";
import type { CheckCategory, PullRequest } from "../../domain/types";
import { compactRelativeTime } from "../../utils/timers";
import { blendOnBg, colors, MAX_TUI_WIDTH_CHARS } from "../theme";
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
        const rowColor = isFocused
          ? (isCursor ? colors.text : colors.dim)
          : (isCursor ? blendOnBg(colors.text, 0.75) : colors.border);
        const rowDotColor = isFocused
          ? dotColor
          : (isCursor ? blendOnBg(dotColor, 0.7) : blendOnBg(dotColor, 0.2));
        const time = compactRelativeTime(pr.updatedAt);
        const draftTag = pr.draft ? "[draft] " : "";
        const title = `${draftTag}${pr.title}`;
        const totalWidth = Math.min(process.stdout.columns ?? MAX_TUI_WIDTH_CHARS, MAX_TUI_WIDTH_CHARS);
        // Matches MainScreen left padding (3) + this list's horizontal padding (2).
        const listWidth = Math.max(20, totalWidth - 5);
        const prefixWidth = 2; // status dot(1) + gap(1)
        const timeWidth = 7;
        const titleLines = computeOverviewTitleLines(
          title,
          Math.max(10, listWidth - prefixWidth - timeWidth),
          Math.max(10, listWidth - prefixWidth),
        );
        const timeLabel = time.padStart(timeWidth);

        return (
          <Box key={`${pr.owner}/${pr.repo}#${pr.number}`} flexDirection="column">
            <Box>
              <Text color={rowDotColor}>{statusToken("pending")}</Text>
              <Text>{" "}</Text>
              <Box flexGrow={1}>
                <Text color={rowColor}>{titleLines[0] ?? ""}</Text>
              </Box>
              <Text color={isFocused ? colors.dim : isCursor ? blendOnBg(colors.text, 0.7) : colors.border}>
                {timeLabel}
              </Text>
            </Box>
            {titleLines.slice(1).map((line, lineIndex) => (
              <Box key={`${pr.owner}/${pr.repo}#${pr.number}-line-${lineIndex}`}>
                <Text color={rowColor}>{" ".repeat(prefixWidth)}</Text>
                <Box flexGrow={1}>
                  <Text color={rowColor}>{line}</Text>
                </Box>
              </Box>
            ))}
          </Box>
        );
      })}
    </Box>
  );
}

export function computeOverviewTitleLines(text: string, firstWidth: number, nextWidth: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [""];

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";
  let limit = Math.max(1, firstWidth);

  const pushLine = () => {
    lines.push(current);
    current = "";
    limit = Math.max(1, nextWidth);
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }

    if (current) {
      pushLine();
    }

    if (word.length <= limit) {
      current = word;
      continue;
    }

    current = truncateWord(word, limit);
  }

  if (current || lines.length === 0) {
    lines.push(current);
  }
  return lines;
}

function truncateWord(word: string, width: number): string {
  const safeWidth = Math.max(1, width);
  if (word.length <= safeWidth) return word;
  if (safeWidth === 1) return "…";
  return `${word.slice(0, safeWidth - 1)}…`;
}
