import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { DatabaseService } from './database';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Jinli TypeScript Backend',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/test/data',
      adjustPoints: '/api/admin/points/adjust',
      getAsset: '/api/user/asset/:uID',
      initAssets: '/api/admin/assets/init'
    }
  });
});

// Health check
app.get('/api/test/data', (req, res) => {
  res.json({
    status: 'ok',
    message: 'TypeScript backend is running',
    timestamp: new Date().toISOString()
  });
});

// Initialize user assets
app.post('/api/admin/assets/init', async (req, res) => {
  try {
    const result = await DatabaseService.initializeAllAssets();
    res.json({
      ok: true,
      status_code: 200,
      data: result,
      message: `Initialized ${result.initialized} asset records`
    });
  } catch (error) {
    console.error('Asset initialization error:', error);
    res.status(500).json({
      ok: false,
      status_code: 500,
      error: 'Failed to initialize assets'
    });
  }
});

// Adjust user points
app.post('/api/admin/points/adjust', async (req, res) => {
  try {
    const { uID, amount, reason } = req.body;
    
    if (!uID || amount === undefined || !reason) {
      return res.status(400).json({
        ok: false,
        status_code: 400,
        error: '参数不完整'
      });
    }

    const result = await DatabaseService.adjustPoints(uID, amount, reason);
    
    if (result.success) {
      res.json({
        ok: true,
        status_code: 200,
        data: {
          uID,
          new_points: result.asset?.points || 0,
          reason
        },
        message: result.message
      });
    } else {
      res.status(404).json({
        ok: false,
        status_code: 404,
        error: result.message
      });
    }
  } catch (error) {
    console.error('Points adjustment error:', error);
    res.status(500).json({
      ok: false,
      status_code: 500,
      error: '积分调整失败'
    });
  }
});

// Get user asset
app.get('/api/user/asset/:uID', async (req, res) => {
  try {
    const uID = parseInt(req.params.uID);
    
    if (isNaN(uID)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const asset = await DatabaseService.getUserAsset(uID);
    
    if (asset) {
      res.json({
        success: true,
        data: {
          uID: asset.uID,
          points: asset.points,
          lucks: asset.lucks,
          time_updated: asset.time_updated
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Not found'
      });
    }
  } catch (error) {
    console.error('Get user asset error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`TypeScript backend running on port ${PORT}`);
  console.log('Using Neon PostgreSQL for optimal performance');
});

export default app;
