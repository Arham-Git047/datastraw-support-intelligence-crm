export type TicketStatus = 'Open' | 'In Progress' | 'Closed';
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type TicketSentiment = 'Positive' | 'Neutral' | 'Frustrated' | 'Angry';

export interface Note {
  id: string;
  ticket_id: string;
  note_text: string;
  created_at: string;
}

export interface AIInsights {
  category: string;
  priority: TicketPriority;
  sentiment: TicketSentiment;
  urgency_score: number;
  confidence: number;
  summary: string;
  suggested_action: string;
  suggested_reply: string;
  resolution_plan: string[];
  customer_impact: string;
  risk_factors: string[];
  data_signals: string[];
  similar_ticket_ids: string[];
  explanation: string;
  generated_at: string;
}

export interface TimelineEvent {
  id: string;
  ticket_id: string;
  event_type: 'created' | 'ai_analyzed' | 'status_changed' | 'note_added' | 'assignment';
  message: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  ticket_id: string;
  customer_name: string;
  customer_email: string;
  subject: string;
  description: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  notes: Note[];
  timeline: TimelineEvent[];
  ai_insights?: AIInsights;
}

export interface TicketDraft {
  customer_name: string;
  customer_email: string;
  subject: string;
  description: string;
}

export interface UserPreferences {
  autoAnalyze: boolean;
  showAIExplanations: boolean;
  compactMode: boolean;
  desktopNotifications: boolean;
}
