/**
 * Custom Rule/Score-Based Anomaly Detection Module
 * 
 * NOTE: This is 100% our own deterministic algorithm.
 * Under NO circumstances does this use AI or Gemini API calls.
 */

// Categorized keyword heuristics for explainable signals and deduplication
const KEYWORD_CATEGORIES = [
  {
    category: 'database_deadlock',
    weight: 30,
    patterns: [/\b(deadlock|deadlocked|lock\s*wait\s*timeout)\b/i],
    tag: 'Database deadlock / lock contention detected in message'
  },
  {
    category: 'security_assault',
    weight: 30,
    patterns: [
      /\b(brute\s*force|credential\s*stuffing|unauthorized\s*access\s*burst)\b/i,
      /\b(sql\s*injection|privilege\s*escalation|xss\s*detected)\b/i
    ],
    tag: 'Security assault or exploit pattern identified in message'
  },
  {
    category: 'memory_exhaustion',
    weight: 35,
    patterns: [
      /\b(out\s*of\s*memory|heap\s*out\s*of\s*memory|oom|heap\s*limit\s*exceeded)\b/i,
      /\b(memory\s*leak|buffer\s*overflow|stack\s*overflow)\b/i
    ],
    tag: 'Memory exhaustion / OOM condition identified in message'
  },
  {
    category: 'process_crash',
    weight: 35,
    patterns: [
      /\b(segmentation\s*fault|segfault|core\s*dumped|kernel\s*panic)\b/i,
      /\b(fatal\s*exception|uncaught\s*exception|unhandled\s*rejection)\b/i
    ],
    tag: 'Critical process crash / unhandled fatal exception in message'
  },
  {
    category: 'network_connectivity',
    weight: 20,
    patterns: [
      /\b(connection\s*refused|connection\s*reset|econnrefused|econnreset)\b/i,
      /\b(gateway\s*timeout|upstream\s*timeout|socket\s*hang\s*up|timed\s*out)\b/i
    ],
    tag: 'Network connectivity / upstream timeout condition in message'
  },
  {
    category: 'circuit_breaker',
    weight: 25,
    patterns: [/\b(circuit\s*breaker\s*(opened|open|tripped))\b/i],
    tag: 'Cascading failure mitigation: Circuit breaker tripped in message'
  }
];

/**
 * Evaluates a single log entry against deterministic heuristic rules and computes an anomaly score.
 * 
 * Signal Weights:
 * - FATAL severity: +50
 * - CRITICAL severity: +45
 * - ERROR severity: +25
 * - WARN severity: +10
 * - HTTP 500-504 / 5xx: +30
 * - Auth/Rate-limit 401/403/429: +20
 * - Status TIMEOUT/FAILED/DEADLOCK/CRASH: +25
 * - High-Risk Keyword Categories (deduplicated): +20 to +35
 * 
 * @param {Object} log - The log entry object
 * @param {string} log.severity - Severity level (INFO, WARN, ERROR, CRITICAL, FATAL)
 * @param {string|number} log.status - Status code or status string (e.g. "500", "200", "TIMEOUT")
 * @param {string} log.message - The log detail message
 * @param {string} [log.eventType] - The category/type of the event
 * @param {string} [log.source] - The originating service
 * @param {number} [threshold=50] - Threshold score (0-100) to flag as anomaly
 * @returns {{ isAnomaly: boolean, score: number, reasons: string[] }}
 */
export function detectAnomaly(log, threshold = 50) {
  let score = 0;
  const reasons = [];

  const severity = (log.severity || '').toUpperCase().trim();
  const statusStr = String(log.status || '').toUpperCase().trim();
  const message = String(log.message || '');

  // 1. Severity Evaluation
  if (severity === 'FATAL') {
    score += 50;
    reasons.push('FATAL severity (+50)');
  } else if (severity === 'CRITICAL') {
    score += 45;
    reasons.push('CRITICAL severity (+45)');
  } else if (severity === 'ERROR') {
    score += 25;
    reasons.push('ERROR severity (+25)');
  } else if (severity === 'WARN' || severity === 'WARNING') {
    score += 10;
    reasons.push('WARN severity (+10)');
  }

  // 2. Status Code & Status Flag Evaluation
  const numericStatus = parseInt(statusStr, 10);
  if (!isNaN(numericStatus)) {
    if (numericStatus >= 500 && numericStatus <= 599) {
      score += 30;
      reasons.push(`HTTP server error status code: ${numericStatus} (+30)`);
    } else if (numericStatus === 401 || numericStatus === 403 || numericStatus === 429) {
      score += 20;
      reasons.push(`Authentication / rate-limit status code: ${numericStatus} (+20)`);
    }
  } else {
    if (['TIMEOUT', 'TIMED_OUT', 'FAILED', 'FAILURE', 'DEADLOCK', 'CRASH', 'PANIC'].includes(statusStr)) {
      score += 25;
      reasons.push(`Failure status flag: '${statusStr}' (+25)`);
    } else if (['DEGRADED', 'CIRCUIT_BROKEN'].includes(statusStr)) {
      score += 20;
      reasons.push(`Degraded operational status: '${statusStr}' (+20)`);
    }
  }

  // 3. Keyword Heuristics with Category Deduplication
  // Prevents multiple overlapping patterns in the same category from inflating the score
  const matchedCategories = new Set();

  for (const cat of KEYWORD_CATEGORIES) {
    if (matchedCategories.has(cat.category)) continue;

    for (const pattern of cat.patterns) {
      if (pattern.test(message)) {
        matchedCategories.add(cat.category);
        score += cat.weight;
        reasons.push(`${cat.tag} (+${cat.weight})`);
        break; // Match category once
      }
    }
  }

  // 4. Normalization and Decision
  const normalizedScore = Math.min(100, Math.max(0, score));
  const isAnomaly = normalizedScore >= threshold;

  // Fallback reason if threshold was met
  if (isAnomaly && reasons.length === 0) {
    reasons.push(`Anomaly score (${normalizedScore}) reached or exceeded threshold (${threshold})`);
  }

  return {
    isAnomaly,
    score: normalizedScore,
    reasons
  };
}

export default {
  detectAnomaly
};
