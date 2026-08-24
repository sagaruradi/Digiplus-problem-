import React from 'react';
import { 
  Activity, 
  Server, 
  RefreshCw, 
  Database, 
  Trash2 
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
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-icon">
          <Activity size={22} />
        </div>
        <div className="brand-text">
          <h1 className="brand-title">Smart Log Analyzer</h1>
          <p className="brand-subtitle">
            Ingests microservice logs, detects anomalies using deterministic heuristic scoring, and generates AI root cause explanations on demand.
          </p>
        </div>
      </div>

      <div className="header-toolbar">
        {/* Backend Connectivity Status */}
        <div 
          className={`status-indicator ${isHealthy ? 'status-online' : 'status-offline'}`}
          title="Backend Express & SQLite WAL status"
        >
          <span className="indicator-dot"></span>
          <Server size={13} />
          <span>{isHealthy ? 'Backend Connected' : 'Disconnected'}</span>
        </div>

        {/* Actions Hierarchy */}
        <button 
          className="btn btn-secondary" 
          onClick={onRefresh}
          disabled={loading || actionLoading}
          title="Refresh logs and metrics"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>

        <button 
          className="btn btn-primary" 
          onClick={onSeed}
          disabled={loading || actionLoading}
          title="Load 25 synthetic enterprise logs with 5 anomalies"
        >
          <Database size={14} />
          <span>{actionLoading ? 'Loading...' : 'Load Demo Logs'}</span>
        </button>

        {totalLogs > 0 && (
          <button 
            className="btn btn-ghost-danger" 
            onClick={onClear}
            disabled={loading || actionLoading}
            title="Clear all stored logs"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </header>
  );
}
