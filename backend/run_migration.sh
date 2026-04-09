#!/bin/bash

# Database Migration Script
# Replace YOUR_POSTGRES_CONNECTION_STRING with your actual connection string

echo "=== Database Migration ==="

# Set your PostgreSQL connection string here
export POSTGRES_URL="YOUR_POSTGRES_CONNECTION_STRING"

# Test connection
echo "Testing PostgreSQL connection..."
python3 -c "
import os
from sqlalchemy import create_engine, text
postgres_url = os.getenv('POSTGRES_URL')
engine = create_engine(postgres_url)
with engine.connect() as conn:
    result = conn.execute(text('SELECT 1'))
    print('PostgreSQL connection successful!')
"

# Run migration
echo "Running migration..."
python3 simple_migrate.py

# Verify migration
echo "Verifying migration..."
python3 simple_test_db.py

echo "Migration completed!"
