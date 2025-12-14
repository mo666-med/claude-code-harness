import json
from pathlib import Path

import pytest

from tests.plugin_validator import (
    DEFAULT_REQUIRED_FIELDS,
    MAX_FIELD_LENGTH,
    InvalidJsonError,
    InvalidValueError,
    ManifestValidationResult,
    MissingFieldError,
    validate_manifest_fields,
    validate_plugin_manifest,
    load_manifest,
)


def test_load_manifest_success(tmp_path: Path) -> None:
    # Given: 正しい JSON 内容を持つ manifest ファイルが存在する
    manifest_path = tmp_path / "plugin.json"
    manifest_path.write_text(json.dumps({"name": "ok", "version": "1"}))

    # When: load_manifest を呼び出す
    manifest = load_manifest(manifest_path)

    # Then: 内容が辞書として読み込まれる
    assert manifest["name"] == "ok"
    assert manifest["version"] == "1"


def test_load_manifest_none_path_raises_type_error() -> None:
    # Given: None が渡される
    # When / Then: TypeError が発生する
    with pytest.raises(TypeError, match="must not be None"):
        load_manifest(None)  # type: ignore[arg-type]


def test_load_manifest_rejects_non_json_extension(tmp_path: Path) -> None:
    # Given: .json 以外の拡張子を持つファイルが指定される
    manifest_path = tmp_path / "plugin.txt"
    manifest_path.write_text("{}")

    # When / Then: InvalidValueError が発生する
    with pytest.raises(InvalidValueError, match=r"\.json extension"):
        load_manifest(manifest_path)


def test_load_manifest_directory_path_raises(tmp_path: Path) -> None:
    # Given: ディレクトリパスが渡される
    directory_path = tmp_path / "nested"
    directory_path.mkdir()

    # When / Then: IsADirectoryError が発生する
    with pytest.raises(IsADirectoryError):
        load_manifest(directory_path)


def test_load_manifest_missing_file(tmp_path: Path) -> None:
    # Given: 存在しないパスが指定される
    missing_path = tmp_path / "absent.json"

    # When / Then: FileNotFoundError が発生する
    with pytest.raises(FileNotFoundError):
        load_manifest(missing_path)


def test_load_manifest_permission_error(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    # Given: 読み取り時に PermissionError を返す環境
    manifest_path = tmp_path / "plugin.json"
    manifest_path.write_text("{}")

    def deny_read(_self: Path, *_args, **_kwargs) -> str:
        raise PermissionError("denied")

    monkeypatch.setattr(Path, "read_text", deny_read)

    # When / Then: PermissionError がそのまま伝播する
    with pytest.raises(PermissionError, match="manifest file is not readable"):
        load_manifest(manifest_path)


def test_load_manifest_empty_file(tmp_path: Path) -> None:
    # Given: 中身が空の manifest ファイル
    manifest_path = tmp_path / "plugin.json"
    manifest_path.write_text("")

    # When / Then: InvalidJsonError が発生する
    with pytest.raises(InvalidJsonError, match="empty"):
        load_manifest(manifest_path)


def test_load_manifest_invalid_json(tmp_path: Path) -> None:
    # Given: JSON 形式でない内容
    manifest_path = tmp_path / "plugin.json"
    manifest_path.write_text("not json")

    # When / Then: InvalidJsonError が発生する
    with pytest.raises(InvalidJsonError, match="valid JSON"):
        load_manifest(manifest_path)


def test_load_manifest_non_object_json(tmp_path: Path) -> None:
    # Given: 配列が格納された manifest
    manifest_path = tmp_path / "plugin.json"
    manifest_path.write_text("[]")

    # When / Then: InvalidJsonError が発生する
    with pytest.raises(InvalidJsonError, match="JSON object"):
        load_manifest(manifest_path)


def test_validate_manifest_fields_missing_required() -> None:
    # Given: 必須フィールドが欠落した manifest
    manifest = {"name": "ok"}

    # When / Then: MissingFieldError が発生する
    with pytest.raises(MissingFieldError, match="missing required fields: author, description, version"):
        validate_manifest_fields(manifest)


def test_validate_manifest_fields_non_mapping() -> None:
    # Given: 辞書以外の型が渡される
    manifest = ["name"]  # type: ignore[list-item]

    # When / Then: InvalidValueError が発生する
    with pytest.raises(InvalidValueError, match="mapping"):
        validate_manifest_fields(manifest)  # type: ignore[arg-type]


def test_validate_manifest_fields_none_manifest() -> None:
    # Given: None が渡される
    # When / Then: TypeError が発生する
    with pytest.raises(TypeError, match="must not be None"):
        validate_manifest_fields(None)  # type: ignore[arg-type]


def test_validate_manifest_fields_null_value() -> None:
    # Given: None を値に持つ必須フィールド
    manifest = {"name": None, "version": "1", "description": "d", "author": "a"}

    # When / Then: InvalidValueError が発生する
    with pytest.raises(InvalidValueError, match="must not be null"):
        validate_manifest_fields(manifest)


def test_validate_manifest_fields_empty_string() -> None:
    # Given: 空文字列を値に持つ必須フィールド
    manifest = {"name": "", "version": "1", "description": "d", "author": "a"}

    # When / Then: InvalidValueError が発生する
    with pytest.raises(InvalidValueError, match="empty or whitespace"):
        validate_manifest_fields(manifest)


def test_validate_manifest_fields_whitespace_only() -> None:
    # Given: 空白のみの文字列を値に持つ必須フィールド
    manifest = {"name": "   ", "version": "1", "description": "d", "author": "a"}

    # When / Then: InvalidValueError が発生する
    with pytest.raises(InvalidValueError, match="empty or whitespace"):
        validate_manifest_fields(manifest)


def test_validate_manifest_fields_type_mismatch() -> None:
    # Given: 数値を含む必須フィールド
    manifest = {"name": 0, "version": "1", "description": "d", "author": "a"}

    # When / Then: InvalidValueError が発生する
    with pytest.raises(InvalidValueError, match="must be a string"):
        validate_manifest_fields(manifest)


def test_validate_manifest_fields_length_boundaries() -> None:
    # Given: 最小文字数と最大文字数の境界値
    minimal = "a"
    maximal = "x" * MAX_FIELD_LENGTH
    manifest = {
        "name": minimal,
        "version": maximal,
        "description": minimal,
        "author": maximal,
    }

    # When: バリデーションを実行する
    result = validate_manifest_fields(manifest)

    # Then: 境界値の入力であっても成功する
    assert isinstance(result, ManifestValidationResult)
    assert result.manifest["version"] == maximal


def test_validate_manifest_fields_too_long() -> None:
    # Given: 最大長を 1 文字超える値を含む manifest
    too_long = "y" * (MAX_FIELD_LENGTH + 1)
    manifest = {
        "name": "ok",
        "version": too_long,
        "description": "d",
        "author": "a",
    }

    # When / Then: InvalidValueError が発生する
    with pytest.raises(InvalidValueError, match="exceeds maximum length"):
        validate_manifest_fields(manifest)


def test_validate_manifest_fields_no_required_fields() -> None:
    # Given: 必須フィールドが空配列で指定される
    manifest = {"anything": "goes"}

    # When: validate_manifest_fields をカスタム必須フィールド無しで実行する
    result = validate_manifest_fields(manifest, required_fields=(), max_length=MAX_FIELD_LENGTH)

    # Then: MissingFieldError は発生せず成功する
    assert isinstance(result, ManifestValidationResult)


def test_validate_plugin_manifest_end_to_end(tmp_path: Path) -> None:
    # Given: 全ての必須フィールドが揃った manifest ファイル
    manifest_path = tmp_path / "plugin.json"
    manifest_content = {field: "ok" for field in DEFAULT_REQUIRED_FIELDS}
    manifest_path.write_text(json.dumps(manifest_content))

    # When: validate_plugin_manifest で読み込みから検証まで行う
    result = validate_plugin_manifest(manifest_path)

    # Then: 正常に結果が返され、必須フィールドが保持される
    assert isinstance(result, ManifestValidationResult)
    assert result.manifest["name"] == "ok"
