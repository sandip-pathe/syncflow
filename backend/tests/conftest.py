import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from unittest.mock import MagicMock, AsyncMock
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("TEMPORAL_HOST", "localhost:7233")
os.environ.setdefault("TEMPORAL_NAMESPACE", "default")
os.environ.setdefault("OPENAI_API_KEY", "test-key")

# Mocking database session for tests
@pytest.fixture
def mock_db_session():
    """Mocks the database session to prevent actual database calls."""
    db_session = MagicMock()
    # Add any specific mock behaviors you need, e.g., for query, add, commit
    db_session.query.return_value.filter.return_value.first.return_value = None
    return db_session

# Mocking the Temporal client
@pytest.fixture
def mock_temporal_client():
    """Mocks the Temporal client to prevent actual workflow executions."""
    client = AsyncMock()
    # Mock the handle for starting a workflow
    handle = AsyncMock()
    client.start_workflow.return_value = handle
    return client

# Creating a test client for the FastAPI app
@pytest_asyncio.fixture
async def test_client(mock_db_session):
    """Creates an async test client for the FastAPI application."""
    from app.main import app
    from app.core.database import get_db

    def override_get_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
