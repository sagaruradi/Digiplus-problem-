import { Router } from 'express';
import { db } from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    // Check SQLite database responsiveness
    const count = db.prepare('SELECT COUNT(*) as count FROM logs').get().count;
    res.json({
      status: 'healthy',
      service: 'smart-log-analyzer-backend',
      timestamp: new Date().toISOString(),
      database: {
        status: 'connected',
        type: 'SQLite (WAL mode)',
        totalLogs: count
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

export default router;
