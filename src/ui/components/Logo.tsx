import { Box, Text } from "ink";
import { colors } from "../theme";

const LOGO_LINES = [
  "   ________  ________  ________  ________  ________   ________ ",
  "  /        \\/    /   \\/        \\/        \\/    /   \\ /        \\",
  " /       __/         /         /        _/         /_/       / ",
  "/       / /         /         //       //         //         / ",
  "\\________/\\___/____/\\___/____/ \\______/ \\________/ \\________/  ",
];

export function Logo() {
  return (
    <Box flexDirection="column" alignItems="center">
      {LOGO_LINES.map((line, i) => (
        <Text key={i} color={colors.dim}>
          {line}
        </Text>
      ))}
    </Box>
  );
}
