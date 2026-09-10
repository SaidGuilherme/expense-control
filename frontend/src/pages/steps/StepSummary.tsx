import DonutChart, { DonutLegend, type Slice } from '../../components/DonutChart';
import { Stat } from '../../components/ui';
import { NEUTRAL_COLOR } from '../../utils/palette';
import { formatMoney, formatPercent } from '../../utils/format';
import type { PlanDetail } from '../../types';

export default function StepSummary({ plan }: { plan: PlanDetail }) {
  const slices: Slice[] = plan.categories
    .filter((category) => category.percentage > 0)
    .map((category) => ({
      key: `c${category.categoryId}`,
      name: category.categoryName,
      percentage: category.percentage,
      amount: category.budget,
      color: category.color
    }));

  if (plan.unallocatedPercentage > 0.009) {
    slices.push({
      key: 'unallocated',
      name: 'Não alocado',
      percentage: plan.unallocatedPercentage,
      amount: plan.unallocatedAmount,
      color: NEUTRAL_COLOR,
      muted: true
    });
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="stats">
        <Stat label="Entradas planejadas" value={formatMoney(plan.totalIncome)} />
        <Stat label="Gastos previstos" value={formatMoney(plan.totalPlannedExpense)} />
        <Stat
          label="Sobra do mês"
          value={formatMoney(plan.balance)}
          tone={plan.balance < 0 ? 'negative' : 'positive'}
        />
        <Stat
          label="Receita distribuída"
          value={formatPercent(plan.totalAllocatedPercentage)}
          hint={`${formatPercent(plan.unallocatedPercentage)} sem destino`}
        />
      </div>

      <div className="split chart-left">
        <div className="card card-pad chart-card">
          <h2>Distribuição planejada</h2>
          <DonutChart
            slices={slices}
            centerLabel="Receita"
            centerValue={formatMoney(plan.totalIncome)}
            height={280}
          />
          <DonutLegend slices={slices} />
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Orçamento x previsto</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th className="num">%</th>
                  <th className="num">Teto</th>
                  <th className="num">Previsto</th>
                  <th className="num">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {plan.categories.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">Nenhuma categoria com valores.</td>
                  </tr>
                )}
                {plan.categories.map((category) => (
                  <tr key={category.categoryId}>
                    <td>
                      <span className="row" style={{ gap: 8 }}>
                        <span className="swatch" style={{ background: category.color }} aria-hidden="true" />
                        {category.categoryName}
                      </span>
                    </td>
                    <td className="num">{formatPercent(category.percentage)}</td>
                    <td className="num">{formatMoney(category.budget)}</td>
                    <td className="num">{formatMoney(category.plannedExpense)}</td>
                    <td
                      className="num"
                      style={{ color: category.difference < 0 ? 'var(--critical)' : 'var(--good-ink)', fontWeight: 600 }}
                    >
                      {formatMoney(category.difference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="split">
        <div className="card">
          <div className="card-head">
            <h2>Entradas</h2>
            <span className="tabular secondary-ink">{formatMoney(plan.totalIncome)}</span>
          </div>
          <table className="data">
            <tbody>
              {plan.incomes.length === 0 && (
                <tr>
                  <td className="muted">Nenhuma entrada lançada.</td>
                </tr>
              )}
              {plan.incomes.map((income) => (
                <tr key={income.incomeSourceId}>
                  <td>{income.incomeSourceName}</td>
                  <td className="num">{formatMoney(income.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2>Gastos previstos</h2>
              {plan.totalGoalContribution > 0 && (
                <p className="tiny muted">
                  inclui {formatMoney(plan.totalGoalContribution)} direcionados a metas
                </p>
              )}
            </div>
            <span className="tabular secondary-ink">{formatMoney(plan.totalPlannedExpense)}</span>
          </div>
          <table className="data">
            <tbody>
              {plan.categories.every(
                (category) => category.expenses.length === 0 && category.goals.length === 0
              ) && (
                <tr>
                  <td className="muted">Nenhum gasto previsto lançado.</td>
                </tr>
              )}
              {plan.categories.flatMap((category) =>
                category.expenses.map((expense) => (
                  <tr key={expense.expenseSourceId}>
                    <td>
                      <span className="row" style={{ gap: 8 }}>
                        <span className="swatch" style={{ background: category.color }} aria-hidden="true" />
                        <span>
                          {expense.expenseSourceName}
                          <span className="tiny muted"> · {category.categoryName}</span>
                        </span>
                      </span>
                    </td>
                    <td className="num">{formatMoney(expense.amount)}</td>
                  </tr>
                ))
              )}
              {plan.categories.flatMap((category) =>
                category.goals.map((goal) => (
                  <tr key={`goal-${goal.goalId}`}>
                    <td>
                      <span className="row" style={{ gap: 8 }}>
                        <span className="swatch" style={{ background: category.color }} aria-hidden="true" />
                        <span>
                          {goal.goalName}
                          <span className="tiny muted"> · meta · {category.categoryName}</span>
                        </span>
                      </span>
                    </td>
                    <td className="num">{formatMoney(goal.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
