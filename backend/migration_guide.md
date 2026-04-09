# Database Migration Guide

## Current Status
- **SQLite Database**: Working with 10 users
- **Admin User**: 0x59f9f640d15ebb053c94a816232cf8ce91b209b0 (uID: 1)
- **Asset Records**: 0 (need to create for existing users)

## Migration Steps

### Step 1: Create Vercel Postgres Database
```bash
# Using Vercel CLI
vercel login
vercel postgres create

# Database name: jinli-db
# Region: Washington, D.C. (or closest)
# Plan: Free (Hobby)
```

### Step 2: Update Environment Variables
After creating the database, Vercel will automatically add:
```
POSTGRES_URL=postgres://username:password@host:port/database?sslmode=require
```

### Step 3: Run Migration
```bash
# Set environment variable locally for testing
export POSTGRES_URL="your_postgres_connection_string"

# Run migration
cd backend
python3 simple_migrate.py
```

### Step 4: Create User Assets for Existing Users
```python
# After migration, create asset records for existing users
from backend.entity import UserEntity
from backend.core import Core

core = Core()
with UserEntity(core.data.db) as ue:
    for user_id in range(1, 11):  # IDs 1-10
        try:
            ue.upsert_asset(user_id, 0)  # Initialize with 0 points
            print(f"Created asset for user {user_id}")
        except Exception as e:
            print(f"Error creating asset for user {user_id}: {e}")
```

### Step 5: Deploy and Test
```bash
# Deploy to Vercel
git add .
git commit -m "migrate to vercel postgres"
git push origin main

# Test points adjustment
curl -X POST "https://jinlibenli.com/api/admin/points/adjust" \
  -H "Content-Type: application/json" \
  -d '{
    "uID": 1,
    "points": 1000,
    "reason": "Initial setup"
  }'
```

## Migration Scripts

### simple_migrate.py
- Migrates all tables from SQLite to Postgres
- Preserves data integrity
- Handles data type conversions

### simple_test_db.py
- Tests database connections
- Verifies data counts
- Checks admin user status

## Expected Results

After migration:
- All 10 users preserved
- Admin user (uID: 1) maintains admin rights
- Asset records created for all users
- Points adjustment functionality restored
- All existing features work normally

## Troubleshooting

### Common Issues
1. **Connection Error**: Check POSTGRES_URL format
2. **Permission Error**: Verify database user permissions
3. **SSL Error**: Ensure `sslmode=require` in connection string
4. **Migration Error**: Check table names and data types

### Verification Commands
```bash
# Check user data
curl -s "https://jinlibenli.com/api/user/asset/1" | jq .

# Test admin functionality
curl -s "https://jinlibenli.com/api/admin/points/adjust" \
  -H "Content-Type: application/json" \
  -d '{"uID": 1, "points": 100, "reason": "test"}' | jq .
```

## Next Steps

1. Create Vercel Postgres database
2. Run migration script
3. Create user asset records
4. Deploy and test
5. Verify all functionality
