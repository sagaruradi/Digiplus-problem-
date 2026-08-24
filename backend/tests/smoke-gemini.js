import logService from '../src/services/logService.js';
import { config } from '../src/config/index.js';

console.log('========================================================');
console.log('🔥 Live Gemini AI Anomaly Explanation Smoke Test');
console.log('========================================================');
console.log(`🤖 Configured Model: ${config.geminiModel}`);
console.log(`🔑 API Key Configured: ${config.geminiApiKey ? 'YES (Key Present)' : 'NO'}\n`);

if (!config.geminiApiKey) {
  console.error('❌ Error: GEMINI_API_KEY is not set in backend/.env');
  process.exit(1);
}

async function runSmokeTest() {
  try {
    // 1. Seed database with synthetic logs
    console.log('1️⃣ Seeding database with synthetic dataset...');
    const seedResult = logService.seedSyntheticLogs();
    console.log(`   Seeded ${seedResult.importedCount} logs (${seedResult.anomaliesCount} anomalies detected).\n`);

    // 2. Fetch the first detected anomaly (e.g. Database Deadlock)
    console.log('2️⃣ Locating an un-analyzed anomaly record...');
    const anomalies = logService.getLogs({ isAnomaly: 'true', limit: 1 });
    if (anomalies.logs.length === 0) {
      throw new Error('No anomalous logs found in seeded dataset');
    }

    const anomaly = anomalies.logs[0];
    console.log(`   Found Anomaly ID: ${anomaly.id}`);
    console.log(`   Source: ${anomaly.source} | Severity: ${anomaly.severity}`);
    console.log(`   Event: ${anomaly.eventType} | Status: ${anomaly.status}`);
    console.log(`   Message: ${anomaly.message}`);
    console.log(`   Score: ${anomaly.anomalyScore}/100\n`);

    // 3. Trigger Gemini Analysis via Service Flow
    console.log('3️⃣ Calling Gemini AI to explain the detected anomaly...');
    const startTime = Date.now();
    const updatedLog = await logService.analyzeLogAnomaly(anomaly.id);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`   ✅ Gemini Response received in ${duration}s!\n`);

    // 4. Print Structured AI Output
    console.log('========================================================');
    console.log('📋 Structured AI Explanation Output:');
    console.log('========================================================');
    console.log(`💡 Explanation:\n   ${updatedLog.aiExplanation}\n`);
    console.log(`🔍 Likely Root Cause:\n   ${updatedLog.aiRootCause}\n`);
    console.log(`🛠️ Recommended Next Step:\n   ${updatedLog.aiNextStep}\n`);
    console.log(`⏱️ Analysis Generated At: ${updatedLog.aiGeneratedAt}`);
    console.log('========================================================\n');

    // 5. Verify SQLite Persistence
    console.log('4️⃣ Verifying SQLite database persistence...');
    const persisted = logService.getLogById(anomaly.id);
    if (!persisted.aiExplanation || !persisted.aiRootCause || !persisted.aiNextStep) {
      throw new Error('AI analysis fields were not persisted in SQLite');
    }
    console.log('   ✅ Verification successful! Log retrieved from SQLite contains all AI fields.\n');
    console.log('🎉 LIVE GEMINI INTEGRATION SMOKE TEST PASSED!');
  } catch (error) {
    console.error('\n❌ Smoke Test Failed:');
    console.error(error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

runSmokeTest();
