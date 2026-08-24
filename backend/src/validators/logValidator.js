/**
 * Log Data Validation Module
 * 
 * Validates incoming log entries for:
 * - Missing required fields
 * - Missing or invalid timestamps
 * - Malformed data types
 * - Empty datasets for batch operations
 */

const VALID_SEVERITIES = ['INFO', 'WARN', 'WARNING', 'ERROR', 'CRITICAL', 'FATAL', 'DEBUG'];

/**
 * Validates a single log entry.
 * 
 * @param {Object} log - The log payload to validate
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateLog(log) {
  const errors = [];

  if (!log || typeof log !== 'object' || Array.isArray(log)) {
    return {
      isValid: false,
      errors: ['Log payload must be a non-null JSON object']
    };
  }

  // 1. Timestamp validation
  if (!log.timestamp) {
    errors.push("Missing required field: 'timestamp'");
  } else if (typeof log.timestamp !== 'string' || log.timestamp.trim() === '') {
    errors.push("Field 'timestamp' must be a non-empty string");
  } else {
    const parsedDate = new Date(log.timestamp);
    if (isNaN(parsedDate.getTime())) {
      errors.push(`Invalid timestamp format: '${log.timestamp}'. Expected valid ISO-8601 date string.`);
    }
  }

  // 2. EventType validation
  if (!log.eventType) {
    errors.push("Missing required field: 'eventType'");
  } else if (typeof log.eventType !== 'string' || log.eventType.trim() === '') {
    errors.push("Field 'eventType' must be a non-empty string");
  }

  // 3. Severity validation
  if (!log.severity) {
    errors.push("Missing required field: 'severity'");
  } else if (typeof log.severity !== 'string' || log.severity.trim() === '') {
    errors.push("Field 'severity' must be a non-empty string");
  } else if (!VALID_SEVERITIES.includes(log.severity.toUpperCase().trim())) {
    errors.push(`Invalid severity: '${log.severity}'. Allowed values: ${VALID_SEVERITIES.join(', ')}`);
  }

  // 4. Source validation
  if (!log.source) {
    errors.push("Missing required field: 'source'");
  } else if (typeof log.source !== 'string' || log.source.trim() === '') {
    errors.push("Field 'source' must be a non-empty string");
  }

  // 5. Message validation
  if (log.message === undefined || log.message === null) {
    errors.push("Missing required field: 'message'");
  } else if (typeof log.message !== 'string') {
    errors.push("Field 'message' must be a string");
  }

  // 6. Status validation
  if (log.status === undefined || log.status === null) {
    errors.push("Missing required field: 'status'");
  } else if (typeof log.status !== 'string' && typeof log.status !== 'number') {
    errors.push("Field 'status' must be a string or number");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates a batch / array of log entries.
 * 
 * @param {Array<Object>} logs - Array of log entries
 * @returns {{ isValid: boolean, errors: Array<{ index: number, errors: string[] }> }}
 */
export function validateLogBatch(logs) {
  if (!Array.isArray(logs)) {
    return {
      isValid: false,
      errors: [{ index: -1, errors: ['Expected a JSON array of log objects'] }]
    };
  }

  if (logs.length === 0) {
    return {
      isValid: false,
      errors: [{ index: -1, errors: ['Dataset is empty. At least one log entry is required.'] }]
    };
  }

  const batchErrors = [];

  logs.forEach((log, index) => {
    const { isValid, errors } = validateLog(log);
    if (!isValid) {
      batchErrors.push({ index, errors });
    }
  });

  return {
    isValid: batchErrors.length === 0,
    errors: batchErrors
  };
}

export default {
  validateLog,
  validateLogBatch
};
