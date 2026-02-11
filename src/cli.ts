#!/usr/bin/env bun
import React from "react";
import { render } from "ink";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./app/App";

const ENTER_ALT_SCREEN = "\u001B[?1049h";
const EXIT_ALT_SCREEN = "\u001B[?1049l";
const CLEAR_SCREEN = "\u001B[2J\u001B[H";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      networkMode: "always",
      retry: 1,
    },
  },
});

function setupFullscreenViewport(): () => void {
  if (!process.stdout.isTTY) {
    return () => {};
  }

  process.stdout.write(ENTER_ALT_SCREEN);
  process.stdout.write(CLEAR_SCREEN);

  let restored = false;
  return () => {
    if (restored) {
      return;
    }
    restored = true;
    process.stdout.write(EXIT_ALT_SCREEN);
  };
}

const restoreFullscreenViewport = setupFullscreenViewport();
process.on("exit", restoreFullscreenViewport);

const app = render(
  React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(App)),
);

void app.waitUntilExit().finally(() => {
  restoreFullscreenViewport();
  process.off("exit", restoreFullscreenViewport);
});
