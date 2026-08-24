import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';

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
    <div className="filter-bar">
      {/* 1. Status Filter Segmented Controls */}
      <div className="segmented-control">
        <button
          className={`segment-btn ${filters.isAnomaly === '' ? 'segment-active' : ''}`}
          onClick={() => onChangeFilter('isAnomaly', '')}
        >
          All Logs
        </button>
        <button
          className={`segment-btn segment-btn-anomaly ${filters.isAnomaly === 'true' ? 'segment-active-anomaly' : ''}`}
          onClick={() => onChangeFilter('isAnomaly', 'true')}
        >
          Anomalies Only
        </button>
        <button
          className={`segment-btn segment-btn-normal ${filters.isAnomaly === 'false' ? 'segment-active-normal' : ''}`}
          onClick={() => onChangeFilter('isAnomaly', 'false')}
        >
          Normal Only
        </button>
      </div>

      {/* 2. Right Controls Group (Search, Severity, Source, Reset) */}
      <div className="filter-tools">
        {/* Search Bar */}
        <div className="search-field">
          <Search size={14} className="search-field-icon" />
          <input
            type="text"
            className="search-field-input"
            placeholder="Search logs, sources, events..."
            value={filters.search}
            onChange={(e) => onChangeFilter('search', e.target.value)}
          />
          {filters.search && (
            <button 
              className="search-clear-btn" 
              onClick={() => onChangeFilter('search', '')}
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Severity Dropdown */}
        <select
          className="select-field"
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

        {/* Source Dropdown */}
        <select
          className="select-field"
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

        {/* Reset Filter Button */}
        {isFiltered && (
          <button 
            className="btn btn-ghost-compact" 
            onClick={onResetFilters} 
            title="Reset active filters"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}
