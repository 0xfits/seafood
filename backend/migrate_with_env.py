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
        print("Please set POSTGRES_URL environment variable:")
        print("export POSTGRES_URL='your_postgres_connection_string'")
        print("Then run: python3 migrate_with_env.py")
        return False
    
    print(f"Using POSTGRES_URL: {postgres_url[:20]}...")
    
    # Import and run migration
    try:
        from simple_migrate import migrate_data
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
