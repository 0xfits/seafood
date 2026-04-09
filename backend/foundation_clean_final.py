#!/usr/bin/env python3
# -*- coding: utf-8 -*- 
"""
Database Configuration - Performance Optimized
This file uses psycopg2-binary for optimal performance
"""
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv
from typing import Optional

# Load environment variables
BASE_DIR = os.path.dirname(__file__)
load_dotenv(os.path.join(BASE_DIR, ".env"))

# Get database URL - prioritize PostgreSQL for performance
POSTGRES_URL = os.getenv("jinli_POSTGRES_URL") or os.getenv("POSTGRES_URL")
SQLALCHEMY_DATABASE_URL = POSTGRES_URL or os.getenv("SQLALCHEMY_DATABASE_URL", "sqlite:///./jinli.db")

# Check if we're running on Vercel
IS_VERCEL = os.environ.get("VERCEL", "0") == "1"

# Create database engine
if POSTGRES_URL and IS_VERCEL:
    # Use PostgreSQL in production for optimal performance
    engine = create_engine(POSTGRES_URL, pool_pre_ping=True)
    print("Using PostgreSQL for optimal performance")
else:
    # Fallback to SQLite for development
    engine = create_engine(SQLALCHEMY_DATABASE_URL, poolclass=StaticPool, connect_args={"check_same_thread": False})
    print("Using SQLite for development")

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
