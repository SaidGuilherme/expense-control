import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatMoney, formatPercent } from '../utils/format';

export interface Slice {
  key: string;
  name: string;
  /** Fatia do gráfico, em porcentagem. */
  percentage: number;
  /** Valor em reais correspondente à fatia. */
  amount: number;
  color: string;
  /** Fatia neutra "não alocado" — recebe cinza e sai do foco. */
  muted?: boolean;
}

interface TooltipPayload {
  payload?: { payload: Slice }[];
  active?: boolean;
}

function SliceTooltip({ active, payload }: TooltipPayload) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;

  return (
    <div className="viz-tooltip">
      <div className="t-name">
        <span className="swatch" style={{ background: slice.color }} aria-hidden="true" />
        {slice.name}
      </div>
      <div className="t-value">
        {formatPercent(slice.percentage)} · {formatMoney(slice.amount)}
      </div>
    </div>
  );
}

interface DonutChartProps {
  slices: Slice[];
  centerLabel: string;
  centerValue: string;
  height?: number;
  emptyMessage?: string;
}

/**
 * Gráfico de pizza (rosca) da distribuição do mês. As fatias são separadas por
 * um vão de 2px na cor da superfície para permanecerem legíveis lado a lado.
 */
export default function DonutChart({
  slices,
  centerLabel,
  centerValue,
  height = 260,
  emptyMessage = 'Defina as porcentagens para ver o gráfico.'
}: DonutChartProps) {
  const drawable = slices.filter((slice) => slice.percentage > 0);
  const hasData = drawable.length > 0;

  return (
    <figure style={{ margin: 0, position: 'relative' }}>
      <div style={{ height }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<SliceTooltip />} isAnimationActive={false} />
              <Pie
                data={drawable}
                dataKey="percentage"
                nameKey="name"
                innerRadius="58%"
                outerRadius="88%"
                paddingAngle={1}
                startAngle={90}
                endAngle={-270}
                isAnimationActive={false}
                stroke="#fcfcfb"
                strokeWidth={2}
              >
                {drawable.map((slice) => (
                  <Cell key={slice.key} fill={slice.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty small" style={{ height, display: 'grid', placeItems: 'center' }}>
            {emptyMessage}
          </div>
        )}
      </div>

      {hasData && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
            textAlign: 'center'
          }}
        >
          <div>
            <div className="label">{centerLabel}</div>
            <div className="tabular" style={{ fontSize: '1.25rem', fontWeight: 680, letterSpacing: '-0.02em' }}>
              {centerValue}
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}

/** Legenda em lista — também serve como visualização tabular das fatias. */
export function DonutLegend({ slices }: { slices: Slice[] }) {
  if (!slices.length) return null;

  return (
    <ul className="legend" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {slices.map((slice) => (
        <li key={slice.key} className="legend-item">
          <span className="swatch" style={{ background: slice.color }} aria-hidden="true" />
          <span className={`name${slice.muted ? ' muted' : ''}`}>{slice.name}</span>
          <span className="tabular secondary-ink">{formatPercent(slice.percentage)}</span>
          <span className="tabular" style={{ minWidth: 96, textAlign: 'right' }}>
            {formatMoney(slice.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}
