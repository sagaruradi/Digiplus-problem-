import React, { useEffect, useState } from 'react';
import { 
  X, 
  FileText, 
  ShieldAlert, 
  CheckCircle2, 
  Copy, 
  Check 
} from 'lucide-react';
import AiAnalysisSection from './AiAnalysisSection.jsx';

export default function LogDetailsModal({
  log,
  onClose,
  onAnalyze,
  analyzing,
  aiError
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!log) return null;

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(log.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSeverityClass = (sev) => {
    switch (sev?.toUpperCase()) {
      case 'CRITICAL': return 'badge-sev-critical';
      case 'FATAL': return 'badge-sev-fatal';
      case 'ERROR': return 'badge-sev-error';
      case 'WARN': case 'WARNING': return 'badge-sev-warn';
      default: return 'badge-sev-info';
    }
  };

  const scoreClass = 
    log.anomalyScore >= 50 ? 'score-val-red' : 
    log.anomalyScore >= 25 ? 'score-val-amber' : 'score-val-green';

  const scoreFillClass =
    log.anomalyScore >= 50 ? 'bar-fill-red' :
    log.anomalyScore >= 25 ? 'bar-fill-amber' : 'bar-fill-green';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-head">
          <div className="modal-title-wrap">
            <div className={`modal-status-badge ${log.isAnomaly ? 'badge-is-anomaly' : 'badge-is-normal'}`}>
              {log.isAnomaly ? <ShieldAlert size={16} /> : <CheckCircle2 size={16} />}
            </div>
            <div>
              <h2 className="modal-event-title">{log.eventType}</h2>
              <div className="modal-id-row font-mono">
                <span>{log.id}</span>
                <span className="divider-dot">•</span>
                <span>{log.source}</span>
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} title="Close (Esc)">
            <X size={16} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="modal-scroll-body">
          {/* Section 1: Original Log Metadata */}
          <div className="details-section">
            <div className="section-label">
              <FileText size={13} />
              <span>Original Log Attributes</span>
            </div>

            <div className="attributes-grid">
              <div className="attr-cell">
                <span className="attr-key">Timestamp</span>
                <span className="attr-val font-mono">{new Date(log.timestamp).toLocaleString()}</span>
              </div>
              <div className="attr-cell">
                <span className="attr-key">Severity</span>
                <span className="attr-val">
                  <span className={`tag-badge ${getSeverityClass(log.severity)}`}>
                    {log.severity}
                  </span>
                </span>
              </div>
              <div className="attr-cell">
                <span className="attr-key">Source Service</span>
                <span className="attr-val font-mono source-tag">{log.source}</span>
              </div>
              <div className="attr-cell">
                <span className="attr-key">Status</span>
                <span className="attr-val font-mono source-tag">{log.status}</span>
              </div>
            </div>

            {/* Log Message Code Block */}
            <div className="code-block-container">
              <div className="code-block-header">
                <span>Message Payload</span>
                <button className="copy-action-btn" onClick={handleCopyMessage}>
                  {copied ? <Check size={12} className="text-green" /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="code-block-pre">{log.message}</pre>
            </div>
          </div>

          {/* Section 2: Deterministic Engine Evaluation */}
          <div className="details-section">
            <div className="section-label">
              <ShieldAlert size={13} />
              <span>Deterministic Anomaly Engine Evaluation</span>
            </div>

            <div className="scoring-card">
              <div className="score-summary">
                <div className="score-main">
                  <span className={`score-digit ${scoreClass}`}>{log.anomalyScore}</span>
                  <span className="score-total font-mono">/ 100</span>
                </div>
                <div className="score-track">
                  <div 
                    className={`score-progress ${scoreFillClass}`} 
                    style={{ width: `${log.anomalyScore}%` }}
                  />
                </div>
                <span className="score-threshold-note">Threshold: 50 pts</span>
              </div>

              <div className="classification-tag-col">
                <span className="attr-key">Engine Verdict</span>
                {log.isAnomaly ? (
                  <span className="tag-badge tag-anomaly">
                    <ShieldAlert size={11} />
                    <span>ANOMALY DETECTED (&ge; 50)</span>
                  </span>
                ) : (
                  <span className="tag-badge tag-normal">
                    <CheckCircle2 size={11} />
                    <span>NORMAL EVENT (&lt; 50)</span>
                  </span>
                )}
              </div>
            </div>

            {/* Triggered Rule Breakdown */}
            <div className="rules-list-container">
              <span className="rules-header-label">Triggered Heuristic Signals:</span>
              {log.anomalyReason && log.anomalyReason.length > 0 ? (
                <ul className="rules-list">
                  {log.anomalyReason.map((reason, idx) => (
                    <li key={idx} className="rule-entry">
                      <span className="rule-bullet">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rules-empty cell-muted">
                  No anomaly heuristic weights triggered. Standard operational execution.
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Gemini AI Root Cause Explanation */}
          <div className="details-section" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
            <AiAnalysisSection
              log={log}
              onAnalyze={onAnalyze}
              analyzing={analyzing}
              error={aiError}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
