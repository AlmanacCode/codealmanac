/**
 * Shared ANSI escape-code constants. TTY-aware: when stdout is not a
 * terminal or `NO_COLOR` is set, every constant resolves to the empty
 * string so formatted output degrades to plain text without per-call
 * checks at every use site.
 *
 * See https://no-color.org/ for the `NO_COLOR` convention.
 */

const useColor =
  (process.stdout.isTTY ?? false) && !("NO_COLOR" in process.env);

export const RST = useColor ? "\x1b[0m" : "";
export const BOLD = useColor ? "\x1b[1m" : "";
export const DIM = useColor ? "\x1b[2m" : "";
export const GREEN = useColor ? "\x1b[38;5;35m" : "";
export const RED = useColor ? "\x1b[38;5;167m" : "";
export const BLUE = useColor ? "\x1b[38;5;75m" : "";
export const YELLOW = useColor ? "\x1b[33m" : "";
export const WHITE_BOLD = useColor ? "\x1b[1;37m" : "";
export const BLUE_DIM = useColor ? "\x1b[38;5;69m" : "";
export const ACCENT_BG = useColor
  ? "\x1b[48;5;252m\x1b[38;5;16m"
  : "";
