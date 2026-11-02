import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { ENDPOINTS } from '../config/api';

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  countryCode?: string;
  tenantId: string;
  assignedTo?: string;
  isActive: boolean;
  isBlocked: boolean;
  tags?: { tag: { id: string; name: string; color?: string } }[];
  createdAt: string;
  updatedAt: string;
}

export interface ContactFormData {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  countryCode?: string;
}

export const useContacts = (search?: string) => {
  return useQuery({
    queryKey: ['contacts', search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '500' });
      if (search) params.set('search', search);
      const { data } = await api.get(`${ENDPOINTS.contacts.getAll}?${params}`);
      return data.data?.contacts || data.data || data.contacts || [];
    },
  });
};

export const useContact = (id: string) => {
  return useQuery({
    queryKey: ['contact', id],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINTS.contacts.getById(id));
      const contact = data.data?.contact || data.data || data;
      return contact;
    },
    enabled: !!id,
  });
};

export const useCreateContact = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ContactFormData) => {
      const { data } = await api.post(ENDPOINTS.contacts.create, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
};

export const useUpdateContact = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: ContactFormData & { id: string }) => {
      const { data } = await api.put(ENDPOINTS.contacts.update(id), payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['contact'] });
    },
  });
};

export const useDeleteContact = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(ENDPOINTS.contacts.delete(id));
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
};

export const useBlockContact = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, block }: { id: string; block: boolean }) => {
      const endpoint = block ? ENDPOINTS.contacts.block(id) : ENDPOINTS.contacts.unblock(id);
      const { data } = await api.patch(endpoint);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['contact'] });
    },
  });
};

export const useImportPhoneContacts = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contacts: { name: string; phone: string; email?: string }[]) => {
      const { data } = await api.post(ENDPOINTS.contacts.importPhone, { contacts });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
};