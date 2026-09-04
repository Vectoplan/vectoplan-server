from __future__ import annotations

import json
from pathlib import Path

from flask import Flask

from app import _install_security_headers
from routes.editor import editor_bp


def _client():
    service_root = Path(__file__).resolve().parents[1]
    app = Flask(
        __name__,
        template_folder=str(service_root / "templates"),
        static_folder=str(service_root / "static"),
    )
    app.config.update(
        TESTING=True,
        VECTOPLAN_EDITOR_RECONSTRUCTION_PARENT_ORIGINS=(
            "http://127.0.0.1:56000",
            "http://localhost:56000",
        ),
    )
    _install_security_headers(app)
    app.register_blueprint(editor_bp)
    return app.test_client()


def test_reconstruction_preview_is_isolated_and_frameable_by_converter() -> None:
    response = _client().get(
        "/editor/reconstruction-preview?parentOrigin=http://127.0.0.1:56000"
    )

    assert response.status_code == 200
    page = response.get_data(as_text=True)
    assert "data-editor-reconstruction-preview" in page
    assert 'data-reconstruction-preview-chunk-enabled="false"' in page
    assert 'data-reconstruction-preview-persistence-enabled="false"' in page
    assert 'data-reconstruction-preview-mode="plan2d"' in page
    assert "Plan-zentrierte 2D-Prüfansicht" in page
    assert 'aria-label="Legende der 2D-Prüfdarstellung"' in page
    assert "Räume / Treppen" in page
    assert "Wände" in page
    assert "Türen / Fenster" in page
    assert "Wandlose Öffnungen" in page
    assert 'aria-label="Erkannte Elemente"' in page
    assert "cadbridge-reconstruction-preview.v1" in page
    assert "cadbridge-progressive-review/0.1" in page
    assert '"sourcePreviewMediaType": "image/png"' in page
    assert response.headers["X-VECTOPLAN-Editor-Runtime-Mode"] == (
        "reconstruction-preview"
    )
    assert response.headers["X-VECTOPLAN-Editor-Chunk-Service"] == "disabled"
    assert response.headers["X-VECTOPLAN-Editor-Persistence"] == "disabled"
    assert "X-Frame-Options" not in response.headers
    policy = response.headers["Content-Security-Policy"]
    assert "default-src 'self'" in policy
    assert "object-src 'none'" in policy
    assert "img-src 'self' data: blob:" in policy
    assert "frame-ancestors 'self'" in policy
    assert "http://127.0.0.1:56000" in policy
    assert "http://localhost:56000" in policy


def test_reconstruction_preview_rejects_untrusted_parent_origin() -> None:
    response = _client().get(
        "/editor/reconstruction-preview?parentOrigin=https://attacker.invalid"
    )

    assert response.status_code == 200
    page = response.get_data(as_text=True)
    assert "https://attacker.invalid" not in page
    assert 'data-reconstruction-preview-parent-origin="http://127.0.0.1:56000"' in page
    assert "https://attacker.invalid" not in response.headers[
        "Content-Security-Policy"
    ]


def test_built_reconstruction_runtime_contains_visible_plan_overlay_layers() -> None:
    service_root = Path(__file__).resolve().parents[1]
    static_root = service_root / "static" / "editor"
    manifest = json.loads((static_root / "manifest.json").read_text(encoding="utf-8"))
    runtime_asset = manifest["reconstruction_preview/reconstruction_preview_runtime.ts"][
        "file"
    ]
    runtime_path = (static_root / runtime_asset).resolve()

    assert runtime_path.is_relative_to(static_root.resolve())
    assert runtime_path.is_file()
    runtime = runtime_path.read_text(encoding="utf-8")
    for marker in (
        "floorplan_door_marker",
        "floorplan_door_outline",
        "floorplan_window_marker",
        "floorplan_window_outline",
        "room_topology_polygon",
        "stair_topology_polygon",
        "room_opening_marker",
        "visibleOverlayRender",
        "pendingOverlayRender",
        "overlayDepthTest",
    ):
        assert marker in runtime
