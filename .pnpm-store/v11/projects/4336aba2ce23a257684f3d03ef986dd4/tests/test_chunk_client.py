from types import MethodType, SimpleNamespace

from src.clients.chunk_client import ChunkClient


def test_send_command_forwards_compact_response_query():
    client = ChunkClient.__new__(ChunkClient)
    client.config = SimpleNamespace(command_timeout_seconds=2.5)
    captured = {}
    expected = object()

    def fake_post(self, path, **kwargs):
        captured["path"] = path
        captured.update(kwargs)
        return expected

    client.post = MethodType(fake_post, client)

    result = client.send_command(
        "project",
        "world",
        {"type": "SetBlock"},
        include_command_log=False,
    )

    assert result is expected
    assert captured["path"] == "/projects/project/worlds/world/commands"
    assert captured["query"] == {"includeCommandLog": False}
    assert captured["json_body"] == {"type": "SetBlock"}
    assert captured["timeout_seconds"] == 2.5


def test_send_command_preserves_legacy_default_without_query():
    client = ChunkClient.__new__(ChunkClient)
    client.config = SimpleNamespace(command_timeout_seconds=2.5)
    captured = {}

    def fake_post(self, path, **kwargs):
        captured.update(kwargs)
        return object()

    client.post = MethodType(fake_post, client)
    client.send_command("project", "world", {"type": "RemoveBlock"})

    assert captured["query"] is None


def test_active_editor_dataset_uses_project_scoped_upstream_route():
    client = ChunkClient.__new__(ChunkClient)
    client.config = SimpleNamespace(request_timeout_seconds=3.0)
    captured = {}
    expected = object()

    def fake_get(self, path, **kwargs):
        captured["path"] = path
        captured.update(kwargs)
        return expected

    client.get = MethodType(fake_get, client)
    result = client.get_active_editor_dataset("project id", "world spawn")

    assert result is expected
    assert captured["path"] == "/projects/project%20id/worlds/world%20spawn/editor-datasets/active"
    assert captured["timeout_seconds"] == 3.0


def test_active_editor_dataset_chunk_forwards_only_integer_coordinates():
    client = ChunkClient.__new__(ChunkClient)
    client.config = SimpleNamespace(request_timeout_seconds=3.0)
    captured = {}

    def fake_get(self, path, **kwargs):
        captured["path"] = path
        captured.update(kwargs)
        return object()

    client.get = MethodType(fake_get, client)
    client.get_active_editor_dataset_chunk(
        "project",
        "world",
        chunk_x=-2,
        chunk_y=0,
        chunk_z=7,
    )

    assert captured["path"].endswith("/editor-datasets/active/chunks")
    assert captured["query"] == {"chunkX": -2, "chunkY": 0, "chunkZ": 7}
