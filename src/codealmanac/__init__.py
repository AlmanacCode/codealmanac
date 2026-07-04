from importlib.metadata import PackageNotFoundError, version

__all__ = ["__version__"]


def _installed_version() -> str:
    try:
        installed = version("codealmanac")
    except PackageNotFoundError:
        return "0+unknown"
    return installed or "0+unknown"


__version__ = _installed_version()
