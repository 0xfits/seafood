import { neon } from "@neondatabase/serverless";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database connection
const databaseUrl = process.env.jinli_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Database URL not found in environment variables');
}
const sql = neon(databaseUrl);

export interface Asset {
  id: number;
  uID: number;
  points: number;
  lucks: number;
  time_updated: string;
}

export interface User {
  uID: string;
  evm_address: string;
  created_at: string;
}

export class DatabaseService {
  // Get all users
  static async getAllUsers(): Promise<User[]> {
    try {
      const result = await sql`SELECT "uID", evm_address, created_at FROM "user" ORDER BY "uID"`;
      return result as User[];
    } catch (error) {
      console.error('Error getting users:', error);
      return [];
    }
  }

  // Get user asset
  static async getUserAsset(uID: number): Promise<Asset | null> {
    try {
      const result = await sql`SELECT * FROM asset WHERE "uID" = ${uID}`;
      return result.length > 0 ? result[0] as Asset : null;
    } catch (error) {
      console.error('Error getting user asset:', error);
      return null;
    }
  }

  // Create or update user asset
  static async upsertAsset(uID: number, points: number): Promise<Asset> {
    try {
      // Check if asset exists
      const existingAsset = await this.getUserAsset(uID);
      
      if (existingAsset) {
        // Update existing asset
        const result = await sql`
          UPDATE asset 
          SET "points" = "points" + ${points}, "time_updated" = NOW() 
          WHERE "uID" = ${uID}
          RETURNING *
        `;
        return result[0] as Asset;
      } else {
        // Create new asset
        const result = await sql`
          INSERT INTO asset ("uID", "points", "lucks", "time_updated") 
          VALUES (${uID}, ${points}, 0, NOW()) 
          RETURNING *
        `;
        return result[0] as Asset;
      }
    } catch (error) {
      console.error('Error upserting asset:', error);
      throw error;
    }
  }

  // Initialize assets for all users
  static async initializeAllAssets(): Promise<{total: number, initialized: number}> {
    try {
      const users = await this.getAllUsers();
      let initializedCount = 0;

      for (const user of users) {
        const userId = parseInt(user.uID);
        const existingAsset = await this.getUserAsset(userId);
        
        if (!existingAsset) {
          await this.upsertAsset(userId, 0);
          initializedCount++;
          console.log(`Created asset for user ${userId}`);
        } else {
          console.log(`Asset already exists for user ${userId}`);
        }
      }

      return {
        total: users.length,
        initialized: initializedCount
      };
    } catch (error) {
      console.error('Error initializing assets:', error);
      throw error;
    }
  }

  // Adjust user points
  static async adjustPoints(uID: number, amount: number, reason: string): Promise<{success: boolean, message: string, asset?: Asset}> {
    try {
      // Check if user asset exists
      const existingAsset = await this.getUserAsset(uID);
      
      if (!existingAsset) {
        return {
          success: false,
          message: '用户资产记录不存在'
        };
      }

      // Update points
      const updatedAsset = await this.upsertAsset(uID, amount);
      
      console.log(`[API] 积分调整结果: 用户${uID}, 金额${amount}, 原因: ${reason}`);
      
      return {
        success: true,
        message: '积分调整成功',
        asset: updatedAsset
      };
    } catch (error) {
      console.error('Error adjusting points:', error);
      return {
        success: false,
        message: '积分调整失败'
      };
    }
  }
}
