"""loading and flattening of translation files

locale directories may contain any mix of .json, .json5, .jsonc and .jsonl files 
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

SUPPORTED_SUFFIXES = (".json", ".json5", ".jsonc", ".jsonl")
FLAT_DIR_NAME = ".flat"


class LocaleError(ValueError):
    """raised when a locale file cannot be parsed."""


def flatten(data: dict[str, Any], prefix: str | None = None) -> dict[str, str]:
    """turn nested translation dictionaries into a flat ``key -> text`` map."""

    result: dict[str, str] = {}

    for key, value in data.items():
        current_key = f"{prefix}.{key}" if prefix else str(key)

        if isinstance(value, dict):
            result.update(flatten(value, current_key))
        elif isinstance(value, str):
            result[current_key] = value
        else:
            result[current_key] = str(value)

    return result


def _rewrite_string(text: str, start: int) -> tuple[str, int]:
    """rewrite a (possibly single-quoted) string into a json string."""

    quote = text[start]
    escaped = {
        "b": "\\b",
        "f": "\\f",
        "n": "\\n",
        "r": "\\r",
        "t": "\\t",
        '"': '\\"',
        "\\": "\\\\",
        "/": "\\/",
    }

    index = start + 1
    parts = ['"']

    while index < len(text):
        char = text[index]

        if char == quote:
            parts.append('"')
            return "".join(parts), index + 1

        if char == "\\":
            if index + 1 >= len(text):
                parts.append("\\\\")
                index += 1
                continue

            escaped_char = text[index + 1]

            # json5 line continuation: backslash followed by a newline.
            if escaped_char in ("\n", "\r"):
                index += 2
                if escaped_char == "\r" and index < len(text) and text[index] == "\n":
                    index += 1
                continue

            if escaped_char == "'":
                parts.append("'")
            elif escaped_char in escaped:
                parts.append(escaped[escaped_char])
            elif escaped_char == "v":
                parts.append("\\u000b")
            elif escaped_char == "0":
                parts.append("\\u0000")
            elif escaped_char == "x" and index + 3 < len(text):
                hex_value = text[index + 2 : index + 4]
                if all(c in "0123456789abcdefABCDEF" for c in hex_value):
                    parts.append(f"\\u00{hex_value}")
                    index += 4
                    continue
                parts.append("\\\\x")
            else:
                parts.append("\\" + escaped_char)

            index += 2
            continue

        if char == '"':
            parts.append('\\"')
        elif char == "\n":
            parts.append("\\n")
        elif char == "\r":
            parts.append("\\r")
        elif char == "\t":
            parts.append("\\t")
        elif ord(char) < 0x20:
            parts.append(f"\\u{ord(char):04x}")
        else:
            parts.append(char)

        index += 1

    raise LocaleError("unterminated string")


def _remove_trailing_commas(text: str) -> str:
    """remove commas before } / ] without touching string contents"""

    parts: list[str] = []
    in_string = False
    index = 0

    while index < len(text):
        char = text[index]

        if in_string:
            parts.append(char)
            if char == "\\" and index + 1 < len(text):
                parts.append(text[index + 1])
                index += 2
                continue
            if char == '"':
                in_string = False
            index += 1
            continue

        if char == '"':
            in_string = True
            parts.append(char)
            index += 1
            continue

        if char == ",":
            next_index = index + 1
            while next_index < len(text) and text[next_index] in " \t\r\n":
                next_index += 1
            if next_index < len(text) and text[next_index] in "}]":
                index += 1
                continue

        parts.append(char)
        index += 1

    return "".join(parts)


def _normalize_relaxed(text: str) -> str:
    """convert the supported json5-ish syntax into strict json"""

    parts: list[str] = []
    index = 0

    while index < len(text):
        char = text[index]

        if char in ('"', "'"):
            rewritten, index = _rewrite_string(text, index)
            parts.append(rewritten)
            continue

        if text.startswith("//", index):
            newline = text.find("\n", index)
            index = len(text) if newline == -1 else newline
            continue

        if text.startswith("/*", index):
            comment_end = text.find("*/", index + 2)
            if comment_end == -1:
                raise LocaleError("unterminated block comment")
            index = comment_end + 2
            continue

        parts.append(char)
        index += 1

    return _remove_trailing_commas("".join(parts))


def _load_relaxed(text: str) -> dict[str, Any]:
    try:
        data = json.loads(_normalize_relaxed(text))
    except json.JSONDecodeError as error:
        raise LocaleError(f"invalid JSON: {error}") from error

    if not isinstance(data, dict):
        raise LocaleError("top-level value must be an object")

    return data


def _load_json_lines(text: str) -> dict[str, Any] | None:
    """parse a json-lines file, returning None if it is not jsonl"""

    result: dict[str, Any] = {}
    found = False

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("//") or line.startswith("#"):
            continue

        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            try:
                item = _load_relaxed(line)
            except LocaleError:
                return None

        if not isinstance(item, dict):
            return None

        result.update(item)
        found = True

    return result if found else None


def load_file(path: str | Path) -> dict[str, Any]:
    """load one locale file and return its (still nested) content"""

    path = Path(path)
    text = path.read_text(encoding="utf-8")

    # usual case: a normal json object
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        data = None

    if data is not None:
        if not isinstance(data, dict):
            raise LocaleError(f"{path}: top-level value must be an object")
        return data

    # pretty printed files with comments / trailing commas / quoted strings
    try:
        return _load_relaxed(text)
    except LocaleError as relaxed_error:
        # True JSON Lines: one (possibly small) JSON object per line.
        json_lines = _load_json_lines(text)
        if json_lines is not None:
            return json_lines

        raise LocaleError(f"{path}: {relaxed_error}") from relaxed_error


def build_flat_files(
    base_path: str | Path = "translations",
    output_path: str | Path | None = None,
) -> dict[str, dict[str, str]]:
    """merge every locale directory into flat json files for disnake i18n"""

    base_path = Path(base_path)
    output_path = (
        Path(output_path) if output_path is not None else base_path / FLAT_DIR_NAME
    )
    output_path.mkdir(parents=True, exist_ok=True)

    result: dict[str, dict[str, str]] = {}

    for lang_dir in sorted(base_path.iterdir()):
        if not lang_dir.is_dir() or lang_dir.name.startswith("."):
            continue

        flat: dict[str, str] = {}
        for locale_file in sorted(lang_dir.rglob("*")):
            if not locale_file.is_file():
                continue
            if locale_file.suffix.lower() not in SUPPORTED_SUFFIXES:
                continue

            flat.update(flatten(load_file(locale_file)))

        result[lang_dir.name] = flat

    for lang, flat in result.items():
        with open(output_path / f"{lang}.json", "w", encoding="utf-8") as file:
            json.dump(flat, file, ensure_ascii=False, indent=2)

    for stale_file in output_path.glob("*.json"):
        if stale_file.stem not in result:
            stale_file.unlink()

    return result
