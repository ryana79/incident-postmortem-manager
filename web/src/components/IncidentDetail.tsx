import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { Incident, CreateTimelineEvent, CreateActionItem } from '../types';
import * as api from '../api';
import { useToast } from './Toast';

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'timeline' | 'actions' | 'audit'>('overview');
  const [showTimelineForm, setShowTimelineForm] = useState(false);
  const [showActionForm, setShowActionForm] = useState(false);
  const [editing, setEditing] = useState(false);
  
  // AI states
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiReport, setAiReport] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadIncident();
  }, [id]);

  async function loadIncident() {
    try {
      const data = await api.getIncident(id!);
      setIncident(data);
    } catch {
      navigate('/');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this incident permanently?')) return;
    await api.deleteIncident(id!);
    navigate('/');
  }

  async function handleExport() {
    const md = await api.exportMarkdown(id!);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `postmortem-${id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleAddTimeline(data: CreateTimelineEvent) {
    await api.addTimelineEvent(id!, data);
    setShowTimelineForm(false);
    loadIncident();
  }

  async function handleDeleteTimeline(eventId: string) {
    await api.deleteTimelineEvent(id!, eventId);
    loadIncident();
  }

  async function handleAddAction(data: CreateActionItem) {
    await api.addActionItem(id!, data);
    setShowActionForm(false);
    loadIncident();
  }

  async function handleToggleAction(actionId: string, done: boolean) {
    await api.updateActionItem(id!, actionId, { status: done ? 'done' : 'open' });
    loadIncident();
  }

  async function handleDeleteAction(actionId: string) {
    await api.deleteActionItem(id!, actionId);
    loadIncident();
  }

  async function handleUpdateIncident(updates: Partial<Incident>) {
    await api.updateIncident(id!, updates);
    setEditing(false);
    loadIncident();
  }

  // AI handlers
  async function handleGenerateSummary() {
    setAiLoading('summary');
    try {
      const { summary } = await api.generateSummary(id!);
      setAiSummary(summary);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate summary', 'error');
    } finally {
      setAiLoading(null);
    }
  }

  async function handleSuggestActions() {
    setAiLoading('actions');
    try {
      const { suggestions } = await api.suggestActions(id!);
      setAiSuggestions(suggestions);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to suggest actions', 'error');
    } finally {
      setAiLoading(null);
    }
  }

  async function handleGenerateReport() {
    setAiLoading('report');
    try {
      const { report } = await api.generateReport(id!);
      setAiReport(report);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate report', 'error');
    } finally {
      setAiLoading(null);
    }
  }

  async function handleApplySummary() {
    if (aiSummary) {
      await api.updateIncident(id!, { summary: aiSummary });
      setAiSummary(null);
      loadIncident();
    }
  }

  async function handleAddSuggestedAction(title: string) {
    await api.addActionItem(id!, { title, owner: 'Unassigned', status: 'open' });
    setAiSuggestions(prev => prev.filter(s => s !== title));
    loadIncident();
  }

  if (loading) {
    return <div className="empty-state"><div className="ai-loading">Loading...</div></div>;
  }

  if (!incident) {
    return <div className="empty-state"><p>Incident not found</p></div>;
  }

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/" style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Incidents
        </Link>
      </div>

      {/* Header Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '600', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
              {incident.title}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div className="card-meta">
                <span style={{ color: 'var(--text-tertiary)' }}>Started</span>{' '}
                {new Date(incident.startedAt).toLocaleString()}
              </div>
              {incident.resolvedAt && (
                <div className="card-meta">
                  <span style={{ color: 'var(--text-tertiary)' }}>Resolved</span>{' '}
                  {new Date(incident.resolvedAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className={`badge badge-${incident.severity.toLowerCase()}`}>{incident.severity}</span>
            <span className={`badge badge-status ${incident.status}`}>{incident.status}</span>
          </div>
        </div>

        {incident.servicesImpacted.length > 0 && (
          <div className="tags" style={{ marginBottom: '1.25rem' }}>
            {incident.servicesImpacted.map((s) => (
              <span key={s} className="tag">{s}</span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export
          </button>
          <button className="btn btn-ai btn-sm" onClick={handleGenerateReport} disabled={aiLoading === 'report'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a4 4 0 014 4c0 1.1-.9 2-2 2h-4a2 2 0 01-2-2 4 4 0 014-4z" />
              <path d="M12 8v8M8 12h8" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            {aiLoading === 'report' ? 'Generating...' : 'AI Report'}
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleDelete} style={{ marginLeft: 'auto' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            Delete
          </button>
        </div>
      </div>

      {/* AI Report Output */}
      {aiReport && (
        <div className="ai-section" style={{ marginBottom: '1.5rem' }}>
          <div className="ai-section-header">
            <span className="ai-badge">AI</span>
            Generated Report
            <button 
              className="btn btn-ghost btn-sm" 
              style={{ marginLeft: 'auto' }}
              onClick={() => {
                const blob = new Blob([aiReport], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ai-postmortem-${id}.md`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAiReport(null)}>✕</button>
          </div>
          <pre className="ai-content" style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', fontSize: '0.875rem' }}>
            {aiReport}
          </pre>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {(['overview', 'timeline', 'actions', 'audit'] as const).map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'timeline' && ` (${incident.timeline.length})`}
            {t === 'actions' && ` (${incident.actionItems.length})`}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="card">
          <div className="section-header">
            <h3 className="section-title">Summary</h3>
            <button 
              className="btn btn-ai btn-sm" 
              onClick={handleGenerateSummary}
              disabled={aiLoading === 'summary'}
            >
              {aiLoading === 'summary' ? 'Generating...' : '✨ Generate with AI'}
            </button>
          </div>
          
          {/* AI Generated Summary */}
          {aiSummary && (
            <div className="ai-section" style={{ marginBottom: '1rem' }}>
              <div className="ai-section-header">
                <span className="ai-badge">AI</span>
                Suggested Summary
              </div>
              <p className="ai-content">{aiSummary}</p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn btn-primary btn-sm" onClick={handleApplySummary}>
                  Apply Summary
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setAiSummary(null)}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {incident.summary ? (
            <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
              {incident.summary}
            </p>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No summary yet. Click "Generate with AI" or edit to add one.
            </p>
          )}
        </div>
      )}

      {/* Timeline Tab */}
      {tab === 'timeline' && (
        <div className="card">
          <div className="section-header">
            <h3 className="section-title">Timeline</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowTimelineForm(true)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Event
            </button>
          </div>
          {incident.timeline.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No timeline events yet. Add events to track what happened.</p>
          ) : (
            <div className="timeline">
              {incident.timeline.map((event) => (
                <div key={event.id} className="timeline-item">
                  <div className="timeline-time">
                    {new Date(event.timestamp).toLocaleString()}
                  </div>
                  <div className="timeline-author">{event.author}</div>
                  <div className="timeline-content">{event.description}</div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: '0.5rem', color: 'var(--danger)' }}
                    onClick={() => handleDeleteTimeline(event.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions Tab */}
      {tab === 'actions' && (
        <div className="card">
          <div className="section-header">
            <h3 className="section-title">Action Items</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="btn btn-ai btn-sm" 
                onClick={handleSuggestActions}
                disabled={aiLoading === 'actions'}
              >
                {aiLoading === 'actions' ? 'Thinking...' : '✨ AI Suggest'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowActionForm(true)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add
              </button>
            </div>
          </div>

          {/* AI Suggestions */}
          {aiSuggestions.length > 0 && (
            <div className="ai-section" style={{ marginBottom: '1rem' }}>
              <div className="ai-section-header">
                <span className="ai-badge">AI</span>
                Suggested Actions
              </div>
              {aiSuggestions.map((suggestion, i) => (
                <div key={i} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  background: 'var(--bg-base)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '0.5rem'
                }}>
                  <span style={{ fontSize: '0.875rem' }}>{suggestion}</span>
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => handleAddSuggestedAction(suggestion)}
                  >
                    Add
                  </button>
                </div>
              ))}
              <button 
                className="btn btn-ghost btn-sm" 
                style={{ marginTop: '0.5rem' }}
                onClick={() => setAiSuggestions([])}
              >
                Dismiss All
              </button>
            </div>
          )}

          {incident.actionItems.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No action items yet. Track follow-ups to prevent future incidents.</p>
          ) : (
            incident.actionItems.map((action) => (
              <div key={action.id} className="action-item">
                <input
                  type="checkbox"
                  className="action-checkbox"
                  checked={action.status === 'done'}
                  onChange={(e) => handleToggleAction(action.id, e.target.checked)}
                />
                <div className="action-content">
                  <div className={`action-title ${action.status === 'done' ? 'done' : ''}`}>
                    {action.title}
                  </div>
                  <div className="action-meta">
                    {action.owner}
                    {action.dueDate && ` · Due ${new Date(action.dueDate).toLocaleDateString()}`}
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--danger)' }}
                  onClick={() => handleDeleteAction(action.id)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Audit Tab */}
      {tab === 'audit' && (
        <div className="card">
          <div className="section-header">
            <h3 className="section-title">Audit Log</h3>
          </div>
          {incident.auditLog.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No audit entries.</p>
          ) : (
            <div className="audit-log">
              {incident.auditLog.slice().reverse().map((entry) => (
                <div key={entry.id} className="audit-entry">
                  <span className="audit-time">{new Date(entry.timestamp).toLocaleString()}</span>
                  <span className="audit-action">{entry.action}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{entry.user}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showTimelineForm && (
        <TimelineModal onClose={() => setShowTimelineForm(false)} onSubmit={handleAddTimeline} />
      )}
      {showActionForm && (
        <ActionModal onClose={() => setShowActionForm(false)} onSubmit={handleAddAction} />
      )}
      {editing && (
        <EditIncidentModal incident={incident} onClose={() => setEditing(false)} onSubmit={handleUpdateIncident} />
      )}
    </>
  );
}

// ─── Timeline Modal ──────────────────────────────────────────────────────────
function TimelineModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (d: CreateTimelineEvent) => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false);
  const [timestamp, setTimestamp] = useState(new Date().toISOString().slice(0, 16));
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ timestamp: new Date(timestamp).toISOString(), author, description });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Add Timeline Event</h3>
          <button className="btn btn-ghost" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Timestamp</label>
                <input type="datetime-local" className="form-input" value={timestamp} onChange={(e) => setTimestamp(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Author</label>
                <input type="text" className="form-input" value={author} onChange={(e) => setAuthor(e.target.value)} required placeholder="Jane Doe" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">What happened?</label>
              <textarea className="form-textarea" value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="Describe this event..." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Adding...' : 'Add Event'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Action Modal ────────────────────────────────────────────────────────────
function ActionModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (d: CreateActionItem) => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState('');
  const [dueDate, setDueDate] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        title,
        owner,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        status: 'open',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Add Action Item</h3>
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
              <input type="text" className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Add alerting for DB latency" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Owner</label>
                <input type="text" className="form-input" value={owner} onChange={(e) => setOwner(e.target.value)} required placeholder="John Smith" />
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Adding...' : 'Add Action'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Incident Modal ─────────────────────────────────────────────────────
function EditIncidentModal({ incident, onClose, onSubmit }: { incident: Incident; onClose: () => void; onSubmit: (d: Partial<Incident>) => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState(incident.title);
  const [severity, setSeverity] = useState(incident.severity);
  const [status, setStatus] = useState(incident.status);
  const [summary, setSummary] = useState(incident.summary || '');
  const [services, setServices] = useState(incident.servicesImpacted.join(', '));
  const [resolvedAt, setResolvedAt] = useState(incident.resolvedAt?.slice(0, 16) || '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        title,
        severity,
        status,
        summary: summary || undefined,
        servicesImpacted: services.split(',').map((s) => s.trim()).filter(Boolean),
        resolvedAt: resolvedAt ? new Date(resolvedAt).toISOString() : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Edit Incident</h3>
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
              <input type="text" className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Severity</label>
                <select className="form-select" value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}>
                  <option value="SEV1">SEV1 — Critical</option>
                  <option value="SEV2">SEV2 — Major</option>
                  <option value="SEV3">SEV3 — Minor</option>
                  <option value="SEV4">SEV4 — Low</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                  <option value="investigating">Investigating</option>
                  <option value="identified">Identified</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Resolved At</label>
              <input type="datetime-local" className="form-input" value={resolvedAt} onChange={(e) => setResolvedAt(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Services Impacted</label>
              <input type="text" className="form-input" value={services} onChange={(e) => setServices(e.target.value)} placeholder="Comma-separated" />
            </div>
            <div className="form-group">
              <label className="form-label">Summary</label>
              <textarea className="form-textarea" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Brief summary of what happened and why..." style={{ minHeight: '120px' }} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
