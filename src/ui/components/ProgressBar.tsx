import { Text } from "ink";
import { MAX_TUI_WIDTH_CHARS } from "../theme";

type Segment = {
  value: number;
  color: string;
};

type Props = {
  segments: Segment[];
  width?: number;
};

/**
 * Renders a segmented bar using half-block characters (▌) with
 * contiguous segments (no inter-segment gaps).
 */
export function ProgressBar({ segments, width }: Props) {
  const cappedColumns = Math.min(process.stdout.columns || 80, MAX_TUI_WIDTH_CHARS);
  const barWidth = width ?? Math.floor(cappedColumns / 2);
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return null;
  }

  const visible = segments.filter((s) => s.value > 0);
  const usable = barWidth;

  const blocks = visible.map((s) => ({
    count: Math.max(1, Math.round((s.value / total) * usable)),
    color: s.color,
  }));

  // Correct rounding so the total fills the exact usable width
  const rendered = blocks.reduce((sum, b) => sum + b.count, 0);
  if (blocks.length > 0) {
    blocks[blocks.length - 1]!.count += usable - rendered;
  }

  const BLOCK = "▌";

  return (
    <Text>
      {blocks.map((block, i) => (
        <Text key={i} color={block.color}>
          {BLOCK.repeat(Math.max(0, block.count))}
        </Text>
      ))}
    </Text>
  );
}
