import api from '../api/axios';

export interface ProblemReportPayload {
  name?: string;
  email: string;
  description: string;
}

export interface ProblemReportResponse {
  message: string;
  ticket_id: string;
  contact_email: string;
  dispatched_to: string | string[];
  email_sent: boolean;
}

export interface SupportTicketItem {
  id: string;
  ticket_id: string;
  submitter_name: string;
  submitter_role: string;
  contact_email: string;
  description: string;
  status: 'UNDER_REVIEW' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED';
  status_display: string;
  admin_reply: string;
  claimed_by_name: string | null;
  resolved_by_name: string | null;
  lrn: string | null;
  grade_level: string | null;
  section: string | null;
  tutor_name: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface SupportTicketListResponse {
  pending_count: number;
  results: SupportTicketItem[];
}

export const ticketService = {
  submitProblemReport: async (payload: ProblemReportPayload): Promise<ProblemReportResponse> => {
    const response = await api.post<ProblemReportResponse>('/users/report-problem/', payload);
    return response.data;
  },

  getTickets: async (statusParam?: string): Promise<SupportTicketListResponse> => {
    const params = statusParam ? { status: statusParam } : {};
    const response = await api.get<SupportTicketListResponse>('/users/tickets/', { params });
    return response.data;
  },

  updateTicketAction: async (
    ticketId: string,
    action: 'claim' | 'resolve' | 'dismiss',
    reply?: string
  ): Promise<{ message: string; ticket: SupportTicketItem }> => {
    const response = await api.post<{ message: string; ticket: SupportTicketItem }>(
      `/users/tickets/${ticketId}/action/`,
      { action, reply }
    );
    return response.data;
  },

  dismissTicketForUser: async (ticketId: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>(`/users/tickets/${ticketId}/dismiss-user/`);
    return response.data;
  },
};
