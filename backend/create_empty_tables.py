#!/usr/bin/env python3
"""
Create empty tables in PostgreSQL
"""
import os
import sqlite3
from sqlalchemy import create_engine, text

# Set environment variable
os.environ['POSTGRES_URL'] = 'postgresql://neondb_owner:npg_v72NBIHwQscm@ep-late-hall-a15wg97s-pooler.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require'

def create_empty_table(table_name, columns, postgres_engine):
    """Create empty table with proper schema"""
    try:
        with postgres_engine.connect() as conn:
            # Create table
            column_definitions = []
            for col in columns:
                col_name = col[1]
                col_type = col[2].upper()
                
                # Convert SQLite types to PostgreSQL types
                if col_type == 'INTEGER':
                    if col[5] == 1:  # PRIMARY KEY
                        pg_type = 'SERIAL PRIMARY KEY'
                    else:
                        pg_type = 'INTEGER'
                elif col_type == 'TEXT':
                    pg_type = 'TEXT'
                elif col_type == 'VARCHAR':
                    pg_type = 'VARCHAR(255)'
                elif col_type == 'DATETIME':
                    pg_type = 'TIMESTAMP'
                elif col_type == 'BLOB':
                    if col_name == 'is_admin':
                        pg_type = 'BOOLEAN DEFAULT FALSE'
                    else:
                        pg_type = 'BYTEA'
                else:
                    pg_type = 'TEXT'
                
                # Add NOT NULL constraint
                if col[3] == 1 and col[5] != 1:  # NOT NULL and not PRIMARY KEY
                    pg_type += ' NOT NULL'
                
                # Add DEFAULT value
                if col[4] is not None:
                    default_val = col[4]
                    if isinstance(default_val, str) and default_val.startswith("'"):
                        pg_type += f' DEFAULT {default_val}'
                    else:
                        pg_type += f' DEFAULT {default_val}'
                
                column_definitions.append(f'    "{col_name}" {pg_type}')
            
            create_sql = f'CREATE TABLE IF NOT EXISTS "{table_name}" (\n{", ".join(column_definitions)}\n)'
            conn.execute(text(create_sql))
            conn.commit()
            
            print(f"Created table: {table_name}")
            
    except Exception as e:
        print(f"Error creating table {table_name}: {e}")
        raise

def main():
    """Create all empty tables"""
    try:
        print("Creating empty tables...")
        
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
        
        # Create each table
        for table in tables:
            print(f"Creating table: {table}")
            
            # Get column info
            cursor.execute(f"PRAGMA table_info({table})")
            columns = cursor.fetchall()
            
            create_empty_table(table, columns, postgres_engine)
        
        sqlite_conn.close()
        print("All tables created successfully!")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
