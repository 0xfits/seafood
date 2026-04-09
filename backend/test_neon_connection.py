#!/usr/bin/env python3
"""
Test Neon database connection
"""
import os
from sqlalchemy import create_engine, text

# Test different connection strings
connection_strings = [
    'postgresql://neondb_owner:npg_v72NBIHwQscm@ep-late-hall-a15wg97s-pooler.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require',
    'postgresql://neondb_owner:npg_v72NBIHwQscm@ep-late-hall-a15wg97s-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
    'postgresql://neondb_owner:npg_v72NBIHwQscm@ep-late-hall-a15wg97s.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=15'
]

def test_connection(name, connection_string):
    """Test a specific connection string"""
    try:
        print(f"\nTesting {name}:")
        print(f"  URL: {connection_string[:50]}...")
        
        engine = create_engine(connection_string)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print(f"  Status: OK")
            
            # Try to get table count
            try:
                result = conn.execute(text("""
                    SELECT COUNT(*) FROM information_schema.tables 
                    WHERE table_schema = 'public'
                """))
                table_count = result.fetchone()[0]
                print(f"  Tables: {table_count}")
                
                # Try to get user count
                try:
                    result = conn.execute(text('SELECT COUNT(*) FROM "user"'))
                    user_count = result.fetchone()[0]
                    print(f"  Users: {user_count}")
                except Exception as e:
                    print(f"  Users table: Error - {e}")
                    
            except Exception as e:
                print(f"  Schema query: Error - {e}")
        
        return True
        
    except Exception as e:
        print(f"  Status: ERROR - {e}")
        return False

def main():
    """Test all connection strings"""
    print("=== Neon Connection Test ===")
    
    for i, conn_str in enumerate(connection_strings):
        test_connection(f"Connection {i+1}", conn_str)
    
    print("\n=== Summary ===")
    print("If any connection works, use that connection string for migration.")

if __name__ == "__main__":
    main()
