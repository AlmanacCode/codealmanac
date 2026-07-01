from enum import StrEnum
from importlib import resources
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, field_validator


class StaticAssetSuffix(StrEnum):
    HTML = ".html"
    CSS = ".css"
    JAVASCRIPT = ".js"


ASSET_MEDIA_TYPES: dict[StaticAssetSuffix, str] = {
    StaticAssetSuffix.HTML: "text/html",
    StaticAssetSuffix.CSS: "text/css",
    StaticAssetSuffix.JAVASCRIPT: "text/javascript",
}


class StaticAssetRequest(BaseModel):
    model_config = ConfigDict(frozen=True)

    path: str

    @field_validator("path")
    @classmethod
    def validate_path(cls, value: str) -> str:
        if value != value.strip():
            raise ValueError("asset path must not contain surrounding whitespace")
        if not value:
            raise ValueError("asset path is required")
        if value.startswith("/") or "\\" in value:
            raise ValueError("asset path must be relative")
        parts = value.split("/")
        if any(part in {"", ".", ".."} for part in parts):
            raise ValueError("asset path contains an invalid segment")
        suffix = Path(value).suffix
        if suffix not in {item.value for item in StaticAssetSuffix}:
            raise ValueError("asset path has an unsupported extension")
        return value

    @property
    def media_type(self) -> str:
        return ASSET_MEDIA_TYPES[StaticAssetSuffix(Path(self.path).suffix)]

    @property
    def parts(self) -> list[str]:
        return self.path.split("/")


def asset_response(asset_path: str) -> Response:
    request = StaticAssetRequest(path=asset_path)
    try:
        return Response(
            read_asset_text(request),
            media_type=request.media_type,
        )
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": f"asset not found: {asset_path}"},
        ) from error


def read_asset_text(request: StaticAssetRequest) -> str:
    asset = resources.files("codealmanac.server.assets").joinpath(*request.parts)
    if not asset.is_file():
        raise FileNotFoundError(request.path)
    return asset.read_text(encoding="utf-8")
