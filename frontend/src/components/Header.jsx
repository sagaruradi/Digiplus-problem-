import React from 'react';
import { 
  Activity, 
  Server, 
  RefreshCw, 
  Database, 
  Trash2,
  Cpu
} from 'lucide-react';

export default function Header({ 
  health, 
  loading, 
  actionLoading, 
  onRefresh, 
  onSeed, 
  onClear,
  totalLogs 
}) {
  const isHealthy = health?.status === 'healthy';

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo-badge">
          <Activity size={26} />
        </div>
        <div>
          <div className="title-row">
            <h1 className="app-title">Smart Log Analyzer</h1>
            <span className="version-tag">DigiPlus ACOE</span>
          </div>
          <p className="app-subtitle">
            Ingests microservice logs, detects anomalies using deterministic heuristic scoring, and generates AI root cause explanations on demand.
          </p>
        </div>
      </div>

      <div className="header-actions">
        {/* Health Status Indicator */}
        <div className={`health-pill ${isHealthy ? 'health-ok' : 'health-err'}`} title="Backend Express & SQLite status">
          <span className="status-dot"></span>
          <Server size={14} />
          <span>{isHealthy ? 'Backend Connected' : 'Disconnected'}</span>
        </div>

        {/* Action Buttons */}
        <button 
          className="btn btn-secondary" 
          onClick={onRefresh}
          disabled={loading || actionLoading}
          title="Refresh logs and statistics"
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>

        <button 
          className="btn btn-primary" 
          onClick={onSeed}
          disabled={loading || actionLoading}
          title="Seed realistic synthetic dataset with 25 logs and 5 anomalies"
        >
          <Database size={15} />
          <span>{actionLoading ? 'Loading Demo...' : 'Load Demo Logs'}</span>
        </button>

        {totalLogs > 0 && (
          <button 
            className="btn btn-ghost" 
            onClick={onClear}
            disabled={loading || actionLoading}
            title="Clear all stored logs"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </header>
  );
}
