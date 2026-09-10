import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { formatMoney, formatMoneyCompact } from '../utils/format';
import type { MonthOverview } from '../types';

/** Entradas e saídas usam as duas primeiras cores da paleta categórica. */
const INCOME_COLOR = '#2a78d6';
const EXPENSE_COLOR = '#eb6834';

interface TooltipProps {
  active?: boolean;
  payload?: { payload: MonthOverview }[];
}

function MonthTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const month = payload[0].payload;

  return (
    <div className="viz-tooltip">
      <div className="t-name">{month.monthName}</div>
      {month.hasPlan ? (
        <>
          <div className="t-value">
            <span className="swatch" style={{ background: INCOME_COLOR }} aria-hidden="true" /> Entradas{' '}
            {formatMoney(month.plannedIncome)}
          </div>
          <div className="t-value">
            <span className="swatch" style={{ background: EXPENSE_COLOR }} aria-hidden="true" /> Saídas{' '}
            {formatMoney(month.plannedExpense)}
          </div>
          <div className="t-value" style={{ marginTop: 4 }}>
            Sobra {formatMoney(month.balance)}
          </div>
        </>
      ) : (
        <div className="t-value">Sem planejamento</div>
      )}
    </div>
  );
}

/**
 * Entradas x saídas previstas em cada mês do ano. As duas séries dividem o
 * mesmo eixo — são a mesma unidade, então a comparação entre barras é direta.
 */
export default function MonthlyBars({ months }: { months: MonthOverview[] }) {
  const hasData = months.some((month) => month.plannedIncome > 0 || month.plannedExpense > 0);

  if (!hasData) {
    return (
      <div className="empty small" style={{ height: 260, display: 'grid', placeItems: 'center' }}>
        Nenhum mês planejado neste ano ainda.
      </div>
    );
  }

  return (
    <figure style={{ margin: 0 }}>
      <ul className="legend" style={{ listStyle: 'none', margin: '0 0 8px', padding: 0, flexDirection: 'row', gap: 16 }}>
        <li className="legend-item" style={{ flex: 'none' }}>
          <span className="swatch" style={{ background: INCOME_COLOR }} aria-hidden="true" />
          <span>Entradas previstas</span>
        </li>
        <li className="legend-item" style={{ flex: 'none' }}>
          <span className="swatch" style={{ background: EXPENSE_COLOR }} aria-hidden="true" />
          <span>Saídas previstas</span>
        </li>
      </ul>

      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={months} barGap={2} margin={{ top: 14, right: 4, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke="#e1e0d9" strokeDasharray="0" />
            <XAxis
              dataKey="shortName"
              tickLine={false}
              axisLine={{ stroke: '#c3c2b7' }}
              tick={{ fill: '#898781', fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tick={{ fill: '#898781', fontSize: 12 }}
              tickFormatter={(value: number) => formatMoneyCompact(value, false)}
            />
            <Tooltip
              content={<MonthTooltip />}
              cursor={{ fill: 'rgba(11, 11, 11, 0.04)' }}
              isAnimationActive={false}
            />
            <Bar dataKey="plannedIncome" name="Entradas" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="plannedExpense" name="Saídas" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
