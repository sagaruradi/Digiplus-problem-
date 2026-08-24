import { GoogleGenAI, Type } from '@google/genai';
import { config } from '../config/index.js';

/**
 * Gemini AI Service for Anomaly Explanation and Root Cause Analysis
 * 
 * IMPORTANT ARCHITECTURAL PRINCIPLE:
 * - Gemini AI does NOT determine if a log is anomalous.
 * - Gemini AI ONLY explains an anomaly that was already detected and scored
 *   by our deterministic backend heuristic algorithm.
 */

// Schema definition for structured JSON output
const ANOMALY_EXPLANATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    explanation: {
      type: Type.STRING,
      description: 'A clear, plain-English summary of what this anomalous event is and what occurred.'
    },
    likelyRootCause: {
      type: Type.STRING,
      description: 'The most probable technical root cause behind this anomaly.'
    },
    nextStep: {
      type: Type.STRING,
      description: 'The recommended immediate remediation or troubleshooting action for engineering teams.'
    }
  },
  required: ['explanation', 'likelyRootCause', 'nextStep']
};

/**
 * Validates the structured output returned from Gemini.
 */
export function validateGeminiAnalysis(analysis) {
  if (!analysis || typeof analysis !== 'object') {
    throw new Error('Gemini response is not a valid JSON object');
  }

  const { explanation, likelyRootCause, nextStep } = analysis;

  if (!explanation || typeof explanation !== 'string' || explanation.trim() === '') {
    throw new Error("Gemini response missing or invalid 'explanation' field");
  }

  if (!likelyRootCause || typeof likelyRootCause !== 'string' || likelyRootCause.trim() === '') {
    throw new Error("Gemini response missing or invalid 'likelyRootCause' field");
  }

  if (!nextStep || typeof nextStep !== 'string' || nextStep.trim() === '') {
    throw new Error("Gemini response missing or invalid 'nextStep' field");
  }

  return {
    explanation: explanation.trim(),
    likelyRootCause: likelyRootCause.trim(),
    nextStep: nextStep.trim()
  };
}

/**
 * Builds the prompt provided to Gemini containing all relevant anomaly metadata.
 */
export function buildAnalysisPrompt(log) {
  const reasonsText = Array.isArray(log.anomalyReason)
    ? log.anomalyReason.join('\n- ')
    : String(log.anomalyReason || 'N/A');

  return `
You are explaining an anomaly that has already been detected by a deterministic backend algorithm.
Do not decide whether the event is anomalous and do not change the anomaly score.

LOG ANOMALY DETAILS:
- Event Timestamp: ${log.timestamp}
- Originating Source / Service: ${log.source}
- Event Category: ${log.eventType}
- Severity: ${log.severity}
- Status / Status Code: ${log.status}
- Message / Payload: ${log.message}
- Deterministic Anomaly Score: ${log.anomalyScore} / 100
- Detection Signals Triggered:
- ${reasonsText}

TASK:
Provide:
1. "explanation": A clear, concise, plain-English summary of what happened.
2. "likelyRootCause": The most probable technical root cause of this failure.
3. "nextStep": Specific, actionable next steps for the engineering or operations team.
`.trim();
}

/**
 * Calls Gemini API to analyze an already-detected anomaly.
 * 
 * @param {Object} log - The anomalous log entry
 * @returns {Promise<{ explanation: string, likelyRootCause: string, nextStep: string, generatedAt: string }>}
 */
export async function analyzeAnomaly(log) {
  if (!config.geminiApiKey || config.geminiApiKey.trim() === '') {
    const error = new Error('Gemini API key is not configured. Set GEMINI_API_KEY in .env file.');
    error.statusCode = 503;
    throw error;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    const prompt = buildAnalysisPrompt(log);

    const response = await ai.models.generateContent({
      model: config.geminiModel,
      contents: prompt,
      config: {
        systemInstruction: 'You are an expert site reliability and systems engineer explaining an already-detected log anomaly. Always respond in valid structured JSON matching the requested schema.',
        responseMimeType: 'application/json',
        responseSchema: ANOMALY_EXPLANATION_SCHEMA,
        temperature: 0.2
      }
    });

    const rawText = response.text;
    if (!rawText) {
      throw new Error('Gemini returned an empty response');
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      throw new Error(`Failed to parse Gemini JSON output: ${parseErr.message}`);
    }

    const validated = validateGeminiAnalysis(parsed);

    return {
      ...validated,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    // Classify error types for clean user feedback
    const errMessage = error.message || '';
    const wrappedError = new Error(
      errMessage.includes('API_KEY_INVALID') || errMessage.includes('403')
        ? 'Invalid Gemini API key. Please check your GEMINI_API_KEY in .env.'
        : errMessage.includes('RESOURCE_EXHAUSTED') || errMessage.includes('429')
        ? 'Gemini API rate limit exceeded. Please retry in a few moments.'
        : `Gemini AI analysis failed: ${errMessage}`
    );
    wrappedError.statusCode = error.status === 404 ? 404 : 502;
    throw wrappedError;
  }
}

export default {
  analyzeAnomaly,
  buildAnalysisPrompt,
  validateGeminiAnalysis
};
