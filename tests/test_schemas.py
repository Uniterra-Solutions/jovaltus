"""Tests for Jovaltus plugin — JSON schemas."""

from jovaltus import schemas


def test_implement_schema_has_required_fields():
    s = schemas.IMPLEMENT_SCHEMA
    assert s["name"] == "jovaltus_implement"
    assert "description" in s
    assert "parameters" in s
    assert s["parameters"]["type"] == "object"
    assert "project_dir" in s["parameters"]["properties"]


def test_verify_schema_has_dual_mode_params():
    """Verify schema should support both task_id and before/after."""
    s = schemas.VERIFY_SCHEMA
    assert s["name"] == "jovaltus_verify"
    props = s["parameters"]["properties"]
    assert "task_id" in props
    assert "before" in props
    assert "after" in props
    # task_id and before are mutually exclusive — neither is required
    assert "required" not in s["parameters"]


def test_simplify_schema_has_dual_mode_params():
    """Simplify schema should support both task_id and before/after."""
    s = schemas.SIMPLIFY_SCHEMA
    assert s["name"] == "jovaltus_simplify"
    props = s["parameters"]["properties"]
    assert "task_id" in props
    assert "before" in props
    assert "after" in props
    assert "required" not in s["parameters"]


def test_all_schemas_mention_subagent_spawning():
    """All tool descriptions should mention that they spawn subagents."""
    for schema in [
        schemas.IMPLEMENT_SCHEMA,
        schemas.VERIFY_SCHEMA,
        schemas.SIMPLIFY_SCHEMA,
    ]:
        assert "spawn" in schema["description"].lower()
