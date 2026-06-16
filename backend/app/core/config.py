from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List
import os

class Settings(BaseSettings):
    # App
    APP_NAME: str = "SyncFlow Durable AI Workflow Builder"
    DEBUG: bool = False  # Production default
    API_PORT: int = 8000

    # CORS - Can be set via CORS_ORIGINS environment variable (comma-separated)
    # Use "*" to allow all origins (not recommended for production with credentials)
    CORS_ORIGINS: str = "*"
    
    # Frontend URL (for notifications and approval links)
    FRONTEND_URL: str = "http://localhost:3000"

    # Execution
    # local: deterministic demo runner with no Temporal/Redis/OpenAI dependency
    # temporal: production durable execution path
    EXECUTION_BACKEND: str = "local"
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS_ORIGINS string into a list"""
        origins_str = self.CORS_ORIGINS.strip()
        
        # If set to "*", return ["*"] for allow all
        if origins_str == "*":
            return ["*"]
        
        # Parse comma-separated list
        origins = [origin.strip() for origin in origins_str.split(",") if origin.strip()]
        
        # In production, also add common deployment URLs
        if not self.DEBUG:
            # Add the current Railway URL if available
            railway_url = os.getenv("RAILWAY_PUBLIC_DOMAIN")
            if railway_url:
                origins.append(f"https://{railway_url}")
        
        return origins

    # Database
    DATABASE_URL: str = "sqlite:///./local-dev.sqlite3"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Temporal Cloud
    TEMPORAL_HOST: str = "localhost:7233"  # Format: <region>.<cloud_provider>.api.temporal.io:7233
    TEMPORAL_NAMESPACE: str = "default"  # Format: <namespace>.<account_id>
    TEMPORAL_API_KEY: str | None = None  # Temporal Cloud API Key (recommended)
    
    # Legacy mTLS (optional, only if not using API key)
    TEMPORAL_TLS_CERT: str | None = None  # Path to client cert
    TEMPORAL_TLS_KEY: str | None = None   # Path to client key

    # APIs
    OPENAI_API_KEY: str = "local-demo-key"
    EXTERNAL_AGENT_API_KEY: str | None = None
    EXTERNAL_AGENT_BASE_URL: str = "https://example.com/api"

    # Notifications
    SLACK_WEBHOOK_URL: str | None = None
    RESEND_API_KEY: str | None = None
    FROM_EMAIL: str | None = None

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings() # type: ignore # Will load from .env automatically

settings = get_settings()
