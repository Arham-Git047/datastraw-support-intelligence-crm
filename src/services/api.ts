import type { AIInsights, Ticket, TicketDraft, TicketStatus } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8080';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
  } catch (error) {
    throw new ApiError('Cannot reach the Support CRM API. Start the server and try again.', 0, error);
  }

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof body === 'object' && body && 'error' in body ? String(body.error) : `Request failed (${response.status})`;
    throw new ApiError(message, response.status, body);
  }

  return body as T;
}

export const api = {
  baseUrl: API_BASE_URL,

  health(): Promise<{ ok: boolean; service: string }> {
    return request('/health');
  },

  async listTickets(params?: { status?: 'All' | TicketStatus; search?: string }): Promise<Ticket[]> {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'All') query.set('status', params.status);
    if (params?.search?.trim()) query.set('search', params.search.trim());

    const rows = await request<Array<Ticket & { ai_insights?: AIInsights | null }>>(
      `/api/tickets${query.toString() ? `?${query.toString()}` : ''}`,
    );

    return rows.map((row) => ({
      ...row,
      notes: row.notes ?? [],
      timeline: row.timeline ?? [],
      ai_insights: row.ai_insights ?? undefined,
    }));
  },

  getTicket(ticketId: string): Promise<Ticket> {
    return request(`/api/tickets/${encodeURIComponent(ticketId)}`);
  },

  async createTicket(draft: TicketDraft): Promise<Ticket> {
    const created = await request<{ ticket_id: string; created_at: string }>('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(draft),
    });

    return this.getTicket(created.ticket_id);
  },

  async updateTicket(ticketId: string, payload: { status: TicketStatus; notes?: string }): Promise<Ticket> {
    await request(`/api/tickets/${encodeURIComponent(ticketId)}`, {
      method: 'PUT',
      body: JSON.stringify({ status: payload.status, notes: payload.notes || '' }),
    });

    return this.getTicket(ticketId);
  },

  analyzeTicket(ticketId: string): Promise<AIInsights> {
    return request(`/api/tickets/${encodeURIComponent(ticketId)}/analyze`, { method: 'POST', body: '{}' });
  },
};
