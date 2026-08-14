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
