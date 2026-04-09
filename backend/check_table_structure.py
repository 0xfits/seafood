#!/usr/bin/env python3
"""
Check PostgreSQL table structure
"""
import os
from sqlalchemy import create_engine, text

# Set environment variable
os.environ['POSTGRES_URL'] = 'postgresql://neondb_owner:npg_v72NBIHwQscm@ep-late-hall-a15wg97s-pooler.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require'

def check_table_structure():
    """Check structure of user and asset tables"""
    try:
        print("Checking table structures...")
        
        # Connect to PostgreSQL
        postgres_engine = create_engine(os.environ['POSTGRES_URL'])
        
        # Check user table
        with postgres_engine.connect() as conn:
            result = conn.execute(text("""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = 'user'
                ORDER BY ordinal_position
            """))
            user_columns = result.fetchall()
        
        print("User table columns:")
        for col in user_columns:
            print(f"  {col[0]}: {col[1]} (nullable: {col[2]}, default: {col[3]})")
        
        # Check asset table
        with postgres_engine.connect() as conn:
            result = conn.execute(text("""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = 'asset'
                ORDER BY ordinal_position
            """))
            asset_columns = result.fetchall()
        
        print("\nAsset table columns:")
        for col in asset_columns:
            print(f"  {col[0]}: {col[1]} (nullable: {col[2]}, default: {col[3]})")
        
        # Get user data
        with postgres_engine.connect() as conn:
            result = conn.execute(text("SELECT * FROM \"user\" LIMIT 3"))
            users = result.fetchall()
        
        print(f"\nSample user data:")
        for user in users:
            print(f"  {user}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_table_structure()
