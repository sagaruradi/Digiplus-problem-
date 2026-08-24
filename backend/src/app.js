import express from 'express';
import cors from 'cors';
import logRoutes from './routes/logRoutes.js';
import healthRoutes from './routes/healthRoutes.js';

const app = express();

// Middleware setup
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API Route Mounts
app.use('/api/health', healthRoutes);
app.use('/api/logs', logRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Smart Log Analyzer & Anomaly Detector API',
    version: '1.0.0',
    phase: 'Phase 1 - Foundational Layer',
    endpoints: {
      health: 'GET /api/health',
      listLogs: 'GET /api/logs',
      getLog: 'GET /api/logs/:id',
      createLog: 'POST /api/logs',
      importLogs: 'POST /api/logs/import',
      seedLogs: 'POST /api/logs/seed',
      deleteLog: 'DELETE /api/logs/:id',
      clearLogs: 'DELETE /api/logs',
      stats: 'GET /api/logs/stats'
    }
  });
});

// 404 Not Found Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  // Handle JSON parsing error from body-parser
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Malformed JSON payload in request body'
    });
  }

  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    error: err.message || 'Internal Server Error'
  };

  if (err.details) {
    response.details = err.details;
  }

  if (process.env.NODE_ENV !== 'production' && statusCode === 500) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
});

export default app;
