import subprocess
import sys
from importlib.metadata import PackageNotFoundError

import pytest

from codealmanac.integrations.updates import package as package_module
from codealmanac.integrations.updates.package import (
    InstalledPackageMetadataProvider,
    SubprocessPackageCommandRunner,
    clean_optional_text,
    read_direct_url,
)


class FakeDistribution:
    def __init__(self, version: str, files: dict[str, str]):
        self.version = version
        self.files = files

    def read_text(self, filename: str) -> str | None:
        return self.files.get(filename)


def install_distribution(monkeypatch, distribution: FakeDistribution | None) -> None:
    def read(name: str) -> FakeDistribution:
        if distribution is None:
            raise PackageNotFoundError(name)
        return distribution

    monkeypatch.setattr(package_module, "distribution", read)


def test_metadata_provider_reports_unknown_when_package_is_missing(monkeypatch):
    install_distribution(monkeypatch, None)

    metadata = InstalledPackageMetadataProvider().read()

    assert metadata.version == "unknown"
    assert metadata.installer is None
    assert metadata.editable is False
    assert metadata.source_url is None


def test_metadata_provider_reads_installer_and_editable_direct_url(monkeypatch):
    install_distribution(
        monkeypatch,
        FakeDistribution(
            version="0.4.7",
            files={
                "INSTALLER": " uv \n",
                "direct_url.json": (
                    '{"url": "file:///repo", "dir_info": {"editable": true}}'
                ),
            },
        ),
    )

    metadata = InstalledPackageMetadataProvider().read()

    assert metadata.version == "0.4.7"
    assert metadata.installer == "uv"
    assert metadata.editable is True
    assert metadata.source_url == "file:///repo"


def test_metadata_provider_ignores_blank_installer_and_absent_direct_url(monkeypatch):
    install_distribution(
        monkeypatch,
        FakeDistribution(version="0.4.7", files={"INSTALLER": "   "}),
    )

    metadata = InstalledPackageMetadataProvider().read()

    assert metadata.installer is None
    assert metadata.editable is False
    assert metadata.source_url is None


@pytest.mark.parametrize(
    "raw",
    [
        None,
        "not json",
        '["pip"]',
        '{"dir_info": "editable"}',
        '{"url": "   "}',
        '{"url": 7}',
    ],
)
def test_read_direct_url_falls_back_to_defaults_for_unusable_payloads(raw):
    metadata = read_direct_url(raw)

    assert metadata.editable is False
    assert metadata.source_url is None


def test_read_direct_url_requires_explicit_editable_flag():
    metadata = read_direct_url('{"url": "file:///repo", "dir_info": {"editable": 1}}')

    assert metadata.editable is False
    assert metadata.source_url == "file:///repo"


@pytest.mark.parametrize(
    ("value", "expected"),
    [(None, None), ("", None), ("  ", None), (" pip ", "pip")],
)
def test_clean_optional_text(value, expected):
    assert clean_optional_text(value) == expected


def test_command_runner_captures_output_streams_and_exit_code():
    result = SubprocessPackageCommandRunner().run(
        (
            sys.executable,
            "-c",
            "import sys; print('out'); print('err', file=sys.stderr); sys.exit(3)",
        )
    )

    assert result.exit_code == 3
    assert result.stdout.strip() == "out"
    assert result.stderr.strip() == "err"


def test_command_runner_reports_os_error_as_failed_result(monkeypatch):
    def explode(*args, **kwargs):
        raise FileNotFoundError("no such tool")

    monkeypatch.setattr(subprocess, "run", explode)

    result = SubprocessPackageCommandRunner().run(("missing-tool", "install"))

    assert result.exit_code == 1
    assert result.stderr == "FileNotFoundError: no such tool"
