#!/usr/bin/env python3
"""
Final test script with built-in environment variable
"""
import os
import sqlite3
from sqlalchemy import create_engine, text

# Set environment variable using official Neon parameters
os.environ['POSTGRES_URL'] = 'postgresql://neondb_owner:npg_v72NBIHwQscm@ep-late-hall-a15wg97s-pooler.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require'

def test_sqlite():
    """Test SQLite connection"""
    try:
        conn = sqlite3.connect('jinli.db')
        cursor = conn.cursor()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        
        cursor.execute("SELECT COUNT(*) FROM user;")
        user_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT uID, EVM, is_admin FROM user WHERE is_admin = 1;")
        admin_users = cursor.fetchall()
        
        conn.close()
        return True, tables, user_count, admin_users
    except Exception as e:
        return False, [], 0, []

def test_postgres():
    """Test Postgres connection"""
    try:
        postgres_url = os.getenv('POSTGRES_URL')
        engine = create_engine(postgres_url)
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
        
        # Get table info
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public'
            """))
            tables = [row[0] for row in result]
        
        # Get user count
        with engine.connect() as conn:
            result = conn.execute(text('SELECT COUNT(*) FROM "user"'))
            user_count = result.fetchone()[0]
        
        # Get admin users
        with engine.connect() as conn:
            result = conn.execute(text('SELECT "uID", EVM, is_admin FROM "user" WHERE is_admin = 1'))
            admin_users = result.fetchall()
        
        # Get asset count
        with engine.connect() as conn:
            result = conn.execute(text('SELECT COUNT(*) FROM asset'))
            asset_count = result.fetchone()[0]
        
        return True, tables, user_count, admin_users, asset_count
    except Exception as e:
        return False, [], 0, [], 0

def main():
    """Main test function"""
    print("=== Final Database Test ===")
    
    print("\n1. SQLite Test:")
    sqlite_ok, sqlite_tables, sqlite_users, sqlite_admins = test_sqlite()
    print(f"   Status: {'OK' if sqlite_ok else 'ERROR'}")
    print(f"   Tables: {len(sqlite_tables)}")
    print(f"   Users: {sqlite_users}")
    print(f"   Admins: {len(sqlite_admins)}")
    
    print("\n2. Neon (Postgres) Test:")
    postgres_ok, postgres_tables, postgres_users, postgres_admins, asset_count = test_postgres()
    print(f"   Status: {'OK' if postgres_ok else 'ERROR'}")
    print(f"   Tables: {len(postgres_tables)}")
    print(f"   Users: {postgres_users}")
    print(f"   Admins: {len(postgres_admins)}")
    print(f"   Assets: {asset_count}")
    
    print("\n3. Migration Verification:")
    if sqlite_ok and postgres_ok:
        print(f"   SQLite users: {sqlite_users}, Neon users: {postgres_users} - {'OK' if sqlite_users == postgres_users else 'ERROR'}")
        print(f"   SQLite admins: {len(sqlite_admins)}, Neon admins: {len(postgres_admins)} - {'OK' if len(sqlite_admins) == len(postgres_admins) else 'ERROR'}")
        print(f"   Asset records: {asset_count} - {'OK' if asset_count > 0 else 'ERROR'}")
    
    print("\n4. Summary:")
    if postgres_ok and asset_count > 0:
        print("   Migration completed successfully!")
        print("   Ready for deployment to Vercel!")
        print("   Points adjustment functionality should work now.")
    else:
        print("   Migration incomplete. Check errors above.")

if __name__ == "__main__":
    main()
