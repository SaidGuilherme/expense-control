import { useMemo, useState } from 'react';
import { api, ApiError } from '../../api/client';
import { ErrorBanner, Meter, MoneyInput, Stat } from '../../components/ui';
import DonutChart, { DonutLegend, type Slice } from '../../components/DonutChart';
import { formatMoney, formatPercent } from '../../utils/format';
import type { Category, ExpenseSource } from '../../types';
import type { Draft } from '../PlanWizardPage';

interface Props {
  categories: Category[];
  expenseSources: ExpenseSource[];
  allocation: Draft;
  draft: Draft;
  totalIncome: number;
  totalExpense: number;
  disabled: boolean;
  onChange: (draft: Draft) => void;
  onSourceCreated: () => Promise<void>;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export default function StepExpenses({
  categories,
  expenseSources,
  allocation,
  draft,
  totalIncome,
  totalExpense,
  disabled,
  onChange,
  onSourceCreated
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [newSource, setNewSource] = useState<Record<number, string>>({});
  const [creatingIn, setCreatingIn] = useState<number | null>(null);

  const setAmount = (sourceId: number, amount: number) => onChange({ ...draft, [sourceId]: amount });

  const blocks = useMemo(() => {
    const sourcesByCategory = new Map<number, ExpenseSource[]>();
    expenseSources.forEach((source) => {
      const list = sourcesByCategory.get(source.categoryId) ?? [];
      list.push(source);
      sourcesByCategory.set(source.categoryId, list);
    });

    return categories
      .map((category) => {
        const percentage = allocation[category.id] ?? 0;
        const sources = sourcesByCategory.get(category.id) ?? [];
        const planned = round2(sources.reduce((total, source) => total + (draft[source.id] ?? 0), 0));

        return {
          category,
          percentage,
          sources,
          budget: round2((totalIncome * percentage) / 100),
          planned
        };
      })
      .filter((block) => block.percentage > 0 || block.planned > 0)
      .sort((a, b) => b.percentage - a.percentage);
  }, [categories, expenseSources, allocation, draft, totalIncome]);

  const slices = useMemo<Slice[]>(
    () =>
      blocks
        .filter((block) => block.planned > 0)
        .map<Slice>((block) => ({
          key: `c${block.category.id}`,
          name: block.category.name,
          percentage: totalExpense > 0 ? round2((block.planned / totalExpense) * 100) : 0,
          amount: block.planned,
          color: block.category.color
        }))
        .sort((a, b) => b.percentage - a.percentage),
    [blocks, totalExpense]
  );

  const createSource = async (categoryId: number) => {
    const name = (newSource[categoryId] ?? '').trim();
    if (!name) return;

    setCreatingIn(categoryId);
    setError(null);
    try {
      await api.expenseSources.create({ name, categoryId });
      await onSourceCreated();
      setNewSource((current) => ({ ...current, [categoryId]: '' }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar a fonte de saída.');
    } finally {
      setCreatingIn(null);
    }
  };

  const balance = round2(totalIncome - totalExpense);

  return (
    <div className="split">
      <section>
        <ErrorBanner message={error} onClose={() => setError(null)} />

        {blocks.length === 0 && (
          <div className="card empty">
            Nenhuma categoria recebeu porcentagem. Volte para a etapa anterior e distribua a receita.
          </div>
        )}

        {blocks.map(({ category, percentage, sources, budget, planned }) => {
          const left = round2(budget - planned);
          const over = left < 0;

          return (
            <article className="category-block" key={category.id}>
              <header>
                <span className="swatch" style={{ background: category.color }} aria-hidden="true" />
                <h3 style={{ flex: 1, minWidth: 120 }}>{category.name}</h3>
                <span className="tiny muted">{formatPercent(percentage)} · teto {formatMoney(budget)}</span>
              </header>

              <div className="body">
                <div style={{ padding: '10px 0 4px' }}>
                  <Meter
                    ratio={budget > 0 ? planned / budget : 0}
                    color={over ? 'var(--critical)' : category.color}
                  />
                  <div className="row tiny" style={{ marginTop: 6 }}>
                    <span className="muted">Previsto {formatMoney(planned)}</span>
                    <span className="spacer" />
                    <span style={{ color: over ? 'var(--critical)' : 'var(--good-ink)', fontWeight: 600 }}>
                      {over ? `${formatMoney(Math.abs(left))} acima do teto` : `${formatMoney(left)} disponível`}
                    </span>
                  </div>
                </div>

                {sources.length === 0 ? (
                  <p className="tiny muted" style={{ padding: '8px 0' }}>
                    Nenhuma fonte de saída nesta categoria ainda.
                  </p>
                ) : (
                  sources.map((source) => (
                    <div className="line-item" key={source.id}>
                      <div className="name">
                        <span>{source.name}</span>
                      </div>
                      <MoneyInput
                        value={draft[source.id] ?? 0}
                        onChange={(value) => setAmount(source.id, value)}
                        ariaLabel={`Valor previsto de ${source.name}`}
                        disabled={disabled}
                      />
                      <button
                        type="button"
                        className="btn ghost small"
                        title="Zerar valor"
                        aria-label={`Zerar ${source.name}`}
                        disabled={disabled || (draft[source.id] ?? 0) === 0}
                        onClick={() => setAmount(source.id, 0)}
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}

                <div className="add-inline">
                  <input
                    type="text"
                    value={newSource[category.id] ?? ''}
                    placeholder={`Nova fonte em ${category.name}`}
                    aria-label={`Nome da nova fonte de saída em ${category.name}`}
                    disabled={disabled || creatingIn === category.id}
                    onChange={(event) =>
                      setNewSource((current) => ({ ...current, [category.id]: event.target.value }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void createSource(category.id);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn secondary small"
                    disabled={disabled || creatingIn === category.id || !(newSource[category.id] ?? '').trim()}
                    onClick={() => void createSource(category.id)}
                  >
                    {creatingIn === category.id ? 'Criando…' : '+ Adicionar'}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="stack" style={{ position: 'sticky', top: 76 }}>
        <div className="stats" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Stat label="Receita planejada" value={formatMoney(totalIncome)} />
          <Stat
            label="Sobra"
            value={formatMoney(balance)}
            tone={balance < 0 ? 'negative' : 'positive'}
            hint={balance < 0 ? 'Gastos previstos acima da receita' : 'Receita menos gastos previstos'}
          />
        </div>

        <div className="card card-pad chart-card">
          <h2>Gastos previstos por categoria</h2>
          <DonutChart
            slices={slices}
            centerLabel="Total previsto"
            centerValue={formatMoney(totalExpense)}
            emptyMessage="Lance os valores previstos para ver o gráfico."
          />
          <DonutLegend slices={slices} />
          <p className="chart-note">Participação de cada categoria no total já lançado.</p>
        </div>
      </section>
    </div>
  );
}
