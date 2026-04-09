# Database Migration Instructions

## Step 1: Set Environment Variable

Replace `YOUR_POSTGRES_CONNECTION_STRING` with your actual PostgreSQL connection string from .env.local:

```bash
# Option 1: Direct export
export POSTGRES_URL="YOUR_POSTGRES_CONNECTION_STRING"

# Option 2: Create temporary .env file
echo "POSTGRES_URL=YOUR_POSTGRES_CONNECTION_STRING" > backend/.env.migration
```

## Step 2: Test Connection

```bash
cd backend
python3 simple_test_db.py
```

Expected output:
```
=== Database Test ===
1. SQLite: ...
2. Postgres: Postgres connection successful
3. Current: ...
```

## Step 3: Run Migration

```bash
python3 simple_migrate.py
```

Expected output:
```
Starting migration...
Found tables: ['user', 'asset', ...]
Migrating table: user
Migrated 10 rows from user
...
Migration completed successfully!
```

## Step 4: Verify Migration

```bash
python3 simple_test_db.py
```

Expected output:
```
Postgres: OK
Current: OK (should now show PostgreSQL)
```

## Step 5: Create User Assets

After migration, create asset records for existing users:

```python
python3 -c "
from backend.entity import UserEntity
from backend.core import Core

core = Core()
with UserEntity(core.data.db) as ue:
    for user_id in range(1, 11):
        try:
            ue.upsert_asset(user_id, 0)
            print(f'Created asset for user {user_id}')
        except Exception as e:
            print(f'Error creating asset for user {user_id}: {e}')
"
```

## Step 6: Deploy to Vercel

```bash
# Commit changes
git add backend/
git commit -m "migrate to vercel postgres"
git push origin main
```

## Step 7: Test in Production

After deployment, test the points adjustment:

```bash
# Test user asset API
curl -s "https://jinlibenli.com/api/user/asset/1" | jq .

# Test points adjustment
curl -X POST "https://jinlibenli.com/api/admin/points/adjust" \
  -H "Content-Type: application/json" \
  -d '{
    "uID": 1,
    "points": 1000,
    "reason": "Initial setup"
  }' | jq .
```

## Troubleshooting

### Connection Error
- Check POSTGRES_URL format
- Ensure `sslmode=require` is included
- Verify database is running

### Migration Error
- Check table names match
- Verify data types are compatible
- Check permissions

### Verification Error
- Compare row counts between SQLite and Postgres
- Check admin user (uID: 1) is preserved
- Verify all tables exist in Postgres

## Expected Results

After successful migration:
- All 10 users migrated
- Admin user (0x59f9f640d15ebb053c94a816232cf8ce91b209b0) preserved
- Asset records created for all users
- Points adjustment functionality restored
- Production environment uses PostgreSQL
