import pytest

from patch_live_backend import patch_access_policy, patch_main


def test_main_patch_is_scoped_and_idempotent():
    original = "from routes import bulk_download, forge\napp.include_router(bulk_download.router)\napp.include_router(forge.router)\n"
    patched = patch_main(original)
    assert "app.include_router(new_today.router)\napp.include_router(forge.router)" in patched
    assert patch_main(patched) == patched


def test_access_policy_patch_is_private_and_idempotent():
    original = (
        'MODULE_CATALOG = (\n    {"key": "bulk_download", "customer_visible": True},\n)\n'
        'API_MODULE_PREFIXES = (\n    ("/api/bulk-download", "bulk_download"),\n)\n'
    )
    patched = patch_access_policy(original)
    assert '"key": "new_today"' in patched
    assert '"customer_visible": False' in patched
    assert '("/api/new-today", "new_today")' in patched
    assert patch_access_policy(patched) == patched


def test_missing_anchor_fails_without_editing():
    with pytest.raises(RuntimeError):
        patch_main("from routes import forge\napp.include_router(forge.router)\n")
