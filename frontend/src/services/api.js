/**
 * API Service Client for Smart Log Analyzer REST API
 */

const API_BASE = '/api';

async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `HTTP error ${response.status}: ${response.statusText}`);
    error.status = response.status;
    error.details = data.details || null;
    throw error;
  }
  return data;
}

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return handleResponse(res);
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/logs/stats`);
  const json = await handleResponse(res);
  return json.data;
}

export async function fetchLogs(params = {}) {
  const query = new URLSearchParams();
  
  if (params.isAnomaly !== undefined && params.isAnomaly !== null && params.isAnomaly !== '') {
    query.append('isAnomaly', params.isAnomaly);
  }
  if (params.severity) query.append('severity', params.severity);
  if (params.source) query.append('source', params.source);
  if (params.eventType) query.append('eventType', params.eventType);
  if (params.search) query.append('search', params.search);
  if (params.limit) query.append('limit', params.limit);
  if (params.offset !== undefined) query.append('offset', params.offset);
  if (params.sortBy) query.append('sortBy', params.sortBy);
  if (params.sortOrder) query.append('sortOrder', params.sortOrder);

  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${API_BASE}/logs${qs}`);
  const json = await handleResponse(res);
  return json.data;
}

export async function fetchLogById(id) {
  const res = await fetch(`${API_BASE}/logs/${encodeURIComponent(id)}`);
  const json = await handleResponse(res);
  return json.data;
}

export async function seedLogs() {
  const res = await fetch(`${API_BASE}/logs/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const json = await handleResponse(res);
  return json.data;
}

export async function clearAllLogs() {
  const res = await fetch(`${API_BASE}/logs`, {
    method: 'DELETE'
  });
  return handleResponse(res);
}

export async function analyzeLogAnomaly(id) {
  const res = await fetch(`${API_BASE}/logs/${encodeURIComponent(id)}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const json = await handleResponse(res);
  return json.data;
}

export default {
  fetchHealth,
  fetchStats,
  fetchLogs,
  fetchLogById,
  seedLogs,
  clearAllLogs,
  analyzeLogAnomaly
};
