import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { ErrorBanner } from '../components/ui';
import StepIncomes from './steps/StepIncomes';
import StepAllocation from './steps/StepAllocation';
import StepExpenses from './steps/StepExpenses';
import StepSummary from './steps/StepSummary';
import { STEP_LABEL, STEP_NUMBER, STEP_ORDER, type Category, type ExpenseSource, type IncomeSource, type PlanDetail } from '../types';

export type Draft = Record<number, number>;

const sum = (draft: Draft) => Object.values(draft).reduce((total, value) => total + (value || 0), 0);

export default function PlanWizardPage() {
  const { id } = useParams<{ id: string }>();
  const planId = Number(id);
  const navigate = useNavigate();

  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [expenseSources, setExpenseSources] = useState<ExpenseSource[]>([]);

  const [incomeDraft, setIncomeDraft] = useState<Draft>({});
  const [allocationDraft, setAllocationDraft] = useState<Draft>({});
  const [expenseDraft, setExpenseDraft] = useState<Draft>({});

  const [viewStep, setViewStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Reidrata os rascunhos a partir do que o servidor devolveu. */
  const applyPlan = useCallback((next: PlanDetail, moveView = false) => {
    setPlan(next);

    const incomes: Draft = {};
    next.incomes.forEach((income) => (incomes[income.incomeSourceId] = income.amount));
    setIncomeDraft(incomes);

    const allocations: Draft = {};
    next.categories.forEach((category) => (allocations[category.categoryId] = category.percentage));
    setAllocationDraft(allocations);

    const expenses: Draft = {};
    next.categories.forEach((category) =>
      category.expenses.forEach((expense) => (expenses[expense.expenseSourceId] = expense.amount))
    );
    setExpenseDraft(expenses);

    if (moveView) setViewStep(STEP_NUMBER[next.step]);
  }, []);

  const reloadCatalogs = useCallback(async () => {
    const [cats, incomes, expenses] = await Promise.all([
      api.categories.list(),
      api.incomeSources.list(),
      api.expenseSources.list()
    ]);
    setCategories(cats);
    setIncomeSources(incomes);
    setExpenseSources(expenses);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [detail] = await Promise.all([api.plans.get(planId), reloadCatalogs()]);
        if (cancelled) return;
        applyPlan(detail, true);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Falha ao carregar o planejamento.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [planId, applyPlan, reloadCatalogs]);

  const totalIncome = useMemo(() => sum(incomeDraft), [incomeDraft]);
  const totalAllocated = useMemo(() => sum(allocationDraft), [allocationDraft]);
  const totalExpense = useMemo(() => sum(expenseDraft), [expenseDraft]);

  /** Persiste o rascunho da etapa que está aberta e devolve o plano atualizado. */
  const saveCurrentStep = useCallback(async (): Promise<PlanDetail> => {
    if (!plan) throw new ApiError('Planejamento não carregado.', 0);

    switch (viewStep) {
      case 1:
        return api.plans.setIncomes(
          plan.id,
          Object.entries(incomeDraft).map(([sourceId, amount]) => ({
            incomeSourceId: Number(sourceId),
            amount
          }))
        );
      case 2:
        return api.plans.setAllocations(
          plan.id,
          Object.entries(allocationDraft).map(([categoryId, percentage]) => ({
            categoryId: Number(categoryId),
            percentage
          }))
        );
      case 3:
        return api.plans.setExpenses(
          plan.id,
          Object.entries(expenseDraft).map(([sourceId, amount]) => ({
            expenseSourceId: Number(sourceId),
            amount
          }))
        );
      default:
        return plan;
    }
  }, [plan, viewStep, incomeDraft, allocationDraft, expenseDraft]);

  const blockingMessage = (): string | null => {
    if (viewStep === 1 && totalIncome <= 0) return 'Informe ao menos uma entrada para continuar.';
    if (viewStep === 2 && totalAllocated <= 0) return 'Distribua pelo menos uma porcentagem entre as categorias.';
    if (viewStep === 2 && totalAllocated > 100.01) return 'A soma das porcentagens não pode passar de 100%.';
    return null;
  };

  const move = async (target: number) => {
    if (!plan || busy) return;

    if (target > viewStep) {
      const blocked = blockingMessage();
      if (blocked) {
        setError(blocked);
        return;
      }
    }

    setBusy(true);
    setError(null);

    try {
      let updated = await saveCurrentStep();

      // O progresso salvo no servidor só avança; voltar é apenas navegação.
      if (target > STEP_NUMBER[updated.step]) {
        updated = await api.plans.setStep(plan.id, target);
      }

      applyPlan(updated);
      setViewStep(target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar esta etapa.');
    } finally {
      setBusy(false);
    }
  };

  const saveOnly = async () => {
    if (!plan || busy) return;
    setBusy(true);
    setError(null);
    try {
      applyPlan(await saveCurrentStep());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <main className="page"><div className="card card-pad empty">Carregando…</div></main>;

  if (!plan) {
    return (
      <main className="page">
        <ErrorBanner message={error ?? 'Planejamento não encontrado.'} />
        <button type="button" className="btn secondary" onClick={() => navigate('/planejamentos')}>
          Voltar para a lista
        </button>
      </main>
    );
  }

  const reachedStep = STEP_NUMBER[plan.step];

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <button type="button" className="btn ghost small" onClick={() => navigate('/planejamentos')}>
            ← Planejamentos
          </button>
          <h1 style={{ marginTop: 6 }}>{plan.label}</h1>
          <p className="subtitle">Etapa {viewStep} de 4 · {STEP_LABEL[STEP_ORDER[viewStep - 1]]}</p>
        </div>
      </div>

      <nav className="stepper" aria-label="Etapas do planejamento">
        {STEP_ORDER.map((step, index) => {
          const number = index + 1;
          const unlocked = number <= Math.max(reachedStep, viewStep);
          return (
            <button
              key={step}
              type="button"
              className={`step-chip${number === viewStep ? ' current' : ''}${number < reachedStep ? ' complete' : ''}`}
              disabled={!unlocked || busy}
              onClick={() => void move(number)}
            >
              <span className="n">{number < reachedStep ? '✓' : number}</span>
              {STEP_LABEL[step]}
            </button>
          );
        })}
      </nav>

      <ErrorBanner message={error} onClose={() => setError(null)} />

      {viewStep === 1 && (
        <StepIncomes
          sources={incomeSources}
          draft={incomeDraft}
          total={totalIncome}
          disabled={busy}
          onChange={setIncomeDraft}
          onSourceCreated={reloadCatalogs}
        />
      )}

      {viewStep === 2 && (
        <StepAllocation
          categories={categories}
          draft={allocationDraft}
          totalIncome={totalIncome}
          totalAllocated={totalAllocated}
          disabled={busy}
          onChange={setAllocationDraft}
          onCategoryCreated={reloadCatalogs}
        />
      )}

      {viewStep === 3 && (
        <StepExpenses
          categories={categories}
          expenseSources={expenseSources}
          allocation={allocationDraft}
          draft={expenseDraft}
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          disabled={busy}
          onChange={setExpenseDraft}
          onSourceCreated={reloadCatalogs}
        />
      )}

      {viewStep === 4 && <StepSummary plan={plan} />}

      <div className="wizard-footer">
        <button
          type="button"
          className="btn secondary"
          disabled={viewStep === 1 || busy}
          onClick={() => void move(viewStep - 1)}
        >
          Voltar
        </button>

        {viewStep < 4 && (
          <button type="button" className="btn ghost" disabled={busy} onClick={() => void saveOnly()}>
            Salvar
          </button>
        )}

        <span className="spacer" />

        {viewStep < 4 ? (
          <button type="button" className="btn" disabled={busy} onClick={() => void move(viewStep + 1)}>
            {busy ? 'Salvando…' : viewStep === 3 ? 'Concluir planejamento' : 'Confirmar e avançar'}
          </button>
        ) : (
          <button type="button" className="btn secondary" onClick={() => navigate('/planejamentos')}>
            Ir para a lista
          </button>
        )}
      </div>
    </main>
  );
}
