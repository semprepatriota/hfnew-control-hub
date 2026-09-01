import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Infinity as InfinityIcon,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { apiUrl } from '../../config/api';
import './Billing.css';

const STATUS_OPTIONS = [
  ['trialing', 'Período de teste'],
  ['active', 'Ativa'],
  ['past_due', 'Pagamento pendente'],
  ['canceled', 'Cancelada'],
  ['expired', 'Expirada'],
  ['incomplete', 'Pagamento incompleto'],
  ['suspended', 'Suspensa'],
];

const PROVIDER_OPTIONS = [
  ['manual', 'Manual'],
  ['legacy', 'Legado'],
  ['bridge', 'Bridge'],
  ['stripe', 'Stripe'],
  ['mercado_pago', 'Mercado Pago'],
];

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

function formatDate(value) {
  if (!value) return 'Sem data definida';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function formatPrice(cents, currency = 'BRL') {
  if (cents === null || cents === undefined) return 'Preço não definido';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(Number(cents) / 100);
}

function centsToInput(cents) {
  if (cents === null || cents === undefined) return '';
  return (Number(cents) / 100).toFixed(2).replace('.', ',');
}

function inputToCents(value) {
  const raw = String(value || '').trim();
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : /^\d+\.\d{1,2}$/.test(raw)
      ? raw
      : raw.replace(/\./g, '');
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : null;
}

function subscriptionDraft(item) {
  return {
    plan_code: item.plan?.code || 'trial',
    status: item.status || 'active',
    provider: item.provider || 'manual',
    billing_interval: item.billing_interval || 'month',
    current_period_start: item.current_period_start || null,
    current_period_end: item.current_period_end || null,
    trial_ends_at: item.trial_ends_at || null,
    grace_ends_at: item.grace_ends_at || null,
    cancel_at_period_end: Boolean(item.cancel_at_period_end),
    grandfathered: Boolean(item.grandfathered),
    limit_overrides: item.limit_overrides || {},
  };
}

function Billing({ currentUser }) {
  const isOwner = currentUser?.role === 'owner';
  const [current, setCurrent] = useState(null);
  const [catalog, setCatalog] = useState({ plans: [], metrics: [] });
  const [subscriptions, setSubscriptions] = useState([]);
  const [planDrafts, setPlanDrafts] = useState({});
  const [subscriptionDrafts, setSubscriptionDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadBilling = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const requests = [
        fetch(apiUrl('/api/billing/current'), { cache: 'no-store' }),
        fetch(apiUrl('/api/billing/catalog'), { cache: 'no-store' }),
      ];
      if (isOwner) {
        requests.push(fetch(apiUrl('/api/billing/admin/subscriptions'), { cache: 'no-store' }));
      }
      const responses = await Promise.all(requests);
      const payloads = await Promise.all(responses.map(readJson));
      const failedIndex = responses.findIndex((response) => !response.ok);
      if (failedIndex >= 0) {
        throw new Error(payloads[failedIndex]?.detail || 'Não foi possível carregar as assinaturas.');
      }

      const currentPayload = payloads[0];
      const catalogPayload = payloads[1];
      const subscriptionItems = isOwner ? (payloads[2]?.items || []) : [];
      setCurrent(currentPayload);
      setCatalog(catalogPayload);
      setSubscriptions(subscriptionItems);
      setPlanDrafts(Object.fromEntries((catalogPayload.plans || []).map((plan) => [
        plan.code,
        {
          currency: plan.currency || 'BRL',
          monthly_price: centsToInput(plan.monthly_price_cents),
          annual_price: centsToInput(plan.annual_price_cents),
          trial_days: String(plan.trial_days ?? 0),
          publicly_available: Boolean(plan.publicly_available),
          limits: Object.fromEntries((catalogPayload.metrics || []).map((metric) => [
            metric.key,
            String(plan.limits?.[metric.key] ?? -1),
          ])),
        },
      ])));
      setSubscriptionDrafts(Object.fromEntries(subscriptionItems.map((item) => [
        item.workspace_id,
        subscriptionDraft(item),
      ])));
    } catch (loadError) {
      setError(loadError.message || 'Falha ao carregar a área de assinatura.');
    } finally {
      setLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  const customerPlans = useMemo(() => (
    (catalog.plans || []).filter((plan) => (
      !plan.is_internal
      && (plan.publicly_available || plan.code === current?.subscription?.plan?.code)
    ))
  ), [catalog.plans, current?.subscription?.plan?.code]);

  const updatePlanDraft = (planCode, updater) => {
    setPlanDrafts((existing) => ({
      ...existing,
      [planCode]: updater(existing[planCode] || {}),
    }));
  };

  const savePlan = async (planCode) => {
    const draft = planDrafts[planCode];
    if (!draft) return;
    setSavingKey(`plan:${planCode}`);
    setError('');
    setMessage('');
    try {
      const response = await fetch(apiUrl(`/api/billing/admin/plans/${encodeURIComponent(planCode)}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency: draft.currency,
          monthly_price_cents: inputToCents(draft.monthly_price),
          annual_price_cents: inputToCents(draft.annual_price),
          trial_days: Number(draft.trial_days || 0),
          publicly_available: Boolean(draft.publicly_available),
          limits: Object.fromEntries(Object.entries(draft.limits || {}).map(([key, value]) => [
            key,
            Number(value),
          ])),
        }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.detail || 'Falha ao salvar o plano.');
      setMessage(`Plano ${data.item?.name || planCode} atualizado.`);
      await loadBilling();
    } catch (saveError) {
      setError(saveError.message || 'Falha ao salvar o plano.');
    } finally {
      setSavingKey('');
    }
  };

  const updateSubscriptionDraft = (workspaceId, field, value) => {
    setSubscriptionDrafts((existing) => ({
      ...existing,
      [workspaceId]: {
        ...(existing[workspaceId] || {}),
        [field]: value,
      },
    }));
  };

  const saveSubscription = async (workspaceId) => {
    const draft = subscriptionDrafts[workspaceId];
    if (!draft) return;
    setSavingKey(`subscription:${workspaceId}`);
    setError('');
    setMessage('');
    try {
      const response = await fetch(apiUrl(`/api/billing/admin/subscriptions/${encodeURIComponent(workspaceId)}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.detail || 'Falha ao salvar a assinatura.');
      setMessage('Assinatura do workspace atualizada.');
      await loadBilling();
    } catch (saveError) {
      setError(saveError.message || 'Falha ao salvar a assinatura.');
    } finally {
      setSavingKey('');
    }
  };

  if (loading) {
    return (
      <div className="billing-loading">
        <Loader2 size={24} className="billing-spin" />
        <span>Carregando assinatura e limites...</span>
      </div>
    );
  }

  const subscription = current?.subscription;
  const currentPlan = subscription?.plan;

  return (
    <div className="billing-page">
      <header className="billing-header">
        <div>
          <span className="billing-eyebrow"><CreditCard size={15} /> Controle comercial</span>
          <h1>{isOwner ? 'Assinaturas e limites' : 'Minha assinatura'}</h1>
          <p>Plano, situação de acesso e consumo mensal do workspace.</p>
        </div>
        <button type="button" className="billing-refresh" onClick={loadBilling} title="Atualizar dados">
          <RefreshCw size={17} />
          Atualizar
        </button>
      </header>

      {error && <div className="billing-alert error"><AlertCircle size={18} /><span>{error}</span></div>}
      {message && <div className="billing-alert success"><CheckCircle2 size={18} /><span>{message}</span></div>}

      {!catalog.automatic_billing_configured && (
        <div className="billing-bridge-notice">
          <ShieldCheck size={19} />
          <div>
            <strong>Cobrança automática protegida e ainda desativada</strong>
            <span>Os planos e limites já funcionam. A ativação do checkout depende apenas do provedor e dos preços finais.</span>
          </div>
        </div>
      )}

      <section className="billing-summary" aria-label="Resumo da assinatura">
        <div className="billing-summary-main">
          <span className={`billing-status ${subscription?.entitled ? 'active' : 'blocked'}`}>
            {subscription?.entitled ? <BadgeCheck size={16} /> : <AlertCircle size={16} />}
            {subscription?.status_label || 'Indisponível'}
          </span>
          <h2>{currentPlan?.name || 'Plano não identificado'}</h2>
          <p>{currentPlan?.description || 'Sem descrição cadastrada.'}</p>
          {subscription?.grandfathered && (
            <span className="billing-legacy"><InfinityIcon size={15} /> Acesso legado preservado e sem limites</span>
          )}
        </div>
        <div className="billing-summary-meta">
          <div>
            <span>Workspace</span>
            <strong>{current?.workspace?.name || 'Workspace'}</strong>
          </div>
          <div>
            <span>Período atual</span>
            <strong>{formatDate(subscription?.current_period_end || subscription?.trial_ends_at)}</strong>
          </div>
          <div>
            <span>Provedor</span>
            <strong>{subscription?.provider || 'manual'}</strong>
          </div>
        </div>
      </section>

      <section className="billing-section">
        <div className="billing-section-heading">
          <div>
            <h2>Consumo do período</h2>
            <p>Tentativas que retornam erro são liberadas; operações aceitas são contabilizadas.</p>
          </div>
          <span><CalendarClock size={15} /> até {formatDate(subscription?.usage_period?.end)}</span>
        </div>
        <div className="billing-usage-grid">
          {(subscription?.usage || []).map((item) => (
            <div className="billing-usage-item" key={item.key}>
              <div className="billing-usage-label">
                <span>{item.label}</span>
                <strong>{item.used} / {item.unlimited ? '∞' : item.limit}</strong>
              </div>
              <div className="billing-progress" aria-label={`${item.label}: ${item.percentage}%`}>
                <span style={{ width: `${item.unlimited ? 0 : item.percentage}%` }}></span>
              </div>
              <small>{item.unlimited ? 'Sem limite' : `${item.remaining} restantes`}</small>
            </div>
          ))}
        </div>
      </section>

      {!isOwner && (
        <section className="billing-section">
          <div className="billing-section-heading">
            <div>
              <h2>Planos disponíveis</h2>
              <p>Somente planos liberados comercialmente aparecem aqui.</p>
            </div>
          </div>
          {customerPlans.length ? (
            <div className="billing-plan-grid">
              {customerPlans.map((plan) => (
                <article className={`billing-plan ${plan.code === currentPlan?.code ? 'selected' : ''}`} key={plan.code}>
                  <span>{plan.code === currentPlan?.code ? 'Plano atual' : 'Disponível'}</span>
                  <h3>{plan.name}</h3>
                  <strong>{formatPrice(plan.monthly_price_cents, plan.currency)} <small>/ mês</small></strong>
                  <p>{plan.description}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="billing-empty">Nenhum novo plano foi publicado ainda.</div>
          )}
        </section>
      )}

      {isOwner && (
        <>
          <section className="billing-section">
            <div className="billing-section-heading">
              <div>
                <h2>Configuração comercial</h2>
                <p>Preços permanecem ocultos até o plano ser marcado como disponível.</p>
              </div>
              <SlidersHorizontal size={20} />
            </div>
            <div className="billing-plan-admin-list">
              {(catalog.plans || []).filter((plan) => !plan.is_internal).map((plan) => {
                const draft = planDrafts[plan.code] || {};
                return (
                  <article className="billing-plan-admin" key={plan.code}>
                    <div className="billing-plan-admin-title">
                      <div><strong>{plan.name}</strong><span>{plan.description}</span></div>
                      <label className="billing-check">
                        <input
                          type="checkbox"
                          checked={Boolean(draft.publicly_available)}
                          onChange={(event) => updatePlanDraft(plan.code, (currentDraft) => ({
                            ...currentDraft,
                            publicly_available: event.target.checked,
                          }))}
                        />
                        Visível para venda
                      </label>
                    </div>
                    <div className="billing-form-grid prices">
                      <label>Mensal (R$)<input value={draft.monthly_price ?? ''} onChange={(event) => updatePlanDraft(plan.code, (currentDraft) => ({ ...currentDraft, monthly_price: event.target.value }))} placeholder="0,00" /></label>
                      <label>Anual (R$)<input value={draft.annual_price ?? ''} onChange={(event) => updatePlanDraft(plan.code, (currentDraft) => ({ ...currentDraft, annual_price: event.target.value }))} placeholder="0,00" /></label>
                      <label>Dias de teste<input type="number" min="0" max="365" value={draft.trial_days ?? '0'} onChange={(event) => updatePlanDraft(plan.code, (currentDraft) => ({ ...currentDraft, trial_days: event.target.value }))} /></label>
                    </div>
                    <div className="billing-form-grid limits">
                      {(catalog.metrics || []).map((metric) => (
                        <label key={metric.key}>
                          {metric.label}
                          <input
                            type="number"
                            min="-1"
                            value={draft.limits?.[metric.key] ?? '-1'}
                            onChange={(event) => updatePlanDraft(plan.code, (currentDraft) => ({
                              ...currentDraft,
                              limits: { ...(currentDraft.limits || {}), [metric.key]: event.target.value },
                            }))}
                          />
                        </label>
                      ))}
                    </div>
                    <div className="billing-plan-admin-actions">
                      <span>Use -1 para ilimitado.</span>
                      <button type="button" onClick={() => savePlan(plan.code)} disabled={savingKey === `plan:${plan.code}`}>
                        {savingKey === `plan:${plan.code}` ? <Loader2 size={16} className="billing-spin" /> : <Save size={16} />}
                        Salvar plano
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="billing-section">
            <div className="billing-section-heading">
              <div>
                <h2>Assinaturas por workspace</h2>
                <p>O workspace interno permanece protegido e os usuários existentes continuam como legado.</p>
              </div>
              <span>{subscriptions.length} workspaces</span>
            </div>
            <div className="billing-table-wrap">
              <table className="billing-table">
                <thead>
                  <tr>
                    <th>Workspace</th>
                    <th>Plano</th>
                    <th>Status</th>
                    <th>Provedor</th>
                    <th>Legado</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((item) => {
                    const draft = subscriptionDrafts[item.workspace_id] || subscriptionDraft(item);
                    const internal = item.workspace_type === 'internal';
                    return (
                      <tr key={item.workspace_id}>
                        <td><strong>{item.workspace_name}</strong><span>{item.owner_email}</span></td>
                        <td>
                          <select disabled={internal} value={draft.plan_code} onChange={(event) => updateSubscriptionDraft(item.workspace_id, 'plan_code', event.target.value)}>
                            {(catalog.plans || []).filter((plan) => internal ? plan.is_internal : !plan.is_internal).map((plan) => <option value={plan.code} key={plan.code}>{plan.name}</option>)}
                          </select>
                        </td>
                        <td>
                          <select disabled={internal} value={draft.status} onChange={(event) => updateSubscriptionDraft(item.workspace_id, 'status', event.target.value)}>
                            {STATUS_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                          </select>
                        </td>
                        <td>
                          <select disabled={internal} value={draft.provider} onChange={(event) => updateSubscriptionDraft(item.workspace_id, 'provider', event.target.value)}>
                            {PROVIDER_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                          </select>
                        </td>
                        <td>
                          <label className="billing-check compact">
                            <input type="checkbox" disabled={internal} checked={Boolean(draft.grandfathered)} onChange={(event) => updateSubscriptionDraft(item.workspace_id, 'grandfathered', event.target.checked)} />
                            {draft.grandfathered ? 'Sim' : 'Não'}
                          </label>
                        </td>
                        <td>
                          <button type="button" className="billing-table-save" disabled={internal || savingKey === `subscription:${item.workspace_id}`} onClick={() => saveSubscription(item.workspace_id)} title="Salvar assinatura">
                            {savingKey === `subscription:${item.workspace_id}` ? <Loader2 size={16} className="billing-spin" /> : <Save size={16} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default Billing;
