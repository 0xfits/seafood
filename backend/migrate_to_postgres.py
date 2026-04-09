#!/usr/bin/env python3
"""
SQLite to Vercel Postgres Migration Script
"""
import os
import sqlite3
import psycopg2
from sqlalchemy import create_engine, text
import pandas as pd
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_sqlite_connection():
    """Get SQLite connection"""
    return sqlite3.connect('jinli.db')

def get_postgres_connection():
    """Get Postgres connection"""
    postgres_url = os.getenv('POSTGRES_URL')
    if not postgres_url:
        raise ValueError("POSTGRES_URL environment variable not set")
    return psycopg2.connect(postgres_url)

def get_table_names():
    """Get all table names from SQLite"""
    conn = get_sqlite_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    conn.close()
    return tables

def get_table_schema(table_name):
    """Get table schema from SQLite"""
    conn = get_sqlite_connection()
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table_name});")
    columns = cursor.fetchall()
    conn.close()
    return columns

def convert_sqlite_to_postgres_schema(sqlite_schema):
    """Convert SQLite schema to Postgres schema"""
    postgres_schema = []
    
    for column in sqlite_schema:
        col_name, col_type, not_null, default_val, pk = column
        
        # Convert data types
        if col_type.upper() == 'INTEGER':
            if pk:
                pg_type = 'SERIAL PRIMARY KEY'
            else:
                pg_type = 'INTEGER'
        elif col_type.upper() == 'TEXT':
            pg_type = 'TEXT'
        elif col_type.upper() == 'VARCHAR':
            # Extract length if specified
            if '(' in col_type:
                length = col_type.split('(')[1].split(')')[0]
                pg_type = f'VARCHAR({length})'
            else:
                pg_type = 'VARCHAR(255)'
        elif col_type.upper() == 'DATETIME':
            pg_type = 'TIMESTAMP'
        elif col_type.upper() == 'BLOB':
            pg_type = 'BOOLEAN' if col_name == 'is_admin' else 'BYTEA'
        else:
            pg_type = col_type
        
        # Handle constraints
        constraints = []
        if not_null == 1 and not pk:
            constraints.append('NOT NULL')
        if default_val is not None and not pk:
            if default_val.startswith("'"):
                constraints.append(f'DEFAULT {default_val}')
            else:
                constraints.append(f'DEFAULT {default_val}')
        
        constraint_str = ' '.join(constraints)
        postgres_schema.append(f'    {col_name} {pg_type} {constraint_str}')
    
    return postgres_schema

def create_postgres_table(table_name, schema):
    """Create table in Postgres"""
    conn = get_postgres_connection()
    cursor = conn.cursor()
    
    try:
        # Drop table if exists
        cursor.execute(f'DROP TABLE IF EXISTS "{table_name}";')
        
        # Create table
        schema_sql = ',\n'.join(schema)
        create_sql = f'CREATE TABLE "{table_name}" (\n{schema_sql}\n);'
        cursor.execute(create_sql)
        
        conn.commit()
        logger.info(f"Created table {table_name}")
    except Exception as e:
        conn.rollback()
        logger.error(f"Error creating table {table_name}: {e}")
        raise
    finally:
        conn.close()

def migrate_table_data(table_name):
    """Migrate data from SQLite to Postgres"""
    try:
        # Read data from SQLite
        sqlite_engine = create_engine('sqlite:///jinli.db')
        df = pd.read_sql_table(table_name, sqlite_engine)
        
        if df.empty:
            logger.info(f"Table {table_name} is empty, skipping data migration")
            return
        
        # Get Postgres connection
        postgres_url = os.getenv('POSTGRES_URL')
        postgres_engine = create_engine(postgres_url)
        
        # Write data to Postgres
        df.to_sql(table_name, postgres_engine, if_exists='append', index=False)
        
        logger.info(f"Migrated {len(df)} rows from table {table_name}")
        
    except Exception as e:
        logger.error(f"Error migrating data for table {table_name}: {e}")
        raise

def create_indexes():
    """Create indexes in Postgres"""
    indexes = [
        'CREATE INDEX IF NOT EXISTS ix_user_EVM ON "user"(EVM);',
        'CREATE INDEX IF NOT EXISTS ix_brand_symbol ON brand(symbol);',
        'CREATE INDEX IF NOT EXISTS ix_journey_tID ON journey(tID);',
        'CREATE INDEX IF NOT EXISTS ix_journey_uID ON journey(uID);',
        'CREATE INDEX IF NOT EXISTS ix_asset_uID ON asset(uID);',
    ]
    
    conn = get_postgres_connection()
    cursor = conn.cursor()
    
    try:
        for index_sql in indexes:
            cursor.execute(index_sql)
            logger.info(f"Created index: {index_sql}")
        
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Error creating indexes: {e}")
        raise
    finally:
        conn.close()

def verify_migration():
    """Verify migration by comparing row counts"""
    sqlite_conn = get_sqlite_connection()
    postgres_conn = get_postgres_connection()
    
    try:
        tables = get_table_names()
        
        for table in tables:
            # SQLite count
            sqlite_cursor = sqlite_conn.cursor()
            sqlite_cursor.execute(f'SELECT COUNT(*) FROM {table};')
            sqlite_count = sqlite_cursor.fetchone()[0]
            
            # Postgres count
            postgres_cursor = postgres_conn.cursor()
            postgres_cursor.execute(f'SELECT COUNT(*) FROM "{table}";')
            postgres_count = postgres_cursor.fetchone()[0]
            
            if sqlite_count == postgres_count:
                logger.info(f"Table {table}: {sqlite_count} rows (verified)")
            else:
                logger.warning(f"Table {table}: SQLite={sqlite_count}, Postgres={postgres_count} (mismatch)")
    
    finally:
        sqlite_conn.close()
        postgres_conn.close()

def main():
    """Main migration function"""
    logger.info("Starting SQLite to Postgres migration...")
    
    try:
        # Get all tables
        tables = get_table_names()
        logger.info(f"Found tables: {tables}")
        
        # Migrate each table
        for table in tables:
            logger.info(f"Processing table: {table}")
            
            # Get schema
            schema = get_table_schema(table)
            logger.info(f"Table {table} schema: {len(schema)} columns")
            
            # Convert schema
            postgres_schema = convert_sqlite_to_postgres_schema(schema)
            
            # Create table
            create_postgres_table(table, postgres_schema)
            
            # Migrate data
            migrate_table_data(table)
        
        # Create indexes
        create_indexes()
        
        # Verify migration
        verify_migration()
        
        logger.info("Migration completed successfully!")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise

if __name__ == "__main__":
    main()
