import { seedTickets } from '../data';
import type { Ticket, TicketDraft, TicketStatus } from '../types';
import { api, ApiError } from './api';

const KEY = 'datastraw-support-crm-tickets-v1';
export const DRAFT_KEY = 'datastraw-support-crm-ticket-draft-v1';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function localLoad(): Ticket[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    const initial = clone(seedTickets);
    localStorage.setItem(KEY, JSON.stringify(initial));
    return initial;
  }

  try {
    return JSON.parse(raw) as Ticket[];
  } catch {
    return clone(seedTickets);
  }
}

function localSave(tickets: Ticket[]) {
  localStorage.setItem(KEY, JSON.stringify(tickets));
  window.dispatchEvent(new Event('tickets-changed'));
}

export const isRemoteStorage = true;

export const storage = {
  async list(params?: { status?: 'All' | TicketStatus; search?: string }): Promise<Ticket[]> {
    return api.listTickets(params);
  },

  async get(ticketId: string): Promise<Ticket | undefined> {
    try {
      return await api.getTicket(ticketId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return undefined;
      throw error;
    }
  },

  async create(draft: TicketDraft): Promise<Ticket> {
    const ticket = await api.createTicket(draft);
    window.dispatchEvent(new Event('tickets-changed'));
    return ticket;
  },

  async updateStatus(ticketId: string, status: TicketStatus): Promise<Ticket | undefined> {
    const current = await this.get(ticketId);
    if (!current) return undefined;
    const ticket = await api.updateTicket(ticketId, { status });
    window.dispatchEvent(new Event('tickets-changed'));
    return ticket;
  },

  async addNote(ticketId: string, noteText: string): Promise<Ticket | undefined> {
    const current = await this.get(ticketId);
    if (!current) return undefined;
    const ticket = await api.updateTicket(ticketId, { status: current.status, notes: noteText });
    window.dispatchEvent(new Event('tickets-changed'));
    return ticket;
  },

  async saveAI(ticketId: string, _insights: Ticket['ai_insights']): Promise<Ticket | undefined> {
    const current = await this.get(ticketId);
    if (!current) return undefined;
    await api.analyzeTicket(ticketId);
    const ticket = await this.get(ticketId);
    window.dispatchEvent(new Event('tickets-changed'));
    return ticket;
  },

  saveDraft(draft: TicketDraft) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  },

  getDraft(): TicketDraft | null {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? (JSON.parse(raw) as TicketDraft) : null;
    } catch {
      return null;
    }
  },

  clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
  },

  reset() {
    // Stage 2 deliberately does not expose a destructive production database reset endpoint.
    // Keep this action local so Settings cannot accidentally erase the shared database.
    localStorage.removeItem(KEY);
    localStorage.removeItem(DRAFT_KEY);
    window.location.reload();
  },

  async localFallbackList(params?: { status?: 'All' | TicketStatus; search?: string }): Promise<Ticket[]> {
    const tickets = localLoad();
    const search = params?.search?.trim().toLowerCase() || '';
    return tickets.filter((ticket) => {
      const matchesStatus = !params?.status || params.status === 'All' || ticket.status === params.status;
      const haystack = [ticket.ticket_id, ticket.customer_name, ticket.customer_email, ticket.subject, ticket.description]
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!search || haystack.includes(search));
    });
  },

  localFallbackSave: localSave,
};
