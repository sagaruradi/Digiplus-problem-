import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header.jsx';
import StatsCards from './components/StatsCards.jsx';
import LogFilters from './components/LogFilters.jsx';
import LogTable from './components/LogTable.jsx';
import LogDetailsModal from './components/LogDetailsModal.jsx';
import { 
  fetchHealth, 
  fetchStats, 
  fetchLogs, 
  seedLogs, 
  clearAllLogs, 
  analyzeLogAnomaly 
} from './services/api.js';
import { AlertCircle } from 'lucide-react';

export default function App() {
  // Application State
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);

  // Filter & Pagination State
  const [filters, setFilters] = useState({
    isAnomaly: '',
    severity: '',
    source: '',
    search: ''
  });

  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);

  // Interaction & Modal State
  const [selectedLog, setSelectedLog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [globalError, setGlobalError] = useState(null);

  // Available sources extracted from stats
  const availableSources = useMemo(() => {
    if (!stats?.bySource) return [];
    return Object.keys(stats.bySource);
  }, [stats]);

  // Check backend health
  const checkHealth = async () => {
    try {
      const data = await fetchHealth();
      setHealth(data);
      setGlobalError(null);
    } catch (err) {
      setHealth({ status: 'unhealthy' });
      setGlobalError(`Backend service is unreachable: ${err.message}`);
    }
  };

  // Load stats
  const loadStats = async () => {
    try {
      const data = await fetchStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  // Load logs based on filters and pagination
  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchLogs({
        isAnomaly: filters.isAnomaly,
        severity: filters.severity,
        source: filters.source,
        search: filters.search,
        limit,
        offset
      });
      setLogs(data.logs || []);
      setTotalLogs(data.total || 0);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, limit, offset]);

  // Initial load
  useEffect(() => {
    checkHealth();
    loadStats();
  }, []);

  // Reload logs when filters or pagination change
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Handlers
  const handleRefresh = async () => {
    await checkHealth();
    await loadStats();
    await loadLogs();
  };

  const handleSeed = async () => {
    try {
      setActionLoading(true);
      await seedLogs();
      await loadStats();
      setOffset(0);
      await loadLogs();
    } catch (err) {
      alert(`Failed to seed dataset: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Are you sure you want to clear all stored logs from the database?')) {
      return;
    }
    try {
      setActionLoading(true);
      await clearAllLogs();
      await loadStats();
      setOffset(0);
      await loadLogs();
      setSelectedLog(null);
    } catch (err) {
      alert(`Failed to clear logs: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value
    }));
    setOffset(0); // Reset to first page
  };

  const handleResetFilters = () => {
    setFilters({
      isAnomaly: '',
      severity: '',
      source: '',
      search: ''
    });
    setOffset(0);
  };

  const handleSelectLog = (log) => {
    setSelectedLog(log);
    setAiError(null);
  };

  const handleCloseModal = () => {
    setSelectedLog(null);
    setAiError(null);
  };

  // Trigger on-demand Gemini AI analysis for an anomaly
  const handleAnalyzeAnomaly = async (logId) => {
    try {
      setAnalyzing(true);
      setAiError(null);
      const updatedLog = await analyzeLogAnomaly(logId);
      
      // Update selected modal log
      setSelectedLog(updatedLog);

      // Update log in table list
      setLogs((prev) => prev.map((l) => (l.id === logId ? updatedLog : l)));

      // Refresh stats to increment analyzed count
      loadStats();
    } catch (err) {
      setAiError(err.message || 'Gemini AI analysis failed. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const isFiltered = 
    filters.isAnomaly !== '' || 
    filters.severity !== '' || 
    filters.source !== '' || 
    filters.search !== '';

  return (
    <div className="app-wrapper">
      {/* Header */}
      <Header
        health={health}
        loading={loading}
        actionLoading={actionLoading}
        onRefresh={handleRefresh}
        onSeed={handleSeed}
        onClear={handleClear}
        totalLogs={stats?.total ?? 0}
      />

      {/* Global Error Banner */}
      {globalError && (
        <div style={{
          background: 'rgba(244, 63, 94, 0.1)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          padding: '1rem',
          borderRadius: '8px',
          color: '#fb7185',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.875rem'
        }}>
          <AlertCircle size={18} />
          <span>{globalError}</span>
        </div>
      )}

      {/* Summary Stats Cards */}
      <StatsCards
        stats={stats}
        onFilterAnomaly={(val) => handleFilterChange('isAnomaly', val)}
        activeFilter={filters.isAnomaly}
      />

      {/* Filters Bar */}
      <LogFilters
        filters={filters}
        onChangeFilter={handleFilterChange}
        onResetFilters={handleResetFilters}
        availableSources={availableSources}
      />

      {/* Main Log Table */}
      <LogTable
        logs={logs}
        total={totalLogs}
        limit={limit}
        offset={offset}
        loading={loading}
        isFiltered={isFiltered}
        onSelectLog={handleSelectLog}
        onChangePage={(newPage) => setOffset((newPage - 1) * limit)}
        onChangeLimit={(newLimit) => {
          setLimit(newLimit);
          setOffset(0);
        }}
        onSeed={handleSeed}
        onResetFilters={handleResetFilters}
        actionLoading={actionLoading}
      />

      {/* Log Detail Modal with Gemini AI Root Cause Analysis */}
      {selectedLog && (
        <LogDetailsModal
          log={selectedLog}
          onClose={handleCloseModal}
          onAnalyze={handleAnalyzeAnomaly}
          analyzing={analyzing}
          aiError={aiError}
        />
      )}
    </div>
  );
}
