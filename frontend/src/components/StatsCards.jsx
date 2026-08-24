import React from 'react';
import { 
  Layers, 
  ShieldAlert, 
  AlertOctagon, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export default function StatsCards({ stats, onFilterAnomaly, activeFilter }) {
  const total = stats?.total ?? 0;
  const anomalies = stats?.anomalies ?? 0;
  const normal = stats?.normal ?? 0;
  const analyzed = stats?.analyzed ?? 0;
  const rate = stats?.anomalyRate ?? 0;

  const criticalCount = (stats?.bySeverity?.CRITICAL || 0) + (stats?.bySeverity?.FATAL || 0);

  return (
    <div className="stats-grid">
      {/* 1. Total Logs */}
      <div 
        className={`stat-card ${activeFilter === '' ? 'stat-card-active' : ''}`}
        onClick={() => onFilterAnomaly('')}
      >
        <div className="stat-header">
          <span className="stat-label">Total Ingested</span>
          <div className="stat-icon stat-icon-blue">
            <Layers size={18} />
          </div>
        </div>
        <div className="stat-value text-blue">{total}</div>
        <div className="stat-footer">Persisted in SQLite (WAL)</div>
      </div>

      {/* 2. Total Anomalies */}
      <div 
        className={`stat-card stat-card-clickable ${activeFilter === 'true' ? 'stat-card-active' : ''}`}
        onClick={() => onFilterAnomaly('true')}
      >
        <div className="stat-header">
          <span className="stat-label">Detected Anomalies</span>
          <div className="stat-icon stat-icon-rose">
            <ShieldAlert size={18} />
          </div>
        </div>
        <div className="stat-value text-rose">{anomalies}</div>
        <div className="stat-footer">
          <span className="badge-pill badge-rose">{rate}% rate</span>
          <span style={{ marginLeft: '6px' }}>by rule engine</span>
        </div>
      </div>

      {/* 3. Critical / Fatal */}
      <div className="stat-card">
        <div className="stat-header">
          <span className="stat-label">Critical & Fatal</span>
          <div className="stat-icon stat-icon-amber">
            <AlertOctagon size={18} />
          </div>
        </div>
        <div className="stat-value text-amber">{criticalCount}</div>
        <div className="stat-footer">High-severity incidents</div>
      </div>

      {/* 4. Normal Logs */}
      <div 
        className={`stat-card stat-card-clickable ${activeFilter === 'false' ? 'stat-card-active' : ''}`}
        onClick={() => onFilterAnomaly('false')}
      >
        <div className="stat-header">
          <span className="stat-label">Normal Operations</span>
          <div className="stat-icon stat-icon-emerald">
            <CheckCircle2 size={18} />
          </div>
        </div>
        <div className="stat-value text-emerald">{normal}</div>
        <div className="stat-footer">
          <span>{analyzed} explained by Gemini</span>
        </div>
      </div>
    </div>
  );
}
