import { create } from 'zustand';
import { api, setToken, getToken } from './services/api';

interface User {
  id: number;
  email: string;
  full_name: string;
  building_id: string | null;
  flat_id: string | null;
  role: 'admin' | 'resident';
  picture?: string;
  subscription_tier?: string;
  subscription_expiry?: string | null;
  trial_end?: string | null;
}

interface AppState {
  user: User | null;
  loading: boolean;
  building: any | null;
  dues: any[];
  duesStats: any | null;
  expenses: any[];
  expensesTotal: number;
  announcements: any[];
  annTotal: number;
  polls: any[];
  flats: any[];

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  loadUser: () => Promise<void>;

  loadDashboard: (buildingId: string) => Promise<void>;
  loadDues: (buildingId: string, month: number, year: number) => Promise<void>;
  loadExpenses: (buildingId: string) => Promise<void>;
  loadAnnouncements: (buildingId: string, limit?: number, offset?: number) => Promise<void>;
  loadPolls: (buildingId: string) => Promise<void>;
  loadFlats: (buildingId: string) => Promise<void>;

  generateDues: (buildingId: string) => Promise<void>;
  payDues: (id: string, month: number, year: number) => Promise<void>;
  unpayDues: (id: string, month: number, year: number) => Promise<void>;

  addExpense: (buildingId: string, category: string, description: string, amount: number) => Promise<void>;
  updateExpense: (id: string, category: string, description: string, amount: number) => Promise<void>;
  deleteExpense: (id: string, amount: number) => Promise<void>;

  addAnnouncement: (buildingId: string, title: string, content: string) => Promise<any>;
  deleteAnnouncement: (id: string) => Promise<void>;
  loadMoreAnnouncements: (buildingId: string, offset: number) => Promise<void>;

  votePoll: (pollId: string, optionIndex: number, alreadyVoted: boolean) => Promise<void>;
  deletePoll: (id: string) => Promise<void>;
  addPoll: (buildingId: string, title: string, description: string, options: string[]) => Promise<void>;

  updateFlat: (id: string, data: any) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  loading: true,
  building: null,
  dues: [],
  duesStats: null,
  expenses: [],
  expensesTotal: 0,
  announcements: [],
  annTotal: 0,
  polls: [],
  flats: [],

  loadUser: async () => {
    try {
      const token = await getToken();
      if (token) {
        const user = await api.auth.me();
        set({ user });
      }
    } catch { await setToken(null); }
    set({ loading: false });
  },

  signIn: async (email, password) => {
    const result = await api.auth.login(email, password);
    await setToken(result.token);
    set({ user: result.user });
  },

  signUp: async (email, password, fullName) => {
    const result = await api.auth.register(email, password, fullName);
    await setToken(result.token);
    set({ user: result.user });
  },

  signOut: async () => {
    try { await setToken(null); } catch {}
    set({ user: null, building: null, dues: [], duesStats: null, expenses: [], expensesTotal: 0, announcements: [], annTotal: 0, polls: [], flats: [] });
  },

  loadDashboard: async (buildingId) => {
    try {
      const [b, stats, exp, annRes] = await Promise.all([
        api.buildings.getById(buildingId),
        api.dues.getStats(buildingId, new Date().getMonth(), new Date().getFullYear()),
        api.expenses.getTotalByBuilding(buildingId, new Date().getMonth(), new Date().getFullYear()),
        api.announcements.getByBuilding(buildingId, 6, 0),
      ]);
      set({
        building: b,
        duesStats: stats,
        expensesTotal: exp?.total || 0,
        announcements: annRes.announcements || [],
        annTotal: annRes.total || 0,
      });
    } catch {}
  },

  loadDues: async (buildingId, month, year) => {
    try {
      let data = await api.dues.getByBuildingAndMonth(buildingId, month, year);
      if ((!data || data.length === 0) && month === new Date().getMonth() && year === new Date().getFullYear()) {
        await api.dues.generate(buildingId);
        data = await api.dues.getByBuildingAndMonth(buildingId, month, year);
      }
      const stats = await api.dues.getStats(buildingId, month, year);
      set({ dues: data || [], duesStats: stats });
    } catch {}
  },

  loadExpenses: async (buildingId) => {
    try {
      const data = await api.expenses.getByBuilding(buildingId);
      set({ expenses: data || [] });
    } catch {}
  },

  loadAnnouncements: async (buildingId, limit = 6, offset = 0) => {
    try {
      const res = await api.announcements.getByBuilding(buildingId, limit, offset);
      if (offset === 0) {
        set({ announcements: res.announcements || [], annTotal: res.total || 0 });
      }
    } catch {}
  },

  loadPolls: async (buildingId) => {
    try {
      const p = await api.polls.getByBuilding(buildingId);
      set({ polls: p || [] });
    } catch {}
  },

  loadFlats: async (buildingId) => {
    try {
      const data = await api.flats.getByBuilding(buildingId);
      set({ flats: data || [] });
    } catch {}
  },

  generateDues: async (buildingId) => {
    try {
      await api.dues.generate(buildingId);
    } catch {}
  },

  payDues: async (id, month, year) => {
    const { dues, user } = get();
    const due = dues.find((d: any) => d.id === id);
    set({
      dues: dues.map((d: any) => d.id === id ? { ...d, is_paid: 1, paid_at: new Date().toISOString() } : d),
    });
    try { await api.dues.pay(id); } catch {}
    if (user?.building_id) {
      const stats = await api.dues.getStats(user.building_id, month, year);
      set({ duesStats: stats });
    }
  },

  unpayDues: async (id, month, year) => {
    const { dues, user } = get();
    set({
      dues: dues.map((d: any) => d.id === id ? { ...d, is_paid: 0, paid_at: null } : d),
    });
    try { await api.dues.unpay(id); } catch {}
    if (user?.building_id) {
      const stats = await api.dues.getStats(user.building_id, month, year);
      set({ duesStats: stats });
    }
  },

  addExpense: async (buildingId, category, description, amount) => {
    try {
      const result = await api.expenses.create(buildingId, category, description, amount);
      set((state) => ({
        expenses: [result, ...state.expenses],
        expensesTotal: state.expensesTotal + amount,
      }));
    } catch (e: any) { throw e; }
  },

  updateExpense: async (id, category, description, amount) => {
    try {
      await api.expenses.update(id, { category, description, amount });
      set((state) => ({
        expenses: state.expenses.map((e: any) => e.id === id ? { ...e, category, description, amount } : e),
      }));
    } catch {}
  },

  deleteExpense: async (id, amount) => {
    try {
      await api.expenses.delete(id);
      set((state) => ({
        expenses: state.expenses.filter((e: any) => e.id !== id),
        expensesTotal: Math.max(0, state.expensesTotal - amount),
      }));
    } catch {}
  },

  addAnnouncement: async (buildingId, title, content) => {
    const result = await api.announcements.create(buildingId, title, content);
    const newAnn = { ...result, created_at: result.created_at || new Date().toISOString() };
    set((state) => ({
      announcements: [newAnn, ...state.announcements],
      annTotal: state.annTotal + 1,
    }));
    return newAnn;
  },

  deleteAnnouncement: async (id) => {
    try {
      await api.announcements.delete(id);
      set((state) => ({
        announcements: state.announcements.filter((a: any) => a.id !== id),
        annTotal: Math.max(0, state.annTotal - 1),
      }));
    } catch {}
  },

  loadMoreAnnouncements: async (buildingId, offset) => {
    try {
      const res = await api.announcements.getByBuilding(buildingId, 6, offset);
      set((state) => ({
        announcements: [...state.announcements, ...(res.announcements || [])],
        annTotal: res.total,
      }));
    } catch {}
  },

  votePoll: async (pollId, optionIndex, alreadyVoted) => {
    try {
      if (alreadyVoted) {
        await api.polls.unvote(pollId);
      } else {
        await api.polls.vote(pollId, optionIndex);
      }
      const { user } = get();
      if (user?.building_id) {
        const p = await api.polls.getByBuilding(user.building_id);
        set({ polls: p || [] });
      }
    } catch {}
  },

  deletePoll: async (id) => {
    try {
      await api.polls.delete(id);
      set((state) => ({ polls: state.polls.filter((p: any) => p.id !== id) }));
    } catch {}
  },

  addPoll: async (buildingId, title, description, options) => {
    try {
      await api.polls.create(buildingId, title, description, options);
      const p = await api.polls.getByBuilding(buildingId);
      set({ polls: p || [] });
    } catch (e: any) { throw e; }
  },

  updateFlat: async (id, data) => {
    try {
      await api.flats.update(id, data);
      set((state) => ({
        flats: state.flats.map((f: any) => f.id === id ? { ...f, ...data, is_rented: data.isRented ? 1 : 0 } : f),
      }));
    } catch {}
  },
}));
