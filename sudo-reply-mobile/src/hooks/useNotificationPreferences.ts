import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { ENDPOINTS } from '../config/api';

export interface NotificationPreferences {
  pushEnabled: boolean;
  types: {
    new_message: boolean;
    conversation_reassigned: boolean;
    broadcast_completed: boolean;
    template_approved: boolean;
    template_rejected: boolean;
  };
}

export interface NotificationPreferencesUpdate {
  pushEnabled?: boolean;
  types?: Partial<NotificationPreferences['types']>;
}

const DEFAULTS: NotificationPreferences = {
  pushEnabled: true,
  types: {
    new_message: true,
    conversation_reassigned: true,
    broadcast_completed: true,
    template_approved: true,
    template_rejected: true,
  },
};

export const useNotificationPreferences = () => {
  return useQuery({
    queryKey: ['notificationPreferences'],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINTS.auth.notificationPrefs);
      return (data.data || DEFAULTS) as NotificationPreferences;
    },
    staleTime: 60_000,
  });
};

export const useUpdateNotificationPreferences = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: NotificationPreferencesUpdate) =>
      api.patch(ENDPOINTS.auth.notificationPrefs, prefs),
    onMutate: async (newPrefs) => {
      await qc.cancelQueries({ queryKey: ['notificationPreferences'] });
      const prev = qc.getQueryData<NotificationPreferences>(['notificationPreferences']);
      qc.setQueryData<NotificationPreferences>(['notificationPreferences'], (old) => ({
        ...DEFAULTS,
        ...old,
        ...newPrefs,
        types: {
          ...DEFAULTS.types,
          ...old?.types,
          ...newPrefs.types,
        },
      }));
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        qc.setQueryData(['notificationPreferences'], context.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notificationPreferences'] });
    },
  });
};