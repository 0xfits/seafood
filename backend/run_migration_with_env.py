#!/usr/bin/env python3
"""
Migration script with environment variable setup
"""
import os
import sys

def main():
    """Setup environment and run migration"""
    print("=== Database Migration Setup ===")
    
    # Check if POSTGRES_URL is set
    postgres_url = os.getenv('POSTGRES_URL')
    if not postgres_url:
        print("POSTGRES_URL is not set!")
        print("\nPlease set it manually:")
        print("export POSTGRES_URL='postgresql://neondb_owner:npg_v72NBIHwQscm@ep-late-hall-a15wg97s-pooler.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require'")
        print("\nThen run:")
        print("python3 migrate_no_pandas.py")
        return False
    
    print(f"Using POSTGRES_URL: {postgres_url[:50]}...")
    
    # Import and run migration
    try:
        from migrate_no_pandas import migrate_data
        print("\nStarting migration...")
        success = migrate_data()
        
        if success:
            print("\nMigration completed successfully!")
            print("Next steps:")
            print("1. Deploy to Vercel")
            print("2. Test user asset functionality")
            print("3. Create asset records for existing users")
        else:
            print("\nMigration failed. Check the error messages above.")
        
        return success
        
    except Exception as e:
        print(f"Error during migration: {e}")
        return False

if __name__ == "__main__":
    main()
