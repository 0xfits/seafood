#!/usr/bin/env python3
# -*- coding: utf-8 -*- 
"""
Neon HTTP API Database Configuration
This file uses Neon HTTP API for database connection
"""
import os
from dotenv import load_dotenv
from typing import Optional

# Load environment variables
BASE_DIR = os.path.dirname(__file__)
load_dotenv(os.path.join(BASE_DIR, ".env"))

# Check if we're running on Vercel
IS_VERCEL = os.environ.get("VERCEL", "0") == "1"

# Database configuration
if IS_VERCEL:
    # Use Neon HTTP API in production
    try:
        from neon_http_client import execute_query, execute_update
        POSTGRES_AVAILABLE = True
        print("Using Neon HTTP API")
    except ImportError:
        POSTGRES_AVAILABLE = False
        print("Neon HTTP API not available, falling back to SQLite")
else:
    POSTGRES_AVAILABLE = False
    print("Not running on Vercel, using local database")

# Database helper functions
async def execute_query(query: str, params: list = None):
    """Execute database query"""
    if IS_VERCEL and POSTGRES_AVAILABLE:
        from neon_http_client import execute_query as neon_execute_query
        return await neon_execute_query(query, params)
    else:
        # Fallback to local SQLite for development
        import sqlite3
        db_path = os.path.join(BASE_DIR, "jinli.db")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        result = cursor.fetchall()
        conn.commit()
        conn.close()
        return result

async def execute_update(query: str, params: list = None):
    """Execute database update"""
    if IS_VERCEL and POSTGRES_AVAILABLE:
        from neon_http_client import execute_update as neon_execute_update
        return await neon_execute_update(query, params)
    else:
        # Fallback to local SQLite for development
        import sqlite3
        db_path = os.path.join(BASE_DIR, "jinli.db")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        conn.commit()
        conn.close()
        return True
