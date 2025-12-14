"""Utility functions for validating Claude Code Harness plugin metadata.

The helpers here are intentionally small so they can be covered by unit tests
and reused by shell wrappers if needed.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

MAX_FIELD_LENGTH = 128
DEFAULT_REQUIRED_FIELDS = ("name", "version", "description", "author")


class ValidationError(Exception):
    """Base exception for validation failures."""


class MissingFieldError(ValidationError):
    """Raised when required manifest fields are missing."""


class InvalidValueError(ValidationError):
    """Raised when manifest values have invalid content or type."""


class InvalidJsonError(ValidationError):
    """Raised when manifest JSON cannot be parsed or is not an object."""


@dataclass(frozen=True)
class ManifestValidationResult:
    manifest: dict
    path: Path


def load_manifest(manifest_path: Path) -> dict:
    """Load the plugin manifest JSON file.

    Parameters
    ----------
    manifest_path:
        Path to the manifest JSON file.

    Raises
    ------
    TypeError
        If ``manifest_path`` is ``None``.
    FileNotFoundError
        If the path does not exist.
    IsADirectoryError
        If the path points to a directory.
    InvalidValueError
        If the file extension is not ``.json``.
    InvalidJsonError
        If the file is empty, invalid JSON, or not an object.
    PermissionError
        If the file cannot be read.
    """

    if manifest_path is None:
        raise TypeError("manifest_path must not be None")

    path = Path(manifest_path)

    if path.is_dir():
        raise IsADirectoryError(f"{path} is a directory, not a manifest file")

    if not path.exists():
        raise FileNotFoundError(f"manifest file not found: {path}")

    if path.suffix != ".json":
        raise InvalidValueError("manifest file must use a .json extension")

    try:
        content = path.read_text(encoding="utf-8")
    except PermissionError as exc:
        raise PermissionError(f"manifest file is not readable: {path}") from exc

    if not content:
        raise InvalidJsonError("manifest file is empty")

    try:
        data = json.loads(content)
    except json.JSONDecodeError as exc:
        raise InvalidJsonError("manifest file is not valid JSON") from exc

    if not isinstance(data, dict):
        raise InvalidJsonError("manifest must be a JSON object")

    return data


def validate_manifest_fields(
    manifest: dict,
    required_fields: Iterable[str] = DEFAULT_REQUIRED_FIELDS,
    *,
    max_length: int = MAX_FIELD_LENGTH,
) -> ManifestValidationResult:
    """Validate required manifest fields and value constraints.

    Parameters
    ----------
    manifest:
        Manifest object already loaded from JSON.
    required_fields:
        Iterable of field names that must be present and non-empty strings.
    max_length:
        Maximum allowed length for string fields.

    Raises
    ------
    TypeError
        When ``manifest`` is ``None``.
    InvalidValueError
        When the manifest is not a mapping, when values are blank/None,
        when values exceed ``max_length``, or when their type is invalid.
    MissingFieldError
        When any required field is missing.
    """

    if manifest is None:
        raise TypeError("manifest must not be None")

    if not isinstance(manifest, dict):
        raise InvalidValueError("manifest must be a mapping")

    missing = [field for field in required_fields if field not in manifest]
    if missing:
        missing_list = ", ".join(sorted(missing))
        raise MissingFieldError(f"missing required fields: {missing_list}")

    for field in required_fields:
        value = manifest[field]
        if value is None:
            raise InvalidValueError(f"{field} must not be null")
        if not isinstance(value, str):
            raise InvalidValueError(f"{field} must be a string")
        if not value.strip():
            raise InvalidValueError(f"{field} must not be empty or whitespace")
        if len(value) > max_length:
            raise InvalidValueError(
                f"{field} exceeds maximum length of {max_length} characters"
            )

    return ManifestValidationResult(manifest=manifest, path=Path())


def validate_plugin_manifest(
    manifest_path: Path,
    required_fields: Iterable[str] = DEFAULT_REQUIRED_FIELDS,
    *,
    max_length: int = MAX_FIELD_LENGTH,
) -> ManifestValidationResult:
    """Load and validate a plugin manifest in a single call."""

    manifest = load_manifest(manifest_path)
    return validate_manifest_fields(manifest, required_fields, max_length=max_length)
