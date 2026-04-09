#!/usr/bin/env python3
"""
Create user asset records for existing users
"""
import os
from sqlalchemy import create_engine, text

# Set environment variable
os.environ['POSTGRES_URL'] = 'postgresql://neondb_owner:npg_v72NBIHwQscm@ep-late-hall-a15wg97s-pooler.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require'

def create_user_assets():
    """Create asset records for all existing users"""
    try:
        print("Creating user asset records...")
        
        # Connect to PostgreSQL
        postgres_engine = create_engine(os.environ['POSTGRES_URL'])
        
        # Get all users (uID is text in user table)
        with postgres_engine.connect() as conn:
            result = conn.execute(text('SELECT "uID" FROM "user" ORDER BY "uID"'))
            users = result.fetchall()
        
        print(f"Found {len(users)} users")
        
        # Create asset records
        with postgres_engine.connect() as conn:
            for user in users:
                user_id_str = user[0]
                user_id_int = int(user_id_str)  # Convert to integer for asset table
                
                # Check if asset already exists
                result = conn.execute(text('SELECT COUNT(*) FROM asset WHERE "uID" = :user_id'), {'user_id': user_id_int})
                count = result.fetchone()[0]
                
                if count == 0:
                    # Create asset record with 0 points
                    conn.execute(text('INSERT INTO asset ("uID", "points", "lucks", "time_updated") VALUES (:user_id, :points, :lucks, :time_updated)'), 
                                 {'user_id': user_id_int, 'points': 0, 'lucks': 0, 'time_updated': '2025-11-10 13:09:56'})
                    print(f"Created asset record for user {user_id_int}")
                else:
                    print(f"Asset record already exists for user {user_id_int}")
            
            conn.commit()
        
        # Verify creation
        with postgres_engine.connect() as conn:
            result = conn.execute(text('SELECT COUNT(*) FROM asset'))
            asset_count = result.fetchone()[0]
            print(f"Total asset records: {asset_count}")
        
        print("User asset records created successfully!")
        
    except Exception as e:
        print(f"Error creating user assets: {e}")

if __name__ == "__main__":
    create_user_assets()
