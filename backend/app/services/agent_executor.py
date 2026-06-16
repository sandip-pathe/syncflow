"""Agent executor with parameter auto-tuning"""
from typing import Optional, Dict, Any
import httpx
from openai import AsyncOpenAI
from app.core.config import settings
from app.services.self_healing import SelfHealingService
import time
import logging

class AgentExecutor:
    def __init__(self):
        self.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.self_healing = SelfHealingService()
        
        # Auto-tuning parameters
        self.temperature_ranges = {
            "low": 0.3,
            "medium": 0.7,
            "high": 1.0
        }

    async def execute(
        self, 
        name: str,
        system_instructions: str,
        input_data: Dict[str, Any],
        temperature: Optional[float] = 0.7,
        expected_output_format: Optional[str] = None,
        provider: str = "openai",
        agent_id: str = "gpt-4o-mini",
        enable_auto_tuning: bool = False,
        previous_eval_score: Optional[float] = None
    ) -> dict:
        """Execute agent with new schema support"""
        start_time = time.time()
        
        # Auto-tune temperature based on previous eval score
        if enable_auto_tuning and previous_eval_score is not None:
            if previous_eval_score < 0.5:
                temperature = self.temperature_ranges["high"]  # More creative
            elif previous_eval_score > 0.9:
                temperature = self.temperature_ranges["low"]  # More deterministic
            else:
                temperature = self.temperature_ranges["medium"]
        
        try:
            if provider == "openai":
                result = await self._execute_openai(
                    agent_id=agent_id,
                    system_instructions=system_instructions,
                    input_data=input_data,
                    temperature=temperature,
                    expected_output_format=expected_output_format
                )
            elif provider == "external":
                result = await self._execute_external_agent(agent_id, input_data)
            elif provider in ["anthropic", "custom"]:
                result = await self._execute_custom(provider, agent_id, input_data)
            else:
                raise ValueError(f"Unsupported provider: {provider}")
            
            latency_ms = (time.time() - start_time) * 1000
            
            # Record success
            self.self_healing.record_agent_execution(
                provider=provider,
                agent_id=agent_id,
                success=True,
                latency_ms=latency_ms,
                cost=result.get("cost", 0.0)
            )
            
            return result
        
        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            
            # Record failure
            self.self_healing.record_agent_execution(
                provider=provider,
                agent_id=agent_id,
                success=False,
                latency_ms=latency_ms
            )
            
            raise

    async def _execute_openai(
        self,
        agent_id: str,
        system_instructions: str,
        input_data: Dict[str, Any],
        temperature: Optional[float] = None,
        expected_output_format: Optional[str] = None
    ) -> dict:
        """Execute OpenAI agent with new schema"""
        # Build messages from input_data
        messages = []
        
        # Add system message
        messages.append({"role": "system", "content": system_instructions})
        
        # Add expected output format if provided
        if expected_output_format:
            messages.append({
                "role": "system",
                "content": f"Expected output format: {expected_output_format}"
            })
        
        # Handle input_data - could be text or structured
        if isinstance(input_data, dict):
            if "prompt" in input_data:
                messages.append({"role": "user", "content": str(input_data["prompt"])})
            elif "input_text" in input_data:
                # Handle trigger input_text field
                messages.append({"role": "user", "content": str(input_data["input_text"])})
            elif "messages" in input_data:
                messages.extend(input_data["messages"])
            else:
                # Convert dict to a readable format
                import json
                messages.append({
                    "role": "user",
                    "content": json.dumps(input_data, indent=2)
                })
        else:
            messages.append({"role": "user", "content": str(input_data)})

        params = {
            "model": agent_id,
            "messages": messages
        }

        if temperature is not None:
            params["temperature"] = temperature

        response = await self.openai_client.chat.completions.create(**params)
        cost = 0
        if response.usage:
            cost = ((response.usage.prompt_tokens * 0.15) + (response.usage.completion_tokens * 0.6)) / 1_000_000

        return {
            "output": response.choices[0].message.content,
            "model": agent_id,
            "cost": cost,
            "usage": response.usage.model_dump() if response.usage else {},
            "temperature_used": temperature
        }
    
    async def _execute_external_agent(self, agent_id: str, input_data: dict) -> dict:
        """Execute an externally hosted agent."""
        if not settings.EXTERNAL_AGENT_API_KEY:
            raise ValueError("EXTERNAL_AGENT_API_KEY not configured")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.EXTERNAL_AGENT_BASE_URL.rstrip('/')}/agents/{agent_id}/execute",
                json=input_data,
                headers={"Authorization": f"Bearer {settings.EXTERNAL_AGENT_API_KEY}"},
                timeout=300
            )
            response.raise_for_status()
            return response.json()
    
    async def _execute_custom(self, provider: str, agent_id: str, input_data: dict) -> dict:
        """Execute custom agent via HTTP"""
        # Placeholder for custom agent execution
        logging.getLogger(__name__).info(f"Executing custom agent '{agent_id}' from provider '{provider}'")
        return {"output": f"Mock execution for {agent_id}", "agent_id": agent_id, "cost": 0.0}
