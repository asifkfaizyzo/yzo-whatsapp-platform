import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { ENDPOINTS } from '../config/api';

export interface Campaign {
  id: string;
  name: string;
  status: string;
  templateId?: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  scheduledAt?: string;
  createdAt: string;
}

export const useCampaigns = () => {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINTS.broadcasts.getAll);
      return data.data?.broadcasts || data.data || data.broadcasts || [];
    },
  });
};