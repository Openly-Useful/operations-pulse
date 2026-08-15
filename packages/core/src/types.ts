export const TICKET_STATUSES = [
  "backlog",
  "triaged",
  "in_progress",
  "blocked",
  "done",
  "closed",
] as const;

export const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const EVENT_STATUSES = ["pass", "warn", "fail", "blocked"] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type EventStatus = (typeof EVENT_STATUSES)[number];

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  source: string;
  sourceRef: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketInput {
  title: string;
  description?: string;
  priority?: TicketPriority;
  status?: TicketStatus;
  source?: string;
  sourceRef?: string;
  tags?: string[];
}

export interface TicketQuery {
  status?: TicketStatus;
  priority?: TicketPriority;
  query?: string;
  limit?: number;
}

export interface PulseEvent {
  id: string;
  runId: string;
  checkId: string;
  status: EventStatus;
  summary: string;
  evidence: Record<string, unknown>;
  ticketId: string | null;
  createdAt: string;
}

export interface PulseRun {
  id: string;
  workspace: string;
  status: "running" | "completed" | "failed";
  summary: string | null;
  startedAt: string;
  completedAt: string | null;
  events?: PulseEvent[];
}

export interface LocalLogCheck {
  paths: string[];
  patterns?: string[];
}

export interface PulseOptions {
  workspace: string;
  createTickets?: boolean;
  localLogs?: LocalLogCheck;
}

export interface PulseResult {
  run: PulseRun;
  events: PulseEvent[];
  createdTickets: Ticket[];
}
