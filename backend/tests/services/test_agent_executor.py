import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from app.services.agent_executor import AgentExecutor


async def test_execute_custom_provider_records_success():
    """
    GIVEN a custom provider agent
    WHEN the executor runs it
    THEN it returns the mock custom execution result and records success.
    """
    executor = AgentExecutor()
    executor.self_healing = MagicMock()

    result = await executor.execute(
        name="Custom Agent",
        system_instructions="",
        provider="custom",
        agent_id="local-agent",
        input_data={"prompt": "Hello"},
    )

    assert result == {"output": "Mock execution for local-agent", "agent_id": "local-agent", "cost": 0.0}
    executor.self_healing.record_agent_execution.assert_called_once()
    assert executor.self_healing.record_agent_execution.call_args.kwargs["success"] is True


@pytest.mark.asyncio
@patch("app.services.agent_executor.AsyncOpenAI")
async def test_execute_openai_agent(mock_openai_class):
    """
    GIVEN an agent executor with a mocked OpenAI client
    WHEN the execute method is called for the 'openai' provider
    THEN it should call the OpenAI API with the correct parameters.
    """
    mock_usage = MagicMock()
    mock_usage.prompt_tokens = 100
    mock_usage.completion_tokens = 50
    mock_usage.model_dump.return_value = {
        "prompt_tokens": 100,
        "completion_tokens": 50,
        "total_tokens": 150,
    }

    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = "This is the AI response."
    mock_response.usage = mock_usage

    mock_openai_instance = MagicMock()
    mock_openai_instance.chat = MagicMock()
    mock_openai_instance.chat.completions = MagicMock()
    mock_openai_instance.chat.completions.create = AsyncMock(return_value=mock_response)
    mock_openai_instance.chat.completions.create.return_value = mock_response
    mock_openai_class.return_value = mock_openai_instance

    executor = AgentExecutor()
    
    # Mock the self-healing service to avoid database calls
    executor.self_healing = MagicMock()

    result = await executor.execute(
        name="OpenAI Agent",
        system_instructions="Be concise.",
        provider="openai",
        agent_id="gpt-4o-mini",
        input_data={"messages": [{"role": "user", "content": "Hello"}]}
    )

    assert result["output"] == "This is the AI response."
    assert result["model"] == "gpt-4o-mini"
    assert result["usage"] == {
        "prompt_tokens": 100,
        "completion_tokens": 50,
        "total_tokens": 150,
    }
    
    mock_openai_instance.chat.completions.create.assert_awaited_once_with(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Be concise."},
            {"role": "user", "content": "Hello"},
        ],
        temperature=0.7,
    )

    executor.self_healing.record_agent_execution.assert_called_once()
    assert executor.self_healing.record_agent_execution.call_args.kwargs["success"] is True
