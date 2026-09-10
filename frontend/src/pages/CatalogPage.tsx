import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { ErrorBanner, Meter, MoneyInput } from '../components/ui';
import { CATEGORY_PALETTE } from '../utils/palette';
import { MONTHS, formatMoney, formatPercent } from '../utils/format';
import type { Category, ExpenseSource, Goal, IncomeSource } from '../types';

type Tab = 'categorias' | 'entradas' | 'saidas' | 'metas';

export default function CatalogPage() {
  const [tab, setTab] = useState<Tab>('categorias');
  const [categories, setCategories] = useState<Category[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [expenseSources, setExpenseSources] = useState<ExpenseSource[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
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
    (async () => {
      try {
        await reload();
        setError(null);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Falha ao carregar os cadastros.');
      } finally {
        setLoading(false);
      }
    })();
  }, [reload]);

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    }
  };

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Cadastros</h1>
          <p className="subtitle">
            Categorias, fontes e metas ficam salvas e são reaproveitadas em todos os meses.
          </p>
        </div>
      </div>

      <nav className="stepper" aria-label="Seções de cadastro">
        {(
          [
            ['categorias', 'Categorias'],
            ['entradas', 'Fontes de entrada'],
            ['saidas', 'Fontes de saída'],
            ['metas', 'Metas']
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`step-chip${tab === value ? ' current' : ''}`}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      <ErrorBanner message={error} onClose={() => setError(null)} />

      {loading ? (
        <div className="card card-pad empty">Carregando…</div>
      ) : tab === 'categorias' ? (
        <CategoriesTab categories={categories} run={run} />
      ) : tab === 'entradas' ? (
        <IncomeSourcesTab sources={incomeSources} run={run} />
      ) : tab === 'saidas' ? (
        <ExpenseSourcesTab categories={categories} sources={expenseSources} run={run} />
      ) : (
        <GoalsTab categories={categories} goals={goals} run={run} />
      )}
    </main>
  );
}

type Runner = (action: () => Promise<unknown>) => Promise<void>;

/* ------------------------------------------------------------- categorias */

function CategoriesTab({ categories, run }: { categories: Category[]; run: Runner }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_PALETTE[0]);

  return (
    <div className="card">
      <div className="card-head">
        <h2>Categorias</h2>
        <span className="tiny muted">{categories.length} ativas</span>
      </div>

      <div className="card-pad">
        {categories.map((category) => (
          <div className="line-item" key={category.id} style={{ gridTemplateColumns: 'minmax(0,1fr) auto 36px' }}>
            <div className="name">
              <span className="swatch" style={{ background: category.color }} aria-hidden="true" />
              <input
                type="text"
                defaultValue={category.name}
                aria-label={`Nome da categoria ${category.name}`}
                onBlur={(event) => {
                  const value = event.target.value.trim();
                  if (value && value !== category.name) {
                    void run(() => api.categories.update(category.id, { name: value, color: category.color }));
                  }
                }}
              />
            </div>

            <div className="color-picker">
              {CATEGORY_PALETTE.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="color-dot"
                  style={{ background: option, width: 18, height: 18 }}
                  aria-label={`Cor ${option} para ${category.name}`}
                  aria-pressed={category.color.toLowerCase() === option}
                  onClick={() => void run(() => api.categories.update(category.id, { name: category.name, color: option }))}
                />
              ))}
            </div>

            <button
              type="button"
              className="btn danger small"
              aria-label={`Remover ${category.name}`}
              title="Remover (se já foi usada, apenas desativa)"
              onClick={() => void run(() => api.categories.remove(category.id))}
            >
              ×
            </button>
          </div>
        ))}

        <div className="add-inline">
          <input
            type="text"
            value={name}
            placeholder="Nova categoria"
            aria-label="Nome da nova categoria"
            onChange={(event) => setName(event.target.value)}
          />
          <button
            type="button"
            className="btn secondary"
            disabled={!name.trim()}
            onClick={() =>
              void run(async () => {
                await api.categories.create({ name: name.trim(), color });
                setName('');
              })
            }
          >
            + Adicionar
          </button>
        </div>

        <div className="row wrap" style={{ marginTop: 10 }}>
          <span className="tiny muted">Cor da nova categoria:</span>
          <div className="color-picker">
            {CATEGORY_PALETTE.map((option) => (
              <button
                key={option}
                type="button"
                className="color-dot"
                style={{ background: option }}
                aria-label={`Usar a cor ${option}`}
                aria-pressed={color === option}
                onClick={() => setColor(option)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- entradas */

function IncomeSourcesTab({ sources, run }: { sources: IncomeSource[]; run: Runner }) {
  const [name, setName] = useState('');

  return (
    <div className="card">
      <div className="card-head">
        <h2>Fontes de entrada</h2>
        <span className="tiny muted">{sources.length} ativas</span>
      </div>

      <div className="card-pad">
        {sources.map((source) => (
          <div className="line-item" key={source.id} style={{ gridTemplateColumns: 'minmax(0,1fr) 36px' }}>
            <input
              type="text"
              defaultValue={source.name}
              aria-label={`Nome da fonte ${source.name}`}
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (value && value !== source.name) {
                  void run(() => api.incomeSources.update(source.id, { name: value }));
                }
              }}
            />
            <button
              type="button"
              className="btn danger small"
              aria-label={`Remover ${source.name}`}
              title="Remover (se já foi usada, apenas desativa)"
              onClick={() => void run(() => api.incomeSources.remove(source.id))}
            >
              ×
            </button>
          </div>
        ))}

        <div className="add-inline">
          <input
            type="text"
            value={name}
            placeholder="Nova fonte de entrada"
            aria-label="Nome da nova fonte de entrada"
            onChange={(event) => setName(event.target.value)}
          />
          <button
            type="button"
            className="btn secondary"
            disabled={!name.trim()}
            onClick={() =>
              void run(async () => {
                await api.incomeSources.create({ name: name.trim() });
                setName('');
              })
            }
          >
            + Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- saídas */

function ExpenseSourcesTab({
  categories,
  sources,
  run
}: {
  categories: Category[];
  sources: ExpenseSource[];
  run: Runner;
}) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  return (
    <div>
      {categories.length === 0 && (
        <div className="card empty">Crie uma categoria antes de cadastrar fontes de saída.</div>
      )}

      {categories.map((category) => {
        const owned = sources.filter((source) => source.categoryId === category.id);

        return (
          <article className="category-block" key={category.id}>
            <header>
              <span className="swatch" style={{ background: category.color }} aria-hidden="true" />
              <h3 style={{ flex: 1 }}>{category.name}</h3>
              <span className="tiny muted">
                {owned.length} {owned.length === 1 ? 'fonte' : 'fontes'}
              </span>
            </header>

            <div className="body">
              {owned.length === 0 && <p className="tiny muted" style={{ padding: '8px 0' }}>Nenhuma fonte aqui.</p>}

              {owned.map((source) => (
                <div className="line-item" key={source.id} style={{ gridTemplateColumns: 'minmax(0,1fr) 36px' }}>
                  <input
                    type="text"
                    defaultValue={source.name}
                    aria-label={`Nome da fonte ${source.name}`}
                    onBlur={(event) => {
                      const value = event.target.value.trim();
                      if (value && value !== source.name) {
                        void run(() =>
                          api.expenseSources.update(source.id, { name: value, categoryId: category.id })
                        );
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn danger small"
                    aria-label={`Remover ${source.name}`}
                    title="Remover (se já foi usada, apenas desativa)"
                    onClick={() => void run(() => api.expenseSources.remove(source.id))}
                  >
                    ×
                  </button>
                </div>
              ))}

              <div className="add-inline">
                <input
                  type="text"
                  value={drafts[category.id] ?? ''}
                  placeholder={`Nova fonte em ${category.name}`}
                  aria-label={`Nome da nova fonte em ${category.name}`}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [category.id]: event.target.value }))
                  }
                />
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={!(drafts[category.id] ?? '').trim()}
                  onClick={() =>
                    void run(async () => {
                      await api.expenseSources.create({
                        name: (drafts[category.id] ?? '').trim(),
                        categoryId: category.id
                      });
                      setDrafts((current) => ({ ...current, [category.id]: '' }));
                    })
                  }
                >
                  + Adicionar
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- metas */

function GoalsTab({
  categories,
  goals,
  run
}: {
  categories: Category[];
  goals: Goal[];
  run: Runner;
}) {
  const now = new Date();
  const [name, setName] = useState('');
  const [target, setTarget] = useState(0);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear() + 1);
  const [categoryId, setCategoryId] = useState<number | ''>('');

  const years = Array.from({ length: 11 }, (_, index) => now.getFullYear() + index);
  const canCreate = name.trim().length > 0 && target > 0 && categoryId !== '';

  const create = () =>
    void run(async () => {
      await api.goals.create({
        name: name.trim(),
        targetAmount: target,
        targetYear: year,
        targetMonth: month,
        categoryId: Number(categoryId)
      });
      setName('');
      setTarget(0);
    });

  return (
    <div className="split table-left">
      <div className="card">
        <div className="card-head">
          <h2>Metas</h2>
          <span className="tiny muted">
            {goals.length} {goals.length === 1 ? 'meta ativa' : 'metas ativas'}
          </span>
        </div>

        <div className="card-pad">
          {goals.length === 0 ? (
            <p className="empty small">
              Nenhuma meta ainda. Crie a primeira ao lado — depois é só direcionar um valor a ela
              na etapa de gastos previstos de cada mês.
            </p>
          ) : (
            goals.map((goal) => (
              <div className="goal-item" key={goal.id}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="swatch" style={{ background: goal.categoryColor }} aria-hidden="true" />
                  <input
                    type="text"
                    defaultValue={goal.name}
                    aria-label={`Nome da meta ${goal.name}`}
                    onBlur={(event) => {
                      const value = event.target.value.trim();
                      if (value && value !== goal.name) {
                        void run(() =>
                          api.goals.update(goal.id, {
                            name: value,
                            targetAmount: goal.targetAmount,
                            targetYear: goal.targetYear,
                            targetMonth: goal.targetMonth,
                            categoryId: goal.categoryId
                          })
                        );
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn danger small"
                    aria-label={`Remover ${goal.name}`}
                    title="Remover (se já recebeu aporte, apenas desativa)"
                    onClick={() => void run(() => api.goals.remove(goal.id))}
                  >
                    ×
                  </button>
                </div>

                <div className="row tiny muted" style={{ marginTop: 6 }}>
                  <span>
                    {goal.categoryName} · prazo {goal.targetLabel}
                  </span>
                  <span className="spacer" />
                  <span className="tabular">
                    {formatMoney(goal.contributedAmount)} de {formatMoney(goal.targetAmount)}
                  </span>
                </div>

                <div style={{ marginTop: 6 }}>
                  <Meter
                    ratio={goal.progressPercent / 100}
                    color={goal.isAchieved ? 'var(--good)' : goal.isLate ? 'var(--critical)' : goal.categoryColor}
                  />
                </div>

                <div className="row tiny" style={{ marginTop: 5 }}>
                  <span className="muted">{formatPercent(goal.progressPercent)}</span>
                  <span className="spacer" />
                  {goal.isAchieved ? (
                    <span style={{ color: 'var(--good-ink)', fontWeight: 600 }}>Meta batida</span>
                  ) : goal.isLate ? (
                    <span style={{ color: 'var(--critical)', fontWeight: 600 }}>
                      Prazo vencido · faltam {formatMoney(goal.remainingAmount)}
                    </span>
                  ) : (
                    <span className="muted">
                      {formatMoney(goal.suggestedMonthlyAmount)}/mês por {goal.monthsRemaining}{' '}
                      {goal.monthsRemaining === 1 ? 'mês' : 'meses'}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Nova meta</h2>
        </div>

        <div className="card-pad stack" style={{ gap: 14 }}>
          {categories.length === 0 && (
            <div className="banner warn" style={{ margin: 0 }}>
              Crie uma categoria antes — a meta precisa de uma para ocupar o teto do mês.
            </div>
          )}

          <div className="field">
            <label htmlFor="goal-name">Nome</label>
            <input
              id="goal-name"
              type="text"
              value={name}
              placeholder="Ex.: Reserva de emergência"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="goal-target">Valor a atingir</label>
            <MoneyInput value={target} onChange={setTarget} ariaLabel="Valor da meta" />
          </div>

          <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 2 }}>
              <label htmlFor="goal-month">Mês de conclusão</label>
              <select id="goal-month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((label, index) => (
                  <option key={label} value={index + 1}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="goal-year">Ano</label>
              <select id="goal-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="goal-category">Categoria</label>
            <select
              id="goal-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value === '' ? '' : Number(event.target.value))}
            >
              <option value="">Escolha uma categoria…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <span className="tiny muted">O aporte da meta ocupa o teto desta categoria no mês.</span>
          </div>

          <button type="button" className="btn" disabled={!canCreate} onClick={create}>
            Criar meta
          </button>
        </div>
      </div>
    </div>
  );
}
