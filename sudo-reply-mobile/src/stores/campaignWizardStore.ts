import { create } from 'zustand';

interface CampaignWizardState {
  name: string;
  templateId: string | null;
  templateName: string;
  paramValues: string[];
  paramCount: number;
  targetType: 'ALL' | 'TAGS';
  selectedTagIds: string[];
  sendMode: 'now' | 'scheduled';
  scheduledAt: Date | null;

  setName: (name: string) => void;
  setTemplate: (id: string, name: string, paramCount: number) => void;
  setParamValue: (index: number, value: string) => void;
  setTargetType: (type: 'ALL' | 'TAGS') => void;
  toggleTag: (tagId: string) => void;
  setSendMode: (mode: 'now' | 'scheduled') => void;
  setScheduledAt: (date: Date | null) => void;
  reset: () => void;
}

const initialState = {
  name: '',
  templateId: null as string | null,
  templateName: '',
  paramValues: [] as string[],
  paramCount: 0,
  targetType: 'ALL' as const,
  selectedTagIds: [] as string[],
  sendMode: 'now' as const,
  scheduledAt: null as Date | null,
};

export const useCampaignWizardStore = create<CampaignWizardState>((set, get) => ({
  ...initialState,

  setName: (name) => set({ name }),

  setTemplate: (id, name, paramCount) =>
    set({
      templateId: id,
      templateName: name,
      paramCount,
      paramValues: new Array(paramCount).fill(''),
    }),

  setParamValue: (index, value) => {
    const paramValues = [...get().paramValues];
    paramValues[index] = value;
    set({ paramValues });
  },

  setTargetType: (targetType) => set({ targetType, selectedTagIds: [] }),

  toggleTag: (tagId) => {
    const selected = get().selectedTagIds;
    if (selected.includes(tagId)) {
      set({ selectedTagIds: selected.filter((id) => id !== tagId) });
    } else {
      set({ selectedTagIds: [...selected, tagId] });
    }
  },

  setSendMode: (sendMode) => set({ sendMode, scheduledAt: null }),

  setScheduledAt: (scheduledAt) => set({ scheduledAt }),

  reset: () => set(initialState),
}));