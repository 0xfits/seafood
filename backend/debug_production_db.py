#!/usr/bin/env python3
"""
Debug production database connection
"""
import os
from sqlalchemy import create_engine, text

def debug_production_db():
    """Debug production database connection"""
    try:
        print("=== Production Database Debug ===")
        
        # Check environment variables
        print(f"POSTGRES_URL: {os.getenv('POSTGRES_URL')}")
        print(f"VERCEL: {os.getenv('VERCEL')}")
        
        # Test foundation.py configuration
        from foundation import engine, SQLALCHEMY_DATABASE_URL
        print(f"SQLALCHEMY_DATABASE_URL: {SQLALCHEMY_DATABASE_URL}")
        
        # Test database connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("Database connection: OK")
            
            # Check user count
            result = conn.execute(text('SELECT COUNT(*) FROM "user"'))
            user_count = result.fetchone()[0]
            print(f"User count: {user_count}")
            
            # Check asset count
            result = conn.execute(text('SELECT COUNT(*) FROM asset'))
            asset_count = result.fetchone()[0]
            print(f"Asset count: {asset_count}")
            
            # Check specific asset
            result = conn.execute(text('SELECT * FROM asset WHERE "uID" = 1'))
            asset = result.fetchone()
            print(f"User 1 asset: {asset}")
        
        # Test entity access
        from entity import UserEntity
        from core import Core
        
        core = Core()
        with UserEntity(core.data.db) as ue:
            asset = ue.get_asset(1)
            print(f"Entity asset for user 1: {asset}")
        
    except Exception as e:
        print(f"Debug error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_production_db()
