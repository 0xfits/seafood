#!/usr/bin/env python3
"""
Simple SQLite to Postgres Migration Script
"""
import os
import sqlite3
import pandas as pd
from sqlalchemy import create_engine
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def migrate_data():
    """Migrate data from SQLite to Postgres"""
    try:
        # Get Postgres URL from environment
        postgres_url = os.getenv('POSTGRES_URL')
        if not postgres_url:
            logger.error("POSTGRES_URL environment variable not set")
            return False
        
        logger.info("Starting migration...")
        
        # Create engines
        sqlite_engine = create_engine('sqlite:///jinli.db')
        postgres_engine = create_engine(postgres_url)
        
        # Connect to SQLite and get tables
        with sqlite3.connect('jinli.db') as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = [row[0] for row in cursor.fetchall()]
        
        logger.info(f"Found tables: {tables}")
        
        # Migrate each table
        for table in tables:
            logger.info(f"Migrating table: {table}")
            
            try:
                # Read data from SQLite
                df = pd.read_sql_table(table, sqlite_engine)
                
                if df.empty:
                    logger.info(f"Table {table} is empty")
                    continue
                
                # Write to Postgres
                df.to_sql(table, postgres_engine, if_exists='replace', index=False)
                logger.info(f"Migrated {len(df)} rows from {table}")
                
            except Exception as e:
                logger.error(f"Error migrating table {table}: {e}")
                continue
        
        # Verify migration
        logger.info("Verifying migration...")
        for table in tables:
            try:
                # SQLite count
                sqlite_count = pd.read_sql(f'SELECT COUNT(*) as count FROM {table}', sqlite_engine).iloc[0]['count']
                
                # Postgres count
                postgres_count = pd.read_sql(f'SELECT COUNT(*) as count FROM "{table}"', postgres_engine).iloc[0]['count']
                
                if sqlite_count == postgres_count:
                    logger.info(f"Table {table}: {sqlite_count} rows (verified)")
                else:
                    logger.warning(f"Table {table}: SQLite={sqlite_count}, Postgres={postgres_count}")
                    
            except Exception as e:
                logger.error(f"Error verifying table {table}: {e}")
        
        logger.info("Migration completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        return False

if __name__ == "__main__":
    migrate_data()
