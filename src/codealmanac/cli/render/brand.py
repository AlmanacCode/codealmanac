from codealmanac.cli.render.terminal import terminal_width, write_line

RST = "\x1b[0m"
BOLD = "\x1b[1m"
DIM = "\x1b[2m"
WHITE_BOLD = "\x1b[1;37m"
BLUE = "\x1b[38;5;75m"
BLUE_DIM = "\x1b[38;5;69m"
ACCENT_BG = "\x1b[48;5;252m\x1b[38;5;16m"
CLAUDE_CORAL = "\x1b[38;5;173m"
CODEX_PERIWINKLE = "\x1b[38;5;105m"
OPENCODE_GREEN = "\x1b[38;5;35m"
DIFF_RED = "\x1b[38;5;203m"
DIFF_GREEN = "\x1b[38;5;76m"

BRAND_COLORS = {
    "Codex": CODEX_PERIWINKLE,
    "Claude": CLAUDE_CORAL,
    "OpenCode": OPENCODE_GREEN,
}

GRADIENT = (
    "\x1b[38;5;255m",
    "\x1b[38;5;253m",
    "\x1b[38;5;251m",
    "\x1b[38;5;249m",
    "\x1b[38;5;246m",
    "\x1b[38;5;243m",
)

SETUP_BANNER = (
    " █████╗ ██╗     ███╗   ███╗ █████╗ ███╗   ██╗ █████╗  ██████╗",
    "██╔══██╗██║     ████╗ ████║██╔══██╗████╗  ██║██╔══██╗██╔════╝",
    "███████║██║     ██╔████╔██║███████║██╔██╗ ██║███████║██║     ",
    "██╔══██║██║     ██║╚██╔╝██║██╔══██║██║╚██╗██║██╔══██║██║     ",
    "██║  ██║███████╗██║ ╚═╝ ██║██║  ██║██║ ╚████║██║  ██║╚██████╗",
    "╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝",
)

ACCENT_STYLE = "bright_blue"
BAR = f"  {DIM}│{RST}"


def print_banner(subtitle: str | None = None) -> None:
    write_line("")
    banner_width = max(len(line) for line in SETUP_BANNER)
    if terminal_width() >= banner_width:
        for index, line in enumerate(SETUP_BANNER):
            color = GRADIENT[index]
            write_line(f"{color}{line}{RST}")
    else:
        write_line(f"{WHITE_BOLD}  CodeAlmanac{RST}")
    write_line("")
    if subtitle is not None:
        write_line(f"{WHITE_BOLD}  {subtitle}{RST}")
        return
    write_line(f"{WHITE_BOLD}  The self-updating wiki for your coding agents.{RST}")
    write_line(
        f"{DIM}  Machine setup only. Repo wikis still start with"
        f" codealmanac init.{RST}"
    )


def print_badge() -> None:
    write_line("")
    write_line(f"   {ACCENT_BG} codealmanac {RST}")


def option_label(label: str, selected: bool) -> str:
    return " ".join(label_word(word, selected) for word in label.split(" "))


def label_word(word: str, selected: bool) -> str:
    color = BRAND_COLORS.get(word)
    if color is None:
        style = WHITE_BOLD if selected else DIM
    elif selected:
        style = f"{BOLD}{color}"
    else:
        style = f"{DIM}{color}"
    return f"{style}{word}{RST}"
