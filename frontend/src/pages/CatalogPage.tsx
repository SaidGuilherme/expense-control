import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { ErrorBanner } from '../components/ui';
import { CATEGORY_PALETTE } from '../utils/palette';
import type { Category, ExpenseSource, IncomeSource } from '../types';

type Tab = 'categorias' | 'entradas' | 'saidas';

export default function CatalogPage() {
  const [tab, setTab] = useState<Tab>('categorias');
  const [categories, setCategories] = useState<Category[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [expenseSources, setExpenseSources] = useState<ExpenseSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
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
            Categorias e fontes ficam salvas e são reaproveitadas em todos os meses.
          </p>
        </div>
      </div>

      <nav className="stepper" aria-label="Seções de cadastro">
        {(
          [
            ['categorias', 'Categorias'],
            ['entradas', 'Fontes de entrada'],
            ['saidas', 'Fontes de saída']
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
      ) : (
        <ExpenseSourcesTab categories={categories} sources={expenseSources} run={run} />
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
