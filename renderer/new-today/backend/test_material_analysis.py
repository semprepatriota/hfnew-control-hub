import asyncio
import base64
import importlib.util
import json
import sys
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from PIL import Image
from pydantic import ValidationError


source = Path(__file__).with_name("new_today.py")
spec = importlib.util.spec_from_file_location("new_today_under_test", source)
new_today = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = new_today
spec.loader.exec_module(new_today)


def test_render_timing_keeps_short_intro_and_no_outro():
    assert new_today._INTRO_FRAMES == 21
    assert new_today._IMAGE_FRAMES == 213
    assert "cta" not in new_today.RenderSettings.model_fields


def test_atlas_templates_validate_and_preserve_classic_default():
    base = {"mediaType": "image", "headline": "Manchete verificada", "source": "Fonte oficial"}
    classic = new_today.RenderSettings.model_validate(base)
    assert classic.template == "classic"
    assert classic.brand == "NEW ATLAS"
    brief = new_today.RenderSettings.model_validate({**base, "template": "brief", "summary": "Resumo confirmado"})
    assert brief.summary == "Resumo confirmado"
    for template in ("alert", "breaking", "field"):
        settings = new_today.RenderSettings.model_validate({**base, "template": template, "summary": "Resumo confirmado"})
        assert settings.template == template
    with pytest.raises(ValidationError):
        new_today.RenderSettings.model_validate({**base, "template": "unknown"})


def test_brief_rejects_text_that_cannot_fit(monkeypatch):
    monkeypatch.setattr(new_today, "_owner_context", lambda auth: {"role": "owner"})
    settings = new_today.RenderSettings(
        mediaType="image", headline="Manchete " * 10, source="Fonte oficial",
        template="brief", summary="Resumo confirmado",
    )
    with pytest.raises(HTTPException) as error:
        asyncio.run(new_today.create_render(None, settings.model_dump_json(), None))
    assert error.value.status_code == 422


def sample_url():
    output = BytesIO()
    Image.new("RGB", (16, 16), "blue").save(output, "JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode("ascii")


def test_sample_is_decoded_and_reencoded_without_metadata():
    result = new_today._sanitize_sample(sample_url())
    assert result.startswith("data:image/jpeg;base64,")
    assert len(base64.b64decode(result.split(",", 1)[1])) > 0

    with pytest.raises(HTTPException) as error:
        new_today._sanitize_sample("https://example.com/photo.jpg")
    assert error.value.status_code == 422


def test_ai_hook_uses_central_key_and_never_invents_source(monkeypatch):
    calls = []

    def fake_post(url, **kwargs):
        calls.append((url, kwargs))
        content = {"headline": "TSE aprova candidatura após decisão", "source": "Jornal Inventado",
                   "evidence": ["TSE aprova candidatura", "Fato que não aparece"], "warning": ""}
        return SimpleNamespace(status_code=200, json=lambda: {"choices": [{"message": {"content": json.dumps(content)}}]})

    monkeypatch.setattr(new_today.requests, "post", fake_post)
    result = new_today._request_material_analysis(
        "TSE aprova candidatura no julgamento", "", [sample_url()],
        {"api_key": "test-key", "model": "gpt-4o-mini"},
    )

    assert len(calls) == 1
    assert calls[0][1]["headers"]["Authorization"] == "Bearer test-key"
    assert "hook do Forge 70/30" in calls[0][1]["json"]["messages"][0]["content"]
    assert result["headline"] == "TSE aprova candidatura após decisão"
    assert result["source"] == ""
    assert result["source_status"] == "not_found"
    assert result["evidence"] == ["TSE aprova candidatura"]


def test_editor_source_is_preserved_but_not_claimed_as_verified(monkeypatch):
    response = {"headline": "Manchete apoiada pelo material", "source": "Fonte divergente", "evidence": [], "warning": ""}
    monkeypatch.setattr(new_today.requests, "post", lambda *args, **kwargs: SimpleNamespace(
        status_code=200, json=lambda: {"choices": [{"message": {"content": json.dumps(response)}}]},
    ))
    result = new_today._request_material_analysis("Texto da reportagem", "Fonte do editor", [], {"api_key": "test"})
    assert result["source"] == "Fonte do editor"
    assert result["source_status"] == "informed"


def test_photo_without_text_does_not_become_a_factual_headline(monkeypatch):
    response = {"headline": "Uma cidade sofre desastre", "source": "", "evidence": [], "warning": ""}
    monkeypatch.setattr(new_today.requests, "post", lambda *args, **kwargs: SimpleNamespace(
        status_code=200, json=lambda: {"choices": [{"message": {"content": json.dumps(response)}}]},
    ))
    result = new_today._request_material_analysis("", "", [sample_url()], {"api_key": "test"})
    assert result["headline"] == ""
    assert result["source"] == ""


def test_unverifiable_ocr_cannot_create_a_headline(monkeypatch):
    response = {"headline": "A cidade entra em alerta", "source": "", "evidence": ["trecho inventado"], "warning": ""}
    monkeypatch.setattr(new_today.requests, "post", lambda *args, **kwargs: SimpleNamespace(
        status_code=200, json=lambda: {"choices": [{"message": {"content": json.dumps(response)}}]},
    ))
    result = new_today._request_material_analysis("texto ilegível da imagem", "", [], {"api_key": "test"})
    assert result["headline"] == ""
    assert result["evidence"] == []


def test_analysis_needs_material_and_configured_key(monkeypatch):
    monkeypatch.setattr(new_today, "_owner_context", lambda auth: {"role": "owner"})
    with pytest.raises(HTTPException) as empty:
        asyncio.run(new_today.analyze_material(new_today.MaterialAnalysisRequest(), None))
    assert empty.value.status_code == 422

    monkeypatch.setattr(new_today, "get_central_chatgpt_config", lambda: {"enabled": True, "api_key": ""})
    with pytest.raises(HTTPException) as missing_key:
        asyncio.run(new_today.analyze_material(new_today.MaterialAnalysisRequest(image_samples=[sample_url()]), None))
    assert missing_key.value.status_code == 503


def test_analysis_rejects_parallel_paid_requests(monkeypatch):
    monkeypatch.setattr(new_today, "_owner_context", lambda auth: {"role": "owner"})
    monkeypatch.setattr(new_today, "get_central_chatgpt_config", lambda: {"enabled": True, "api_key": "test"})
    new_today._ANALYZE_LOCK.acquire()
    try:
        with pytest.raises(HTTPException) as busy:
            asyncio.run(new_today.analyze_material(new_today.MaterialAnalysisRequest(extracted_text="Notícia de teste"), None))
        assert busy.value.status_code == 429
    finally:
        new_today._ANALYZE_LOCK.release()
