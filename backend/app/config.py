from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    # 应用配置
    APP_NAME: str = "Jinli Club API"
    DEBUG: bool = False
    VERSION: str = "1.0.0"
    
    # 数据库 - 支持 SQLite 和 PostgreSQL
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./jinli.db")
    
    # JWT 配置
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 天
    
    # CORS 配置
    CORS_ORIGINS: List[str] = [
        "https://www.jinlibenli.com",
        "https://jinlibenli.com", 
        "http://localhost:3000",
        "http://localhost:5173"
    ]
    
    # Web3 配置
    WEB3_PROVIDER: str = os.getenv("WEB3_PROVIDER", "https://bsc-dataseed.binance.org/")
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
