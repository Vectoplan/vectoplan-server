from src.domain.identifiers import is_public_id, new_public_id


def test_public_ids_are_prefixed_and_unique():
    first = new_public_id("lv")
    second = new_public_id("lv")

    assert first != second
    assert is_public_id(first, "lv")
    assert not is_public_id(first, "lvv")
