import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { Incident, CreateIncident } from './types';
import * as api from './api';
import IncidentDetail from './components/IncidentDetail';

function App() {
  return (
    <div className="app">
      <header className="header">
        <Link to="/" style={{ textDecoration: 'none' }}>
          <h1>
            <div className="header-logo">PM</div>
            Postmortem
          </h1>
        </Link>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<IncidentList />} />
          <Route path="/incidents/:id" element={<IncidentDetail />} />
        </Routes>
      </main>
    </div>
  );
}

function IncidentList() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    loadIncidents();
  }, []);

  async function loadIncidents() {
    try {
      const data = await api.listIncidents();
      setIncidents(data);
    } catch (err) {
      console.error('Failed to load incidents', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(data: CreateIncident) {
    const inc = await api.createIncident(data);
    setShowCreate(false);
    navigate(`/incidents/${inc.id}`);
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="ai-loading">Loading incidents...</div>
      </div>
    );
  }

  return (
    <>
      <div className="section-header">
        <h2 className="section-title">Incidents</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Incident
        </button>
      </div>

      {incidents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 12h6M12 9v6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3>No incidents yet</h3>
          <p>Create your first incident postmortem to get started.</p>
        </div>
      ) : (
        incidents.map((inc) => (
          <Link
            key={inc.id}
            to={`/incidents/${inc.id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">{inc.title}</div>
                  <div className="card-meta">
                    {new Date(inc.startedAt).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    })} · {inc.timeline.length} events · {inc.actionItems.length} actions
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span className={`badge badge-${inc.severity.toLowerCase()}`}>{inc.severity}</span>
                  <span className={`badge badge-status ${inc.status}`}>{inc.status}</span>
                </div>
              </div>
              {inc.servicesImpacted.length > 0 && (
                <div className="tags">
                  {inc.servicesImpacted.map((s) => (
                    <span key={s} className="tag">{s}</span>
                  ))}
                </div>
              )}
            </div>
          </Link>
        ))
      )}

      {showCreate && (
        <CreateIncidentModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </>
  );
}

interface CreateModalProps {
  onClose: () => void;
  onCreate: (data: CreateIncident) => Promise<void>;
}

function CreateIncidentModal({ onClose, onCreate }: CreateModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<'SEV1' | 'SEV2' | 'SEV3' | 'SEV4'>('SEV2');
  const [status, setStatus] = useState<'investigating' | 'identified' | 'monitoring' | 'resolved'>('investigating');
  const [startedAt, setStartedAt] = useState(new Date().toISOString().slice(0, 16));
  const [services, setServices] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onCreate({
        title,
        severity,
        status,
        startedAt: new Date(startedAt).toISOString(),
        servicesImpacted: services.split(',').map((s) => s.trim()).filter(Boolean),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Create Incident</h3>
          <button className="btn btn-ghost" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Title</label>
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g., API Gateway Outage"
                autoFocus
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Severity</label>
                <select
                  className="form-select"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as typeof severity)}
                >
                  <option value="SEV1">SEV1 — Critical</option>
                  <option value="SEV2">SEV2 — Major</option>
                  <option value="SEV3">SEV3 — Minor</option>
                  <option value="SEV4">SEV4 — Low</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                >
                  <option value="investigating">Investigating</option>
                  <option value="identified">Identified</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Started At</label>
              <input
                type="datetime-local"
                className="form-input"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Services Impacted</label>
              <input
                type="text"
                className="form-input"
                value={services}
                onChange={(e) => setServices(e.target.value)}
                placeholder="auth-service, payment-api, web-frontend"
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                Comma-separated list
              </small>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
