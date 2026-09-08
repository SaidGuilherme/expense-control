import { useState } from 'react';
import { api, ApiError } from '../../api/client';
import { ErrorBanner, MoneyInput } from '../../components/ui';
import { formatMoney } from '../../utils/format';
import type { IncomeSource } from '../../types';
import type { Draft } from '../PlanWizardPage';

interface Props {
  sources: IncomeSource[];
  draft: Draft;
  total: number;
  disabled: boolean;
  onChange: (draft: Draft) => void;
  onSourceCreated: () => Promise<void>;
}

export default function StepIncomes({ sources, draft, total, disabled, onChange, onSourceCreated }: Props) {
  const [newSource, setNewSource] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAmount = (sourceId: number, amount: number) => onChange({ ...draft, [sourceId]: amount });

  const createSource = async () => {
    const name = newSource.trim();
    if (!name) return;

    setCreating(true);
    setError(null);
    try {
      await api.incomeSources.create({ name });
      await onSourceCreated();
      setNewSource('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar a fonte.');
    } finally {
      setCreating(false);
    }
  };

  const filled = sources.filter((source) => (draft[source.id] ?? 0) > 0).length;

  return (
    <div className="split">
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Fontes de entrada</h2>
            <p className="small secondary-ink">Informe quanto você espera receber de cada fonte neste mês.</p>
          </div>
        </div>

        <div className="card-pad">
          <ErrorBanner message={error} onClose={() => setError(null)} />

          {sources.length === 0 ? (
            <p className="empty small">Nenhuma fonte cadastrada. Crie a primeira abaixo.</p>
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
              value={newSource}
              placeholder="Nova fonte de entrada (ex.: 13º salário)"
              aria-label="Nome da nova fonte de entrada"
              disabled={disabled || creating}
              onChange={(event) => setNewSource(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void createSource();
                }
              }}
            />
            <button
              type="button"
              className="btn secondary"
              disabled={disabled || creating || !newSource.trim()}
              onClick={() => void createSource()}
            >
              {creating ? 'Criando…' : '+ Adicionar'}
            </button>
          </div>
          <p className="tiny muted" style={{ marginTop: 8 }}>
            As fontes ficam salvas e são reaproveitadas em todos os meses.
          </p>
        </div>
      </section>

      <section className="stack">
        <div className="hero">
          <span className="label">Recebimento planejado do mês</span>
          <div className="value tabular">{formatMoney(total)}</div>
          <p className="small" style={{ marginTop: 4, color: 'var(--accent-ink)' }}>
            Soma de {filled} {filled === 1 ? 'fonte preenchida' : 'fontes preenchidas'}.
          </p>
        </div>

        <div className="card card-pad">
          <h3>Como funciona</h3>
          <ol className="small secondary-ink" style={{ paddingLeft: 18, marginTop: 8, lineHeight: 1.7 }}>
            <li>Você preenche o que espera receber no mês.</li>
            <li>Esse total vira a base para a distribuição por categoria.</li>
            <li>Depois de confirmar o gráfico, lança os gastos previstos.</li>
          </ol>
        </div>
      </section>
    </div>
  );
}
