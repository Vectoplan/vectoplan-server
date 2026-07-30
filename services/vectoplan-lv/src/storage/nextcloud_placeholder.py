"""Explicit boundary for a future Nextcloud storage adapter."""


class NextcloudStorageUnavailable(RuntimeError):
    pass


def create_nextcloud_provider():
    raise NextcloudStorageUnavailable(
        "Nextcloud is intentionally not implemented in the initial service slice"
    )


__all__ = ["NextcloudStorageUnavailable", "create_nextcloud_provider"]
