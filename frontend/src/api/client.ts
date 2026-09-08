import type {
  Category,
  ExpenseSource,
  IncomeSource,
  PlanDetail,
  PlanSummary
} from '../types';

/**
 * Sempre relativo: em dev o Vite faz proxy de /api para a API .NET,
 * em produção o nginx do container do frontend faz o mesmo.
 */
const BASE = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) }
    });
  } catch {
    throw new ApiError('Não foi possível falar com o servidor. Verifique se a API está no ar.', 0);
  }

  if (!response.ok) {
    let detail = `Erro ${response.status}.`;
    try {
      const body = await response.json();
      detail = body.detail || body.title || detail;
    } catch {
      /* resposta sem corpo JSON */
    }
    throw new ApiError(detail, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const body = (data: unknown) => JSON.stringify(data);

export const api = {
  // ---------- catálogos reutilizáveis ----------
  categories: {
    list: (includeInactive = false) =>
      request<Category[]>(`/categories?includeInactive=${includeInactive}`),
    create: (input: { name: string; color?: string }) =>
      request<Category>('/categories', { method: 'POST', body: body(input) }),
    update: (id: number, input: { name: string; color?: string; isActive?: boolean }) =>
      request<Category>(`/categories/${id}`, { method: 'PUT', body: body(input) }),
    remove: (id: number) => request<void>(`/categories/${id}`, { method: 'DELETE' })
  },

  incomeSources: {
    list: (includeInactive = false) =>
      request<IncomeSource[]>(`/income-sources?includeInactive=${includeInactive}`),
    create: (input: { name: string }) =>
      request<IncomeSource>('/income-sources', { method: 'POST', body: body(input) }),
    update: (id: number, input: { name: string; isActive?: boolean }) =>
      request<IncomeSource>(`/income-sources/${id}`, { method: 'PUT', body: body(input) }),
    remove: (id: number) => request<void>(`/income-sources/${id}`, { method: 'DELETE' })
  },

  expenseSources: {
    list: (categoryId?: number, includeInactive = false) =>
      request<ExpenseSource[]>(
        `/expense-sources?includeInactive=${includeInactive}` +
          (categoryId ? `&categoryId=${categoryId}` : '')
      ),
    create: (input: { name: string; categoryId: number }) =>
      request<ExpenseSource>('/expense-sources', { method: 'POST', body: body(input) }),
    update: (id: number, input: { name: string; categoryId: number; isActive?: boolean }) =>
      request<ExpenseSource>(`/expense-sources/${id}`, { method: 'PUT', body: body(input) }),
    remove: (id: number) => request<void>(`/expense-sources/${id}`, { method: 'DELETE' })
  },

  // ---------- planejamento mensal ----------
  plans: {
    list: () => request<PlanSummary[]>('/plans'),
    get: (id: number) => request<PlanDetail>(`/plans/${id}`),
    create: (input: { year: number; month: number; copyFromPlanId?: number }) =>
      request<PlanDetail>('/plans', { method: 'POST', body: body(input) }),
    remove: (id: number) => request<void>(`/plans/${id}`, { method: 'DELETE' }),

    setIncomes: (id: number, items: { incomeSourceId: number; amount: number }[]) =>
      request<PlanDetail>(`/plans/${id}/incomes`, { method: 'PUT', body: body({ items }) }),

    setAllocations: (id: number, items: { categoryId: number; percentage: number }[]) =>
      request<PlanDetail>(`/plans/${id}/allocations`, { method: 'PUT', body: body({ items }) }),

    setExpenses: (id: number, items: { expenseSourceId: number; amount: number }[]) =>
      request<PlanDetail>(`/plans/${id}/expenses`, { method: 'PUT', body: body({ items }) }),

    setStep: (id: number, step: number) =>
      request<PlanDetail>(`/plans/${id}/step`, { method: 'POST', body: body({ step }) })
  }
};
