# Vercel Postgres Database Setup Guide

## Step 1: Create Vercel Postgres Database

### Option A: Using Vercel CLI
```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Login to Vercel
vercel login

# Create Postgres database
vercel postgres create

# Choose database name: jinli-db
# Choose region: Washington, D.C. (or closest to your users)
# Choose plan: Free (Hobby)
```

### Option B: Using Vercel Dashboard
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your project
3. Go to "Storage" tab
4. Click "Create Database"
5. Choose "Postgres"
6. Enter database name: `jinli-db`
7. Choose region and plan
8. Click "Create"

## Step 2: Get Database Connection String

After creating the database, Vercel will automatically add the connection string to your project's environment variables:

```
POSTGRES_URL=postgres://username:password@host:port/database?sslmode=require
```

## Step 3: Update Application Configuration

### Update foundation.py
```python
# In backend/foundation.py
SQLALCHEMY_DATABASE_URL = os.getenv("POSTGRES_URL", "sqlite:///./jinli.db")
```

### Update api/requirements.txt
```txt
# Add PostgreSQL driver
psycopg2-binary==2.9.6
```

## Step 4: Run Migration Script

```bash
# Set the POSTGRES_URL environment variable
export POSTGRES_URL="postgres://username:password@host:port/database?sslmode=require"

# Run migration
cd backend
python simple_migrate.py
```

## Step 5: Deploy to Vercel

```bash
# Commit changes
git add .
git commit -m "migrate to vercel postgres"
git push origin main
```

## Step 6: Verify Migration

After deployment, test the database connection:

```bash
# Test user data
curl -s "https://jinlibenli.com/api/user/asset/1" | jq .
```

## Troubleshooting

### Common Issues

1. **Connection Error**: Make sure POSTGRES_URL is correct
2. **Permission Error**: Check database user permissions
3. **SSL Error**: Ensure `sslmode=require` in connection string
4. **Migration Error**: Check table names and data types

### Debug Commands

```bash
# Check database connection
python -c "import psycopg2; conn = psycopg2.connect(os.getenv('POSTGRES_URL')); print('Connected successfully')"

# Check table data
python -c "import pandas as pd; from sqlalchemy import create_engine; engine = create_engine(os.getenv('POSTGRES_URL')); print(pd.read_sql('SELECT COUNT(*) FROM \"user\"', engine))"
```

## Data Migration Details

### Current SQLite Data
- **Users**: 10 records
- **Assets**: 0 records (need to create for existing users)
- **Other tables**: Various data for tasks, gifts, etc.

### Postgres Schema
The migration script will automatically:
1. Create tables with proper PostgreSQL data types
2. Migrate all existing data
3. Create necessary indexes
4. Verify data integrity

### Expected Results
After migration:
- All user data preserved
- Admin user (0x59f9f640d15ebb053c94a816232cf8ce91b209b0) still has admin rights
- Points adjustment functionality restored
- All existing features work normally
