#!/usr/bin/env python3
"""
Final migration script with built-in environment variable
"""
import os
import sqlite3
from sqlalchemy import create_engine, text

# Set environment variable directly
os.environ['POSTGRES_URL'] = 'postgresql://neondb_owner:npg_v72NBIHwQscm@ep-late-hall-a15wg97s-pooler.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require'

def migrate_table_data(table_name, sqlite_conn, postgres_engine):
    """Migrate data from SQLite to Postgres"""
    try:
        # Get data from SQLite
        cursor = sqlite_conn.cursor()
        cursor.execute(f"SELECT * FROM {table_name}")
        rows = cursor.fetchall()
        
        # Get column names
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = [col[1] for col in cursor.fetchall()]
        
        if not rows:
            print(f"Table {table_name} is empty")
            return
        
        # Insert data into Postgres
        with postgres_engine.connect() as conn:
            # Create table
            create_table_sql = f"""
            CREATE TABLE IF NOT EXISTS "{table_name}" (
                {', '.join([f'"{col}" TEXT' for col in columns])}
            )
            """
            conn.execute(text(create_table_sql))
            
            # Clear existing data
            conn.execute(text('DELETE FROM "' + table_name + '"'))
            
            # Insert data
            for row in rows:
                row_dict = dict(zip(columns, row))
                column_names = ', '.join([f'"{col}"' for col in columns])
                param_names = ', '.join([f':{col}' for col in columns])
                insert_sql = 'INSERT INTO "' + table_name + '" (' + column_names + ') VALUES (' + param_names + ')'
                conn.execute(text(insert_sql), row_dict)
            
            conn.commit()
        
        print(f"Migrated {len(rows)} rows from {table_name}")
        
    except Exception as e:
        print(f"Error migrating table {table_name}: {e}")
        raise

def main():
    """Main migration function"""
    try:
        print("Starting migration...")
        
        # Connect to databases
        sqlite_conn = sqlite3.connect('jinli.db')
        postgres_engine = create_engine(os.environ['POSTGRES_URL'])
        
        # Get all tables
        cursor = sqlite_conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        
        # Skip SQLite system tables
        tables = [t for t in tables if not t.startswith('sqlite_')]
        print(f"Found tables: {tables}")
        
        # Migrate each table
        for table in tables:
            print(f"Migrating table: {table}")
            migrate_table_data(table, sqlite_conn, postgres_engine)
        
        # Verify migration
        print("Verifying migration...")
        for table in tables:
            try:
                # SQLite count
                cursor.execute(f'SELECT COUNT(*) FROM {table}')
                sqlite_count = cursor.fetchone()[0]
                
                # Postgres count
                with postgres_engine.connect() as conn:
                    result = conn.execute(text('SELECT COUNT(*) FROM "' + table + '"'))
                    postgres_count = result.fetchone()[0]
                
                if sqlite_count == postgres_count:
                    print(f"Table {table}: {sqlite_count} rows (verified)")
                else:
                    print(f"Table {table}: SQLite={sqlite_count}, Postgres={postgres_count}")
                    
            except Exception as e:
                print(f"Error verifying table {table}: {e}")
        
        sqlite_conn.close()
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    main()
