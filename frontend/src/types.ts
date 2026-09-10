export type PlanStep = 'Entradas' | 'Alocacao' | 'Saidas' | 'Concluido';

export const STEP_ORDER: PlanStep[] = ['Entradas', 'Alocacao', 'Saidas', 'Concluido'];

export const STEP_NUMBER: Record<PlanStep, number> = {
  Entradas: 1,
  Alocacao: 2,
  Saidas: 3,
  Concluido: 4
};

export const STEP_LABEL: Record<PlanStep, string> = {
  Entradas: 'Entradas',
  Alocacao: 'Distribuição',
  Saidas: 'Gastos previstos',
  Concluido: 'Resumo'
};

export interface Category {
  id: number;
  name: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  expenseSourceCount: number;
}

export interface IncomeSource {
  id: number;
  name: string;
  isActive: boolean;
}

export interface ExpenseSource {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  isActive: boolean;
}

export interface PlanSummary {
  id: number;
  year: number;
  month: number;
  label: string;
  step: PlanStep;
  totalIncome: number;
  totalAllocatedPercentage: number;
  totalPlannedExpense: number;
  balance: number;
  updatedAt: string;
}

export interface PlannedIncome {
  incomeSourceId: number;
  incomeSourceName: string;
  amount: number;
}

export interface PlannedExpense {
  expenseSourceId: number;
  expenseSourceName: string;
  categoryId: number;
  categoryName: string;
  amount: number;
}

export interface CategoryBreakdown {
  categoryId: number;
  categoryName: string;
  color: string;
  percentage: number;
  budget: number;
  plannedExpense: number;
  difference: number;
  expenses: PlannedExpense[];
}

export interface MonthOverview {
  month: number;
  monthName: string;
  shortName: string;
  hasPlan: boolean;
  planId: number | null;
  step: PlanStep | null;
  plannedIncome: number;
  plannedExpense: number;
  balance: number;
}

export interface CategoryYearTotal {
  categoryId: number;
  categoryName: string;
  color: string;
  plannedExpense: number;
  shareOfExpense: number;
  monthlyAverage: number;
}

export interface YearOverview {
  year: number;
  availableYears: number[];
  plannedMonths: number;
  totalIncome: number;
  totalExpense: number;
  totalBalance: number;
  averageMonthlyIncome: number;
  averageMonthlyExpense: number;
  averageMonthlyBalance: number;
  highestExpenseMonthAmount: number;
  highestExpenseMonthName: string | null;
  months: MonthOverview[];
  categories: CategoryYearTotal[];
}

export interface PlanDetail {
  id: number;
  year: number;
  month: number;
  label: string;
  step: PlanStep;
  notes?: string | null;
  incomes: PlannedIncome[];
  totalIncome: number;
  categories: CategoryBreakdown[];
  totalAllocatedPercentage: number;
  unallocatedPercentage: number;
  unallocatedAmount: number;
  totalPlannedExpense: number;
  balance: number;
  createdAt: string;
  updatedAt: string;
}
