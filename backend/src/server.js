import app from './app.js';
import { config } from './config/index.js';

const PORT = config.port;
const HOST = config.host;

const server = app.listen(PORT, HOST, () => {
  console.log('====================================================');
  console.log(`🚀 Smart Log Analyzer Backend running on ${HOST}:${PORT}`);
  console.log(`📊 Mode: ${config.nodeEnv}`);
  console.log(`📁 Database Path: ${config.dbPath}`);
  console.log(`⚙️ Anomaly Threshold: ${config.anomalyThreshold}`);
  console.log(`🔗 API Base: http://${HOST}:${PORT}`);
  console.log(`🏥 Health Check: http://${HOST}:${PORT}/api/health`);
  console.log('====================================================');
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received. Closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

export default server;
