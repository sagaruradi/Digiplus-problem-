import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db/database.js';
import { detectAnomaly, extractIpAddress } from '../detector/anomalyDetector.js';
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

// Prepared statement to count recent failures/anomalies associated with an IP
const countRecentIpFailuresStmt = db.prepare(`
  SELECT COUNT(*) as count 
  FROM logs 
  WHERE (message LIKE ? OR source LIKE ?)
    AND (
      status IN ('401', '403', '429', '500', '502', '503', '504', 'FAILED', 'FAILURE', 'TIMEOUT', 'DEADLOCK', 'CRASH')
      OR isAnomaly = 1
    )
    AND timestamp >= datetime(?, '-' || ? || ' minutes')
`);

/**
 * Counts recent failures or anomalies originating from a specific IP address within lookback window.
 * @param {string} ipAddress
 * @param {string} [currentTimestamp]
 * @param {number} [lookbackMinutes=15]
 * @returns {number}
 */
export function getRecentIpFailureCount(ipAddress, currentTimestamp = new Date().toISOString(), lookbackMinutes = 15) {
  if (!ipAddress) return 0;
  try {
    const pattern = `%${ipAddress}%`;
    const result = countRecentIpFailuresStmt.get(pattern, pattern, currentTimestamp, lookbackMinutes);
    return result ? Number(result.count) : 0;
  } catch (err) {
    console.error('Error querying recent IP failure count:', err);
    return 0;
  }
}

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

  // 2. IP Offender Context Lookup
  const targetIp = extractIpAddress(logData.message) || extractIpAddress(logData.source);
  let recentFailureCount = 0;
  if (targetIp) {
    recentFailureCount = getRecentIpFailureCount(targetIp, logData.timestamp, 15);
  }

  // 3. Anomaly Detection (Rule-based deterministic algorithm with cumulative IP context)
  const anomalyResult = detectAnomaly(logData, config.anomalyThreshold, {
    ipAddress: targetIp,
    recentFailureCount
  });

  // 4. Prepare Record
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

  // 5. Persistence
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
    const batchIpCounts = new Map();

    for (const log of logs) {
      const targetIp = extractIpAddress(log.message) || extractIpAddress(log.source);
      let recentFailureCount = 0;
      if (targetIp) {
        const dbCount = getRecentIpFailureCount(targetIp, log.timestamp, 15);
        const inBatchCount = batchIpCounts.get(targetIp) || 0;
        recentFailureCount = dbCount + inBatchCount;
      }

      const anomalyResult = detectAnomaly(log, config.anomalyThreshold, {
        ipAddress: targetIp,
        recentFailureCount
      });

      if (anomalyResult.isAnomaly) {
        anomalyCount++;
      }

      // If this log was an auth failure or error, track in-batch count
      const statusStr = String(log.status || '').toUpperCase().trim();
      const numStatus = parseInt(statusStr, 10);
      const isFail = 
        (numStatus >= 500 && numStatus <= 599) || 
        [401, 403, 429].includes(numStatus) || 
        ['TIMEOUT', 'TIMED_OUT', 'FAILED', 'FAILURE', 'DEADLOCK', 'CRASH'].includes(statusStr) ||
        anomalyResult.isAnomaly;
      
      if (targetIp && isFail) {
        batchIpCounts.set(targetIp, (batchIpCounts.get(targetIp) || 0) + 1);
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
    order = 'DESC'
  } = queryParams;

  const conditions = [];
  const params = {};

  if (isAnomaly !== undefined && isAnomaly !== null && isAnomaly !== '') {
    conditions.push('isAnomaly = @isAnomaly');
    params.isAnomaly = (isAnomaly === true || isAnomaly === 'true' || isAnomaly === 1 || isAnomaly === '1') ? 1 : 0;
  }

  if (severity) {
    conditions.push('severity = @severity');
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
    conditions.push('(message LIKE @search OR eventType LIKE @search OR source LIKE @search)');
    params.search = `%${search.trim()}%`;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  // Safe sorting
  const validSortCols = ['timestamp', 'severity', 'source', 'anomalyScore', 'createdAt'];
  const safeSortBy = validSortCols.includes(sortBy) ? sortBy : 'timestamp';
  const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Count total matching
  const countSql = `SELECT COUNT(*) as total FROM logs ${whereClause}`;
  const countStmt = db.prepare(countSql);
  const totalResult = countStmt.get(params);
  const total = totalResult ? totalResult.total : 0;

  // Fetch paginated records
  const querySql = `
    SELECT * FROM logs 
    ${whereClause} 
    ORDER BY ${safeSortBy} ${safeOrder} 
    LIMIT @limit OFFSET @offset
  `;
  const selectStmt = db.prepare(querySql);
  const records = selectStmt.all({
    ...params,
    limit: Math.max(1, Math.min(100, parseInt(limit, 10) || 50)),
    offset: Math.max(0, parseInt(offset, 10) || 0)
  });

  return {
    total,
    limit: parseInt(limit, 10) || 50,
    offset: parseInt(offset, 10) || 0,
    logs: records.map(formatLogRecord)
  };
}

/**
 * Retrieves a single log by its primary ID.
 */
export function getLogById(id) {
  const record = selectByIdStmt.get(id);
  return formatLogRecord(record);
}

/**
 * Deletes a single log by its primary ID.
 */
export function deleteLogById(id) {
  const result = deleteByIdStmt.run(id);
  return result.changes > 0;
}

/**
 * Clears all logs from the database.
 */
export function clearAllLogs() {
  const result = clearAllStmt.run();
  return result.changes;
}

/**
 * Seeds the database with the synthetic dataset.
 */
export function seedDatabase() {
  clearAllLogs();
  const dataPath = path.resolve(__dirname, '../data/syntheticLogs.json');
  const rawData = fs.readFileSync(dataPath, 'utf8');
  const syntheticLogs = JSON.parse(rawData);
  return importLogs(syntheticLogs);
}

/**
 * Aggregates statistics about the dataset.
 */
export function getLogStatistics() {
  const totalStmt = db.prepare(`SELECT COUNT(*) as total FROM logs`);
  const anomaliesStmt = db.prepare(`SELECT COUNT(*) as anomalies FROM logs WHERE isAnomaly = 1`);
  const analyzedStmt = db.prepare(`SELECT COUNT(*) as analyzed FROM logs WHERE aiExplanation IS NOT NULL`);
  
  const severityStmt = db.prepare(`
    SELECT severity, COUNT(*) as count 
    FROM logs 
    GROUP BY severity
  `);
  
  const sourceStmt = db.prepare(`
    SELECT source, COUNT(*) as count 
    FROM logs 
    GROUP BY source
  `);

  const total = totalStmt.get().total;
  const anomalies = anomaliesStmt.get().anomalies;
  const analyzed = analyzedStmt.get().analyzed;
  const normal = total - anomalies;
  const anomalyRate = total > 0 ? ((anomalies / total) * 100).toFixed(1) : 0;

  const severityCounts = {};
  for (const row of severityStmt.all()) {
    severityCounts[row.severity] = row.count;
  }

  const sourceCounts = {};
  for (const row of sourceStmt.all()) {
    sourceCounts[row.source] = row.count;
  }

  return {
    total,
    anomalies,
    normal,
    analyzed,
    anomalyRate: Number(anomalyRate),
    bySeverity: severityCounts,
    bySource: sourceCounts
  };
}

/**
 * Performs Gemini AI root-cause analysis for an already-detected anomalous log.
 */
export async function analyzeLogAnomaly(id) {
  // 1. Fetch log
  const log = getLogById(id);
  if (!log) {
    const error = new Error(`Log with ID '${id}' not found`);
    error.statusCode = 404;
    throw error;
  }

  // 2. Strict Architectural Gate: AI only analyzes detected anomalies
  if (!log.isAnomaly) {
    const error = new Error(
      `Log with ID '${id}' is not flagged as an anomaly (score: ${log.anomalyScore}). Gemini AI analysis is strictly reserved for anomalous events.`
    );
    error.statusCode = 400;
    throw error;
  }

  // 3. Request Gemini AI Analysis
  const aiResult = await geminiService.analyzeAnomaly(log);

  // 4. Persist AI Analysis to SQLite
  const generatedAt = aiResult.generatedAt || new Date().toISOString();
  updateAiAnalysisStmt.run({
    id,
    aiExplanation: aiResult.explanation,
    aiRootCause: aiResult.likelyRootCause,
    aiNextStep: aiResult.nextStep,
    aiGeneratedAt: generatedAt
  });

  // 5. Return updated record
  return getLogById(id);
}

export const seedSyntheticLogs = seedDatabase;
export const getLogStats = getLogStatistics;

export default {
  createLog,
  importLogs,
  getLogs,
  getLogById,
  deleteLogById,
  clearAllLogs,
  seedDatabase,
  seedSyntheticLogs,
  getLogStatistics,
  getLogStats,
  analyzeLogAnomaly,
  getRecentIpFailureCount
};
