import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { ENDPOINTS } from '../config/api';

export interface Template {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any;
  headerType: string;
  headerText: string | null;
  footerText: string | null;
  buttons: any;
  bodyParams: any;
}

export function useApprovedTemplates() {
  return useQuery({
    queryKey: ['templates', 'approved'],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINTS.templates.getAll);
      const all: Template[] = data.data || data.templates || data || [];
      return all.filter((t) => t.status === 'APPROVED');
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Parse body text from template components and count {{N}} placeholders */
export function getTemplateBodyInfo(template: Template) {
  try {
    const components =
      typeof template.components === 'string'
        ? JSON.parse(template.components)
        : template.components;

    if (!Array.isArray(components)) return { bodyText: '', paramCount: 0 };

    const bodyComp = components.find((c: any) => c.type === 'BODY');
    const bodyText = bodyComp?.text || '';
    const matches = bodyText.match(/\{\{\d+\}\}/g);
    return { bodyText, paramCount: matches ? matches.length : 0 };
  } catch {
    return { bodyText: '', paramCount: 0 };
  }
}