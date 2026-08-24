import React, { useEffect } from 'react';
import { 
  X, 
  Clock, 
  Server, 
  Tag, 
  ShieldAlert, 
  CheckCircle, 
  Copy, 
  Check, 
  FileText,
  AlertTriangle
} from 'lucide-react';
import AiAnalysisSection from './AiAnalysisSection.jsx';

export default function LogDetailsModal({
  log,
  onClose,
  onAnalyze,
  analyzing,
  aiError
}) {
  const [copied, setCopied] = React.useState(false);

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
      case 'CRITICAL': return 'sev-critical';
      case 'FATAL': return 'sev-fatal';
      case 'ERROR': return 'sev-error';
      case 'WARN': return 'sev-warn';
      default: return 'sev-info';
    }
  };

  const scoreColor = 
    log.anomalyScore >= 50 ? '#f43f5e' : 
    log.anomalyScore >= 25 ? '#f59e0b' : '#10b981';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className={`modal-icon-badge ${log.isAnomaly ? 'modal-icon-anomaly' : 'modal-icon-normal'}`}>
              {log.isAnomaly ? <ShieldAlert size={20} /> : <CheckCircle size={20} />}
            </div>
            <div>
              <h2 className="modal-title">{log.eventType}</h2>
              <div className="modal-id-subtitle">
                <span>ID: {log.id}</span>
                <span className="dot-divider">•</span>
                <span>Source: {log.source}</span>
              </div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Close (Esc)">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Section 1: Original Log Metadata */}
          <div className="modal-section">
            <h3 className="section-heading">
              <FileText size={15} />
              <span>Original Log Attributes</span>
            </h3>
            <div className="metadata-grid">
              <div className="meta-item">
                <span className="meta-label">Timestamp</span>
                <span className="meta-value font-mono">
                  {new Date(log.timestamp).toLocaleString()} ({log.timestamp})
                </span>
              </div>

              <div className="meta-item">
                <span className="meta-label">Severity Level</span>
                <span className="meta-value">
                  <span className={`severity-pill ${getSeverityClass(log.severity)}`}>
                    {log.severity}
                  </span>
                </span>
              </div>

              <div className="meta-item">
                <span className="meta-label">Originating Source</span>
                <span className="meta-value font-mono code-pill">{log.source}</span>
              </div>

              <div className="meta-item">
                <span className="meta-label">Status Flag / Code</span>
                <span className="meta-value font-mono code-pill">{log.status}</span>
              </div>
            </div>

            {/* Message payload */}
            <div className="message-container">
              <div className="message-header">
                <span>Log Payload / Message</span>
                <button className="copy-btn" onClick={handleCopyMessage} title="Copy message">
                  {copied ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="message-pre">{log.message}</pre>
            </div>
          </div>

          {/* Section 2: Deterministic Anomaly Detection */}
          <div className="modal-section">
            <h3 className="section-heading">
              <ShieldAlert size={15} />
              <span>Deterministic Anomaly Engine Evaluation</span>
            </h3>

            <div className="detection-banner">
              <div className="score-block">
                <span className="score-number" style={{ color: scoreColor }}>
                  {log.anomalyScore}
                </span>
                <span className="score-max">/ 100</span>
                <div className="score-bar-bg">
                  <div 
                    className="score-bar-fill" 
                    style={{ width: `${log.anomalyScore}%`, backgroundColor: scoreColor }}
                  />
                </div>
              </div>

              <div className="status-block">
                <span className="meta-label">Engine Classification</span>
                {log.isAnomaly ? (
                  <span className="badge-pill badge-rose" style={{ fontSize: '0.85rem' }}>
                    🚨 ANOMALY DETECTED (Score &ge; 50)
                  </span>
                ) : (
                  <span className="badge-pill badge-emerald" style={{ fontSize: '0.85rem' }}>
                    ✅ NORMAL OPERATIONAL EVENT
                  </span>
                )}
              </div>
            </div>

            {/* Triggered Rule Reasons */}
            <div className="reasons-box">
              <span className="meta-label" style={{ marginBottom: '8px', display: 'block' }}>
                Triggered Heuristic Rules & Weights:
              </span>
              {log.anomalyReason && log.anomalyReason.length > 0 ? (
                <ul className="reasons-list">
                  {log.anomalyReason.map((reason, idx) => (
                    <li key={idx} className="reason-item">
                      <span className="reason-bullet">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                  No anomaly triggers fired. Standard operational pattern within SLA.
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Gemini AI Root Cause Explanation */}
          <div className="modal-section" style={{ borderBottom: 'none' }}>
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
