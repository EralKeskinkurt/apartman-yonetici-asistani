import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const BASE_URL = Constants.expoConfig?.extra?.API_URL || 'http://localhost:3000/api';
const TOKEN_KEY = 'auth_token';

let authToken: string | null = null;

export async function setToken(token: string | null) {
  authToken = token;
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

export async function getToken(): Promise<string | null> {
  if (authToken) return authToken;
  const saved = await AsyncStorage.getItem(TOKEN_KEY);
  if (saved) authToken = saved;
  return authToken;
}

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data.error || 'Something went wrong');
    (error as any).status = res.status;
    throw error;
  }
  return data;
}

export const api = {
  auth: {
    register: (email: string, password: string, fullName: string) =>
      request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, fullName }),
      }),
    login: (email: string, password: string) =>
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    residentRegister: (email: string, password: string, fullName: string, inviteCode: string, flatNumber?: string) =>
      request('/auth/resident-register', {
        method: 'POST',
        body: JSON.stringify({ email, password, fullName, inviteCode, flatNumber }),
      }),
    residentLogin: (email: string, password: string) =>
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    me: () => request('/auth/me'),
    changePassword: (currentPassword: string, newPassword: string) =>
      request('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    getInviteCode: () => request('/auth/invite-code', { method: 'POST' }),
    regenerateInvite: () => request('/auth/regenerate-invite', { method: 'PUT' }),
    googleLogin: (idToken: string, inviteCode?: string, flatNumber?: string) =>
      request('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken, inviteCode, flatNumber }),
      }),
  },

  buildings: {
    getById: (id: string) => request(`/buildings/${id}`),
    create: (name: string, address: string, totalFlats: number, monthlyDues: number) =>
      request('/buildings', {
        method: 'POST',
        body: JSON.stringify({ name, address, totalFlats, monthlyDues }),
      }),
    update: (id: string, data: { name?: string; address?: string; monthlyDues?: number }) =>
      request(`/buildings/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    getByAdmin: () => request('/buildings'),
  },

  flats: {
    getByBuilding: (buildingId: string) => request(`/flats/building/${buildingId}`),
    create: (buildingId: string, floor: number, number: number, ownerName: string, ownerPhone: string) =>
      request('/flats/batch', {
        method: 'POST',
        body: JSON.stringify({
          buildingId,
          flats: [{ floor, number, ownerName, ownerPhone }],
        }),
      }).then((r: any[]) => r[0]),
    createBatch: (buildingId: string, flats: any[]) =>
      request('/flats/batch', {
        method: 'POST',
        body: JSON.stringify({ buildingId, flats }),
      }),
    getById: (id: string) => request(`/flats/${id}`),
    update: (id: string, data: any) =>
      request(`/flats/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  dues: {
    getByBuildingAndMonth: (buildingId: string, month: number, year: number) =>
      request(`/dues/building/${buildingId}?month=${month}&year=${year}`),
    pay: (id: string) => request(`/dues/${id}/pay`, { method: 'PUT' }),
    unpay: (id: string) => request(`/dues/${id}/unpay`, { method: 'PUT' }),
    generate: (buildingId: string) =>
      request(`/dues/generate/${buildingId}`, { method: 'POST' }),
    createBatch: (buildingId: string, records: any[]) =>
      request('/dues/batch', {
        method: 'POST',
        body: JSON.stringify({ buildingId, records }),
      }),
    getStats: (buildingId: string, month: number, year: number) =>
      request(`/dues/stats/${buildingId}?month=${month}&year=${year}`),
  },

  expenses: {
    getByBuilding: (buildingId: string, limit?: number) =>
      request(`/expenses/building/${buildingId}`),
    create: (buildingId: string, category: string, description: string, amount: number) =>
      request('/expenses', {
        method: 'POST',
        body: JSON.stringify({ buildingId, category, description, amount }),
      }),
    update: (id: string, data: { category?: string; description?: string; amount?: number }) =>
      request(`/expenses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) => request(`/expenses/${id}`, { method: 'DELETE' }),
    getTotalByBuilding: (buildingId: string, month?: number, year?: number) => {
      const params = month !== undefined && year !== undefined
        ? `?month=${month}&year=${year}`
        : '';
      return request(`/expenses/total/${buildingId}${params}`);
    },
  },

  announcements: {
    getByBuilding: (buildingId: string, limit?: number, offset?: number) =>
      request(`/announcements/building/${buildingId}?limit=${limit || 6}&offset=${offset || 0}`),
    create: (buildingId: string, title: string, content: string) =>
      request('/announcements', {
        method: 'POST',
        body: JSON.stringify({ buildingId, title, content }),
      }),
    delete: (id: string) => request(`/announcements/${id}`, { method: 'DELETE' }),
  },

  polls: {
    getByBuilding: (buildingId: string) =>
      request(`/polls/building/${buildingId}`),
    create: (buildingId: string, title: string, description: string, options: string[], expiresAt?: string) =>
      request('/polls', {
        method: 'POST',
        body: JSON.stringify({ buildingId, title, description, options, expiresAt }),
      }),
    vote: (pollId: string, optionIndex: number) =>
      request(`/polls/${pollId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ optionIndex }),
      }),
    unvote: (pollId: string) => request(`/polls/${pollId}/vote`, { method: 'DELETE' }),
    delete: (id: string) => request(`/polls/${id}`, { method: 'DELETE' }),
  },

  payment: {
    createCheckout: () => request('/payment/create-checkout', { method: 'POST' }),
    verify: (token: string) => request('/payment/verify', { method: 'POST', body: JSON.stringify({ token }) }),
    payWithCard: (data: { cardNumber: string; expireMonth: string; expireYear: string; cvc: string; cardHolderName: string }) =>
      request('/payment/pay-with-card', { method: 'POST', body: JSON.stringify(data) }),
    status: () => request('/payment/status'),
    cancelSubscription: () => request('/payment/cancel', { method: 'POST' }),
  },

  // alias for backward compatibility
  aidat: undefined as any,
};

api.aidat = api.dues;
