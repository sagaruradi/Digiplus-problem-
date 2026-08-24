import logService from '../services/logService.js';

/**
 * Controller handling REST API operations for Logs, Anomalies, and AI Explanations
 */
export async function getLogs(req, res, next) {
  try {
    const result = logService.getLogs(req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function getLogById(req, res, next) {
  try {
    const { id } = req.params;
    const log = logService.getLogById(id);
    if (!log) {
      return res.status(404).json({
        success: false,
        error: `Log with ID '${id}' not found`
      });
    }
    res.json({
      success: true,
      data: log
    });
  } catch (error) {
    next(error);
  }
}

export async function createLog(req, res, next) {
  try {
    const created = logService.createLog(req.body);
    res.status(201).json({
      success: true,
      message: 'Log entry ingested successfully',
      data: created
    });
  } catch (error) {
    next(error);
  }
}

export async function importLogs(req, res, next) {
  try {
    const logsPayload = Array.isArray(req.body) ? req.body : req.body.logs;
    
    if (!logsPayload) {
      return res.status(400).json({
        success: false,
        error: 'Missing logs payload. Pass a JSON array of log objects.'
      });
    }

    const result = logService.importLogs(logsPayload);
    res.status(201).json({
      success: true,
      message: `Successfully imported ${result.importedCount} logs (${result.anomaliesCount} anomalies detected)`,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function analyzeLog(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await logService.analyzeLogAnomaly(id);
    res.json({
      success: true,
      message: 'Gemini AI explanation generated and saved successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteLog(req, res, next) {
  try {
    const { id } = req.params;
    const deleted = logService.deleteLogById(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: `Log with ID '${id}' not found`
      });
    }
    res.json({
      success: true,
      message: `Log '${id}' deleted successfully`
    });
  } catch (error) {
    next(error);
  }
}

export async function clearLogs(req, res, next) {
  try {
    const count = logService.clearAllLogs();
    res.json({
      success: true,
      message: `Cleared ${count} logs from the database`
    });
  } catch (error) {
    next(error);
  }
}

export async function seedLogs(req, res, next) {
  try {
    const result = logService.seedSyntheticLogs();
    res.status(201).json({
      success: true,
      message: `Seeded synthetic dataset with ${result.importedCount} logs (${result.anomaliesCount} anomalies detected)`,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function getStats(req, res, next) {
  try {
    const stats = logService.getLogStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getLogs,
  getLogById,
  createLog,
  importLogs,
  analyzeLog,
  deleteLog,
  clearLogs,
  seedLogs,
  getStats
};
