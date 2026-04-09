#!/usr/bin/env python3
"""
SQLite to Postgres Migration Script (No Pandas Dependency)
"""
import os
import sqlite3
from sqlalchemy import create_engine, text
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def migrate_table_data(table_name, sqlite_conn, postgres_engine):
    """Migrate data from SQLite to Postgres without pandas"""
    try:
        # Get data from SQLite
        cursor = sqlite_conn.cursor()
        cursor.execute(f"SELECT * FROM {table_name}")
        rows = cursor.fetchall()
        
        # Get column names
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = [col[1] for col in cursor.fetchall()]
        
        if not rows:
            logger.info(f"Table {table_name} is empty")
            return
        
        # Insert data into Postgres
        with postgres_engine.connect() as conn:
            # Create table with proper schema
            create_table_sql = f"""
            CREATE TABLE IF NOT EXISTS "{table_name}" (
                {', '.join([f'"{col}" TEXT' for col in columns])}
            )
            """
            conn.execute(text(create_table_sql))
            
            # Clear existing data
            conn.execute(text('DELETE FROM "' + table_name + '"'))
            
            # Insert data using dictionary format
            for row in rows:
                # Convert tuple to dictionary
                row_dict = dict(zip(columns, row))
                column_names = ', '.join([f'"{col}"' for col in columns])
                param_names = ', '.join([f':{col}' for col in columns])
                insert_sql = 'INSERT INTO "' + table_name + '" (' + column_names + ') VALUES (' + param_names + ')'
                conn.execute(text(insert_sql), row_dict)
            
            conn.commit()
        
        logger.info(f"Migrated {len(rows)} rows from {table_name}")
        
    except Exception as e:
        logger.error(f"Error migrating table {table_name}: {e}")
        raise

def migrate_data():
    """Migrate all data from SQLite to Postgres"""
    try:
        postgres_url = os.getenv('POSTGRES_URL')
        if not postgres_url:
            logger.error("POSTGRES_URL not set")
            return False
        
        logger.info("Starting migration...")
        
        # Connect to databases
        sqlite_conn = sqlite3.connect('jinli.db')
        postgres_engine = create_engine(postgres_url)
        
        # Get all tables
        cursor = sqlite_conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        
        # Skip SQLite system tables
        tables = [t for t in tables if not t.startswith('sqlite_')]
        logger.info(f"Found tables: {tables}")
        
        # Migrate each table
        for table in tables:
            logger.info(f"Migrating table: {table}")
            migrate_table_data(table, sqlite_conn, postgres_engine)
        
        # Verify migration
        logger.info("Verifying migration...")
        for table in tables:
            try:
                # SQLite count
                cursor.execute(f'SELECT COUNT(*) FROM {table}')
                sqlite_count = cursor.fetchone()[0]
                
                # Postgres count
                with postgres_engine.connect() as conn:
                    result = conn.execute(text(f'SELECT COUNT(*) FROM "{table}"'))
                    postgres_count = result.fetchone()[0]
                
                if sqlite_count == postgres_count:
                    logger.info(f"Table {table}: {sqlite_count} rows (verified)")
                else:
                    logger.warning(f"Table {table}: SQLite={sqlite_count}, Postgres={postgres_count}")
                    
            except Exception as e:
                logger.error(f"Error verifying table {table}: {e}")
        
        sqlite_conn.close()
        logger.info("Migration completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        return False

if __name__ == "__main__":
    migrate_data()
