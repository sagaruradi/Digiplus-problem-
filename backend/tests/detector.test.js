import assert from 'assert';
import { detectAnomaly, extractIpAddress } from '../src/detector/anomalyDetector.js';
import { validateLog, validateLogBatch } from '../src/validators/logValidator.js';
import logService from '../src/services/logService.js';
import { db } from '../src/db/database.js';

console.log('🧪 Starting Anomaly Detector, Validation & Repeat IP Offender Verification Suite...\n');

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
  const errorLog = {
    timestamp: '2026-08-24T08:00:00.000Z',
    eventType: 'ORDER_TIMEOUT',
    severity: 'ERROR',
    source: 'order-service',
    message: 'Order creation process interrupted',
    status: 'TIMEOUT'
  };

  const result = detectAnomaly(errorLog);
  assert.strictEqual(result.isAnomaly, true);
  assert.strictEqual(result.score, 50);
  assert.strictEqual(result.reasons.length, 2);
  assert.ok(result.reasons.some(r => r.includes('ERROR severity (+25)')));
  assert.ok(result.reasons.some(r => r.includes("Failure status flag: 'TIMEOUT' (+25)")));
});

runTest('CRITICAL (+45) + 500 (+30) reliably produces score 75 and isAnomaly = true', () => {
  const criticalLog = {
    timestamp: '2026-08-24T08:00:00.000Z',
    eventType: 'SERVICE_OUTAGE',
    severity: 'CRITICAL',
    source: 'payment-gateway',
    message: 'Upstream payment processor unreachable',
    status: '500'
  };

  const result = detectAnomaly(criticalLog);
  assert.strictEqual(result.isAnomaly, true);
  assert.strictEqual(result.score, 75);
  assert.ok(result.reasons.some(r => r.includes('CRITICAL severity (+45)')));
  assert.ok(result.reasons.some(r => r.includes('HTTP server error status code: 500 (+30)')));
});

runTest('Keyword deduplication: Multiple matching patterns in same category only score once', () => {
  const duplicatePatternLog = {
    timestamp: '2026-08-24T08:00:00.000Z',
    eventType: 'MEM_ALERT',
    severity: 'INFO',
    source: 'analytics-worker',
    message: 'Process experienced heap out of memory and out of memory crash with memory leak',
    status: '200'
  };

  const result = detectAnomaly(duplicatePatternLog);
  assert.strictEqual(result.score, 35);
  assert.strictEqual(result.reasons.length, 1);
  assert.ok(result.reasons[0].includes('Memory exhaustion / OOM condition identified in message (+35)'));
});

runTest('Auth / rate-limit statuses (401, 403, 429) add +20 points', () => {
  const rateLimitLog = {
    timestamp: '2026-08-24T08:00:00.000Z',
    eventType: 'API_THROTTLE',
    severity: 'WARN',
    source: 'api-gateway',
    message: 'Rate limit threshold exceeded for client API key',
    status: '429'
  };

  const result = detectAnomaly(rateLimitLog);
  assert.strictEqual(result.score, 30);
  assert.strictEqual(result.isAnomaly, false);
  assert.ok(result.reasons.some(r => r.includes('WARN severity (+10)')));
  assert.ok(result.reasons.some(r => r.includes('Authentication / rate-limit status code: 429 (+20)')));
});

runTest('Configurable threshold works as expected', () => {
  const borderLog = {
    timestamp: '2026-08-24T08:00:00.000Z',
    eventType: 'AUTH_FAIL',
    severity: 'ERROR',
    source: 'auth-service',
    message: 'Invalid password provided',
    status: '401'
  };

  const standardRes = detectAnomaly(borderLog, 50);
  assert.strictEqual(standardRes.score, 45);
  assert.strictEqual(standardRes.isAnomaly, false);

  const sensitiveRes = detectAnomaly(borderLog, 40);
  assert.strictEqual(sensitiveRes.score, 45);
  assert.strictEqual(sensitiveRes.isAnomaly, true);
});

runTest('Score is capped at 100', () => {
  const extremeLog = {
    timestamp: '2026-08-24T08:00:00.000Z',
    eventType: 'CATASTROPHIC_FAILURE',
    severity: 'FATAL',
    source: 'core-database',
    message: 'FATAL deadlock occurred causing segmentation fault and out of memory crash with brute force exploit',
    status: '500'
  };

  const result = detectAnomaly(extremeLog);
  assert.strictEqual(result.score, 100);
  assert.strictEqual(result.isAnomaly, true);
});

// -------------------------------------------------------------
// 2. INPUT VALIDATOR EDGE CASES
// -------------------------------------------------------------
console.log('\n--- 2. Input Validator Edge Cases ---');

runTest('Missing or empty timestamp is rejected', () => {
  const invalidLog = {
    eventType: 'TEST',
    severity: 'INFO',
    source: 'test-src',
    message: 'missing timestamp',
    status: '200'
  };

  const res = validateLog(invalidLog);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.errors.some(e => e.includes('timestamp')));
});

runTest('Unparseable invalid timestamp string is rejected', () => {
  const invalidLog = {
    timestamp: 'not-a-real-date',
    eventType: 'TEST',
    severity: 'INFO',
    source: 'test-src',
    message: 'invalid date',
    status: '200'
  };

  const res = validateLog(invalidLog);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.errors.some(e => e.includes('timestamp')));
});

runTest('Missing individual required fields are caught', () => {
  const missingFields = [
    { field: 'eventType', obj: { timestamp: new Date().toISOString(), severity: 'INFO', source: 'src', message: 'm', status: '200' } },
    { field: 'severity', obj: { timestamp: new Date().toISOString(), eventType: 'evt', source: 'src', message: 'm', status: '200' } },
    { field: 'source', obj: { timestamp: new Date().toISOString(), eventType: 'evt', severity: 'INFO', message: 'm', status: '200' } },
    { field: 'message', obj: { timestamp: new Date().toISOString(), eventType: 'evt', severity: 'INFO', source: 'src', status: '200' } },
    { field: 'status', obj: { timestamp: new Date().toISOString(), eventType: 'evt', severity: 'INFO', source: 'src', message: 'm' } }
  ];

  for (const { field, obj } of missingFields) {
    const res = validateLog(obj);
    assert.strictEqual(res.isValid, false, `Expected missing ${field} to fail validation`);
    assert.ok(res.errors.some(e => e.includes(field)));
  }
});

runTest('Invalid severity string is rejected', () => {
  const invalidLog = {
    timestamp: new Date().toISOString(),
    eventType: 'TEST',
    severity: 'UNKNOWN_LEVEL',
    source: 'src',
    message: 'test msg',
    status: '200'
  };

  const res = validateLog(invalidLog);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.errors.some(e => e.includes('severity')));
});

runTest('Empty batch array is rejected', () => {
  const res = validateLogBatch([]);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.errors.some(e => e.errors.some(msg => msg.includes('empty'))));
});

runTest('Malformed non-object inputs are rejected', () => {
  assert.strictEqual(validateLog(null).isValid, false);
  assert.strictEqual(validateLog('string').isValid, false);
  assert.strictEqual(validateLogBatch(null).isValid, false);
  assert.strictEqual(validateLogBatch({ notAnArray: true }).isValid, false);
});

// -------------------------------------------------------------
// 3. PERSISTENCE, TRANSACTIONS & FILTERING VERIFICATION
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

  const mixedBatch = [
    {
      timestamp: new Date().toISOString(),
      eventType: 'VALID_1',
      severity: 'INFO',
      source: 'service-a',
      message: 'Valid log entry 1',
      status: '200'
    },
    {
      timestamp: 'invalid-date',
      eventType: 'INVALID_2',
      severity: 'INVALID_SEVERITY',
      source: 'service-b',
      message: 'Invalid log entry 2',
      status: '500'
    }
  ];

  assert.throws(() => {
    logService.importLogs(mixedBatch);
  }, /Batch validation failed/);

  const res = logService.getLogs();
  assert.strictEqual(res.total, 0, 'Transactional rollback should result in 0 records stored');
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

  const retrieved = logService.getLogById(created.id);
  assert.strictEqual(retrieved.id, created.id);
  assert.strictEqual(retrieved.isAnomaly, true);
  assert.strictEqual(retrieved.anomalyScore, created.anomalyScore);
  assert.deepStrictEqual(retrieved.anomalyReason, created.anomalyReason);
});

runTest('Seed synthetic dataset and verify filtering capabilities', () => {
  const seedResult = logService.seedDatabase();
  assert.strictEqual(seedResult.importedCount, 25);
  assert.strictEqual(seedResult.anomaliesCount, 5);

  const anomaliesOnly = logService.getLogs({ isAnomaly: 'true' });
  assert.strictEqual(anomaliesOnly.logs.length, 5);
  for (const l of anomaliesOnly.logs) {
    assert.strictEqual(l.isAnomaly, true);
    assert.ok(l.anomalyScore >= 50);
  }

  const normalOnly = logService.getLogs({ isAnomaly: 'false' });
  assert.strictEqual(normalOnly.logs.length, 20);
  for (const l of normalOnly.logs) {
    assert.strictEqual(l.isAnomaly, false);
    assert.ok(l.anomalyScore < 50);
  }

  const criticalOnly = logService.getLogs({ severity: 'CRITICAL' });
  assert.strictEqual(criticalOnly.logs.length, 2);

  const searchDeadlock = logService.getLogs({ search: 'deadlock' });
  assert.ok(searchDeadlock.logs.length >= 1);
  assert.ok(searchDeadlock.logs[0].message.toLowerCase().includes('deadlock'));
});

// -------------------------------------------------------------
// 4. REPEAT IP OFFENDER EXTRACTION & CUMULATIVE SCORING
// -------------------------------------------------------------
console.log('\n--- 4. Repeat IP Offender Extraction & Cumulative Scoring ---');

runTest('extractIpAddress extracts valid IPv4 and ignores non-IP strings', () => {
  assert.strictEqual(extractIpAddress('Failed login attempt from IP 192.168.1.105 on port 8080'), '192.168.1.105');
  assert.strictEqual(extractIpAddress('Request from 10.0.0.1 blocked'), '10.0.0.1');
  assert.strictEqual(extractIpAddress('No IP address here at all'), null);
  assert.strictEqual(extractIpAddress(null), null);
  assert.strictEqual(extractIpAddress(12345), null);
});

runTest('detectAnomaly applies repeat offender score tiers from context', () => {
  const mildAuthLog = {
    timestamp: new Date().toISOString(),
    eventType: 'AUTH_FAILURE',
    severity: 'WARN',
    source: 'auth-service',
    message: 'Invalid password for user test from IP 172.16.0.45',
    status: '401'
  };

  // Baseline without context: WARN (+10) + 401 (+20) = 30 (Normal)
  const baselineRes = detectAnomaly(mildAuthLog, 50, {});
  assert.strictEqual(baselineRes.score, 30);
  assert.strictEqual(baselineRes.isAnomaly, false);

  // 3 previous failures: 30 + 15 = 45 (Normal)
  const tier1Res = detectAnomaly(mildAuthLog, 50, { ipAddress: '172.16.0.45', recentFailureCount: 3 });
  assert.strictEqual(tier1Res.score, 45);
  assert.strictEqual(tier1Res.isAnomaly, false);
  assert.ok(tier1Res.reasons.some(r => r.includes('Repeat offender signal: 3 recent failure incidents')));

  // 6 previous failures: 30 + 30 = 60 (ANOMALY!)
  const tier2Res = detectAnomaly(mildAuthLog, 50, { ipAddress: '172.16.0.45', recentFailureCount: 6 });
  assert.strictEqual(tier2Res.score, 60);
  assert.strictEqual(tier2Res.isAnomaly, true);
  assert.ok(tier2Res.reasons.some(r => r.includes('High-frequency attack (6 recent failures)')));

  // 12 previous failures: 30 + 50 = 80 (ANOMALY!)
  const tier3Res = detectAnomaly(mildAuthLog, 50, { ipAddress: '172.16.0.45', recentFailureCount: 12 });
  assert.strictEqual(tier3Res.score, 80);
  assert.strictEqual(tier3Res.isAnomaly, true);
  assert.ok(tier3Res.reasons.some(r => r.includes('Sustained assault (12 recent failures)')));
});

runTest('Sequential log ingestion dynamically escalates anomaly score for repeat IP offender', () => {
  logService.clearAllLogs();
  const ip = '198.51.100.77';

  // 1st failed attempt from IP: WARN (+10) + 401 (+20) = 30 (isAnomaly = false)
  const log1 = logService.createLog({
    timestamp: new Date().toISOString(),
    eventType: 'LOGIN_FAIL',
    severity: 'WARN',
    source: 'auth-service',
    message: `Invalid credentials from IP ${ip}`,
    status: '401'
  });
  assert.strictEqual(log1.anomalyScore, 30);
  assert.strictEqual(log1.isAnomaly, false);

  // 2nd failed attempt from same IP (1 prior in DB): 30 (isAnomaly = false)
  const log2 = logService.createLog({
    timestamp: new Date().toISOString(),
    eventType: 'LOGIN_FAIL',
    severity: 'WARN',
    source: 'auth-service',
    message: `Invalid credentials from IP ${ip}`,
    status: '401'
  });
  assert.strictEqual(log2.anomalyScore, 30);
  assert.strictEqual(log2.isAnomaly, false);

  // 3rd failed attempt from same IP (2 prior in DB): 30 + 15 = 45 (isAnomaly = false)
  const log3 = logService.createLog({
    timestamp: new Date().toISOString(),
    eventType: 'LOGIN_FAIL',
    severity: 'WARN',
    source: 'auth-service',
    message: `Invalid credentials from IP ${ip}`,
    status: '401'
  });
  assert.strictEqual(log3.anomalyScore, 45);
  assert.strictEqual(log3.isAnomaly, false);
  assert.ok(log3.anomalyReason.some(r => r.includes('Repeat offender')));

  // Ingest 3 more failures from same IP
  for (let i = 0; i < 3; i++) {
    logService.createLog({
      timestamp: new Date().toISOString(),
      eventType: 'LOGIN_FAIL',
      severity: 'WARN',
      source: 'auth-service',
      message: `Invalid credentials from IP ${ip}`,
      status: '401'
    });
  }

  // 7th failed attempt from same IP (6 prior in DB): 30 + 30 = 60 (isAnomaly = true!)
  const log7 = logService.createLog({
    timestamp: new Date().toISOString(),
    eventType: 'LOGIN_FAIL',
    severity: 'WARN',
    source: 'auth-service',
    message: `Invalid credentials from IP ${ip}`,
    status: '401'
  });
  assert.strictEqual(log7.anomalyScore, 60);
  assert.strictEqual(log7.isAnomaly, true);
  assert.ok(log7.anomalyReason.some(r => r.includes('High-frequency attack (6 recent failures)')));
});

console.log(`\n========================================`);
console.log(`Detector & IP Suite Results: ${passedTests} / ${totalTests} Passed`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
