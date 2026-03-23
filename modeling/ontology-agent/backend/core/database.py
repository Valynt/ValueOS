"""
Database configuration and models using SQLAlchemy with PostgreSQL.
Uses JSONB for flexible storage of scrape results.
"""

import os
from datetime import datetime
from typing import Optional
from sqlalchemy import Column, String, DateTime, Float, Integer, Text, JSON, ForeignKey, create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings from environment."""
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ontology_agent"
    openai_api_key: Optional[str] = None
    
    class Config:
        env_file = ".env"


settings = Settings()

# SQLAlchemy setup
Base = declarative_base()

# Async engine
engine = create_async_engine(
    settings.database_url,
    echo=False,
    future=True
)

# Session factory
async_session = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


async def get_db() -> AsyncSession:
    """Dependency to get database session."""
    async with async_session() as session:
        yield session


async def init_db():
    """Initialize database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# =============================================================================
# Database Models
# =============================================================================

class User(Base):
    """User model for authentication."""
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    name = Column(String)
    image = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    jobs = relationship("AnalysisJob", back_populates="user")


class AnalysisJob(Base):
    """Analysis job tracking."""
    __tablename__ = "analysis_jobs"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    url = Column(String, nullable=False)
    status = Column(String, default="queued")
    progress = Column(Float, default=0.0)
    
    # Timing
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    processing_time = Column(Float, nullable=True)
    
    # Results (JSONB for flexible storage)
    competitor_urls = Column(JSON, default=list)
    industry_hints = Column(JSON, default=list)
    crawled_data = Column(JSON, default=dict)  # Raw crawl results
    entities = Column(JSON, default=list)
    relationships = Column(JSON, default=list)
    insights = Column(JSON, default=list)
    warnings = Column(JSON, default=list)
    
    # Stats
    sources_crawled = Column(Integer, default=0)
    entities_count = Column(Integer, default=0)
    relationships_count = Column(Integer, default=0)
    
    # Error handling
    error_message = Column(Text, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="jobs")


class CrawlCache(Base):
    """Cache for crawled pages to avoid re-crawling."""
    __tablename__ = "crawl_cache"
    
    url = Column(String, primary_key=True)
    domain = Column(String, index=True)
    content_hash = Column(String)
    data = Column(JSON)  # Crawled page data
    crawled_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
