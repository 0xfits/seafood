#!/usr/bin/env python3
# -*- coding: utf-8 -*- 
"""
Vercel Postgres SDK Database Configuration
This file uses Vercel Postgres SDK for database connection
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
    # Use Vercel Postgres SDK in production
    try:
        from vercel_postgres import sql
        POSTGRES_AVAILABLE = True
        print("Using Vercel Postgres SDK")
    except ImportError:
        POSTGRES_AVAILABLE = False
        print("Vercel Postgres SDK not available, falling back to SQLAlchemy")
else:
    POSTGRES_AVAILABLE = False
    print("Not running on Vercel, using local database")

# Database connection
def get_db_connection():
    """Get database connection"""
    if IS_VERCEL and POSTGRES_AVAILABLE:
        # Use Vercel Postgres SDK
        from vercel_postgres import sql
        return sql
    else:
        # Fallback to local SQLite for development
        import sqlite3
        db_path = os.path.join(BASE_DIR, "jinli.db")
        return sqlite3.connect(db_path)

# Database helper functions
async def execute_query(query: str, params: dict = None):
    """Execute database query"""
    if IS_VERCEL and POSTGRES_AVAILABLE:
        from vercel_postgres import sql
        if params:
            return await sql(query, params)
        else:
            return await sql(query)
    else:
        # Fallback to local SQLite
        conn = get_db_connection()
        cursor = conn.cursor()
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        result = cursor.fetchall()
        conn.commit()
        conn.close()
        return result

async def execute_update(query: str, params: dict = None):
    """Execute database update"""
    if IS_VERCEL and POSTGRES_AVAILABLE:
        from vercel_postgres import sql
        if params:
            return await sql(query, params)
        else:
            return await sql(query)
    else:
        # Fallback to local SQLite
        conn = get_db_connection()
        cursor = conn.cursor()
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        conn.commit()
        conn.close()
        return True
