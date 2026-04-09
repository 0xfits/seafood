#!/usr/bin/env python3
"""
Test database connection and migration readiness
"""
import os
import sqlite3
from sqlalchemy import create_engine, text
import pandas as pd
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_sqlite_connection():
    """Test SQLite connection and get data info"""
    try:
        conn = sqlite3.connect('jinli.db')
        cursor = conn.cursor()
        
        # Get table info
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        
        logger.info(f"SQLite tables: {tables}")
        
        # Get user count
        cursor.execute("SELECT COUNT(*) FROM user;")
        user_count = cursor.fetchone()[0]
        logger.info(f"SQLite users: {user_count}")
        
        # Get asset count
        cursor.execute("SELECT COUNT(*) FROM asset;")
        asset_count = cursor.fetchone()[0]
        logger.info(f"SQLite assets: {asset_count}")
        
        # Get admin user info
        cursor.execute("SELECT uID, EVM, is_admin FROM user WHERE is_admin = 1;")
        admin_users = cursor.fetchall()
        logger.info(f"SQLite admin users: {admin_users}")
        
        conn.close()
        return True
        
    except Exception as e:
        logger.error(f"SQLite connection error: {e}")
        return False

def test_postgres_connection():
    """Test Postgres connection"""
    try:
        postgres_url = os.getenv('POSTGRES_URL')
        if not postgres_url:
            logger.warning("POSTGRES_URL not set, skipping Postgres test")
            return False
        
        engine = create_engine(postgres_url)
        
        # Test connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            logger.info("Postgres connection successful")
        
        # Get table info
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public'
            """))
            tables = [row[0] for row in result]
            logger.info(f"Postgres tables: {tables}")
        
        return True
        
    except Exception as e:
        logger.error(f"Postgres connection error: {e}")
        return False

def test_current_database():
    """Test current database configuration"""
    try:
        from foundation import engine, SQLALCHEMY_DATABASE_URL
        
        logger.info(f"Current database URL: {SQLALCHEMY_DATABASE_URL}")
        
        # Test connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            logger.info("Current database connection successful")
        
        # Test user query
        with engine.connect() as conn:
            try:
                result = conn.execute(text("SELECT COUNT(*) FROM user"))
                user_count = result.fetchone()[0]
                logger.info(f"Current database users: {user_count}")
            except Exception as e:
                logger.error(f"Error querying users: {e}")
        
        return True
        
    except Exception as e:
        logger.error(f"Current database error: {e}")
        return False

def main():
    """Main test function"""
    logger.info("=== Database Connection Test ===")
    
    # Test SQLite
    logger.info("\n1. Testing SQLite...")
    sqlite_ok = test_sqlite_connection()
    
    # Test Postgres
    logger.info("\n2. Testing Postgres...")
    postgres_ok = test_postgres_connection()
    
    # Test current configuration
    logger.info("\n3. Testing current database configuration...")
    current_ok = test_current_database()
    
    # Summary
    logger.info("\n=== Test Summary ===")
    logger.info(f"SQLite: {'OK' if sqlite_ok else 'ERROR'}")
    logger.info(f"Postgres: {'OK' if postgres_ok else 'ERROR'}")
    logger.info(f"Current: {'OK' if current_ok else 'ERROR'}")
    
    if postgres_ok:
        logger.info("\nReady for migration! Run: python simple_migrate.py")
    else:
        logger.info("\nPostgres not ready. Please set up Vercel Postgres first.")

if __name__ == "__main__":
    main()
