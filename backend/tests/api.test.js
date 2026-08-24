import http from 'http';
import assert from 'assert';
import app from '../src/app.js';
import { db } from '../src/db/database.js';

console.log('🌐 Starting Phase 2 REST API Endpoint Verification Suite...\n');

let server;
const TEST_PORT = 5098;
const BASE_URL = `http://localhost:${TEST_PORT}`;

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (body !== null) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runApiTests() {
  server = app.listen(TEST_PORT);
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  try {
    // 1. Health check
    await test('GET /api/health returns 200, healthy status, and database info', async () => {
      const res = await makeRequest('GET', '/api/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'healthy');
      assert.strictEqual(res.body.database.status, 'connected');
    });

    // 2. Clear logs and verify empty database behavior
    await test('DELETE /api/logs clears database and GET /api/logs returns empty set without errors', async () => {
      const clearRes = await makeRequest('DELETE', '/api/logs');
      assert.strictEqual(clearRes.status, 200);
      assert.strictEqual(clearRes.body.success, true);

      const listRes = await makeRequest('GET', '/api/logs');
      assert.strictEqual(listRes.status, 200);
      assert.strictEqual(listRes.body.data.total, 0);
      assert.strictEqual(listRes.body.data.logs.length, 0);
    });

    // 3. Seed endpoint
    await test('POST /api/logs/seed populates synthetic dataset (25 logs, 5 anomalies)', async () => {
      const res = await makeRequest('POST', '/api/logs/seed');
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.importedCount, 25);
      assert.strictEqual(res.body.data.anomaliesCount, 5);
    });

    // 4. Query logs with pagination
    await test('GET /api/logs returns paginated list of logs', async () => {
      const res = await makeRequest('GET', '/api/logs?limit=10&offset=0');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.logs.length, 10);
      assert.strictEqual(res.body.data.total, 25);
    });

    // 5. Query anomalies only
    await test('GET /api/logs?isAnomaly=true returns only 5 anomalous logs', async () => {
      const res = await makeRequest('GET', '/api/logs?isAnomaly=true');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.logs.length, 5);
      for (const log of res.body.data.logs) {
        assert.strictEqual(log.isAnomaly, true);
        assert.ok(log.anomalyScore >= 50);
        assert.ok(Array.isArray(log.anomalyReason) && log.anomalyReason.length > 0);
      }
    });

    // 6. Query normal logs only
    await test('GET /api/logs?isAnomaly=false returns only 20 normal logs', async () => {
      const res = await makeRequest('GET', '/api/logs?isAnomaly=false');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.logs.length, 20);
      for (const log of res.body.data.logs) {
        assert.strictEqual(log.isAnomaly, false);
        assert.ok(log.anomalyScore < 50);
      }
    });

    // 7. Filter by severity and source
    await test('GET /api/logs with severity and source filters works accurately', async () => {
      const resSev = await makeRequest('GET', '/api/logs?severity=CRITICAL');
      assert.strictEqual(resSev.status, 200);
      assert.strictEqual(resSev.body.data.logs.length, 2);

      const resSrc = await makeRequest('GET', '/api/logs?source=auth-service');
      assert.strictEqual(resSrc.status, 200);
      assert.ok(resSrc.body.data.logs.length >= 2);
    });

    // 8. Search query parameter
    await test('GET /api/logs?search=deadlock returns matching deadlock log', async () => {
      const res = await makeRequest('GET', '/api/logs?search=deadlock');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.logs.length >= 1);
      assert.ok(res.body.data.logs[0].message.toLowerCase().includes('deadlock'));
    });

    // 9. Stats endpoint
    await test('GET /api/logs/stats returns correct totals and rates', async () => {
      const res = await makeRequest('GET', '/api/logs/stats');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.total, 25);
      assert.strictEqual(res.body.data.anomalies, 5);
      assert.strictEqual(res.body.data.normal, 20);
      assert.strictEqual(res.body.data.anomalyRate, 20);
    });

    // 10. Ingest single log (normal)
    let normalLogId;
    await test('POST /api/logs with normal log returns 201 with score 0 and isAnomaly=false', async () => {
      const normalPayload = {
        timestamp: new Date().toISOString(),
        eventType: 'API_GET_USER',
        severity: 'INFO',
        source: 'user-service',
        message: 'Successfully retrieved user details',
        status: '200'
      };
      const res = await makeRequest('POST', '/api/logs', normalPayload);
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.isAnomaly, false);
      assert.strictEqual(res.body.data.anomalyScore, 0);
      normalLogId = res.body.data.id;
    });

    // 11. Ingest single log (anomalous)
    let anomalyLogId;
    await test('POST /api/logs with anomalous log (CRITICAL + 500) returns 201 with score 75 and isAnomaly=true', async () => {
      const anomalyPayload = {
        timestamp: new Date().toISOString(),
        eventType: 'PAYMENT_FAILURE',
        severity: 'CRITICAL',
        source: 'billing-engine',
        message: 'Payment settlement failed due to upstream network issue',
        status: '500'
      };
      const res = await makeRequest('POST', '/api/logs', anomalyPayload);
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.isAnomaly, true);
      assert.strictEqual(res.body.data.anomalyScore, 75);
      anomalyLogId = res.body.data.id;
    });

    // 12. Retrieve single log by ID
    await test('GET /api/logs/:id returns log with structured anomaly metadata', async () => {
      const res = await makeRequest('GET', `/api/logs/${anomalyLogId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.id, anomalyLogId);
      assert.strictEqual(res.body.data.isAnomaly, true);
      assert.strictEqual(res.body.data.anomalyScore, 75);
      assert.ok(res.body.data.anomalyReason.length >= 2);
    });

    // 13. Retrieve non-existent log
    await test('GET /api/logs/:id with non-existent ID returns 404', async () => {
      const res = await makeRequest('GET', '/api/logs/non-existent-uuid-1234');
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
    });

    // 14. Validation: Missing timestamp returns 400
    await test('POST /api/logs missing timestamp returns 400 Bad Request', async () => {
      const res = await makeRequest('POST', '/api/logs', {
        eventType: 'TEST',
        severity: 'INFO',
        source: 's',
        message: 'm',
        status: '200'
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.details.some(d => d.includes('timestamp')));
    });

    // 15. Validation: Invalid timestamp format returns 400
    await test('POST /api/logs invalid timestamp string returns 400 Bad Request', async () => {
      const res = await makeRequest('POST', '/api/logs', {
        timestamp: 'invalid-timestamp-abc',
        eventType: 'TEST',
        severity: 'INFO',
        source: 's',
        message: 'm',
        status: '200'
      });
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.details.some(d => d.includes('Invalid timestamp format')));
    });

    // 16. Validation: Missing required fields returns 400
    await test('POST /api/logs with missing required fields returns 400 Bad Request', async () => {
      const res = await makeRequest('POST', '/api/logs', { timestamp: new Date().toISOString() });
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.details.length >= 4);
    });

    // 17. Batch import: Empty array returns 400
    await test('POST /api/logs/import with empty array returns 400 Bad Request', async () => {
      const res = await makeRequest('POST', '/api/logs/import', []);
      assert.strictEqual(res.status, 400);
    });

    // 18. Batch import: Invalid item causes entire batch rejection (transactional)
    await test('POST /api/logs/import with 1 invalid item rolls back all items', async () => {
      const countBefore = db.prepare('SELECT COUNT(*) as count FROM logs').get().count;

      const badBatch = [
        { timestamp: new Date().toISOString(), eventType: 'VALID_A', severity: 'INFO', source: 'src', message: 'msg', status: '200' },
        { timestamp: 'INVALID_DATE', eventType: 'INVALID_B', severity: 'ERROR', source: 'src', message: 'msg', status: '500' }
      ];

      const res = await makeRequest('POST', '/api/logs/import', badBatch);
      assert.strictEqual(res.status, 400);

      const countAfter = db.prepare('SELECT COUNT(*) as count FROM logs').get().count;
      assert.strictEqual(countAfter, countBefore, 'Database row count must not change on failed batch');
    });

    // 19. Delete single log
    await test('DELETE /api/logs/:id removes record and returns 200', async () => {
      const res = await makeRequest('DELETE', `/api/logs/${normalLogId}`);
      assert.strictEqual(res.status, 200);

      // Verify 404 now
      const verifyRes = await makeRequest('GET', `/api/logs/${normalLogId}`);
      assert.strictEqual(verifyRes.status, 404);
    });

    // 20. Delete non-existent log returns 404
    await test('DELETE /api/logs/:id on non-existent ID returns 404', async () => {
      const res = await makeRequest('DELETE', '/api/logs/non-existent-uuid-9999');
      assert.strictEqual(res.status, 404);
    });

    console.log(`\n========================================`);
    console.log(`Phase 2 API Test Results: ${passed} / ${total} Passed`);
    console.log(`========================================\n`);

    if (passed !== total) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runApiTests().catch((err) => {
  console.error('Fatal API test error:', err);
  if (server) server.close();
  process.exit(1);
});
