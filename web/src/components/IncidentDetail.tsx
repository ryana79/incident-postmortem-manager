import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { Incident, CreateTimelineEvent, CreateActionItem } from '../types';
import * as api from '../api';

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'timeline' | 'actions' | 'audit'>('overview');
  const [showTimelineForm, setShowTimelineForm] = useState(false);
  const [showActionForm, setShowActionForm] = useState(false);
  const [editing, setEditing] = useState(false);

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

  if (loading) {
    return <div className="empty-state"><p>Loading...</p></div>;
  }

  if (!incident) {
    return <div className="empty-state"><p>Incident not found</p></div>;
  }

  return (
    <>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/" style={{ fontSize: '0.875rem' }}>← Back to Incidents</Link>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div>
            <h2 className="card-title" style={{ fontSize: '1.5rem' }}>{incident.title}</h2>
            <div className="card-meta">
              Created {new Date(incident.createdAt).toLocaleString()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className={`badge badge-${incident.severity.toLowerCase()}`}>{incident.severity}</span>
            <span className={`badge badge-status ${incident.status}`}>{incident.status}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Started:</span>{' '}
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              {new Date(incident.startedAt).toLocaleString()}
            </span>
          </div>
          {incident.resolvedAt && (
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Resolved:</span>{' '}
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {new Date(incident.resolvedAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {incident.servicesImpacted.length > 0 && (
          <div className="tags" style={{ marginBottom: '1rem' }}>
            {incident.servicesImpacted.map((s) => (
              <span key={s} className="tag">{s}</span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
            ✏️ Edit
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>
            📄 Export Markdown
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleDelete}>
            🗑️ Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        {(['overview', 'timeline', 'actions', 'audit'] as const).map((t) => (
          <button
            key={t}
            className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
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
          </div>
          {incident.summary ? (
            <p style={{ whiteSpace: 'pre-wrap' }}>{incident.summary}</p>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No summary yet. Click Edit to add one.
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
              + Add Event
            </button>
          </div>
          {incident.timeline.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No timeline events yet.</p>
          ) : (
            <div className="timeline">
              {incident.timeline.map((event) => (
                <div key={event.id} className="timeline-item">
                  <div className="timeline-time">{new Date(event.timestamp).toLocaleString()}</div>
                  <div className="timeline-author">{event.author}</div>
                  <div className="timeline-content">{event.description}</div>
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ marginTop: '0.5rem' }}
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
            <button className="btn btn-primary btn-sm" onClick={() => setShowActionForm(true)}>
              + Add Action
            </button>
          </div>
          {incident.actionItems.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No action items yet.</p>
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
                    Owner: {action.owner}
                    {action.dueDate && ` · Due: ${new Date(action.dueDate).toLocaleDateString()}`}
                  </div>
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDeleteAction(action.id)}
                >
                  ✕
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
                  <span>{entry.user}</span>
                  {entry.details && (
                    <span style={{ color: 'var(--text-muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {entry.details.slice(0, 100)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showTimelineForm && (
        <TimelineModal
          onClose={() => setShowTimelineForm(false)}
          onSubmit={handleAddTimeline}
        />
      )}

      {showActionForm && (
        <ActionModal
          onClose={() => setShowActionForm(false)}
          onSubmit={handleAddAction}
        />
      )}

      {editing && (
        <EditIncidentModal
          incident={incident}
          onClose={() => setEditing(false)}
          onSubmit={handleUpdateIncident}
        />
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
          <button className="btn btn-icon btn-secondary" onClick={onClose}>✕</button>
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
                <input type="text" className="form-input" value={author} onChange={(e) => setAuthor(e.target.value)} required placeholder="e.g., Jane Doe" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="What happened?" />
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
          <button className="btn btn-icon btn-secondary" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Title</label>
              <input type="text" className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g., Add alerting for DB latency" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Owner</label>
                <input type="text" className="form-input" value={owner} onChange={(e) => setOwner(e.target.value)} required placeholder="e.g., John Smith" />
              </div>
              <div className="form-group">
                <label className="form-label">Due Date (optional)</label>
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
          <button className="btn btn-icon btn-secondary" onClick={onClose}>✕</button>
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
                  <option value="SEV1">SEV1</option>
                  <option value="SEV2">SEV2</option>
                  <option value="SEV3">SEV3</option>
                  <option value="SEV4">SEV4</option>
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
              <label className="form-label">Resolved At (optional)</label>
              <input type="datetime-local" className="form-input" value={resolvedAt} onChange={(e) => setResolvedAt(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Services Impacted</label>
              <input type="text" className="form-input" value={services} onChange={(e) => setServices(e.target.value)} placeholder="Comma-separated" />
            </div>
            <div className="form-group">
              <label className="form-label">Summary</label>
              <textarea className="form-textarea" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Brief summary of what happened and why..." style={{ minHeight: '150px' }} />
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

