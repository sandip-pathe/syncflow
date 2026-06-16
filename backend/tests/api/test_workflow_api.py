import pytest
from unittest.mock import patch, MagicMock
from uuid import uuid4

# Mark all tests in this file as asyncio
pytestmark = pytest.mark.asyncio

@pytest.fixture
def mock_workflow_model():
    """Fixture to create a mock Workflow ORM object."""
    workflow = MagicMock()
    workflow.id = str(uuid4())
    workflow.name = "Test Workflow"
    workflow.description = "A test workflow"
    workflow.definition = {
        "nodes": [
            {"id": "start", "type": "trigger", "data": {}},
            {"id": "end", "type": "end", "data": {}},
        ],
        "edges": [{"id": "edge-1", "source": "start", "target": "end"}],
    }
    return workflow

async def test_create_workflow_success(test_client, mock_db_session):
    """
    GIVEN a valid workflow creation payload
    WHEN the POST /workflows/ endpoint is called
    THEN it should return a 200 OK status and the ID of the created workflow.
    """
    payload = {
        "name": "My New Workflow",
        "description": "This is a test.",
        "nodes": [{"id": "1", "type": "trigger", "data": {}}],
        "edges": []
    }

    response = await test_client.post("/api/workflows/", json=payload)

    assert response.status_code == 200
    response_data = response.json()
    assert "id" in response_data
    assert response_data["name"] == payload["name"]
    assert response_data["description"] == payload["description"]
    mock_db_session.add.assert_called_once()
    mock_db_session.commit.assert_called_once()


async def test_get_workflow_not_found(test_client, mock_db_session):
    """
    GIVEN a non-existent workflow ID
    WHEN the GET /workflows/{workflow_id} endpoint is called
    THEN it should return a 404 Not Found error.
    """
    non_existent_id = str(uuid4())

    response = await test_client.get(f"/api/workflows/{non_existent_id}")

    assert response.status_code == 404
    assert response.json() == {"detail": "Workflow not found"}


async def test_execute_workflow_temporal_backend(test_client, mock_db_session, mock_temporal_client, mock_workflow_model):
    """
    GIVEN a valid workflow and execution request
    WHEN the POST /workflows/{workflow_id}/execute endpoint is called
    THEN it should successfully start a Temporal workflow and return a 200 OK status.
    """
    # Arrange
    # Ensure the database mock returns our mock workflow
    mock_db_session.query.return_value.filter.return_value.first.return_value = mock_workflow_model

    with patch("app.api.workflows.settings.EXECUTION_BACKEND", "temporal"), patch("app.api.workflows.get_temporal_client", return_value=mock_temporal_client):
        payload = {"input_data": {"message": "Hello World"}}

        response = await test_client.post(f"/api/workflows/{mock_workflow_model.id}/execute", json=payload)

        assert response.status_code == 200
        response_data = response.json()
        assert "execution_id" in response_data
        assert response_data["status"] == "running"
        assert response_data["execution_backend"] == "temporal"
        mock_temporal_client.start_workflow.assert_awaited_once()


async def test_execute_workflow_local_backend(test_client, mock_db_session, mock_workflow_model):
    """
    GIVEN local execution mode
    WHEN the execute endpoint is called
    THEN it completes a simple workflow without Temporal.
    """
    mock_db_session.query.return_value.filter.return_value.first.return_value = mock_workflow_model

    with patch("app.api.workflows.settings.EXECUTION_BACKEND", "local"):
        response = await test_client.post(
            f"/api/workflows/{mock_workflow_model.id}/execute",
            json={"input_data": {"message": "Hello World"}},
        )

    assert response.status_code == 200
    response_data = response.json()
    assert response_data["status"] == "completed"
    assert response_data["execution_backend"] == "local"
    assert response_data["events"]
    assert response_data["output"]["audit"]["nodes_executed"] == 2


async def test_execute_workflow_invalid_definition_returns_validation_error(
    test_client, mock_db_session, mock_workflow_model
):
    """
    GIVEN an invalid workflow definition
    WHEN the execute endpoint is called
    THEN it returns a validation error before starting execution.
    """
    mock_workflow_model.definition = {
        "nodes": [{"id": "start", "type": "trigger", "data": {}}],
        "edges": [],
    }
    mock_db_session.query.return_value.filter.return_value.first.return_value = mock_workflow_model

    response = await test_client.post(
        f"/api/workflows/{mock_workflow_model.id}/execute",
        json={"input_data": {"message": "Hello World"}},
    )

    assert response.status_code == 400
    response_data = response.json()
    assert response_data["detail"]["message"] == "Workflow validation failed"
    assert response_data["detail"]["errors"]
    mock_db_session.add.assert_not_called()
