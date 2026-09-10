import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { ErrorBanner, Meter, Modal } from '../components/ui';
import { MONTHS, formatMoney, formatPercent } from '../utils/format';
import { STEP_LABEL, STEP_NUMBER, type PlanDetail, type PlanSummary } from '../types';

type ViewMode = 'cards' | 'lista';

const VIEW_KEY = 'controle-gastos:plans-view';

const readStoredView = (): ViewMode => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'lista' ? 'lista' : 'cards';
  } catch {
    return 'cards';
  }
};

export default function PlansPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [view, setView] = useState<ViewMode>(readStoredView);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  // O assistente de período volta para cá com o resultado da gravação.
  const [notice, setNotice] = useState<string | null>(
    (location.state as { notice?: string } | null)?.notice ?? null
  );

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

  useEffect(() => {
    if ((location.state as { notice?: string } | null)?.notice) {
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const toggleSelected = (planId: number) =>
    setSelected((current) =>
      current.includes(planId) ? current.filter((id) => id !== planId) : [...current, planId]
    );

  const selectAll = () => setSelected(plans.map((plan) => plan.id));

  // A ordem de envio segue o calendário, não a de clique.
  const editTogether = () => {
    const ordered = plans
      .filter((plan) => selected.includes(plan.id))
      .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))
      .map((plan) => plan.id);
    navigate(`/planejamentos/periodo?editar=${ordered.join(',')}`);
  };

  const changeView = (next: ViewMode) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* navegador sem storage: a preferência só não persiste */
    }
  };

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Planejamentos</h1>
          <p className="subtitle">Escolha um mês e planeje entradas, distribuição e gastos previstos.</p>
        </div>

        <div className="row" style={{ gap: 12 }}>
          <div className="segmented" role="group" aria-label="Modo de visualização">
            <button
              type="button"
              className={view === 'cards' ? 'current' : undefined}
              aria-pressed={view === 'cards'}
              onClick={() => changeView('cards')}
            >
              Cards
            </button>
            <button
              type="button"
              className={view === 'lista' ? 'current' : undefined}
              aria-pressed={view === 'lista'}
              onClick={() => changeView('lista')}
            >
              Lista
            </button>
          </div>

          <button type="button" className="btn" onClick={() => setCreating(true)}>
            + Novo planejamento
          </button>
        </div>
      </div>

      <ErrorBanner message={error} onClose={() => setError(null)} />

      {notice && (
        <div className="banner info">
          <span aria-hidden="true">✓</span>
          <span className="spacer">{notice}</span>
          <button type="button" className="btn ghost small" onClick={() => setNotice(null)}>
            fechar
          </button>
        </div>
      )}

      {selected.length > 0 && (
        <div className="selection-bar">
          <strong>
            {selected.length} {selected.length === 1 ? 'mês selecionado' : 'meses selecionados'}
          </strong>
          <span className="spacer" />
          {selected.length < plans.length && (
            <button type="button" className="btn ghost small" onClick={selectAll}>
              Selecionar todos
            </button>
          )}
          <button type="button" className="btn ghost small" onClick={() => setSelected([])}>
            Limpar
          </button>
          <button type="button" className="btn small" onClick={editTogether}>
            Editar em conjunto
          </button>
        </div>
      )}

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
      ) : view === 'cards' ? (
        <div className="grid grid-cards">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={selected.includes(plan.id)}
              onToggle={() => toggleSelected(plan.id)}
              onDeleted={load}
            />
          ))}
        </div>
      ) : (
        <div className="card">
          {plans.map((plan) => (
            <PlanRow
              key={plan.id}
              plan={plan}
              selected={selected.includes(plan.id)}
              onToggle={() => toggleSelected(plan.id)}
              onDeleted={load}
            />
          ))}
        </div>
      )}

      {creating && (
        <NewPlanDialog
          existing={plans}
          onClose={() => setCreating(false)}
          onCreated={(id) => navigate(`/planejamentos/${id}`)}
          onPeriod={(query) => navigate(`/planejamentos/periodo?${query}`)}
        />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ cards */

function PlanCard({
  plan,
  selected,
  onToggle,
  onDeleted
}: {
  plan: PlanSummary;
  selected: boolean;
  onToggle: () => void;
  onDeleted: () => Promise<void>;
}) {
  const done = plan.step === 'Concluido';

  return (
    <article className={`plan-card${selected ? ' selected' : ''}`}>
      <div className="row">
        <input
          type="checkbox"
          className="pick"
          checked={selected}
          onChange={onToggle}
          aria-label={`Selecionar ${plan.label}`}
        />
        <h2 style={{ flex: 1, minWidth: 0 }}>
          <Link to={`/planejamentos/${plan.id}`}>{plan.label}</Link>
        </h2>
        <span className={`badge ${done ? 'done' : 'progress'}`}>
          {done ? 'Concluído' : `Etapa ${STEP_NUMBER[plan.step]}/4`}
        </span>
      </div>

      <Figures plan={plan} />

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
        <DeleteButton planId={plan.id} onDeleted={onDeleted} />
      </div>
    </article>
  );
}

function Figures({ plan }: { plan: PlanSummary }) {
  return (
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
  );
}

function DeleteButton({ planId, onDeleted }: { planId: number; onDeleted: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    setRemoving(true);
    try {
      await api.plans.remove(planId);
      await onDeleted();
    } finally {
      setRemoving(false);
      setConfirming(false);
    }
  };

  if (!confirming) {
    return (
      <button type="button" className="btn danger small" onClick={() => setConfirming(true)}>
        Excluir
      </button>
    );
  }

  return (
    <>
      <button type="button" className="btn ghost small" onClick={() => setConfirming(false)}>
        Cancelar
      </button>
      <button type="button" className="btn danger small" disabled={removing} onClick={() => void remove()}>
        {removing ? 'Excluindo…' : 'Confirmar exclusão'}
      </button>
    </>
  );
}

/* ------------------------------------------------------------------ lista */

function PlanRow({
  plan,
  selected,
  onToggle,
  onDeleted
}: {
  plan: PlanSummary;
  selected: boolean;
  onToggle: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = plan.step === 'Concluido';

  // O detalhe só é buscado na primeira vez que a linha abre.
  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || detail || loading) return;

    setLoading(true);
    setError(null);
    try {
      setDetail(await api.plans.get(plan.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar o detalhe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`plan-row${selected ? ' selected' : ''}`}>
      <div className="plan-row-head">
        <button
          type="button"
          className="expander"
          aria-expanded={open}
          aria-label={open ? `Recolher ${plan.label}` : `Expandir ${plan.label}`}
          onClick={() => void toggle()}
        >
          <span aria-hidden="true" className={open ? 'open' : undefined}>
            ›
          </span>
        </button>

        <div className="plan-row-title">
          <Link to={`/planejamentos/${plan.id}`}>{plan.label}</Link>
          <span className={`badge ${done ? 'done' : 'progress'}`}>
            {done ? 'Concluído' : `Etapa ${STEP_NUMBER[plan.step]}/4`}
          </span>
        </div>

        <div className="plan-row-figures tabular">
          <span title="Entradas">{formatMoney(plan.totalIncome)}</span>
          <span title="Saídas previstas" className="muted">
            −{formatMoney(plan.totalPlannedExpense)}
          </span>
          <span
            title="Sobra"
            style={{ color: plan.balance < 0 ? 'var(--critical)' : 'var(--good-ink)', fontWeight: 600 }}
          >
            {formatMoney(plan.balance)}
          </span>
        </div>

        <input
          type="checkbox"
          className="pick pick-end"
          checked={selected}
          onChange={onToggle}
          aria-label={`Selecionar ${plan.label}`}
        />
      </div>

      {open && (
        <div className="plan-row-body">
          <ErrorBanner message={error} onClose={() => setError(null)} />

          {loading && <p className="small muted">Carregando detalhe…</p>}

          {detail && (
            <>
              <div className="split">
                <div>
                  <div className="subhead">Entradas</div>
                  {detail.incomes.length === 0 ? (
                    <p className="tiny muted">Nenhuma entrada lançada.</p>
                  ) : (
                    <table className="data compact">
                      <tbody>
                        {detail.incomes.map((income) => (
                          <tr key={income.incomeSourceId}>
                            <td>{income.incomeSourceName}</td>
                            <td className="num">{formatMoney(income.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div>
                  <div className="subhead">Categorias</div>
                  {detail.categories.length === 0 ? (
                    <p className="tiny muted">Distribuição ainda não definida.</p>
                  ) : (
                    detail.categories.map((category) => (
                      <div key={category.categoryId} style={{ padding: '6px 0' }}>
                        <div className="row tiny" style={{ gap: 8 }}>
                          <span className="swatch" style={{ background: category.color }} aria-hidden="true" />
                          <span style={{ flex: 1, minWidth: 0 }}>{category.categoryName}</span>
                          <span className="tabular muted">
                            {formatMoney(category.plannedExpense)} de {formatMoney(category.budget)}
                          </span>
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <Meter
                            ratio={category.budget > 0 ? category.plannedExpense / category.budget : 0}
                            color={category.difference < 0 ? 'var(--critical)' : category.color}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {detail.totalGoalContribution > 0 && (
                <>
                  <div className="subhead">Metas</div>
                  <table className="data compact">
                    <tbody>
                      {detail.categories.flatMap((category) =>
                        category.goals.map((goal) => (
                          <tr key={goal.goalId}>
                            <td>
                              {goal.goalName}
                              <span className="tiny muted"> · {category.categoryName}</span>
                            </td>
                            <td className="num">{formatMoney(goal.amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </>
              )}

              <div className="row" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                <Link className="btn secondary small" to={`/planejamentos/${plan.id}`}>
                  Abrir planejamento
                </Link>
                <span className="spacer" />
                <DeleteButton planId={plan.id} onDeleted={onDeleted} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- criar */

type CreateMode = 'mes' | 'intervalo';

function NewPlanDialog({
  existing,
  onClose,
  onCreated,
  onPeriod
}: {
  existing: PlanSummary[];
  onClose: () => void;
  onCreated: (id: number) => void;
  onPeriod: (query: string) => void;
}) {
  const now = new Date();
  const [mode, setMode] = useState<CreateMode>('mes');

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [endMonth, setEndMonth] = useState(12);
  const [endYear, setEndYear] = useState(now.getFullYear());

  const [copyFrom, setCopyFrom] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const years = useMemo(
    () => Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - 1 + index),
    []
  );

  const taken = existing.some((plan) => plan.year === year && plan.month === month);

  // Quantos meses o intervalo cobre e quantos realmente serão criados.
  const range = useMemo(() => {
    const start = year * 12 + (month - 1);
    const end = endYear * 12 + (endMonth - 1);
    const length = end - start + 1;
    if (length <= 0) return { length, willCreate: 0, alreadyThere: 0 };

    const takenIndexes = new Set(existing.map((plan) => plan.year * 12 + (plan.month - 1)));
    let alreadyThere = 0;
    for (let index = start; index <= end; index++) if (takenIndexes.has(index)) alreadyThere++;

    return { length, willCreate: length - alreadyThere, alreadyThere };
  }, [year, month, endYear, endMonth, existing]);

  const submit = async () => {
    setSaving(true);
    setError(null);

    try {
      const copyFromPlanId = copyFrom === '' ? undefined : Number(copyFrom);

      if (mode === 'mes') {
        const plan = await api.plans.create({ year, month, copyFromPlanId });
        onCreated(plan.id);
        return;
      }

      // O período não grava nada aqui: abre o assistente para montar o padrão.
      const query = new URLSearchParams({
        inicio: `${year}-${month}`,
        fim: `${endYear}-${endMonth}`
      });
      if (copyFromPlanId) query.set('base', String(copyFromPlanId));
      onPeriod(query.toString());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar o planejamento.');
      setSaving(false);
    }
  };

  const blocked =
    mode === 'mes' ? taken : range.length <= 0 || range.willCreate === 0 || range.length > 36;

  return (
    <Modal
      title="Novo planejamento"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="btn" onClick={() => void submit()} disabled={saving || blocked}>
            {saving
              ? 'Criando…'
              : mode === 'mes'
                ? 'Começar'
                : `Planejar ${range.willCreate} ${range.willCreate === 1 ? 'mês' : 'meses'}`}
          </button>
        </>
      }
    >
      <ErrorBanner message={error} />

      <div className="segmented full" role="group" aria-label="Tipo de criação">
        <button
          type="button"
          className={mode === 'mes' ? 'current' : undefined}
          aria-pressed={mode === 'mes'}
          onClick={() => setMode('mes')}
        >
          Um mês
        </button>
        <button
          type="button"
          className={mode === 'intervalo' ? 'current' : undefined}
          aria-pressed={mode === 'intervalo'}
          onClick={() => setMode('intervalo')}
        >
          Intervalo de meses
        </button>
      </div>

      <div className="row" style={{ gap: 12 }}>
        <div className="field" style={{ flex: 2 }}>
          <label htmlFor="new-plan-month">{mode === 'mes' ? 'Mês' : 'Mês inicial'}</label>
          <select id="new-plan-month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="new-plan-year">{mode === 'mes' ? 'Ano' : 'Ano inicial'}</label>
          <select id="new-plan-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      {mode === 'intervalo' && (
        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 2 }}>
            <label htmlFor="new-plan-end-month">Mês final</label>
            <select
              id="new-plan-end-month"
              value={endMonth}
              onChange={(e) => setEndMonth(Number(e.target.value))}
            >
              {MONTHS.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="new-plan-end-year">Ano final</label>
            <select
              id="new-plan-end-year"
              value={endYear}
              onChange={(e) => setEndYear(Number(e.target.value))}
            >
              {years.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="field">
        <label htmlFor="new-plan-copy">Padrão (opcional)</label>
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
        <span className="tiny muted">
          {mode === 'mes'
            ? 'Traz entradas, distribuição, gastos previstos e metas do mês escolhido.'
            : 'Só semeia o padrão do período no assistente — você ainda ajusta tudo antes de gravar.'}
        </span>
      </div>

      {mode === 'mes' && taken && (
        <div className="banner warn" style={{ margin: 0 }}>
          Esse mês já tem um planejamento.
        </div>
      )}

      {mode === 'intervalo' && (
        <div
          className={`banner ${range.length <= 0 || range.length > 36 || range.willCreate === 0 ? 'warn' : 'info'}`}
          style={{ margin: 0 }}
        >
          <span aria-hidden="true">ℹ</span>
          <span>
            {range.length <= 0
              ? 'O mês final precisa ser igual ou posterior ao inicial.'
              : range.length > 36
                ? `O intervalo tem ${range.length} meses; o máximo por vez é 36.`
                : range.willCreate === 0
                  ? 'Todos os meses do intervalo já têm planejamento.'
                  : `${range.length} ${range.length === 1 ? 'mês no intervalo' : 'meses no intervalo'}: ${
                      range.willCreate
                    } ${range.willCreate === 1 ? 'será criado' : 'serão criados'}${
                      range.alreadyThere > 0
                        ? ` e ${range.alreadyThere} ${
                            range.alreadyThere === 1 ? 'já existe e será preservado' : 'já existem e serão preservados'
                          }`
                        : ''
                    }.`}
          </span>
        </div>
      )}
    </Modal>
  );
}
