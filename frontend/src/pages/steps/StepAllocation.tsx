import { useMemo, useState } from 'react';
import { api, ApiError } from '../../api/client';
import { ErrorBanner, PercentInput } from '../../components/ui';
import DonutChart, { DonutLegend, type Slice } from '../../components/DonutChart';
import { CATEGORY_PALETTE, NEUTRAL_COLOR } from '../../utils/palette';
import { formatMoney, formatPercent } from '../../utils/format';
import type { Category } from '../../types';
import type { Draft } from '../PlanWizardPage';

interface Props {
  categories: Category[];
  draft: Draft;
  totalIncome: number;
  totalAllocated: number;
  disabled: boolean;
  onChange: (draft: Draft) => void;
  onCategoryCreated: () => Promise<void>;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export default function StepAllocation({
  categories,
  draft,
  totalIncome,
  totalAllocated,
  disabled,
  onChange,
  onCategoryCreated
}: Props) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(CATEGORY_PALETTE[0]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = round2(100 - totalAllocated);
  const overAllocated = totalAllocated > 100.01;

  const slices = useMemo<Slice[]>(() => {
    const used = categories
      .filter((category) => (draft[category.id] ?? 0) > 0)
      .map<Slice>((category) => ({
        key: `c${category.id}`,
        name: category.name,
        percentage: draft[category.id] ?? 0,
        amount: round2((totalIncome * (draft[category.id] ?? 0)) / 100),
        color: category.color
      }))
      .sort((a, b) => b.percentage - a.percentage);

    if (remaining > 0.009) {
      used.push({
        key: 'unallocated',
        name: 'Não alocado',
        percentage: remaining,
        amount: round2((totalIncome * remaining) / 100),
        color: NEUTRAL_COLOR,
        muted: true
      });
    }

    return used;
  }, [categories, draft, totalIncome, remaining]);

  const setPercentage = (categoryId: number, percentage: number) =>
    onChange({ ...draft, [categoryId]: round2(percentage) });

  const distributeRemaining = () => {
    const targets = categories.filter((category) => (draft[category.id] ?? 0) > 0);
    if (targets.length === 0 || remaining <= 0) return;

    const share = round2(remaining / targets.length);
    const next: Draft = { ...draft };
    targets.forEach((category, index) => {
      const extra = index === targets.length - 1 ? round2(remaining - share * (targets.length - 1)) : share;
      next[category.id] = round2((next[category.id] ?? 0) + extra);
    });
    onChange(next);
  };

  const clearAll = () => {
    const next: Draft = {};
    categories.forEach((category) => (next[category.id] = 0));
    onChange(next);
  };

  const createCategory = async () => {
    const name = newName.trim();
    if (!name) return;

    setCreating(true);
    setError(null);
    try {
      await api.categories.create({ name, color: newColor });
      await onCategoryCreated();
      setNewName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar a categoria.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="split">
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Distribuição por categoria</h2>
            <p className="small secondary-ink">
              Sobre {formatMoney(totalIncome)} de receita planejada.
            </p>
          </div>
          <div className="row">
            <button type="button" className="btn ghost small" disabled={disabled} onClick={clearAll}>
              Zerar
            </button>
            <button
              type="button"
              className="btn secondary small"
              disabled={disabled || remaining <= 0}
              onClick={distributeRemaining}
            >
              Distribuir restante
            </button>
          </div>
        </div>

        <div className="card-pad">
          <ErrorBanner message={error} onClose={() => setError(null)} />

          {categories.map((category) => {
            const percentage = draft[category.id] ?? 0;
            const amount = round2((totalIncome * percentage) / 100);

            return (
              <div className="alloc-item" key={category.id}>
                <div className="name row" style={{ minWidth: 0 }}>
                  <span className="swatch" style={{ background: category.color }} aria-hidden="true" />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {category.name}
                  </span>
                </div>

                <PercentInput
                  value={percentage}
                  onChange={(next) => setPercentage(category.id, next)}
                  ariaLabel={`Porcentagem de ${category.name}`}
                  disabled={disabled}
                />

                <input
                  className="slider"
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={percentage}
                  disabled={disabled}
                  aria-label={`Ajustar porcentagem de ${category.name}`}
                  onChange={(event) => setPercentage(category.id, Number(event.target.value))}
                />

                <div className="meta">
                  <span>{formatPercent(percentage)} da receita</span>
                  <span className="tabular">{formatMoney(amount)}</span>
                </div>
              </div>
            );
          })}

          <div className="add-inline">
            <input
              type="text"
              value={newName}
              placeholder="Nova categoria (ex.: Pets)"
              aria-label="Nome da nova categoria"
              disabled={disabled || creating}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void createCategory();
                }
              }}
            />
            <button
              type="button"
              className="btn secondary"
              disabled={disabled || creating || !newName.trim()}
              onClick={() => void createCategory()}
            >
              {creating ? 'Criando…' : '+ Adicionar'}
            </button>
          </div>

          <div className="row wrap" style={{ marginTop: 10 }}>
            <span className="tiny muted">Cor:</span>
            <div className="color-picker">
              {CATEGORY_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="color-dot"
                  style={{ background: color }}
                  aria-label={`Usar a cor ${color}`}
                  aria-pressed={newColor === color}
                  onClick={() => setNewColor(color)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="stack" style={{ position: 'sticky', top: 76 }}>
        <div className="card card-pad chart-card">
          <div className="row">
            <h2 style={{ flex: 1 }}>Gráfico de pizza</h2>
            <span className={`badge ${overAllocated ? '' : 'progress'}`}
                  style={overAllocated ? { background: '#fbeded', color: '#8f2020' } : undefined}>
              {formatPercent(totalAllocated)} distribuído
            </span>
          </div>

          <DonutChart
            slices={slices}
            centerLabel="Distribuído"
            centerValue={formatPercent(Math.min(totalAllocated, 100))}
          />

          <DonutLegend slices={slices} />

          <p className="chart-note">
            Atualiza conforme você digita. A fatia cinza é a parte da receita ainda não distribuída.
          </p>
        </div>

        {overAllocated ? (
          <div className="banner error" style={{ margin: 0 }}>
            <span aria-hidden="true">⚠</span>
            <span>A soma passou de 100%. Reduza {formatPercent(round2(totalAllocated - 100))} para continuar.</span>
          </div>
        ) : remaining > 0.009 ? (
          <div className="banner info" style={{ margin: 0 }}>
            <span aria-hidden="true">ℹ</span>
            <span>
              Ainda restam {formatPercent(remaining)} ({formatMoney(round2((totalIncome * remaining) / 100))}) sem
              destino. Você pode seguir assim — vira sobra planejada.
            </span>
          </div>
        ) : (
          <div className="banner info" style={{ margin: 0, background: '#e8f6e8', color: 'var(--good-ink)', borderColor: '#cfe8cf' }}>
            <span aria-hidden="true">✓</span>
            <span>100% da receita distribuída. Confirme para lançar os gastos previstos.</span>
          </div>
        )}
      </section>
    </div>
  );
}
