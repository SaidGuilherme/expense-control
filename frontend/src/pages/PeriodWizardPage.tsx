import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { ErrorBanner } from '../components/ui';
import StepIncomes from './steps/StepIncomes';
import StepAllocation from './steps/StepAllocation';
import StepExpenses from './steps/StepExpenses';
import StepSummary from './steps/StepSummary';
import {
  cloneDrafts,
  composePreview,
  draftsFromDetail,
  emptyDrafts,
  sumDraft,
  toBatchMonth,
  type DraftSet
} from '../utils/preview';
import { MONTHS, formatMoney, monthLabel } from '../utils/format';
import {
  STEP_LABEL,
  STEP_ORDER,
  type Category,
  type ExpenseSource,
  type Goal,
  type IncomeSource,
  type PlanSummary
} from '../types';

/** 'padrao' ou a chave de um mês, no formato "2027-3". */
type Target = string;
const TEMPLATE: Target = 'padrao';

interface MonthSlot {
  key: Target;
  year: number;
  month: number;
  label: string;
  /** Criação: já tem planejamento, então fica de fora do período. */
  blocked: boolean;
}

const parseMonthParam = (value: string | null): { year: number; month: number } | null => {
  const match = /^(\d{4})-(\d{1,2})$/.exec(value ?? '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
};

export default function PeriodWizardPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const editIds = useMemo(
    () =>
      (params.get('editar') ?? '')
        .split(',')
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    [params]
  );

  const isEditing = editIds.length > 0;
  const start = parseMonthParam(params.get('inicio'));
  const end = parseMonthParam(params.get('fim'));
  const baseId = Number(params.get('base')) || 0;

  const [categories, setCategories] = useState<Category[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [expenseSources, setExpenseSources] = useState<ExpenseSource[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [existingPlans, setExistingPlans] = useState<PlanSummary[]>([]);

  /** Só na edição: como cada mês está hoje, para o botão "manter os valores atuais". */
  const [originals, setOriginals] = useState<Record<Target, DraftSet>>({});
  const [editSlots, setEditSlots] = useState<MonthSlot[]>([]);

  const [template, setTemplate] = useState<DraftSet>(emptyDrafts);
  const [overrides, setOverrides] = useState<Record<Target, DraftSet>>({});

  const [target, setTarget] = useState<Target>(TEMPLATE);
  const [viewStep, setViewStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadCatalogs = useCallback(async () => {
    const [cats, incomes, expenses, goalList] = await Promise.all([
      api.categories.list(),
      api.incomeSources.list(),
      api.expenseSources.list(),
      api.goals.list()
    ]);
    setCategories(cats);
    setIncomeSources(incomes);
    setExpenseSources(expenses);
    setGoals(goalList);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [plans] = await Promise.all([api.plans.list(), reloadCatalogs()]);
        if (cancelled) return;
        setExistingPlans(plans);

        if (isEditing) {
          const details = await Promise.all(editIds.map((id) => api.plans.get(id)));
          if (cancelled) return;

          const ordered = details.sort(
            (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month)
          );

          setEditSlots(
            ordered.map((detail) => ({
              key: `${detail.year}-${detail.month}`,
              year: detail.year,
              month: detail.month,
              label: detail.label,
              blocked: false
            }))
          );

          const snapshots: Record<Target, DraftSet> = {};
          ordered.forEach((detail) => {
            snapshots[`${detail.year}-${detail.month}`] = draftsFromDetail(detail);
          });
          setOriginals(snapshots);

          // O padrão começa do primeiro mês selecionado — é o ponto de partida
          // mais previsível para depois valer para todos.
          if (ordered.length > 0) setTemplate(draftsFromDetail(ordered[0]));
        } else if (baseId > 0) {
          // "Começar a partir de" só semeia o padrão; nada fica ligado àquele mês.
          const base = await api.plans.get(baseId);
          if (cancelled) return;
          setTemplate(draftsFromDetail(base));
        }

        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Falha ao carregar os dados.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isEditing, editIds, baseId, reloadCatalogs]);

  const slots = useMemo<MonthSlot[]>(() => {
    if (isEditing) return editSlots;
    if (!start || !end) return [];

    const from = start.year * 12 + (start.month - 1);
    const to = end.year * 12 + (end.month - 1);
    if (to < from || to - from + 1 > 36) return [];

    const taken = new Set(existingPlans.map((plan) => plan.year * 12 + (plan.month - 1)));
    const list: MonthSlot[] = [];

    for (let index = from; index <= to; index++) {
      const year = Math.floor(index / 12);
      const month = (index % 12) + 1;
      list.push({
        key: `${year}-${month}`,
        year,
        month,
        label: monthLabel(year, month),
        blocked: taken.has(index)
      });
    }

    return list;
  }, [isEditing, editSlots, start, end, existingPlans]);

  const openSlots = slots.filter((slot) => !slot.blocked);

  const current = target === TEMPLATE ? template : (overrides[target] ?? template);

  const patch = (changes: Partial<DraftSet>) => {
    if (target === TEMPLATE) {
      setTemplate((previous) => ({ ...previous, ...changes }));
      return;
    }
    // Primeiro toque no mês: parte de uma cópia do padrão e passa a divergir.
    setOverrides((previous) => ({
      ...previous,
      [target]: { ...cloneDrafts(previous[target] ?? template), ...changes }
    }));
  };

  const resetMonth = () => {
    setOverrides((previous) => {
      const next = { ...previous };
      delete next[target];
      return next;
    });
  };

  /** Edição: congela o mês nos valores que ele já tem gravados. */
  const keepCurrentValues = () => {
    const snapshot = originals[target];
    if (!snapshot) return;
    setOverrides((previous) => ({ ...previous, [target]: cloneDrafts(snapshot) }));
  };

  const totalIncome = sumDraft(current.income);
  const totalAllocated = sumDraft(current.allocation);
  const totalExpense = sumDraft(current.expense) + sumDraft(current.goal);

  // "Salvo apenas depois de cada etapa do padrão ser preenchida."
  const templateChecks = useMemo(() => {
    const income = sumDraft(template.income);
    const allocated = sumDraft(template.allocation);
    const spent = sumDraft(template.expense) + sumDraft(template.goal);

    return [
      { label: 'Entradas do padrão preenchidas', ok: income > 0 },
      { label: 'Distribuição do padrão definida (até 100%)', ok: allocated > 0 && allocated <= 100.01 },
      { label: 'Gastos previstos do padrão lançados', ok: spent > 0 }
    ];
  }, [template]);

  const templateReady = templateChecks.every((check) => check.ok);

  const blockingMessage = (): string | null => {
    if (viewStep === 1 && totalIncome <= 0) return 'Informe ao menos uma entrada para continuar.';
    if (viewStep === 2 && totalAllocated <= 0) return 'Distribua pelo menos uma porcentagem entre as categorias.';
    if (viewStep === 2 && totalAllocated > 100.01) return 'A soma das porcentagens não pode passar de 100%.';
    return null;
  };

  const move = (next: number) => {
    if (next > viewStep) {
      const blocked = blockingMessage();
      if (blocked) {
        setError(blocked);
        return;
      }
    }
    setError(null);
    setViewStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    if (saving || !templateReady || openSlots.length === 0) return;

    setSaving(true);
    setError(null);

    try {
      const payload = openSlots.map((slot) =>
        toBatchMonth(overrides[slot.key] ?? template, slot.year, slot.month)
      );

      let notice: string;

      if (isEditing) {
        const result = await api.plans.applyBatch(payload);
        const parts = [
          `${result.updatedCount} ${result.updatedCount === 1 ? 'mês atualizado' : 'meses atualizados'}`
        ];
        if (result.createdCount > 0) {
          parts.push(
            `${result.createdCount} ${result.createdCount === 1 ? 'mês criado' : 'meses criados'}`
          );
        }
        notice = `${parts.join(' · ')}.`;
      } else {
        const result = await api.plans.createBatch(payload);
        const parts = [
          `${result.createdCount} ${result.createdCount === 1 ? 'mês criado' : 'meses criados'}`
        ];
        if (result.skippedCount > 0) {
          parts.push(
            `${result.skippedCount} já ${result.skippedCount === 1 ? 'existia' : 'existiam'} e ${
              result.skippedCount === 1 ? 'foi preservado' : 'foram preservados'
            } (${result.skippedMonths.join(', ')})`
          );
        }
        notice = `${parts.join(' · ')}. Agora é só ajustar mês a mês.`;
      }

      navigate('/planejamentos', { state: { notice } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível gravar.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="page">
        <div className="card card-pad empty">Carregando…</div>
      </main>
    );
  }

  if (slots.length === 0) {
    return (
      <main className="page">
        <ErrorBanner
          message={
            isEditing
              ? 'Nenhum mês selecionado para editar.'
              : 'Período inválido. Volte e escolha o mês inicial e o final (no máximo 36 meses).'
          }
        />
        <button type="button" className="btn secondary" onClick={() => navigate('/planejamentos')}>
          Voltar para os planejamentos
        </button>
      </main>
    );
  }

  const title = isEditing
    ? `Editar ${openSlots.length} ${openSlots.length === 1 ? 'mês' : 'meses'} em conjunto`
    : `${MONTHS[start!.month - 1]} de ${start!.year} — ${MONTHS[end!.month - 1]} de ${end!.year}`;

  const currentSlot = slots.find((slot) => slot.key === target);
  const editingLabel = target === TEMPLATE ? 'Padrão do período' : (currentSlot?.label ?? '');
  const adjusted = Object.keys(overrides).length;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <button type="button" className="btn ghost small" onClick={() => navigate('/planejamentos')}>
            ← Planejamentos
          </button>
          <h1 style={{ marginTop: 6 }}>{title}</h1>
          <p className="subtitle">
            {isEditing ? (
              <>
                O padrão <strong>sobrescreve</strong> todos os meses selecionados; um mês ajustado
                mantém o que você definiu nele. Nada muda até você confirmar.
              </>
            ) : (
              <>
                {openSlots.length} {openSlots.length === 1 ? 'mês será criado' : 'meses serão criados'} com o
                padrão abaixo. Nada é gravado até você concluir.
              </>
            )}
          </p>
        </div>
      </div>

      <ErrorBanner message={error} onClose={() => setError(null)} />

      {/* Acima do indicador de etapa: o que está sendo editado. */}
      <div className="target-picker">
        <div className="field" style={{ flex: 1, minWidth: 220, maxWidth: 320 }}>
          <label htmlFor="period-target">Editando</label>
          <select
            id="period-target"
            value={target}
            disabled={saving}
            onChange={(event) => setTarget(event.target.value)}
          >
            <option value={TEMPLATE}>Padrão do período</option>
            <optgroup label={isEditing ? 'Meses selecionados' : 'Meses do período'}>
              {slots.map((slot) => (
                <option key={slot.key} value={slot.key} disabled={slot.blocked}>
                  {slot.label}
                  {slot.blocked ? ' — já existe' : overrides[slot.key] ? ' — ajustado' : ''}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="target-note">
          {target === TEMPLATE ? (
            <>
              O padrão vale para <strong>todos</strong> os meses{isEditing ? ' selecionados' : ' do período'}.
              {adjusted > 0 && ` ${adjusted} ${adjusted === 1 ? 'mês tem' : 'meses têm'} ajuste próprio.`}
            </>
          ) : overrides[target] ? (
            <>
              Este mês foi <strong>ajustado</strong> e sobrescreve o padrão.
              <button type="button" className="btn ghost small" style={{ marginLeft: 8 }} onClick={resetMonth}>
                Voltar ao padrão
              </button>
            </>
          ) : (
            <>
              Este mês está seguindo o padrão{isEditing ? ' e será sobrescrito por ele' : ''}.
              {isEditing && originals[target] && (
                <button
                  type="button"
                  className="btn ghost small"
                  style={{ marginLeft: 8 }}
                  onClick={keepCurrentValues}
                >
                  Manter os valores atuais
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <nav className="stepper" aria-label="Etapas do planejamento">
        {STEP_ORDER.map((step, index) => {
          const number = index + 1;
          return (
            <button
              key={step}
              type="button"
              className={`step-chip${number === viewStep ? ' current' : ''}`}
              disabled={saving}
              onClick={() => move(number)}
            >
              <span className="n">{number}</span>
              {STEP_LABEL[step]}
            </button>
          );
        })}
      </nav>

      {viewStep === 1 && (
        <StepIncomes
          sources={incomeSources}
          draft={current.income}
          total={totalIncome}
          disabled={saving}
          onChange={(income) => patch({ income })}
          onSourceCreated={reloadCatalogs}
        />
      )}

      {viewStep === 2 && (
        <StepAllocation
          categories={categories}
          draft={current.allocation}
          totalIncome={totalIncome}
          totalAllocated={totalAllocated}
          disabled={saving}
          onChange={(allocation) => patch({ allocation })}
          onCategoryCreated={reloadCatalogs}
        />
      )}

      {viewStep === 3 && (
        <StepExpenses
          categories={categories}
          expenseSources={expenseSources}
          goals={goals}
          allocation={current.allocation}
          draft={current.expense}
          goalDraft={current.goal}
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          disabled={saving}
          onChange={(expense) => patch({ expense })}
          onGoalChange={(goal) => patch({ goal })}
          onSourceCreated={reloadCatalogs}
        />
      )}

      {viewStep === 4 && (
        <div className="stack" style={{ gap: 20 }}>
          <div className={`card card-pad ${templateReady ? '' : 'checklist-pending'}`}>
            <h2>Antes de gravar</h2>
            <p className="small secondary-ink" style={{ marginTop: 4 }}>
              {isEditing
                ? 'Os meses só são sobrescritos depois que o padrão está completo.'
                : 'Os meses só são criados depois que o padrão do período está completo.'}
            </p>
            <ul className="checklist">
              {templateChecks.map((check) => (
                <li key={check.label} className={check.ok ? 'ok' : undefined}>
                  <span aria-hidden="true">{check.ok ? '✓' : '○'}</span>
                  {check.label}
                </li>
              ))}
            </ul>
            {!templateReady && (
              <p className="small muted" style={{ marginTop: 10 }}>
                Volte ao <strong>Padrão do período</strong> no seletor acima para completar o que falta.
              </p>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <h2>O que será gravado</h2>
              <span className="tiny muted">
                {openSlots.length} {openSlots.length === 1 ? 'mês' : 'meses'}
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Origem</th>
                    <th className="num">Entradas</th>
                    <th className="num">Saídas</th>
                    <th className="num">Sobra</th>
                  </tr>
                </thead>
                <tbody>
                  {openSlots.map((slot) => {
                    const drafts = overrides[slot.key] ?? template;
                    const income = sumDraft(drafts.income);
                    const spent = sumDraft(drafts.expense) + sumDraft(drafts.goal);
                    const own = Boolean(overrides[slot.key]);

                    return (
                      <tr key={slot.key}>
                        <td>{slot.label}</td>
                        <td>
                          <span className={`badge ${own ? 'progress' : ''}`}>
                            {own ? 'Ajuste do mês' : 'Padrão'}
                          </span>
                        </td>
                        <td className="num">{formatMoney(income)}</td>
                        <td className="num">{formatMoney(spent)}</td>
                        <td
                          className="num"
                          style={{
                            color: income - spent < 0 ? 'var(--critical)' : 'var(--good-ink)',
                            fontWeight: 600
                          }}
                        >
                          {formatMoney(income - spent)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <StepSummary
            plan={composePreview(
              current,
              { categories, incomeSources, expenseSources, goals },
              editingLabel,
              currentSlot?.year ?? start?.year ?? new Date().getFullYear(),
              currentSlot?.month ?? start?.month ?? 1
            )}
          />
        </div>
      )}

      <div className="wizard-footer">
        <button
          type="button"
          className="btn secondary"
          disabled={viewStep === 1 || saving}
          onClick={() => move(viewStep - 1)}
        >
          Voltar
        </button>

        <span className="spacer" />

        {viewStep < 4 ? (
          <button type="button" className="btn" disabled={saving} onClick={() => move(viewStep + 1)}>
            Avançar
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            disabled={saving || !templateReady}
            onClick={() => void save()}
            title={templateReady ? undefined : 'Complete as etapas do padrão primeiro'}
          >
            {saving
              ? 'Gravando…'
              : isEditing
                ? `Aplicar a ${openSlots.length} ${openSlots.length === 1 ? 'mês' : 'meses'}`
                : `Criar ${openSlots.length} ${openSlots.length === 1 ? 'mês' : 'meses'}`}
          </button>
        )}
      </div>
    </main>
  );
}
