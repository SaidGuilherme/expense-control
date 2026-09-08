import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { ErrorBanner, Modal } from '../components/ui';
import { MONTHS, formatMoney, formatPercent } from '../utils/format';
import { STEP_LABEL, STEP_NUMBER, type PlanSummary } from '../types';

export default function PlansPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setPlans(await api.plans.list());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar os planejamentos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Planejamentos</h1>
          <p className="subtitle">Escolha um mês e planeje entradas, distribuição e gastos previstos.</p>
        </div>
        <button type="button" className="btn" onClick={() => setCreating(true)}>
          + Novo planejamento
        </button>
      </div>

      <ErrorBanner message={error} onClose={() => setError(null)} />

      {loading ? (
        <div className="card card-pad empty">Carregando…</div>
      ) : plans.length === 0 ? (
        <div className="card empty">
          <h2>Nenhum mês planejado ainda</h2>
          <p className="secondary-ink" style={{ marginTop: 6 }}>
            Comece escolhendo o mês que você quer organizar.
          </p>
          <button type="button" className="btn" style={{ marginTop: 16 }} onClick={() => setCreating(true)}>
            Iniciar planejamento
          </button>
        </div>
      ) : (
        <div className="grid grid-cards">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onDeleted={load} />
          ))}
        </div>
      )}

      {creating && (
        <NewPlanDialog
          existing={plans}
          onClose={() => setCreating(false)}
          onCreated={(id) => navigate(`/planejamentos/${id}`)}
        />
      )}
    </main>
  );
}

function PlanCard({ plan, onDeleted }: { plan: PlanSummary; onDeleted: () => Promise<void> }) {
  const done = plan.step === 'Concluido';
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    setRemoving(true);
    try {
      await api.plans.remove(plan.id);
      await onDeleted();
    } finally {
      setRemoving(false);
      setConfirming(false);
    }
  };

  return (
    <article className="plan-card">
      <div className="row">
        <h2 style={{ flex: 1, minWidth: 0 }}>
          <Link to={`/planejamentos/${plan.id}`}>{plan.label}</Link>
        </h2>
        <span className={`badge ${done ? 'done' : 'progress'}`}>
          {done ? 'Concluído' : `Etapa ${STEP_NUMBER[plan.step]}/4`}
        </span>
      </div>

      <div className="figures">
        <div>
          <span className="label">Entradas</span>
          <strong className="tabular">{formatMoney(plan.totalIncome)}</strong>
        </div>
        <div>
          <span className="label">Saídas</span>
          <strong className="tabular">{formatMoney(plan.totalPlannedExpense)}</strong>
        </div>
        <div>
          <span className="label">Sobra</span>
          <strong
            className="tabular"
            style={{ color: plan.balance < 0 ? 'var(--critical)' : 'var(--good-ink)' }}
          >
            {formatMoney(plan.balance)}
          </strong>
        </div>
      </div>

      <div className="tiny muted">
        {done ? 'Planejamento concluído' : `Etapa atual: ${STEP_LABEL[plan.step]}`} ·{' '}
        {plan.totalAllocatedPercentage > 0
          ? `${formatPercent(plan.totalAllocatedPercentage)} distribuído`
          : 'sem distribuição'}
      </div>

      <div className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
        <Link className="btn secondary small" to={`/planejamentos/${plan.id}`}>
          Abrir
        </Link>
        <span className="spacer" />
        {confirming ? (
          <>
            <button type="button" className="btn ghost small" onClick={() => setConfirming(false)}>
              Cancelar
            </button>
            <button type="button" className="btn danger small" disabled={removing} onClick={() => void remove()}>
              {removing ? 'Excluindo…' : 'Confirmar exclusão'}
            </button>
          </>
        ) : (
          <button type="button" className="btn danger small" onClick={() => setConfirming(true)}>
            Excluir
          </button>
        )}
      </div>
    </article>
  );
}

function NewPlanDialog({
  existing,
  onClose,
  onCreated
}: {
  existing: PlanSummary[];
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [copyFrom, setCopyFrom] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const years = useMemo(
    () => Array.from({ length: 7 }, (_, index) => now.getFullYear() - 1 + index),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const taken = existing.some((plan) => plan.year === year && plan.month === month);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const plan = await api.plans.create({
        year,
        month,
        copyFromPlanId: copyFrom === '' ? undefined : Number(copyFrom)
      });
      onCreated(plan.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar o planejamento.');
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Novo planejamento"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="btn" onClick={() => void submit()} disabled={saving || taken}>
            {saving ? 'Criando…' : 'Começar'}
          </button>
        </>
      }
    >
      <ErrorBanner message={error} />

      <div className="row" style={{ gap: 12 }}>
        <div className="field" style={{ flex: 2 }}>
          <label htmlFor="new-plan-month">Mês</label>
          <select id="new-plan-month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="new-plan-year">Ano</label>
          <select id="new-plan-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="new-plan-copy">Copiar de (opcional)</label>
        <select
          id="new-plan-copy"
          value={copyFrom}
          onChange={(e) => setCopyFrom(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="">Começar do zero</option>
          {existing.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.label}
            </option>
          ))}
        </select>
        <span className="tiny muted">Traz entradas, distribuição e gastos previstos do mês escolhido.</span>
      </div>

      {taken && <div className="banner warn" style={{ margin: 0 }}>Esse mês já tem um planejamento.</div>}
    </Modal>
  );
}
