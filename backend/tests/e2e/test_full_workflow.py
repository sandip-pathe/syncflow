import pytest
import httpx
import asyncio
import os

pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.e2e,
    pytest.mark.skipif(
        os.getenv("RUN_E2E") != "1",
        reason="requires a running backend, database, Redis, Temporal, and agent credentials",
    ),
]

# Base URL for our running service
BASE_URL = "http://localhost:8000"

# A sample workflow definition for our test
SIMPLE_AGENT_WORKFLOW = {
    "name": "E2E Test - Simple Agent Workflow",
    "description": "A workflow to test the full execution path.",
    "nodes": [
        {
            "id": "start-node",
            "type": "trigger",
            "data": {}
        },
        {
            "id": "agent-node",
            "type": "agent",
            "data": {
                "provider": "openai",
                "agent_id": "gpt-4o-mini", # Use a fast and cheap model for testing
                "input_mapping": {
                    "messages": [
                        {
                            "role": "user",
                            "content": "What is the capital of France? Respond with only the name of the city."
                        }
                    ]
                }
            }
        }
    ],
    "edges": [
        {
            "id": "edge-1",
            "source": "start-node",
            "target": "agent-node"
        }
    ]
}

@pytest.mark.asyncio
async def test_create_and_run_simple_workflow():
    """
    This is an end-to-end test that performs the following steps:
    1. Ensures the backend service is reachable.
    2. Creates a new workflow definition via the API.
    3. Starts an execution of that workflow.
    4. Polls the execution status until it completes.
    5. Verifies the final output of the workflow.
    """
    async with httpx.AsyncClient() as client:
        # --- 1. Health Check: Ensure the service is running ---
        try:
            health_response = await client.get(f"{BASE_URL}/health")
            assert health_response.status_code == 200, "Health check failed. Is the backend container running?"
            print("\n✅ Health check passed.")
        except httpx.ConnectError:
            pytest.fail("Connection failed. Please ensure your docker-compose stack is up and running.")

        # --- 2. Create Workflow ---
        print("Creating workflow...")
        create_response = await client.post(f"{BASE_URL}/api/workflows/", json=SIMPLE_AGENT_WORKFLOW)
        assert create_response.status_code == 200
        workflow_data = create_response.json()
        workflow_id = workflow_data.get("id")
        assert workflow_id is not None
        print(f"Workflow created with ID: {workflow_id}")

        # --- 3. Execute Workflow ---
        print("Executing workflow...")
        execute_response = await client.post(f"{BASE_URL}/api/workflows/{workflow_id}/execute", json={"input_data": {}})
        assert execute_response.status_code == 200
        execution_data = execute_response.json()
        execution_id = execution_data.get("execution_id")
        assert execution_id is not None
        print(f"Execution started with ID: {execution_id}")

        # --- 4. Poll for Completion ---
        print("Polling for execution status...")
        final_status = ""
        output_data = None
        for i in range(180): # Poll for up to 20 seconds
            await asyncio.sleep(1)
            print(f"  ...polling attempt {i+1}")
            status_response = await client.get(f"{BASE_URL}/api/executions/{execution_id}")
            
            if status_response.status_code == 200:
                status_data = status_response.json()
                final_status = status_data.get("status")
                if final_status in ["completed", "failed"]:
                    output_data = status_data.get("output_data")
                    break
        
        print(f"Final status received: {final_status}")
        assert final_status == "completed", f"Workflow did not complete successfully. Final status was '{final_status}'."

        # --- 5. Verify the Output ---
        print("Verifying output...")
        assert output_data is not None
        # The output from an agent node is nested
        agent_output = output_data.get("output", "").strip()
        print(f"Agent output: '{agent_output}'")
        assert "Paris" in agent_output

        print("✅ E2E test passed successfully!")
