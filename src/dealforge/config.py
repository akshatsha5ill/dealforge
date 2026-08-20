import os
from typing import Any
from pydantic import BaseModel, ConfigDict
from pydantic_settings import BaseSettings, SettingsConfigDict
import tomli

class AppConfig(BaseModel):
    log_level: str = "INFO"

class MeetingConfig(BaseModel):
    platform: str = "zoom"
    api_key: str = ""

class IntentConfig(BaseModel):
    provider: str = "openai"
    model: str = "gpt-4o-mini"
    threshold: float = 0.6

class RagConfig(BaseModel):
    embedder: str = "openai"
    vectorstore: str = "chroma"
    top_k: int = 4
    collateral_dir: str = "./collateral"

class AnswerConfig(BaseModel):
    provider: str = "openai"
    model: str = "gpt-4o"

class DmConfig(BaseModel):
    method: str = "meeting_dm"

class StorageConfig(BaseModel):
    type: str = "sqlite"
    path: str = "./dealforge.db"

class DealForgeConfig(BaseSettings):
    app: AppConfig = AppConfig()
    meeting: MeetingConfig = MeetingConfig()
    intent: IntentConfig = IntentConfig()
    rag: RagConfig = RagConfig()
    answer: AnswerConfig = AnswerConfig()
    dm: DmConfig = DmConfig()
    storage: StorageConfig = StorageConfig()

    model_config = SettingsConfigDict(
        env_nested_delimiter="__",
        env_file=".env",
        env_file_encoding="utf-8"
    )

    @classmethod
    def load(cls, config_path: str = "dealforge.toml") -> "DealForgeConfig":
        config_data = {}
        if os.path.exists(config_path):
            with open(config_path, "rb") as f:
                config_data = tomli.load(f)

        # Resolve 'env:' prefixed strings
        def resolve_envs(data: Any) -> Any:
            if isinstance(data, dict):
                return {k: resolve_envs(v) for k, v in data.items()}
            elif isinstance(data, list):
                return [resolve_envs(item) for item in data]
            elif isinstance(data, str) and data.startswith("env:"):
                env_var = data[4:]
                return os.environ.get(env_var, "")
            return data

        resolved_data = resolve_envs(config_data)
        return cls(**resolved_data)
