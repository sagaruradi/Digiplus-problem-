import React from 'react';
import { 
  ShieldAlert, 
  CheckCircle, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import EmptyState from './EmptyState.jsx';

export default function LogTable({
  logs = [],
  total = 0,
  limit = 10,
  offset = 0,
  loading = false,
  isFiltered = false,
  onSelectLog,
  onChangePage,
  onChangeLimit,
  onSeed,
  onResetFilters,
  actionLoading
}) {
  if (!loading && total === 0) {
    return (
      <EmptyState
        isFiltered={isFiltered}
        onSeed={onSeed}
        onResetFilters={onResetFilters}
        actionLoading={actionLoading}
      />
    );
  }

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit) || 1;
  const startItem = total > 0 ? offset + 1 : 0;
  const endItem = Math.min(offset + limit, total);

  const getSeverityClass = (sev) => {
    switch (sev?.toUpperCase()) {
      case 'CRITICAL': return 'sev-critical';
      case 'FATAL': return 'sev-fatal';
      case 'ERROR': return 'sev-error';
      case 'WARN': return 'sev-warn';
      default: return 'sev-info';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 50) return '#f43f5e';
    if (score >= 25) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="table-container-card">
      <div className="table-wrapper">
        <table className="log-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Source</th>
              <th>Event Category</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Score</th>
              <th>Classification</th>
              <th>AI Diagnosis</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const isAnomaly = Boolean(log.isAnomaly);
              const hasAiAnalysis = Boolean(log.aiExplanation);

              return (
                <tr 
                  key={log.id} 
                  className={`table-row ${isAnomaly ? 'row-anomaly' : 'row-normal'}`}
                  onClick={() => onSelectLog(log)}
                >
                  {/* Timestamp */}
                  <td className="font-mono text-muted" style={{ fontSize: '0.78rem' }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>

                  {/* Source */}
                  <td>
                    <span className="code-pill font-mono">{log.source}</span>
                  </td>

                  {/* Event Category */}
                  <td style={{ fontWeight: 600, color: '#f1f5f9' }}>
                    {log.eventType}
                  </td>

                  {/* Severity */}
                  <td>
                    <span className={`severity-pill ${getSeverityClass(log.severity)}`}>
                      {log.severity}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="font-mono" style={{ fontSize: '0.8rem' }}>
                    {log.status}
                  </td>

                  {/* Anomaly Score */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span 
                        className="font-mono" 
                        style={{ fontWeight: 700, color: getScoreColor(log.anomalyScore) }}
                      >
                        {log.anomalyScore}
                      </span>
                    </div>
                  </td>

                  {/* Classification Badge */}
                  <td>
                    {isAnomaly ? (
                      <span className="badge-pill badge-rose" style={{ fontSize: '0.7rem' }}>
                        <ShieldAlert size={12} />
                        <span>ANOMALY</span>
                      </span>
                    ) : (
                      <span className="badge-pill badge-emerald" style={{ fontSize: '0.7rem' }}>
                        <CheckCircle size={12} />
                        <span>NORMAL</span>
                      </span>
                    )}
                  </td>

                  {/* AI Status */}
                  <td>
                    {isAnomaly ? (
                      hasAiAnalysis ? (
                        <span className="badge-pill badge-purple" title="AI explanation generated and saved">
                          <Sparkles size={12} />
                          <span>Explained</span>
                        </span>
                      ) : (
                        <span className="badge-pill badge-muted" title="Click to analyze with Gemini">
                          <span>Unanalyzed</span>
                        </span>
                      )
                    ) : (
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                        —
                      </span>
                    )}
                  </td>

                  {/* Action Button */}
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      className="btn btn-ghost row-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLog(log);
                      }}
                      title="View full log details"
                    >
                      <span>Details</span>
                      <ExternalLink size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="table-pagination-footer">
        <div className="pagination-info">
          Showing <strong>{startItem}</strong> - <strong>{endItem}</strong> of <strong>{total}</strong> entries
        </div>

        <div className="pagination-controls">
          {/* Limit selector */}
          <div className="limit-selector">
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Per page:</span>
            <select
              value={limit}
              onChange={(e) => onChangeLimit(Number(e.target.value))}
              className="filter-select"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          {/* Page buttons */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button
              className="btn btn-secondary page-btn"
              disabled={currentPage <= 1 || loading}
              onClick={() => onChangePage(currentPage - 1)}
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="page-indicator">
              Page {currentPage} of {totalPages}
            </span>

            <button
              className="btn btn-secondary page-btn"
              disabled={currentPage >= totalPages || loading}
              onClick={() => onChangePage(currentPage + 1)}
              title="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
