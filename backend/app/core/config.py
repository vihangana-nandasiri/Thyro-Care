from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Immutable application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = Field(default="ThyroCare AI API", alias="APP_NAME")
    app_version: str = Field(default="0.1.0", alias="APP_VERSION")
    app_environment: Literal["development", "staging", "production", "test"] = Field(
        default="development",
        alias="APP_ENVIRONMENT",
    )
    debug: bool = Field(default=True, alias="DEBUG")
    api_v1_prefix: str = Field(default="/api/v1", alias="API_V1_PREFIX")
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    allowed_origins: str = Field(default="http://localhost:5173", alias="ALLOWED_ORIGINS")
    mongodb_uri: str = Field(default="mongodb://localhost:27017", alias="MONGODB_URI")
    mongodb_database: str = Field(default="thyrocare_ai", alias="MONGODB_DATABASE")
    mongodb_server_selection_timeout_ms: int = Field(
        default=3000,
        alias="MONGODB_SERVER_SELECTION_TIMEOUT_MS",
    )
    mongodb_connect_timeout_ms: int = Field(default=3000, alias="MONGODB_CONNECT_TIMEOUT_MS")
    mongodb_socket_timeout_ms: int = Field(default=10000, alias="MONGODB_SOCKET_TIMEOUT_MS")
    database_auto_initialize: bool = Field(default=True, alias="DATABASE_AUTO_INITIALIZE")
    database_run_migrations: bool = Field(default=True, alias="DATABASE_RUN_MIGRATIONS")
    database_require_connection: bool = Field(
        default=False,
        alias="DATABASE_REQUIRE_CONNECTION",
    )
    database_test_name: str = Field(default="thyrocare_ai_test", alias="DATABASE_TEST_NAME")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    request_timeout_seconds: int = Field(default=30, alias="REQUEST_TIMEOUT_SECONDS")
    rate_limit_enabled: bool = Field(default=False, alias="RATE_LIMIT_ENABLED")
    rate_limit_default: str = Field(default="100/minute", alias="RATE_LIMIT_DEFAULT")
    openapi_enabled: bool = Field(default=True, alias="OPENAPI_ENABLED")

    # Authentication
    authentication_enabled: bool = Field(default=True, alias="AUTHENTICATION_ENABLED")
    jwt_secret_key: str = Field(
        default="dev-only-change-me-use-openssl-rand-hex-32-chars-min",
        alias="JWT_SECRET_KEY",
    )
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_issuer: str = Field(default="thyrocare-ai-api", alias="JWT_ISSUER")
    jwt_audience: str = Field(default="thyrocare-ai-web", alias="JWT_AUDIENCE")
    access_token_expire_minutes: int = Field(default=15, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=14, alias="REFRESH_TOKEN_EXPIRE_DAYS")
    jwt_clock_skew_seconds: int = Field(default=30, alias="JWT_CLOCK_SKEW_SECONDS")
    password_min_length: int = Field(default=10, alias="PASSWORD_MIN_LENGTH")
    password_max_length: int = Field(default=128, alias="PASSWORD_MAX_LENGTH")
    login_max_failed_attempts: int = Field(default=5, alias="LOGIN_MAX_FAILED_ATTEMPTS")
    login_lock_minutes: int = Field(default=15, alias="LOGIN_LOCK_MINUTES")
    auth_rate_limit_login: str = Field(default="10/minute", alias="AUTH_RATE_LIMIT_LOGIN")
    auth_rate_limit_register: str = Field(default="5/minute", alias="AUTH_RATE_LIMIT_REGISTER")
    auth_rate_limit_refresh: str = Field(default="30/minute", alias="AUTH_RATE_LIMIT_REFRESH")
    refresh_cookie_name: str = Field(default="thyrocare_refresh", alias="REFRESH_COOKIE_NAME")
    csrf_cookie_name: str = Field(default="thyrocare_csrf", alias="CSRF_COOKIE_NAME")
    cookie_secure: bool = Field(default=False, alias="COOKIE_SECURE")
    cookie_samesite: Literal["lax", "strict", "none"] = Field(
        default="lax",
        alias="COOKIE_SAMESITE",
    )
    cookie_domain: str | None = Field(default=None, alias="COOKIE_DOMAIN")
    cookie_path: str = Field(default="/api/v1/auth", alias="COOKIE_PATH")
    csrf_header_name: str = Field(default="X-CSRF-Token", alias="CSRF_HEADER_NAME")
    require_email_verification: bool = Field(
        default=False,
        alias="REQUIRE_EMAIL_VERIFICATION",
    )

    # Phase 13A — email delivery / recovery / Google
    email_delivery_enabled: bool = Field(default=False, alias="EMAIL_DELIVERY_ENABLED")
    email_provider: str = Field(default="smtp", alias="EMAIL_PROVIDER")
    smtp_host: str = Field(default="", alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_username: str = Field(default="", alias="SMTP_USERNAME")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD")
    smtp_use_tls: bool = Field(default=True, alias="SMTP_USE_TLS")
    smtp_from_email: str = Field(default="", alias="SMTP_FROM_EMAIL")
    smtp_from_name: str = Field(default="ThyroCare AI", alias="SMTP_FROM_NAME")
    frontend_public_url: str = Field(
        default="http://localhost:5173",
        alias="FRONTEND_PUBLIC_URL",
    )
    email_verification_enabled: bool = Field(default=False, alias="EMAIL_VERIFICATION_ENABLED")
    email_verification_token_ttl_hours: int = Field(
        default=24,
        alias="EMAIL_VERIFICATION_TOKEN_TTL_HOURS",
    )
    password_reset_enabled: bool = Field(default=False, alias="PASSWORD_RESET_ENABLED")
    password_reset_token_ttl_minutes: int = Field(
        default=30,
        alias="PASSWORD_RESET_TOKEN_TTL_MINUTES",
    )
    google_auth_enabled: bool = Field(default=False, alias="GOOGLE_AUTH_ENABLED")
    google_client_id: str = Field(default="", alias="GOOGLE_CLIENT_ID")
    auth_rate_limit_forgot_password: str = Field(
        default="5/minute",
        alias="AUTH_RATE_LIMIT_FORGOT_PASSWORD",
    )
    auth_rate_limit_reset_password: str = Field(
        default="10/minute",
        alias="AUTH_RATE_LIMIT_RESET_PASSWORD",
    )
    auth_rate_limit_verify_email: str = Field(
        default="10/minute",
        alias="AUTH_RATE_LIMIT_VERIFY_EMAIL",
    )
    auth_rate_limit_resend_verification: str = Field(
        default="3/minute",
        alias="AUTH_RATE_LIMIT_RESEND_VERIFICATION",
    )
    auth_rate_limit_change_password: str = Field(
        default="5/minute",
        alias="AUTH_RATE_LIMIT_CHANGE_PASSWORD",
    )
    auth_rate_limit_google: str = Field(default="10/minute", alias="AUTH_RATE_LIMIT_GOOGLE")

    # Phase 11 / 13B — safe assistant (default disabled)
    ai_assistant_enabled: bool = Field(default=False, alias="AI_ASSISTANT_ENABLED")
    llm_provider: str = Field(default="disabled", alias="LLM_PROVIDER")
    llm_model: str = Field(default="", alias="LLM_MODEL")
    llm_api_key: str = Field(default="", alias="LLM_API_KEY")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_chat_model: str = Field(default="", alias="OPENAI_CHAT_MODEL")
    openai_embedding_model: str = Field(
        default="text-embedding-3-small",
        alias="OPENAI_EMBEDDING_MODEL",
    )
    openai_timeout_seconds: int = Field(default=25, alias="OPENAI_TIMEOUT_SECONDS")
    openai_max_retries: int = Field(default=1, ge=0, le=3, alias="OPENAI_MAX_RETRIES")
    openai_store_responses: bool = Field(default=False, alias="OPENAI_STORE_RESPONSES")
    llm_timeout_seconds: int = Field(default=20, alias="LLM_TIMEOUT_SECONDS")
    llm_max_output_tokens: int = Field(default=700, alias="LLM_MAX_OUTPUT_TOKENS")
    llm_reasoning_effort: str = Field(default="low", alias="LLM_REASONING_EFFORT")
    llm_temperature: float = Field(default=0.2, alias="LLM_TEMPERATURE")
    moderation_enabled: bool = Field(default=False, alias="MODERATION_ENABLED")
    moderation_model: str = Field(
        default="omni-moderation-latest",
        alias="MODERATION_MODEL",
    )
    knowledge_retrieval_mode: str = Field(default="lexical", alias="KNOWLEDGE_RETRIEVAL_MODE")
    knowledge_max_chunks: int = Field(default=5, alias="KNOWLEDGE_MAX_CHUNKS")
    knowledge_min_score: float = Field(default=0.15, alias="KNOWLEDGE_MIN_SCORE")
    vector_search_enabled: bool = Field(default=False, alias="VECTOR_SEARCH_ENABLED")
    vector_search_index_name: str = Field(default="", alias="VECTOR_SEARCH_INDEX_NAME")
    knowledge_vector_top_k: int = Field(default=12, alias="KNOWLEDGE_VECTOR_TOP_K")
    knowledge_lexical_top_k: int = Field(default=12, alias="KNOWLEDGE_LEXICAL_TOP_K")
    knowledge_final_top_k: int = Field(default=5, alias="KNOWLEDGE_FINAL_TOP_K")
    knowledge_min_vector_score: float = Field(default=0.0, alias="KNOWLEDGE_MIN_VECTOR_SCORE")
    knowledge_min_lexical_score: float = Field(
        default=0.15,
        alias="KNOWLEDGE_MIN_LEXICAL_SCORE",
    )
    knowledge_rrf_k: int = Field(default=60, alias="KNOWLEDGE_RRF_K")
    chat_max_message_length: int = Field(default=4000, alias="CHAT_MAX_MESSAGE_LENGTH")
    chat_max_history_messages: int = Field(default=50, alias="CHAT_MAX_HISTORY_MESSAGES")
    chat_rate_limit: str = Field(default="20/minute", alias="CHAT_RATE_LIMIT")
    chat_streaming_enabled: bool = Field(default=True, alias="CHAT_STREAMING_ENABLED")
    chat_context_max_messages: int = Field(default=10, alias="CHAT_CONTEXT_MAX_MESSAGES")
    chat_daily_message_limit: int = Field(default=100, alias="CHAT_DAILY_MESSAGE_LIMIT")
    chat_retention_days: int | None = Field(default=None, alias="CHAT_RETENTION_DAYS")
    chat_hard_delete_enabled: bool = Field(default=False, alias="CHAT_HARD_DELETE_ENABLED")
    prompt_version: str = Field(default="assistant-policy-v2", alias="PROMPT_VERSION")
    retrieval_version: str = Field(default="hybrid-retrieval-v1", alias="RETRIEVAL_VERSION")
    eval_dataset_version: str = Field(default="chatbot-evals-v1", alias="EVAL_DATASET_VERSION")
    embedding_pipeline_version: str = Field(
        default="embedding-pipeline-v1",
        alias="EMBEDDING_PIPELINE_VERSION",
    )

    @field_validator("api_v1_prefix")
    @classmethod
    def normalize_prefix(cls, value: str) -> str:
        value = value.strip() or "/api/v1"
        if not value.startswith("/"):
            value = f"/{value}"
        return value.rstrip("/") or "/api/v1"

    @field_validator("cookie_domain", mode="before")
    @classmethod
    def empty_domain_to_none(cls, value: object) -> object:
        if value == "" or value is None:
            return None
        return value

    @property
    def is_production(self) -> bool:
        return self.app_environment == "production"

    @property
    def is_development(self) -> bool:
        return self.app_environment in {"development", "test"}

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def access_token_expire_seconds(self) -> int:
        return self.access_token_expire_minutes * 60

    def validate_for_runtime(self) -> None:
        """Fail clearly when critical production values are missing or unsafe."""
        if not self.database_test_name.endswith("_test"):
            raise ValueError("DATABASE_TEST_NAME must end with '_test'")
        if self.jwt_algorithm != "HS256":
            raise ValueError("Only HS256 is supported for JWT_ALGORITHM")
        if self.cookie_samesite == "none" and not self.cookie_secure:
            raise ValueError("COOKIE_SAMESITE=none requires COOKIE_SECURE=true")
        if not self.is_production:
            return
        if not self.mongodb_uri or self.mongodb_uri.startswith("mongodb://localhost"):
            raise ValueError("Production requires a non-local MONGODB_URI")
        if "*" in self.cors_origins:
            raise ValueError("Production must not use wildcard ALLOWED_ORIGINS")
        if self.debug:
            raise ValueError("Production must set DEBUG=false")
        if not self.cookie_secure:
            raise ValueError("Production must set COOKIE_SECURE=true")
        secret = self.jwt_secret_key.strip()
        if len(secret) < 32:
            raise ValueError("Production JWT_SECRET_KEY must be at least 32 characters")
        if secret.startswith("dev-only") or "change-me" in secret.lower():
            raise ValueError("Production must not use the development JWT_SECRET_KEY")
        if self.ai_assistant_enabled:
            provider = self.llm_provider.strip().lower()
            if provider in {"", "disabled", "none", "fake"}:
                raise ValueError(
                    "Production AI_ASSISTANT_ENABLED requires a configured non-fake LLM_PROVIDER"
                )
            if provider == "openai":
                api_key = self.openai_api_key.strip() or self.llm_api_key.strip()
                model = self.openai_chat_model.strip() or self.llm_model.strip()
                if not api_key:
                    raise ValueError(
                        "Production OpenAI provider requires OPENAI_API_KEY (or LLM_API_KEY)"
                    )
                if not model:
                    raise ValueError(
                        "Production OpenAI provider requires OPENAI_CHAT_MODEL (or LLM_MODEL)"
                    )
                if self.openai_store_responses:
                    raise ValueError("OPENAI_STORE_RESPONSES must remain false")
            else:
                if not self.llm_api_key.strip():
                    raise ValueError("Production AI_ASSISTANT_ENABLED requires LLM_API_KEY")
                if not self.llm_model.strip():
                    raise ValueError("Production AI_ASSISTANT_ENABLED requires LLM_MODEL")
        if self.vector_search_enabled and not self.vector_search_index_name.strip():
            # Soft requirement documented; do not hard-fail until Atlas is configured.
            pass
        if self.email_delivery_enabled:
            if self.email_provider.strip().lower() == "smtp":
                if not self.smtp_host.strip() or not self.smtp_from_email.strip():
                    raise ValueError(
                        "EMAIL_DELIVERY_ENABLED with SMTP requires SMTP_HOST and SMTP_FROM_EMAIL"
                    )
        if self.google_auth_enabled and not self.google_client_id.strip():
            raise ValueError("GOOGLE_AUTH_ENABLED requires GOOGLE_CLIENT_ID")
        if not self.frontend_public_url.strip():
            raise ValueError("FRONTEND_PUBLIC_URL is required")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_for_runtime()
    return settings
