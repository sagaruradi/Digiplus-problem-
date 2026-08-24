import http from 'http';
import assert from 'assert';
import app from '../src/app.js';
import geminiService, { buildAnalysisPrompt, validateGeminiAnalysis } from '../src/services/geminiService.js';
import logService from '../src/services/logService.js';
import { config } from '../src/config/index.js';

console.log('🤖 Starting Gemini Service & AI Explanation Verification Suite...\n');

let server;
const TEST_PORT = 5097;
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

async function runGeminiTests() {
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
    // 1. Prompt Building Test
    await test('buildAnalysisPrompt includes all log metadata, score, and reasons', () => {
      const sampleAnomaly = {
        timestamp: '2026-08-24T08:09:12.000Z',
        eventType: 'DB_TRANSACTION',
        severity: 'CRITICAL',
        source: 'database-cluster',
        status: 'DEADLOCK',
        message: 'Deadlock between PID-4412 and PID-7781 on resource idx_ledger_balance',
        anomalyScore: 100,
        anomalyReason: ['CRITICAL severity (+45)', 'Failure status flag: DEADLOCK (+25)']
      };

      const prompt = buildAnalysisPrompt(sampleAnomaly);
      assert.ok(prompt.includes('database-cluster'));
      assert.ok(prompt.includes('DEADLOCK'));
      assert.ok(prompt.includes('100 / 100'));
      assert.ok(prompt.includes('CRITICAL severity'));
      assert.ok(prompt.includes('Do not decide whether the event is anomalous'));
    });

    // 2. Output Schema Validation Tests
    await test('validateGeminiAnalysis validates valid JSON response', () => {
      const valid = {
        explanation: 'Database deadlock occurred between two transactions.',
        likelyRootCause: 'Concurrent updates on index idx_ledger_balance in reverse order.',
        nextStep: 'Inspect application transaction boundaries and implement consistent locking.'
      };
      const result = validateGeminiAnalysis(valid);
      assert.strictEqual(result.explanation, valid.explanation);
      assert.strictEqual(result.likelyRootCause, valid.likelyRootCause);
      assert.strictEqual(result.nextStep, valid.nextStep);
    });

    await test('validateGeminiAnalysis throws on missing required fields', () => {
      // Missing nextStep
      assert.throws(() => {
        validateGeminiAnalysis({
          explanation: 'Some explanation',
          likelyRootCause: 'Some root cause'
        });
      }, /nextStep/);

      // Missing explanation
      assert.throws(() => {
        validateGeminiAnalysis({
          likelyRootCause: 'Some root cause',
          nextStep: 'Some next step'
        });
      }, /explanation/);
    });

    // 3. Missing API key handling
    await test('analyzeAnomaly throws 503 when API key is missing', async () => {
      const originalKey = config.geminiApiKey;
      config.geminiApiKey = '';
      try {
        let threw = false;
        try {
          await geminiService.analyzeAnomaly({
            timestamp: new Date().toISOString(),
            eventType: 'TEST',
            severity: 'CRITICAL',
            source: 'test',
            message: 'test',
            status: '500',
            anomalyScore: 75,
            anomalyReason: ['test']
          });
        } catch (err) {
          threw = true;
          assert.strictEqual(err.statusCode, 503);
          assert.ok(err.message.includes('API key is not configured'));
        }
        assert.strictEqual(threw, true);
      } finally {
        config.geminiApiKey = originalKey;
      }
    });

    // 4. REST API: Analyze non-existent log returns 404
    await test('POST /api/logs/:id/analyze returns 404 for non-existent log', async () => {
      const res = await makeRequest('POST', '/api/logs/non-existent-uuid-12345/analyze');
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
    });

    // 5. REST API: Analyze normal log (not anomaly) returns 400 Bad Request
    await test('POST /api/logs/:id/analyze on normal log returns 400 and does NOT call AI', async () => {
      logService.clearAllLogs();
      const normalLog = logService.createLog({
        timestamp: new Date().toISOString(),
        eventType: 'AUTH_LOGIN',
        severity: 'INFO',
        source: 'auth-service',
        message: 'User logged in normally',
        status: '200'
      });

      const res = await makeRequest('POST', `/api/logs/${normalLog.id}/analyze`);
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.error.includes('not flagged as an anomaly'));
    });

    // 6. REST API: Mocked successful AI analysis persistence & retrieval
    await test('POST /api/logs/:id/analyze persists AI explanation and GET returns saved fields', async () => {
      const anomalyLog = logService.createLog({
        timestamp: new Date().toISOString(),
        eventType: 'DB_DEADLOCK',
        severity: 'CRITICAL',
        source: 'database-cluster',
        message: 'Transaction deadlock detected on ledger table',
        status: 'DEADLOCK'
      });

      // Stub geminiService.analyzeAnomaly for automated test
      const originalAnalyze = geminiService.analyzeAnomaly;
      geminiService.analyzeAnomaly = async (log) => ({
        explanation: 'Mocked: A database deadlock halted transaction processing.',
        likelyRootCause: 'Mocked: Mutually exclusive lock order between processes.',
        nextStep: 'Mocked: Enforce deterministic locking order in SQL transactions.',
        generatedAt: '2026-08-24T10:00:00.000Z'
      });

      try {
        const analyzeRes = await makeRequest('POST', `/api/logs/${anomalyLog.id}/analyze`);
        assert.strictEqual(analyzeRes.status, 200);
        assert.strictEqual(analyzeRes.body.success, true);
        assert.strictEqual(analyzeRes.body.data.aiExplanation, 'Mocked: A database deadlock halted transaction processing.');
        assert.strictEqual(analyzeRes.body.data.aiRootCause, 'Mocked: Mutually exclusive lock order between processes.');
        assert.strictEqual(analyzeRes.body.data.aiNextStep, 'Mocked: Enforce deterministic locking order in SQL transactions.');
        assert.strictEqual(analyzeRes.body.data.aiGeneratedAt, '2026-08-24T10:00:00.000Z');

        // Verify retrieval via GET /api/logs/:id
        const getRes = await makeRequest('GET', `/api/logs/${anomalyLog.id}`);
        assert.strictEqual(getRes.status, 200);
        assert.strictEqual(getRes.body.data.aiExplanation, 'Mocked: A database deadlock halted transaction processing.');
        assert.strictEqual(getRes.body.data.aiRootCause, 'Mocked: Mutually exclusive lock order between processes.');
      } finally {
        geminiService.analyzeAnomaly = originalAnalyze;
      }
    });

    console.log(`\n========================================`);
    console.log(`Gemini Suite Results: ${passed} / ${total} Passed`);
    console.log(`========================================\n`);

    if (passed !== total) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runGeminiTests().catch((err) => {
  console.error('Fatal Gemini test error:', err);
  if (server) server.close();
  process.exit(1);
});
