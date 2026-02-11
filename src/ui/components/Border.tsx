import { Text } from "ink";
import { colors } from "../theme";

type Props = {
  width?: number;
};

export function Border({ width }: Props) {
  const cols = width ?? process.stdout.columns ?? 80;
  const pattern = "nu";
  const line = pattern.repeat(Math.ceil(cols / pattern.length)).slice(0, cols);
  return <Text color={colors.border}>{line}</Text>;
}
