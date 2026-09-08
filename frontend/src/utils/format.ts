const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const decimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export const formatMoney = (value: number): string => currency.format(Number.isFinite(value) ? value : 0);

export const formatMoneyInput = (value: number): string =>
  value === 0 ? '' : decimal.format(value);

export const formatPercent = (value: number): string =>
  `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

/**
 * Aceita "1.234,56", "1234,56" e "1234.56".
 * Se houver vírgula, o ponto é separador de milhar; caso contrário o ponto é decimal.
 */
export function parseMoney(text: string): number {
  const cleaned = text.replace(/[^\d.,-]/g, '').trim();
  if (!cleaned) return 0;

  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 0;
}

export function parsePercent(text: string): number {
  const value = parseMoney(text);
  return Math.min(100, Math.max(0, value));
}

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const monthLabel = (year: number, month: number) => `${MONTHS[month - 1]} de ${year}`;
