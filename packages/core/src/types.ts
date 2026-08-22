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
export const CONNECTION_STATES = [
  "configured",
  "connected",
  "needs_credentials",
  "error",
  "disconnected",
] as const;
export const CONNECTION_MODES = ["local", "host-oauth", "env-token", "self-hosted"] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type EventStatus = (typeof EVENT_STATUSES)[number];
export type ConnectionState = (typeof CONNECTION_STATES)[number];
export type ConnectionMode = (typeof CONNECTION_MODES)[number];

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

export interface ConnectionConfig {
  id: string;
  mode: ConnectionMode;
  credentialEnv: string | null;
  endpoint: string | null;
  settings: Record<string, string>;
  state: ConnectionState;
  configuredAt: string;
  testedAt: string | null;
  lastError: string | null;
}

export interface ConfigureConnectionInput {
  id: string;
  mode: ConnectionMode;
  credentialEnv?: string;
  endpoint?: string;
  settings?: Record<string, string>;
}

export interface ConnectionCheck {
  connectionId: string;
  checkId: string;
  status: EventStatus;
  summary: string;
  evidence: Record<string, unknown>;
}

export interface ConnectedPulseOptions extends PulseOptions {
  connectionIds: string[];
}

export interface PulseResult {
  run: PulseRun;
  events: PulseEvent[];
  createdTickets: Ticket[];
}
