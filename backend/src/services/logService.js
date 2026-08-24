import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db/database.js';
import { detectAnomaly } from '../detector/anomalyDetector.js';
import { validateLog, validateLogBatch } from '../validators/logValidator.js';
import { config } from '../config/index.js';
import geminiService from './geminiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prepared statements for high-performance database interactions
const insertStmt = db.prepare(`
  INSERT INTO logs (
    id, timestamp, eventType, severity, source, message, status,
    isAnomaly, anomalyScore, anomalyReason, createdAt,
    aiExplanation, aiRootCause, aiNextStep, aiGeneratedAt
  ) VALUES (
    @id, @timestamp, @eventType, @severity, @source, @message, @status,
    @isAnomaly, @anomalyScore, @anomalyReason, @createdAt,
    @aiExplanation, @aiRootCause, @aiNextStep, @aiGeneratedAt
  )
`);

const updateAiAnalysisStmt = db.prepare(`
  UPDATE logs 
  SET 
    aiExplanation = @aiExplanation,
    aiRootCause = @aiRootCause,
    aiNextStep = @aiNextStep,
    aiGeneratedAt = @aiGeneratedAt
  WHERE id = @id
`);

const selectByIdStmt = db.prepare(`SELECT * FROM logs WHERE id = ?`);
const deleteByIdStmt = db.prepare(`DELETE FROM logs WHERE id = ?`);
const clearAllStmt = db.prepare(`DELETE FROM logs`);

/**
 * Normalizes log output format (e.g. deserializing anomalyReason JSON and converting isAnomaly to boolean).
 */
function formatLogRecord(record) {
  if (!record) return null;
  let parsedReasons = [];
  try {
    parsedReasons = record.anomalyReason ? JSON.parse(record.anomalyReason) : [];
  } catch {
    parsedReasons = record.anomalyReason ? [record.anomalyReason] : [];
  }

  return {
    id: record.id,
    timestamp: record.timestamp,
    eventType: record.eventType,
    severity: record.severity,
    source: record.source,
    message: record.message,
    status: record.status,
    isAnomaly: Boolean(record.isAnomaly),
    anomalyScore: Number(record.anomalyScore),
    anomalyReason: parsedReasons,
    createdAt: record.createdAt,
    aiExplanation: record.aiExplanation || null,
    aiRootCause: record.aiRootCause || null,
    aiNextStep: record.aiNextStep || null,
    aiGeneratedAt: record.aiGeneratedAt || null
  };
}

/**
 * Creates and persists a single log entry after validation and anomaly evaluation.
 */
export function createLog(logData) {
  // 1. Validation
  const validation = validateLog(logData);
  if (!validation.isValid) {
    const error = new Error('Validation failed');
    error.statusCode = 400;
    error.details = validation.errors;
    throw error;
  }

  // 2. Anomaly Detection (Rule-based deterministic algorithm)
  const anomalyResult = detectAnomaly(logData, config.anomalyThreshold);

  // 3. Prepare Record
  const newRecord = {
    id: logData.id || uuidv4(),
    timestamp: logData.timestamp,
    eventType: logData.eventType.trim(),
    severity: logData.severity.toUpperCase().trim(),
    source: logData.source.trim(),
    message: logData.message.trim(),
    status: String(logData.status).trim(),
    isAnomaly: anomalyResult.isAnomaly ? 1 : 0,
    anomalyScore: anomalyResult.score,
    anomalyReason: JSON.stringify(anomalyResult.reasons),
    createdAt: new Date().toISOString(),
    aiExplanation: null,
    aiRootCause: null,
    aiNextStep: null,
    aiGeneratedAt: null
  };

  // 4. Persistence
  insertStmt.run(newRecord);

  return formatLogRecord(newRecord);
}

/**
 * Ingests a batch of log entries transactionally.
 */
export function importLogs(logsArray) {
  // 1. Validate Batch Upfront
  const batchValidation = validateLogBatch(logsArray);
  if (!batchValidation.isValid) {
    const error = new Error('Batch validation failed');
    error.statusCode = 400;
    error.details = batchValidation.errors;
    throw error;
  }

  // 2. Process and Persist Transactionally
  const insertMany = db.transaction((logs) => {
    let anomalyCount = 0;
    const insertedLogs = [];

    for (const log of logs) {
      const anomalyResult = detectAnomaly(log, config.anomalyThreshold);
      if (anomalyResult.isAnomaly) {
        anomalyCount++;
      }

      const record = {
        id: log.id || uuidv4(),
        timestamp: log.timestamp,
        eventType: log.eventType.trim(),
        severity: log.severity.toUpperCase().trim(),
        source: log.source.trim(),
        message: log.message.trim(),
        status: String(log.status).trim(),
        isAnomaly: anomalyResult.isAnomaly ? 1 : 0,
        anomalyScore: anomalyResult.score,
        anomalyReason: JSON.stringify(anomalyResult.reasons),
        createdAt: new Date().toISOString(),
        aiExplanation: null,
        aiRootCause: null,
        aiNextStep: null,
        aiGeneratedAt: null
      };

      insertStmt.run(record);
      insertedLogs.push(formatLogRecord(record));
    }

    return {
      importedCount: insertedLogs.length,
      anomaliesCount: anomalyCount,
      logs: insertedLogs
    };
  });

  return insertMany(logsArray);
}

/**
 * Retrieves logs with filtering, search, and pagination.
 */
export function getLogs(queryParams = {}) {
  const {
    isAnomaly,
    severity,
    source,
    eventType,
    search,
    limit = 50,
    offset = 0,
    sortBy = 'timestamp',
    sortOrder = 'DESC'
  } = queryParams;

  const conditions = [];
  const params = {};

  if (isAnomaly !== undefined && isAnomaly !== '') {
    conditions.push('isAnomaly = @isAnomaly');
    params.isAnomaly = (isAnomaly === 'true' || isAnomaly === true || isAnomaly === '1' || isAnomaly === 1) ? 1 : 0;
  }

  if (severity) {
    conditions.push('UPPER(severity) = @severity');
    params.severity = severity.toUpperCase().trim();
  }

  if (source) {
    conditions.push('source = @source');
    params.source = source.trim();
  }

  if (eventType) {
    conditions.push('eventType = @eventType');
    params.eventType = eventType.trim();
  }

  if (search) {
    conditions.push('(message LIKE @search OR source LIKE @search OR eventType LIKE @search)');
    params.search = `%${search.trim()}%`;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  // Safe sorting columns
  const allowedSortCols = ['timestamp', 'severity', 'isAnomaly', 'anomalyScore', 'createdAt', 'source', 'eventType'];
  const safeSortBy = allowedSortCols.includes(sortBy) ? sortBy : 'timestamp';
  const safeSortOrder = (sortOrder || '').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Count total matching logs
  const countQuery = `SELECT COUNT(*) as count FROM logs ${whereClause}`;
  const totalCount = db.prepare(countQuery).get(params).count;

  // Retrieve paginated records
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
  const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const selectQuery = `
    SELECT * FROM logs 
    ${whereClause} 
    ORDER BY ${safeSortBy} ${safeSortOrder} 
    LIMIT @limit OFFSET @offset
  `;

  const rows = db.prepare(selectQuery).all({
    ...params,
    limit: parsedLimit,
    offset: parsedOffset
  });

  return {
    total: totalCount,
    limit: parsedLimit,
    offset: parsedOffset,
    logs: rows.map(formatLogRecord)
  };
}

/**
 * Retrieves a single log entry by ID.
 */
export function getLogById(id) {
  const row = selectByIdStmt.get(id);
  if (!row) return null;
  return formatLogRecord(row);
}

/**
 * Analyzes an existing anomaly with Gemini AI and persists the root cause explanation.
 * 
 * @param {string} id - The log ID
 * @returns {Promise<Object>} Updated log record with AI explanation
 */
export async function analyzeLogAnomaly(id) {
  const log = getLogById(id);
  if (!log) {
    const error = new Error(`Log with ID '${id}' not found`);
    error.statusCode = 404;
    throw error;
  }

  if (!log.isAnomaly) {
    const error = new Error(`Log '${id}' is not flagged as an anomaly. AI analysis is only performed on detected anomalies.`);
    error.statusCode = 400;
    throw error;
  }

  // Call Gemini AI
  const analysis = await geminiService.analyzeAnomaly(log);

  // Persist AI analysis
  updateAiAnalysisStmt.run({
    id: log.id,
    aiExplanation: analysis.explanation,
    aiRootCause: analysis.likelyRootCause,
    aiNextStep: analysis.nextStep,
    aiGeneratedAt: analysis.generatedAt
  });

  return getLogById(id);
}

/**
 * Deletes a single log entry by ID.
 */
export function deleteLogById(id) {
  const result = deleteByIdStmt.run(id);
  return result.changes > 0;
}

/**
 * Deletes all stored logs.
 */
export function clearAllLogs() {
  const result = clearAllStmt.run();
  return result.changes;
}

/**
 * Seeds the database with the pre-defined synthetic dataset.
 */
export function seedSyntheticLogs() {
  const dataPath = path.resolve(__dirname, '../data/syntheticLogs.json');
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const syntheticLogs = JSON.parse(rawData);

  // Clear existing before seeding
  clearAllLogs();

  return importLogs(syntheticLogs);
}

/**
 * Computes aggregation statistics across the dataset.
 */
export function getLogStats() {
  const total = db.prepare('SELECT COUNT(*) as count FROM logs').get().count;
  const anomalies = db.prepare('SELECT COUNT(*) as count FROM logs WHERE isAnomaly = 1').get().count;
  const analyzed = db.prepare('SELECT COUNT(*) as count FROM logs WHERE isAnomaly = 1 AND aiExplanation IS NOT NULL').get().count;
  const normal = total - anomalies;

  const severityCounts = db.prepare(`
    SELECT severity, COUNT(*) as count 
    FROM logs 
    GROUP BY severity
  `).all();

  const sourceCounts = db.prepare(`
    SELECT source, COUNT(*) as count 
    FROM logs 
    GROUP BY source 
    ORDER BY count DESC 
    LIMIT 10
  `).all();

  return {
    total,
    anomalies,
    analyzed,
    normal,
    anomalyRate: total > 0 ? Number(((anomalies / total) * 100).toFixed(2)) : 0,
    bySeverity: Object.fromEntries(severityCounts.map(r => [r.severity, r.count])),
    bySource: Object.fromEntries(sourceCounts.map(r => [r.source, r.count]))
  };
}

export default {
  createLog,
  importLogs,
  getLogs,
  getLogById,
  analyzeLogAnomaly,
  deleteLogById,
  clearAllLogs,
  seedSyntheticLogs,
  getLogStats
};
