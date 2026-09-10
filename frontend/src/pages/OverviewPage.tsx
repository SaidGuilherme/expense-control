import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { ErrorBanner, Meter, Stat } from '../components/ui';
import MonthlyBars from '../components/MonthlyBars';
import { formatMoney, formatPercent } from '../utils/format';
import { STEP_NUMBER, type YearOverview } from '../types';

export default function OverviewPage() {
  const [overview, setOverview] = useState<YearOverview | null>(null);
  const [year, setYear] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (target?: number) => {
    setLoading(true);
    try {
      const data = await api.overview.get(target);
      setOverview(data);
      setYear(data.year);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar o resumo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !overview) {
    return (
      <main className="page">
        <div className="card card-pad empty">Carregando…</div>
      </main>
    );
  }

  if (!overview) {
    return (
      <main className="page">
        <ErrorBanner message={error} onClose={() => setError(null)} />
      </main>
    );
  }

  const { plannedMonths } = overview;
  const perMonthHint = (value: number) =>
    plannedMonths === 0 ? 'nenhum mês planejado' : `${formatMoney(value)} por mês`;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Resumo anual</h1>
          <p className="subtitle">
            Quanto está previsto entrar e sair em {overview.year}, no ano e por mês.
          </p>
        </div>

        <div className="field" style={{ minWidth: 130 }}>
          <label htmlFor="overview-year">Ano</label>
          <select
            id="overview-year"
            value={year ?? overview.year}
            disabled={loading}
            onChange={(event) => void load(Number(event.target.value))}
          >
            {overview.availableYears.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ErrorBanner message={error} onClose={() => setError(null)} />

      {plannedMonths === 0 ? (
        <div className="card empty">
          <h2>Nenhum mês planejado em {overview.year}</h2>
          <p className="secondary-ink" style={{ marginTop: 6 }}>
            Assim que você planejar o primeiro mês, os totais do ano aparecem aqui.
          </p>
          <Link className="btn" style={{ marginTop: 16 }} to="/planejamentos">
            Ir para os planejamentos
          </Link>
        </div>
      ) : (
        <div className="stack" style={{ gap: 20 }}>
          <div className="stats">
            <Stat
              label="Entradas previstas no ano"
              value={formatMoney(overview.totalIncome)}
              hint={perMonthHint(overview.averageMonthlyIncome)}
            />
            <Stat
              label="Saídas previstas no ano"
              value={formatMoney(overview.totalExpense)}
              hint={
                overview.totalGoalContribution > 0
                  ? `${perMonthHint(overview.averageMonthlyExpense)} · ${formatMoney(
                      overview.totalGoalContribution
                    )} em metas`
                  : perMonthHint(overview.averageMonthlyExpense)
              }
            />
            <Stat
              label="Sobra prevista no ano"
              value={formatMoney(overview.totalBalance)}
              tone={overview.totalBalance < 0 ? 'negative' : 'positive'}
              hint={perMonthHint(overview.averageMonthlyBalance)}
            />
            <Stat
              label="Meses planejados"
              value={`${plannedMonths} de 12`}
              hint={
                overview.highestExpenseMonthName
                  ? `maior gasto em ${overview.highestExpenseMonthName}`
                  : 'nenhum gasto lançado'
              }
            />
          </div>

          <p className="tiny muted" style={{ marginTop: -8 }}>
            As médias por mês dividem o total do ano pelos {plannedMonths}{' '}
            {plannedMonths === 1 ? 'mês já planejado' : 'meses já planejados'} — meses em branco não
            entram na conta.
          </p>

          <div className="card card-pad chart-card">
            <h2>Entradas e saídas mês a mês</h2>
            <MonthlyBars months={overview.months} />
          </div>

          <div className="split table-left">
            <div className="card">
              <div className="card-head">
                <h2>Por mês</h2>
                <span className="tiny muted">Clique no mês para abrir o planejamento</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th className="num">Entradas</th>
                      <th className="num">Saídas</th>
                      <th className="num">Sobra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.months.map((month) => (
                      <tr key={month.month} className={month.hasPlan ? undefined : 'row-empty'}>
                        <td>
                          {month.planId ? (
                            <Link to={`/planejamentos/${month.planId}`}>{month.monthName}</Link>
                          ) : (
                            <span className="muted">{month.monthName}</span>
                          )}
                          {month.hasPlan && month.step && month.step !== 'Concluido' && (
                            <span className="tiny muted"> · etapa {STEP_NUMBER[month.step]}/4</span>
                          )}
                        </td>
                        <td className="num">{month.hasPlan ? formatMoney(month.plannedIncome) : '—'}</td>
                        <td className="num">{month.hasPlan ? formatMoney(month.plannedExpense) : '—'}</td>
                        <td
                          className="num"
                          style={{
                            color: month.hasPlan
                              ? month.balance < 0
                                ? 'var(--critical)'
                                : 'var(--good-ink)'
                              : undefined,
                            fontWeight: month.hasPlan ? 600 : undefined
                          }}
                        >
                          {month.hasPlan ? formatMoney(month.balance) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>Total do ano</th>
                      <th className="num">{formatMoney(overview.totalIncome)}</th>
                      <th className="num">{formatMoney(overview.totalExpense)}</th>
                      <th className="num">{formatMoney(overview.totalBalance)}</th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h2>Gasto por categoria no ano</h2>
              </div>
              <div className="card-pad">
                {overview.categories.length === 0 ? (
                  <p className="small muted">Nenhum gasto previsto lançado em {overview.year}.</p>
                ) : (
                  overview.categories.map((category) => (
                    <div key={category.categoryId} style={{ padding: '10px 0' }}>
                      <div className="row" style={{ gap: 8 }}>
                        <span className="swatch" style={{ background: category.color }} aria-hidden="true" />
                        <span style={{ flex: 1, minWidth: 0 }}>{category.categoryName}</span>
                        <span className="tabular small">{formatMoney(category.plannedExpense)}</span>
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <Meter ratio={category.shareOfExpense / 100} color={category.color} />
                      </div>
                      <div className="row tiny muted" style={{ marginTop: 5 }}>
                        <span>{formatPercent(category.shareOfExpense)} do total</span>
                        <span className="spacer" />
                        <span className="tabular">{formatMoney(category.monthlyAverage)} por mês</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {overview.goals.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h2>Metas</h2>
                <span className="tiny muted">
                  {formatMoney(overview.totalGoalContribution)} direcionados em {overview.year}
                </span>
              </div>
              <div className="card-pad goals-grid">
                {overview.goals.map((goal) => (
                  <div key={goal.id}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="swatch" style={{ background: goal.categoryColor }} aria-hidden="true" />
                      <span style={{ flex: 1, minWidth: 0 }}>{goal.name}</span>
                      <span className="tabular small">{formatPercent(goal.progressPercent)}</span>
                    </div>

                    <div style={{ marginTop: 6 }}>
                      <Meter
                        ratio={goal.progressPercent / 100}
                        color={
                          goal.isAchieved
                            ? 'var(--good)'
                            : goal.isLate
                              ? 'var(--critical)'
                              : goal.categoryColor
                        }
                      />
                    </div>

                    <div className="row tiny" style={{ marginTop: 5 }}>
                      <span className="muted tabular">
                        {formatMoney(goal.contributedAmount)} de {formatMoney(goal.targetAmount)}
                      </span>
                      <span className="spacer" />
                      {goal.isAchieved ? (
                        <span style={{ color: 'var(--good-ink)', fontWeight: 600 }}>batida</span>
                      ) : goal.isLate ? (
                        <span style={{ color: 'var(--critical)', fontWeight: 600 }}>
                          venceu em {goal.targetLabel}
                        </span>
                      ) : (
                        <span className="muted">
                          {formatMoney(goal.suggestedMonthlyAmount)}/mês até {goal.targetLabel}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
