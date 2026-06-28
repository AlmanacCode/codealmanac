export interface ServeStartup {
  url: string;
}

export interface ServeStartupOutput {
  stdout: string;
}

export function renderServeStartup(startup: ServeStartup): ServeStartupOutput {
  return {
    stdout: [
      `almanac console: ${startup.url}`,
      "Press Ctrl+C to stop.",
    ].join("\n") + "\n",
  };
}
