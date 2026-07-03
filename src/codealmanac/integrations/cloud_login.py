import sys
from typing import TextIO

from codealmanac.services.cloud_auth.models import CloudLoginSession
from codealmanac.workflows.cloud_login.ports import (
    CloudLoginStartDecision,
)
from codealmanac.workflows.cloud_login.requests import RunCloudLoginRequest


class TerminalCloudLoginInteraction:
    def __init__(
        self,
        *,
        stdin: TextIO | None = None,
        stdout: TextIO | None = None,
    ):
        self.stdin = stdin or sys.stdin
        self.stdout = stdout or sys.stdout

    def started(
        self,
        session: CloudLoginSession,
        request: RunCloudLoginRequest,
    ) -> CloudLoginStartDecision:
        mode = effective_browser_mode(request)
        if mode == "silent":
            return CloudLoginStartDecision(open_browser=False)

        self._write("Cloud sign-in")
        self._write(f"Open: {session.verification_url}")
        self._write(f"Code: {session.user_code}")

        if mode == "never":
            self._write("Waiting for browser approval...")
            return CloudLoginStartDecision(open_browser=False)

        if not self._can_prompt():
            self._write("Waiting for browser approval...")
            return CloudLoginStartDecision(open_browser=False)

        if mode == "open":
            self._write("Opening browser...")
            return CloudLoginStartDecision(open_browser=True)

        self.stdout.write("Open browser to finish cloud setup? [Y/n] ")
        self.stdout.flush()
        answer = self.stdin.readline().strip().lower()
        open_browser = answer in {"", "y", "yes"}
        if not open_browser:
            self._write("Waiting for browser approval...")
        return CloudLoginStartDecision(open_browser=open_browser)

    def _can_prompt(self) -> bool:
        return self.stdin.isatty() and self.stdout.isatty()

    def _write(self, message: str) -> None:
        self.stdout.write(f"{message}\n")


def effective_browser_mode(request: RunCloudLoginRequest) -> str:
    if request.no_browser:
        return "never"
    return request.browser_mode
