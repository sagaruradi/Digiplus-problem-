import React from 'react';
import { 
  Sparkles, 
  Lightbulb, 
  HelpCircle, 
  Wrench, 
  Clock, 
  AlertTriangle, 
  RotateCw,
  Info 
} from 'lucide-react';

export default function AiAnalysisSection({ log, onAnalyze, analyzing, error }) {
  const isAnomaly = Boolean(log.isAnomaly);
  const hasAiAnalysis = Boolean(log.aiExplanation);

  // Case 1: Normal Log
  if (!isAnomaly) {
    return (
      <div className="ai-box ai-box-inactive">
        <div className="ai-inactive-header">
          <Info size={15} className="text-blue" />
          <span className="ai-inactive-title">AI Root Cause Analysis Inactive</span>
        </div>
        <p className="ai-inactive-desc">
          This log is classified as <strong>Normal</strong> (Score: {log.anomalyScore}/100). Gemini AI root-cause analysis is exclusively engaged for anomalous events requiring technical triage.
        </p>
      </div>
    );
  }

  // Case 2: Anomaly Already Analyzed
  if (hasAiAnalysis) {
    return (
      <div className="ai-box ai-box-analyzed">
        <div className="ai-box-header">
          <div className="ai-box-title-group">
            <div className="ai-chip-icon">
              <Sparkles size={14} />
            </div>
            <div>
              <h4 className="ai-title">Gemini AI Root Cause Analysis</h4>
              <span className="ai-sub">Generated from pre-flagged deterministic signals</span>
            </div>
          </div>
          <button
            className="btn btn-secondary-compact"
            onClick={() => onAnalyze(log.id)}
            disabled={analyzing}
            title="Re-run Gemini AI analysis"
          >
            <RotateCw size={12} className={analyzing ? 'spin' : ''} />
            <span>{analyzing ? 'Analyzing...' : 'Re-Analyze'}</span>
          </button>
        </div>

        {error && (
          <div className="ai-error-box">
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        )}

        <div className="ai-diagnosis-grid">
          {/* 1. Plain English Explanation */}
          <div className="diagnosis-card card-summary">
            <div className="diagnosis-title text-amber">
              <Lightbulb size={14} />
              <span>Plain-English Summary</span>
            </div>
            <p className="diagnosis-body">{log.aiExplanation}</p>
          </div>

          {/* 2. Likely Root Cause */}
          <div className="diagnosis-card card-rootcause">
            <div className="diagnosis-title text-red">
              <HelpCircle size={14} />
              <span>Likely Technical Root Cause</span>
            </div>
            <p className="diagnosis-body">{log.aiRootCause}</p>
          </div>

          {/* 3. Recommended Next Step */}
          <div className="diagnosis-card card-nextstep">
            <div className="diagnosis-title text-green">
              <Wrench size={14} />
              <span>Recommended Next Step</span>
            </div>
            <p className="diagnosis-body">{log.aiNextStep}</p>
          </div>
        </div>

        {log.aiGeneratedAt && (
          <div className="ai-timestamp-footer">
            <Clock size={12} />
            <span>Analyzed on {new Date(log.aiGeneratedAt).toLocaleString()}</span>
          </div>
        )}
      </div>
    );
  }

  // Case 3: Anomaly Needs AI Analysis
  return (
    <div className="ai-box ai-box-pending">
      <div className="ai-pending-header">
        <div className="ai-chip-icon">
          <Sparkles size={16} />
        </div>
        <div>
          <h4 className="ai-title">AI Root Cause Analysis Available</h4>
          <p className="ai-sub">
            This detected anomaly has not been analyzed yet. Request an on-demand diagnosis from Gemini AI.
          </p>
        </div>
      </div>

      {error && (
        <div className="ai-error-box" style={{ marginTop: '10px' }}>
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div className="ai-pending-action">
        <button
          className="btn btn-ai-primary"
          onClick={() => onAnalyze(log.id)}
          disabled={analyzing}
        >
          <Sparkles size={14} className={analyzing ? 'spin' : ''} />
          <span>{analyzing ? 'Consulting Gemini AI...' : 'Analyze with Gemini AI'}</span>
        </button>

        {analyzing && (
          <span className="ai-analyzing-msg">
            Synthesizing technical explanation and next steps...
          </span>
        )}
      </div>
    </div>
  );
}
