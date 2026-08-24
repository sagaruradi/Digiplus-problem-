import React from 'react';
import { Database, SearchX, RotateCcw } from 'lucide-react';

export default function EmptyState({ isFiltered, onSeed, onResetFilters, actionLoading }) {
  if (isFiltered) {
    return (
      <div className="empty-panel">
        <div className="empty-icon-box">
          <SearchX size={28} />
        </div>
        <h3 className="empty-heading">No matching logs found</h3>
        <p className="empty-text">
          No log entries match your active filter criteria. Try adjusting the search term or clearing filters.
        </p>
        <button className="btn btn-secondary" onClick={onResetFilters}>
          <RotateCcw size={13} />
          <span>Reset Filters</span>
        </button>
      </div>
    );
  }

  return (
    <div className="empty-panel">
      <div className="empty-icon-box">
        <Database size={28} />
      </div>
      <h3 className="empty-heading">No logs found</h3>
      <p className="empty-text">
        Your log database is currently empty. Add logs manually or load the demo dataset to get started.
      </p>
      <button className="btn btn-primary" onClick={onSeed} disabled={actionLoading}>
        <Database size={14} />
        <span>{actionLoading ? 'Loading Demo Data...' : 'Load Demo Logs'}</span>
      </button>
    </div>
  );
}
