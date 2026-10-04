"""Add only NEW TODAY route and access-policy entries to the live backend."""

from pathlib import Path
import ast
import re


BACKEND = Path("/root/ALLIANCE-DARK/backend")


def add_after(text: str, pattern: str, addition: str, marker: str) -> str:
    if marker in text:
        return text
    matches = list(re.finditer(pattern, text, flags=re.MULTILINE))
    if len(matches) != 1:
        raise RuntimeError(f"Expected one anchor for {marker}; got {len(matches)}")
    match = matches[0]
    return text[: match.end()] + addition + text[match.end() :]


def patch_main(text: str) -> str:
    if "from routes import new_today," not in text:
        text = add_after(
            text,
            r"^from routes import ",
            "new_today, ",
            "from routes import new_today,",
        )
    text = add_after(
        text,
        r"^app\.include_router\(bulk_download\.router\)\n",
        "app.include_router(new_today.router)\n",
        "app.include_router(new_today.router)",
    )
    ast.parse(text)
    return text


def patch_access_policy(text: str) -> str:
    text = add_after(
        text,
        r'^\s*\{"key": "bulk_download",[^\n]*\n',
        '    {"key": "new_today", "label": "NEW TODAY", "frontend_path": "/new-today", "customer_visible": False},\n',
        '"key": "new_today"',
    )
    text = add_after(
        text,
        r'^\s*\("/api/bulk-download",[^\n]*\n',
        '    ("/api/new-today", "new_today"),\n',
        '"/api/new-today"',
    )
    ast.parse(text)
    return text


def main() -> None:
    main_path = BACKEND / "main.py"
    access_path = BACKEND / "services/access_policy.py"
    changes = {
        main_path: patch_main(main_path.read_text(encoding="utf-8")),
        access_path: patch_access_policy(access_path.read_text(encoding="utf-8")),
    }
    for path, content in changes.items():
        temporary = path.with_suffix(path.suffix + ".new-today")
        temporary.write_text(content, encoding="utf-8")
        temporary.replace(path)
    print("NEW_TODAY_BACKEND_PATCH=OK")


if __name__ == "__main__":
    main()
