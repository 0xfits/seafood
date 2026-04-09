#!/usr/bin/env python3
"""
Create user asset records in production Neon database
"""
import os
from sqlalchemy import create_engine, text

# Use production Neon connection
os.environ['POSTGRES_URL'] = 'postgresql://neondb_owner:npg_v72NBIHwQscm@ep-late-hall-a15wg97s-pooler.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require'

def create_production_assets():
    """Create asset records for all users in production"""
    try:
        print("Creating user asset records in production...")
        
        # Connect to production Neon database
        postgres_engine = create_engine(os.environ['POSTGRES_URL'])
        
        # Get all users
        with postgres_engine.connect() as conn:
            result = conn.execute(text('SELECT "uID" FROM "user" ORDER BY "uID"'))
            users = result.fetchall()
        
        print(f"Found {len(users)} users in production")
        
        # Create asset records
        with postgres_engine.connect() as conn:
            created_count = 0
            for user in users:
                user_id_str = user[0]
                user_id_int = int(user_id_str)
                
                # Check if asset already exists
                result = conn.execute(text('SELECT COUNT(*) FROM asset WHERE "uID" = :user_id'), {'user_id': user_id_int})
                count = result.fetchone()[0]
                
                if count == 0:
                    # Create asset record with 0 points
                    conn.execute(text('INSERT INTO asset ("uID", "points", "lucks", "time_updated") VALUES (:user_id, :points, :lucks, :time_updated)'), 
                                 {'user_id': user_id_int, 'points': 0, 'lucks': 0, 'time_updated': '2025-11-10 13:09:56'})
                    print(f"Created asset record for user {user_id_int}")
                    created_count += 1
                else:
                    print(f"Asset record already exists for user {user_id_int}")
            
            conn.commit()
        
        # Verify creation
        with postgres_engine.connect() as conn:
            result = conn.execute(text('SELECT COUNT(*) FROM asset'))
            asset_count = result.fetchone()[0]
            print(f"Total asset records in production: {asset_count}")
        
        print(f"Created {created_count} new asset records")
        print("Production asset records created successfully!")
        
    except Exception as e:
        print(f"Error creating production assets: {e}")

if __name__ == "__main__":
    create_production_assets()
