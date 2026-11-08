import api from '../api/axios';

export interface SystemAnnouncementItem {
  id: string;
  title: string;
  message: string;
  announcement_type: 'INFO' | 'UPDATE' | 'MAINTENANCE';
  announcement_type_display: string;
  target_role: 'ALL' | 'TUTORS' | 'STUDENTS' | 'PRINCIPALS';
  target_role_display: string;
  is_active: boolean;
  created_by_name: string;
  created_at: string;
  expires_at: string | null;
}

export interface AnnouncementListResponse {
  count: number;
  results: SystemAnnouncementItem[];
}

export interface CreateAnnouncementPayload {
  title: string;
  message: string;
  announcement_type: 'INFO' | 'UPDATE' | 'MAINTENANCE';
  target_role: 'ALL' | 'TUTORS' | 'STUDENTS' | 'PRINCIPALS';
}

export const announcementService = {
  getAnnouncements: async (): Promise<AnnouncementListResponse> => {
    const response = await api.get<AnnouncementListResponse>('/users/announcements/');
    return response.data;
  },

  createAnnouncement: async (payload: CreateAnnouncementPayload): Promise<SystemAnnouncementItem> => {
    const response = await api.post<SystemAnnouncementItem>('/users/announcements/', payload);
    return response.data;
  },

  deleteAnnouncement: async (id: string | number): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>(`/users/announcements/${id}/`);
    return response.data;
  },
};

