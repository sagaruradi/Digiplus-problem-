import assert from 'assert';
import { detectAnomaly } from '../src/detector/anomalyDetector.js';
import { validateLog, validateLogBatch } from '../src/validators/logValidator.js';
import logService from '../src/services/logService.js';
import { db } from '../src/db/database.js';

console.log('🧪 Starting Phase 2 Unit, Anomaly Detector & Persistence Verification Suite...\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

// -------------------------------------------------------------
// 1. ANOMALY DETECTOR CALIBRATION & COMBINATIONS
// -------------------------------------------------------------
console.log('--- 1. Anomaly Detector Signal Calibration & Combinations ---');

runTest('Normal INFO/200 log gets score 0 and isAnomaly = false', () => {
  const normalLog = {
    timestamp: '2026-08-24T08:00:00.000Z',
    eventType: 'AUTH_LOGIN',
    severity: 'INFO',
    source: 'auth-service',
    message: 'User logged in successfully',
    status: '200'
  };

  const result = detectAnomaly(normalLog);
  assert.strictEqual(result.isAnomaly, false);
  assert.strictEqual(result.score, 0);
  assert.strictEqual(result.reasons.length, 0);
});

runTest('Minor WARN/200 log gets score 10 and isAnomaly = false', () => {
  const warnLog = {
    timestamp: '2026-08-24T08:00:00.000Z',
    eventType: 'DB_QUERY',
    severity: 'WARN',
    source: 'database-cluster',
    message: 'Slow query execution on table users',
    status: '200'
  };

  const result = detectAnomaly(warnLog);
  assert.strictEqual(result.isAnomaly, false);
  assert.strictEqual(result.score, 10);
  assert.strictEqual(result.reasons.length, 1);
  assert.ok(result.reasons[0].includes('WARN severity (+10)'));
});

runTest('ERROR (+25) + TIMEOUT (+25) reliably produces score 50 and isAnomaly = true', () => {
  const timeoutLog = {
    timestamp: '2026-08-24T08:00:00.000Z',
    eventType: 'API_REQUEST',
    severity: 'ERROR',
    source: 'api-gateway',
    message: 'Upstream call to payment provider timed out',
    status: 'TIMEOUT'
  };

  const result = detectAnomaly(timeoutLog);
  assert.strictEqual(result.isAnomaly, true);
  // ERROR (+25) + TIMEOUT (+25) + network keyword (+20) = 70
  assert.ok(result.score >= 50, `Score was ${result.score}, expected >= 50`);
  assert.ok(result.reasons.some(r => r.includes('ERROR severity')));
  assert.ok(result.reasons.some(r => r.includes('TIMEOUT')));
});

runTest('CRITICAL (+45) + 500 (+30) reliably produces score 75 and isAnomaly = true', () => {
  const critLog = {
    timestamp: '2026-08-24T08:00:00.000Z',
    eventType: 'ORDER_SERVICE',
    severity: 'CRITICAL',
    source: 'order-service',
    message: 'Internal processing failure in checkout flow',
    status: '500'
  };

  const result = detectAnomaly(critLog);
  assert.strictEqual(result.isAnomaly, true);
  assert.strictEqual(result.score, 75);
  assert.ok(result.reasons.some(r => r.includes('CRITICAL severity (+45)')));
  assert.ok(result.reasons.some(r => r.includes('500 (+30)')));
});

runTest('Keyword deduplication: Multiple matching patterns in same category only score once', () => {
  const duplicateKeywordsLog = {
    timestamp: '2026-08-24T08:00:00.000Z',
    eventType: 'SYSTEM',
    severity: 'INFO',
    source: 'node-worker',
    // Contains multiple memory exhaustion keywords: "heap out of memory", "oom", "memory leak"
    message: 'System reported heap out of memory and oom error due to memory leak',
    status: '200'
  };

  const result = detectAnomaly(duplicateKeywordsLog);
  // Memory category weight is 35. With deduplication, category triggers exactly once (+35).
  assert.strictEqual(result.score, 35);
  const memoryReasons = result.reasons.filter(r => r.includes('Memory exhaustion'));
  assert.strictEqual(memoryReasons.length, 1, 'Memory category should only trigger once');
});

runTest('Auth / rate-limit statuses (401, 403, 429) add +20 points', () => {
  for (const code of ['401', '403', '429']) {
    const res = detectAnomaly({
      timestamp: '2026-08-24T08:00:00.000Z',
      eventType: 'AUTH',
      severity: 'INFO',
      source: 'auth-service',
      message: 'Rate limit / Auth status test',
      status: code
    });
    assert.strictEqual(res.score, 20);
    assert.ok(res.reasons.some(r => r.includes(code)));
  }
});

runTest('Configurable threshold works as expected', () => {
  const log = {
    timestamp: '2026-08-24T08:00:00.000Z',
    eventType: 'DB',
    severity: 'ERROR', // +25
    source: 'db',
    message: 'Standard query error',
    status: '200'
  };

  // With threshold 25: isAnomaly = true
  const resLow = detectAnomaly(log, 25);
  assert.strictEqual(resLow.score, 25);
  assert.strictEqual(resLow.isAnomaly, true);

  // With threshold 50: isAnomaly = false
  const resHigh = detectAnomaly(log, 50);
  assert.strictEqual(resHigh.score, 25);
  assert.strictEqual(resHigh.isAnomaly, false);
});

runTest('Score is capped at 100', () => {
  const maxLog = {
    timestamp: '2026-08-24T08:00:00.000Z',
    eventType: 'CRITICAL_EVENT',
    severity: 'FATAL', // +50
    source: 'kernel',
    // Triggers crash (+35), deadlock (+30), memory (+35), status CRASH (+25) => raw = 175
    message: 'Deadlock encountered leading to segmentation fault and heap out of memory crash',
    status: 'CRASH'
  };

  const result = detectAnomaly(maxLog);
  assert.strictEqual(result.score, 100);
  assert.strictEqual(result.isAnomaly, true);
});

// -------------------------------------------------------------
// 2. INPUT VALIDATOR EDGE CASES
// -------------------------------------------------------------
console.log('\n--- 2. Input Validator Edge Cases ---');

runTest('Missing or empty timestamp is rejected', () => {
  const res1 = validateLog({ eventType: 'A', severity: 'INFO', source: 'S', message: 'M', status: '200' });
  assert.strictEqual(res1.isValid, false);
  assert.ok(res1.errors.some(e => e.includes('timestamp')));

  const res2 = validateLog({ timestamp: '   ', eventType: 'A', severity: 'INFO', source: 'S', message: 'M', status: '200' });
  assert.strictEqual(res2.isValid, false);
});

runTest('Unparseable invalid timestamp string is rejected', () => {
  const res = validateLog({ timestamp: 'not-a-date-xyz', eventType: 'A', severity: 'INFO', source: 'S', message: 'M', status: '200' });
  assert.strictEqual(res.isValid, false);
  assert.ok(res.errors.some(e => e.includes('Invalid timestamp format')));
});

runTest('Missing individual required fields are caught', () => {
  // Missing eventType
  assert.strictEqual(validateLog({ timestamp: '2026-08-24T00:00:00Z', severity: 'INFO', source: 'S', message: 'M', status: '200' }).isValid, false);
  // Missing severity
  assert.strictEqual(validateLog({ timestamp: '2026-08-24T00:00:00Z', eventType: 'E', source: 'S', message: 'M', status: '200' }).isValid, false);
  // Missing source
  assert.strictEqual(validateLog({ timestamp: '2026-08-24T00:00:00Z', eventType: 'E', severity: 'INFO', message: 'M', status: '200' }).isValid, false);
  // Missing message
  assert.strictEqual(validateLog({ timestamp: '2026-08-24T00:00:00Z', eventType: 'E', severity: 'INFO', source: 'S', status: '200' }).isValid, false);
  // Missing status
  assert.strictEqual(validateLog({ timestamp: '2026-08-24T00:00:00Z', eventType: 'E', severity: 'INFO', source: 'S', message: 'M' }).isValid, false);
});

runTest('Invalid severity string is rejected', () => {
  const res = validateLog({ timestamp: '2026-08-24T00:00:00Z', eventType: 'E', severity: 'SUPER_CRITICAL', source: 'S', message: 'M', status: '200' });
  assert.strictEqual(res.isValid, false);
  assert.ok(res.errors.some(e => e.includes('Invalid severity')));
});

runTest('Empty batch array is rejected', () => {
  const res = validateLogBatch([]);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.errors[0].errors.some(e => e.includes('empty')));
});

runTest('Malformed non-object inputs are rejected', () => {
  assert.strictEqual(validateLog(null).isValid, false);
  assert.strictEqual(validateLog(undefined).isValid, false);
  assert.strictEqual(validateLog('string-payload').isValid, false);
  assert.strictEqual(validateLog([1, 2, 3]).isValid, false);
});

// -------------------------------------------------------------
// 3. PERSISTENCE, TRANSACTIONS & RETRIEVAL VERIFICATION
// -------------------------------------------------------------
console.log('\n--- 3. Persistence, Transactions & Filtering Verification ---');

runTest('Querying empty database returns empty results with total 0', () => {
  logService.clearAllLogs();
  const res = logService.getLogs();
  assert.strictEqual(res.total, 0);
  assert.strictEqual(res.logs.length, 0);
});

runTest('Batch import is strictly transactional: Invalid entry causes zero rows inserted', () => {
  logService.clearAllLogs();

  const batchWithBadEntry = [
    { timestamp: '2026-08-24T08:00:00.000Z', eventType: 'VALID_1', severity: 'INFO', source: 's1', message: 'm1', status: '200' },
    { timestamp: 'INVALID_TIMESTAMP_STRING', eventType: 'BAD_ENTRY', severity: 'ERROR', source: 's2', message: 'm2', status: '500' },
    { timestamp: '2026-08-24T08:02:00.000Z', eventType: 'VALID_2', severity: 'INFO', source: 's3', message: 'm3', status: '200' }
  ];

  let threw = false;
  try {
    logService.importLogs(batchWithBadEntry);
  } catch (err) {
    threw = true;
  }

  assert.strictEqual(threw, true, 'Import should have thrown validation error');
  const count = db.prepare('SELECT COUNT(*) as count FROM logs').get().count;
  assert.strictEqual(count, 0, 'Database must have 0 rows after rolled-back batch');
});

runTest('End-to-end log ingestion stores anomaly result and remains retrievable', () => {
  logService.clearAllLogs();

  const anomalyPayload = {
    timestamp: '2026-08-24T09:30:00.000Z',
    eventType: 'DB_DEADLOCK_ALERT',
    severity: 'CRITICAL',
    source: 'database-primary',
    message: 'Process PID-999 terminated due to resource deadlock on table transactions',
    status: 'DEADLOCK'
  };

  const created = logService.createLog(anomalyPayload);
  assert.strictEqual(created.isAnomaly, true);
  assert.ok(created.anomalyScore >= 50);
  assert.ok(created.anomalyReason.length > 0);

  // Retrieve back and verify data integrity
  const retrieved = logService.getLogById(created.id);
  assert.strictEqual(retrieved.id, created.id);
  assert.strictEqual(retrieved.isAnomaly, true);
  assert.strictEqual(retrieved.anomalyScore, created.anomalyScore);
  assert.deepStrictEqual(retrieved.anomalyReason, created.anomalyReason);
});

runTest('Seed synthetic dataset and verify filtering capabilities', () => {
  const seedResult = logService.seedSyntheticLogs();
  assert.strictEqual(seedResult.importedCount, 25);
  assert.strictEqual(seedResult.anomaliesCount, 5);

  // Filter isAnomaly=true
  const anomaliesOnly = logService.getLogs({ isAnomaly: 'true' });
  assert.strictEqual(anomaliesOnly.logs.length, 5);
  for (const l of anomaliesOnly.logs) {
    assert.strictEqual(l.isAnomaly, true);
    assert.ok(l.anomalyScore >= 50);
  }

  // Filter isAnomaly=false
  const normalOnly = logService.getLogs({ isAnomaly: 'false' });
  assert.strictEqual(normalOnly.logs.length, 20);
  for (const l of normalOnly.logs) {
    assert.strictEqual(l.isAnomaly, false);
    assert.ok(l.anomalyScore < 50);
  }

  // Filter by severity
  const criticalOnly = logService.getLogs({ severity: 'CRITICAL' });
  assert.strictEqual(criticalOnly.logs.length, 2);

  // Search by keyword
  const searchDeadlock = logService.getLogs({ search: 'deadlock' });
  assert.ok(searchDeadlock.logs.length >= 1);
  assert.ok(searchDeadlock.logs[0].message.toLowerCase().includes('deadlock'));
});

console.log(`\n========================================`);
console.log(`Phase 2 Suite Results: ${passedTests} / ${totalTests} Passed`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
