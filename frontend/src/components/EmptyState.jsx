import React from 'react';
import { Database, SearchX, RotateCcw } from 'lucide-react';

export default function EmptyState({ isFiltered, onSeed, onResetFilters, actionLoading }) {
  if (isFiltered) {
    return (
      <div className="empty-state-card">
        <div className="empty-icon-wrap">
          <SearchX size={36} color="#94a3b8" />
        </div>
        <h3 className="empty-title">No Matching Logs Found</h3>
        <p className="empty-desc">
          No records match your selected filters and search query. Try broadening your criteria or resetting filters.
        </p>
        <button className="btn btn-secondary" onClick={onResetFilters}>
          <RotateCcw size={15} />
          <span>Reset All Filters</span>
        </button>
      </div>
    );
  }

  return (
    <div className="empty-state-card">
      <div className="empty-icon-wrap">
        <Database size={36} color="#3b82f6" />
      </div>
      <h3 className="empty-title">No Logs Stored in SQLite</h3>
      <p className="empty-desc">
        The database is currently empty. Load the curated synthetic dataset (25 realistic enterprise logs with 5 intentional anomalies) to explore the system.
      </p>
      <button className="btn btn-primary" onClick={onSeed} disabled={actionLoading}>
        <Database size={16} />
        <span>{actionLoading ? 'Loading Demo Data...' : 'Load Demo Logs'}</span>
      </button>
    </div>
  );
}
