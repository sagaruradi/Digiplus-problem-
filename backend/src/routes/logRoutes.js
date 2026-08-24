import { Router } from 'express';
import {
  getLogs,
  getLogById,
  createLog,
  importLogs,
  analyzeLog,
  deleteLog,
  clearLogs,
  seedLogs,
  getStats
} from '../controllers/logController.js';

const router = Router();

// Stats aggregation
router.get('/stats', getStats);

// Seed synthetic data
router.post('/seed', seedLogs);

// Batch import
router.post('/import', importLogs);

// AI Anomaly Explanation
router.post('/:id/analyze', analyzeLog);

// General log collection operations
router.get('/', getLogs);
router.post('/', createLog);
router.delete('/', clearLogs);

// Single log operations
router.get('/:id', getLogById);
router.delete('/:id', deleteLog);

export default router;
