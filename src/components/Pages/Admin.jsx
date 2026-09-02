import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  DatabaseBackup,
  HardDrive,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { apiUrl } from '../../config/api';
import './Admin.css';


const CATEGORY_LABELS = {
  administration: 'Administração',
  billing: 'Assinaturas',
  access: 'Acessos',
  connections: 'Conexões',
  forge_7030: 'Forge 70/30',
  forge_5050: 'Forge 50/50',
  forge_max: 'Forge Max',
  research_studio: 'Research Studio',
  bulk_download: 'Baixar em Massa',
  agents: 'Agentes',
  leads: 'Leads',
  schedule: 'Agenda',
  whatsapp: 'WhatsApp',
  vault: 'Vault',
  system: 'Sistema',
};

const STATUS_LABELS = {
  active: 'Ativo',
  trialing: 'Teste',
  past_due: 'Pendente',
  canceled: 'Cancelado',
  expired: 'Expirado',
  suspended: 'Suspenso',
  created: 'Criado',
  verified: 'Verificado',
  failed: 'Falhou',
  deleted: 'Excluído',
  success: 'Sucesso',
  denied: 'Negado',
  error: 'Erro',
  pass: 'Pronto',
  blocker: 'Bloqueio',
  warning: 'Atenção',
};

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || `Falha HTTP ${response.status}`);
  }
  return payload;
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const amount = bytes / (1024 ** index);
  return `${amount.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return 'Sem registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem registro';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function statusTone(status) {
  if (['active', 'created', 'verified', 'success', 'trialing', 'pass'].includes(status)) return 'success';
  if (['failed', 'error', 'expired', 'suspended', 'blocker'].includes(status)) return 'danger';
  if (['denied', 'past_due', 'canceled', 'warning'].includes(status)) return 'warning';
  return 'neutral';
}

function Admin() {
  const [overview, setOverview] = useState(null);
  const [backups, setBackups] = useState([]);
  const [audit, setAudit] = useState({ items: [], total: 0 });
  const [readiness, setReadiness] = useState(null);
  const [filters, setFilters] = useState({ workspace_id: '', category: '', outcome: '' });
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadAudit = useCallback(async (activeFilters = filters) => {
    const query = new URLSearchParams({ limit: '100' });
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    const payload = await readJson(await fetch(apiUrl(`/api/admin/audit?${query.toString()}`), { cache: 'no-store' }));
    setAudit(payload);
  }, [filters]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewPayload, backupsPayload, auditPayload, readinessPayload] = await Promise.all([
        fetch(apiUrl('/api/admin/overview'), { cache: 'no-store' }).then(readJson),
        fetch(apiUrl('/api/admin/backups'), { cache: 'no-store' }).then(readJson),
        fetch(apiUrl('/api/admin/audit?limit=100'), { cache: 'no-store' }).then(readJson),
        fetch(apiUrl('/api/security/readiness'), { cache: 'no-store' }).then(readJson),
      ]);
      setOverview(overviewPayload);
      setBackups(backupsPayload.items || []);
      setAudit(auditPayload);
      setReadiness(readinessPayload);
    } catch (loadError) {
      setError(loadError.message || 'Falha ao carregar Administração.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const refreshAfterAction = useCallback(async () => {
    const [overviewPayload, backupsPayload, readinessPayload] = await Promise.all([
      fetch(apiUrl('/api/admin/overview'), { cache: 'no-store' }).then(readJson),
      fetch(apiUrl('/api/admin/backups'), { cache: 'no-store' }).then(readJson),
      fetch(apiUrl('/api/security/readiness'), { cache: 'no-store' }).then(readJson),
    ]);
    setOverview(overviewPayload);
    setBackups(backupsPayload.items || []);
    setReadiness(readinessPayload);
    await loadAudit();
  }, [loadAudit]);

  const createBackup = async () => {
    setActionKey('create');
    setError('');
    setMessage('');
    try {
      await readJson(await fetch(apiUrl('/api/admin/backups'), { method: 'POST' }));
      setMessage('Backup de identidade criado com sucesso.');
      await refreshAfterAction();
    } catch (actionError) {
      setError(actionError.message || 'Falha ao criar backup.');
    } finally {
      setActionKey('');
    }
  };

  const verifyBackup = async (backupId) => {
    setActionKey(`verify:${backupId}`);
    setError('');
    setMessage('');
    try {
      await readJson(await fetch(apiUrl(`/api/admin/backups/${encodeURIComponent(backupId)}/verify`), { method: 'POST' }));
      setMessage('Integridade do backup confirmada.');
      await refreshAfterAction();
    } catch (actionError) {
      setError(actionError.message || 'Falha ao verificar backup.');
    } finally {
      setActionKey('');
    }
  };

  const removeBackup = async (backup) => {
    if (!window.confirm(`Excluir o backup ${backup.file_name}?`)) return;
    setActionKey(`delete:${backup.id}`);
    setError('');
    setMessage('');
    try {
      await readJson(await fetch(apiUrl(`/api/admin/backups/${encodeURIComponent(backup.id)}`), { method: 'DELETE' }));
      setMessage('Backup excluído.');
      await refreshAfterAction();
    } catch (actionError) {
      setError(actionError.message || 'Falha ao excluir backup.');
    } finally {
      setActionKey('');
    }
  };

  const applyAuditFilters = async (event) => {
    event.preventDefault();
    setActionKey('audit');
    setError('');
    try {
      await loadAudit(filters);
    } catch (filterError) {
      setError(filterError.message || 'Falha ao filtrar auditoria.');
    } finally {
      setActionKey('');
    }
  };

  const workspaceOptions = overview?.workspaces?.items || [];
  const stats = useMemo(() => [
    {
      label: 'Workspaces',
      value: overview?.workspaces?.total || 0,
      detail: `${overview?.workspaces?.by_status?.active || 0} ativos`,
      icon: Building2,
      tone: 'blue',
    },
    {
      label: 'Usuários',
      value: overview?.users?.total || 0,
      detail: `${overview?.users?.by_status?.active || 0} ativos`,
      icon: Users,
      tone: 'green',
    },
    {
      label: 'Assinaturas',
      value: overview?.subscriptions?.total || 0,
      detail: `${overview?.subscriptions?.by_status?.active || 0} ativas`,
      icon: ShieldCheck,
      tone: 'gold',
    },
    {
      label: 'Auditoria 24h',
      value: overview?.audit_24h?.total || 0,
      detail: `${overview?.audit_24h?.errors || 0} erros`,
      icon: Activity,
      tone: overview?.audit_24h?.errors ? 'red' : 'green',
    },
  ], [overview]);

  if (loading) {
    return (
      <div className="admin-loading">
        <Loader2 size={26} className="admin-spin" />
        <span>Carregando Administração</span>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <span className="admin-eyebrow"><ShieldCheck size={15} /> Controle do proprietário</span>
          <h1>Administração</h1>
          <p>Estado operacional do HUB em {formatDate(overview?.generated_at)}.</p>
        </div>
        <button type="button" className="admin-icon-button" onClick={loadAll} title="Atualizar dados">
          <RefreshCw size={18} />
        </button>
      </header>

      {error && <div className="admin-alert danger"><AlertTriangle size={18} /><span>{error}</span></div>}
      {message && <div className="admin-alert success"><CheckCircle2 size={18} /><span>{message}</span></div>}

      <section className="admin-stat-grid" aria-label="Resumo operacional">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <article className={`admin-stat ${item.tone}`} key={item.label}>
              <span className="admin-stat-icon"><Icon size={19} /></span>
              <div><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></div>
            </article>
          );
        })}
      </section>

      <div className="admin-system-strip">
        <span><HardDrive size={16} /> Schema <strong>v{overview?.identity?.schema_version || 0}</strong></span>
        <span>Banco <strong>{formatBytes(overview?.identity?.database_bytes)}</strong></span>
        <span>Último backup <strong>{formatDate(overview?.last_backup?.created_at)}</strong></span>
        <span className={`admin-status-chip ${statusTone(overview?.last_backup?.status)}`}>
          {STATUS_LABELS[overview?.last_backup?.status] || 'Sem backup'}
        </span>
      </div>

      <section className="admin-section admin-readiness">
        <div className="admin-section-heading">
          <div><h2>Prontidão comercial</h2><span>Segurança e operação para novos clientes</span></div>
          <span className={`admin-status-chip ${readiness?.launch_ready ? 'success' : 'danger'}`}>
            {readiness?.launch_ready ? 'Pronto para lançamento' : 'Ajustes necessários'}
          </span>
        </div>
        <div className="admin-readiness-summary">
          <span className="admin-readiness-score"><Rocket size={20} /><strong>{readiness?.score || 0}%</strong></span>
          <span><CheckCircle2 size={15} /> {readiness?.summary?.passed || 0} prontos</span>
          <span><AlertTriangle size={15} /> {readiness?.summary?.warnings || 0} alertas</span>
          <span><LockKeyhole size={15} /> {readiness?.summary?.blockers || 0} bloqueios</span>
        </div>
        <div className="admin-readiness-grid">
          {(readiness?.checks || []).map((check) => (
            <article className={`admin-readiness-item ${statusTone(check.status)}`} key={check.id}>
              <div><strong>{check.label}</strong><span className={`admin-status-chip ${statusTone(check.status)}`}>{STATUS_LABELS[check.status]}</span></div>
              <p>{check.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section-heading">
          <div><h2>Workspaces</h2><span>{workspaceOptions.length} registros</span></div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Workspace</th><th>Responsável</th><th>Membros</th><th>Plano</th><th>Assinatura</th><th>Último acesso</th></tr></thead>
            <tbody>
              {workspaceOptions.map((workspace) => (
                <tr key={workspace.id}>
                  <td><strong>{workspace.name}</strong><span>{workspace.workspace_type === 'internal' ? 'Interno' : 'Cliente'}</span></td>
                  <td><strong>{workspace.owner_name || 'Usuário'}</strong><span>{workspace.owner_email}</span></td>
                  <td>{workspace.members}</td>
                  <td>{workspace.plan_code || 'Sem plano'}</td>
                  <td><span className={`admin-status-chip ${statusTone(workspace.subscription_status)}`}>{STATUS_LABELS[workspace.subscription_status] || workspace.subscription_status}</span></td>
                  <td>{formatDate(workspace.last_accessed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section-heading">
          <div><h2>Backups de identidade</h2><span>{backups.length} {backups.length === 1 ? 'arquivo protegido' : 'arquivos protegidos'}</span></div>
          <button type="button" className="admin-primary-button" onClick={createBackup} disabled={Boolean(actionKey)}>
            {actionKey === 'create' ? <Loader2 size={17} className="admin-spin" /> : <DatabaseBackup size={17} />}
            Criar backup
          </button>
        </div>
        {backups.length === 0 ? (
          <div className="admin-empty">Nenhum backup registrado.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Arquivo</th><th>Origem</th><th>Tamanho</th><th>Schema</th><th>Estado</th><th>Criado</th><th>Ações</th></tr></thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.id}>
                    <td><strong>{backup.file_name}</strong><span>{backup.sha256 ? `${backup.sha256.slice(0, 14)}…` : backup.error_message || 'Sem checksum'}</span></td>
                    <td>{backup.trigger_kind === 'automatic' ? 'Automático' : 'Manual'}</td>
                    <td>{formatBytes(backup.file_size_bytes)}</td>
                    <td>v{backup.schema_version}</td>
                    <td><span className={`admin-status-chip ${statusTone(backup.status)}`}>{STATUS_LABELS[backup.status] || backup.status}</span></td>
                    <td>{formatDate(backup.created_at)}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button type="button" onClick={() => verifyBackup(backup.id)} disabled={Boolean(actionKey)} title="Verificar integridade">
                          {actionKey === `verify:${backup.id}` ? <Loader2 size={16} className="admin-spin" /> : <ShieldCheck size={16} />}
                        </button>
                        <button type="button" className="danger" onClick={() => removeBackup(backup)} disabled={Boolean(actionKey)} title="Excluir backup">
                          {actionKey === `delete:${backup.id}` ? <Loader2 size={16} className="admin-spin" /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-section">
        <div className="admin-section-heading audit">
          <div><h2>Auditoria</h2><span>{audit.total || 0} eventos encontrados</span></div>
          <form className="admin-audit-filters" onSubmit={applyAuditFilters}>
            <select value={filters.workspace_id} onChange={(event) => setFilters((current) => ({ ...current, workspace_id: event.target.value }))} aria-label="Filtrar workspace">
              <option value="">Todos os workspaces</option>
              {workspaceOptions.map((workspace) => <option value={workspace.id} key={workspace.id}>{workspace.name}</option>)}
            </select>
            <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))} aria-label="Filtrar categoria">
              <option value="">Todas as categorias</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
            <select value={filters.outcome} onChange={(event) => setFilters((current) => ({ ...current, outcome: event.target.value }))} aria-label="Filtrar resultado">
              <option value="">Todos os resultados</option>
              <option value="success">Sucesso</option><option value="denied">Negado</option><option value="error">Erro</option>
            </select>
            <button type="submit" disabled={actionKey === 'audit'} title="Aplicar filtros">
              {actionKey === 'audit' ? <Loader2 size={16} className="admin-spin" /> : <Search size={16} />}
            </button>
          </form>
        </div>
        {audit.items?.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table audit-table">
              <thead><tr><th>Data</th><th>Usuário</th><th>Workspace</th><th>Categoria</th><th>Ação</th><th>Resultado</th><th>Duração</th></tr></thead>
              <tbody>
                {audit.items.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDate(event.created_at)}</td>
                    <td><strong>{event.actor_name || 'Usuário'}</strong><span>{event.actor_email}</span></td>
                    <td>{event.workspace_name || 'Sistema'}</td>
                    <td>{CATEGORY_LABELS[event.category] || event.category}</td>
                    <td><strong>{event.action}</strong><span>{event.request_method} · {event.request_path}</span></td>
                    <td><span className={`admin-status-chip ${statusTone(event.outcome)}`}>{STATUS_LABELS[event.outcome] || event.outcome} · {event.response_status}</span></td>
                    <td>{event.duration_ms} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="admin-empty">Nenhum evento para os filtros atuais.</div>}
      </section>
    </div>
  );
}

export default Admin;
