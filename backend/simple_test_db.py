#!/usr/bin/env python3
"""
Simple database connection test (no pandas dependency)
"""
import os
import sqlite3
from sqlalchemy import create_engine, text

def test_sqlite():
    """Test SQLite connection"""
    try:
        conn = sqlite3.connect('jinli.db')
        cursor = conn.cursor()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"SQLite tables: {tables}")
        
        cursor.execute("SELECT COUNT(*) FROM user;")
        user_count = cursor.fetchone()[0]
        print(f"SQLite users: {user_count}")
        
        cursor.execute("SELECT uID, EVM, is_admin FROM user WHERE is_admin = 1;")
        admin_users = cursor.fetchall()
        print(f"SQLite admin users: {admin_users}")
        
        conn.close()
        return True
    except Exception as e:
        print(f"SQLite error: {e}")
        return False

def test_postgres():
    """Test Postgres connection"""
    try:
        postgres_url = os.getenv('POSTGRES_URL')
        if not postgres_url:
            print("POSTGRES_URL not set")
            return False
        
        engine = create_engine(postgres_url)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("Postgres connection successful")
        
        return True
    except Exception as e:
        print(f"Postgres error: {e}")
        return False

def test_current():
    """Test current database configuration"""
    try:
        from foundation import engine, SQLALCHEMY_DATABASE_URL
        print(f"Current DB URL: {SQLALCHEMY_DATABASE_URL}")
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("Current database connection successful")
        
        return True
    except Exception as e:
        print(f"Current database error: {e}")
        return False

if __name__ == "__main__":
    print("=== Database Test ===")
    
    print("\n1. SQLite:")
    sqlite_ok = test_sqlite()
    
    print("\n2. Postgres:")
    postgres_ok = test_postgres()
    
    print("\n3. Current:")
    current_ok = test_current()
    
    print(f"\nResults: SQLite={sqlite_ok}, Postgres={postgres_ok}, Current={current_ok}")
    
    if postgres_ok:
        print("\nReady for migration! Run: python simple_migrate.py")
    else:
        print("\nPlease set up Vercel Postgres first.")
