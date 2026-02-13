import { useEffect, useState } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { formatRelativeTime } from "../../utils/timers";
import { colors } from "../theme";

type Props = {
  repos: string[];
  lastRefreshAt: Date | null;
  loadingOverview: boolean;
  loadingDetail: boolean;
};

export function StatusBar(props: Props) {
  const [, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isLoading = props.loadingOverview || props.loadingDetail;
  const repoLabel = props.repos.length > 0 ? props.repos.join(", ") : "—";

  return (
    <Box paddingX={1}>
      <Text color={colors.dim}>
        {repoLabel}
        {"  |  "}
        last refresh: {formatRelativeTime(props.lastRefreshAt)}
        {"  |  "}
      </Text>
      {isLoading ? (
        <Text color={colors.dim}>
          <Spinner type="dots" /> syncing
        </Text>
      ) : (
        <Text color={colors.dim}>idle</Text>
      )}
    </Box>
  );
}
