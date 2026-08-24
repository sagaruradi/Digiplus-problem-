import React from 'react';
import { Search, X, Filter, RotateCcw } from 'lucide-react';

const SEVERITIES = ['INFO', 'WARN', 'ERROR', 'CRITICAL', 'FATAL'];

export default function LogFilters({
  filters,
  onChangeFilter,
  onResetFilters,
  availableSources = []
}) {
  const isFiltered = 
    filters.isAnomaly !== '' || 
    filters.severity !== '' || 
    filters.source !== '' || 
    filters.search !== '';

  return (
    <div className="filters-container">
      {/* 1. Status Filter Tabs (All / Anomalies / Normal) */}
      <div className="status-tabs">
        <button
          className={`tab-btn ${filters.isAnomaly === '' ? 'tab-btn-active' : ''}`}
          onClick={() => onChangeFilter('isAnomaly', '')}
        >
          All Logs
        </button>
        <button
          className={`tab-btn tab-btn-danger ${filters.isAnomaly === 'true' ? 'tab-btn-active-danger' : ''}`}
          onClick={() => onChangeFilter('isAnomaly', 'true')}
        >
          Anomalies Only
        </button>
        <button
          className={`tab-btn tab-btn-success ${filters.isAnomaly === 'false' ? 'tab-btn-active-success' : ''}`}
          onClick={() => onChangeFilter('isAnomaly', 'false')}
        >
          Normal Only
        </button>
      </div>

      {/* 2. Controls Group (Search, Severity, Source, Reset) */}
      <div className="filter-controls-group">
        {/* Search Bar */}
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search message, source, or event..."
            value={filters.search}
            onChange={(e) => onChangeFilter('search', e.target.value)}
          />
          {filters.search && (
            <button 
              className="search-clear-btn" 
              onClick={() => onChangeFilter('search', '')}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Severity Select */}
        <div className="select-wrapper">
          <select
            className="filter-select"
            value={filters.severity}
            onChange={(e) => onChangeFilter('severity', e.target.value)}
          >
            <option value="">All Severities</option>
            {SEVERITIES.map((sev) => (
              <option key={sev} value={sev}>
                {sev}
              </option>
            ))}
          </select>
        </div>

        {/* Source Select */}
        <div className="select-wrapper">
          <select
            className="filter-select"
            value={filters.source}
            onChange={(e) => onChangeFilter('source', e.target.value)}
          >
            <option value="">All Sources</option>
            {availableSources.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>
        </div>

        {/* Reset Filters */}
        {isFiltered && (
          <button 
            className="btn btn-ghost" 
            onClick={onResetFilters} 
            title="Reset all filters"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}
