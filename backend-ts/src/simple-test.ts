import { neon } from "@neondatabase/serverless";

// Database connection
const databaseUrl = process.env.jinli_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Database URL not found');
}
const sql = neon(databaseUrl);

export default async function handler(req: any, res: any) {
  try {
    // Test database connection
    const result = await sql`SELECT NOW() as current_time`;
    
    res.json({
      status: 'ok',
      message: 'TypeScript backend is running',
      database_connected: true,
      current_time: result[0]?.current_time,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
