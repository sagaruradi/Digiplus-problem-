import React from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  ArrowRight 
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
      case 'CRITICAL': return 'badge-sev-critical';
      case 'FATAL': return 'badge-sev-fatal';
      case 'ERROR': return 'badge-sev-error';
      case 'WARN': case 'WARNING': return 'badge-sev-warn';
      default: return 'badge-sev-info';
    }
  };

  const getScoreClass = (score) => {
    if (score >= 50) return 'score-val-red';
    if (score >= 25) return 'score-val-amber';
    return 'score-val-green';
  };

  return (
    <div className="table-card">
      <div className="table-responsive">
        <table className="console-table">
          <thead>
            <tr>
              <th style={{ width: '110px' }}>Timestamp</th>
              <th style={{ width: '130px' }}>Source</th>
              <th>Event Category</th>
              <th style={{ width: '90px' }}>Severity</th>
              <th style={{ width: '70px' }}>Status</th>
              <th style={{ width: '60px' }}>Score</th>
              <th style={{ width: '110px' }}>Classification</th>
              <th style={{ width: '120px' }}>AI Diagnosis</th>
              <th style={{ width: '80px', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const isAnomaly = Boolean(log.isAnomaly);
              const hasAiAnalysis = Boolean(log.aiExplanation);

              return (
                <tr 
                  key={log.id} 
                  className={`console-row ${isAnomaly ? 'row-is-anomaly' : 'row-is-normal'}`}
                  onClick={() => onSelectLog(log)}
                >
                  {/* Timestamp */}
                  <td className="cell-mono cell-muted">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>

                  {/* Source */}
                  <td>
                    <span className="source-tag font-mono">{log.source}</span>
                  </td>

                  {/* Event Category */}
                  <td className="cell-event">
                    {log.eventType}
                  </td>

                  {/* Severity */}
                  <td>
                    <span className={`tag-badge ${getSeverityClass(log.severity)}`}>
                      {log.severity}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="cell-mono" style={{ fontSize: '0.8rem' }}>
                    {log.status}
                  </td>

                  {/* Anomaly Score */}
                  <td>
                    <span className={`font-mono font-bold ${getScoreClass(log.anomalyScore)}`}>
                      {log.anomalyScore}
                    </span>
                  </td>

                  {/* Classification */}
                  <td>
                    {isAnomaly ? (
                      <span className="tag-badge tag-anomaly">
                        <ShieldAlert size={11} />
                        <span>ANOMALY</span>
                      </span>
                    ) : (
                      <span className="tag-badge tag-normal">
                        <CheckCircle2 size={11} />
                        <span>NORMAL</span>
                      </span>
                    )}
                  </td>

                  {/* AI Diagnosis */}
                  <td>
                    {isAnomaly ? (
                      hasAiAnalysis ? (
                        <span className="tag-badge tag-ai-done" title="Root cause analysis generated and saved">
                          <Sparkles size={11} />
                          <span>Explained</span>
                        </span>
                      ) : (
                        <span className="tag-badge tag-ai-pending" title="Click details to analyze with Gemini">
                          <span>Unanalyzed</span>
                        </span>
                      )
                    ) : (
                      <span className="cell-muted">—</span>
                    )}
                  </td>

                  {/* Action */}
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      className="btn-table-action"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLog(log);
                      }}
                      title="View log details and analysis"
                    >
                      <span>Details</span>
                      <ArrowRight size={11} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Pagination Footer */}
      <div className="table-footer">
        <div className="footer-count">
          Showing <span>{startItem}–{endItem}</span> of <span>{total}</span> entries
        </div>

        <div className="footer-nav">
          <div className="limit-inline">
            <span className="cell-muted">Rows:</span>
            <select
              value={limit}
              onChange={(e) => onChangeLimit(Number(e.target.value))}
              className="select-field-compact"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="pagination-arrows">
            <button
              className="btn-arrow"
              disabled={currentPage <= 1 || loading}
              onClick={() => onChangePage(currentPage - 1)}
              title="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="page-text">
              {currentPage} / {totalPages}
            </span>
            <button
              className="btn-arrow"
              disabled={currentPage >= totalPages || loading}
              onClick={() => onChangePage(currentPage + 1)}
              title="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
