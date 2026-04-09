#!/usr/bin/env python3
"""
Fix production user asset records
"""
import os
from sqlalchemy import create_engine, text

# Use production Neon connection
os.environ['POSTGRES_URL'] = 'postgresql://neondb_owner:npg_v72NBIHwQscm@ep-late-hall-a15wg97s-pooler.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require'

def fix_production_assets():
    """Fix asset records for all users in production"""
    try:
        print("Fixing user asset records in production...")
        
        # Connect to production Neon database
        postgres_engine = create_engine(os.environ['POSTGRES_URL'])
        
        # Get all users
        with postgres_engine.connect() as conn:
            result = conn.execute(text('SELECT "uID" FROM "user" ORDER BY "uID"'))
            users = result.fetchall()
        
        print(f"Found {len(users)} users in production")
        
        # Clear existing asset records and recreate them
        with postgres_engine.connect() as conn:
            # Clear all existing asset records
            conn.execute(text('DELETE FROM asset'))
            print("Cleared existing asset records")
            
            # Create new asset records for all users
            for user in users:
                user_id_str = user[0]
                user_id_int = int(user_id_str)
                
                # Create asset record with 0 points
                conn.execute(text('INSERT INTO asset ("uID", "points", "lucks", "time_updated") VALUES (:user_id, :points, :lucks, :time_updated)'), 
                             {'user_id': user_id_int, 'points': 0, 'lucks': 0, 'time_updated': '2025-11-10 13:09:56'})
                print(f"Created asset record for user {user_id_int}")
            
            conn.commit()
        
        # Verify creation
        with postgres_engine.connect() as conn:
            result = conn.execute(text('SELECT COUNT(*) FROM asset'))
            asset_count = result.fetchone()[0]
            print(f"Total asset records in production: {asset_count}")
            
            # Check specific user asset
            result = conn.execute(text('SELECT * FROM asset WHERE "uID" = 1'))
            asset = result.fetchone()
            print(f"User 1 asset: {asset}")
        
        print("Production asset records fixed successfully!")
        
    except Exception as e:
        print(f"Error fixing production assets: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    fix_production_assets()
