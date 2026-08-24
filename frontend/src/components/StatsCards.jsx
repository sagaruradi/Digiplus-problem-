import React from 'react';
import { 
  Layers, 
  ShieldAlert, 
  AlertOctagon, 
  CheckCircle2 
} from 'lucide-react';

export default function StatsCards({ stats, onFilterAnomaly, activeFilter }) {
  const total = stats?.total ?? 0;
  const anomalies = stats?.anomalies ?? 0;
  const normal = stats?.normal ?? 0;
  const analyzed = stats?.analyzed ?? 0;
  const rate = stats?.anomalyRate ?? 0;

  const criticalCount = (stats?.bySeverity?.CRITICAL || 0) + (stats?.bySeverity?.FATAL || 0);

  return (
    <div className="metrics-grid">
      {/* 1. Total Ingested */}
      <div 
        className={`metric-card ${activeFilter === '' ? 'metric-card-selected' : ''}`}
        onClick={() => onFilterAnomaly('')}
      >
        <div className="metric-header">
          <span className="metric-title">Total Ingested</span>
          <Layers size={15} className="metric-icon metric-icon-blue" />
        </div>
        <div className="metric-value text-blue">{total}</div>
        <div className="metric-meta">SQLite WAL storage</div>
      </div>

      {/* 2. Detected Anomalies */}
      <div 
        className={`metric-card metric-card-interactive ${activeFilter === 'true' ? 'metric-card-selected' : ''}`}
        onClick={() => onFilterAnomaly('true')}
      >
        <div className="metric-header">
          <span className="metric-title">Detected Anomalies</span>
          <ShieldAlert size={15} className="metric-icon metric-icon-red" />
        </div>
        <div className="metric-value text-red">{anomalies}</div>
        <div className="metric-meta">
          <span className="meta-tag meta-tag-red">{rate}% rate</span>
          <span className="meta-sub">Score &ge; 50</span>
        </div>
      </div>

      {/* 3. Critical & Fatal */}
      <div className="metric-card">
        <div className="metric-header">
          <span className="metric-title">Critical & Fatal</span>
          <AlertOctagon size={15} className="metric-icon metric-icon-amber" />
        </div>
        <div className="metric-value text-amber">{criticalCount}</div>
        <div className="metric-meta">High-severity alerts</div>
      </div>

      {/* 4. Normal Operations */}
      <div 
        className={`metric-card metric-card-interactive ${activeFilter === 'false' ? 'metric-card-selected' : ''}`}
        onClick={() => onFilterAnomaly('false')}
      >
        <div className="metric-header">
          <span className="metric-title">Normal Operations</span>
          <CheckCircle2 size={15} className="metric-icon metric-icon-green" />
        </div>
        <div className="metric-value text-green">{normal}</div>
        <div className="metric-meta">
          <span className="meta-sub">{analyzed} with AI explanation</span>
        </div>
      </div>
    </div>
  );
}
