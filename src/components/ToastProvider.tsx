import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  showLoading: (message: string) => void;
  hideLoading: () => void;
  isLoading: boolean;
}

const ToastContext = createContext<ToastContextType>({} as ToastContextType);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loadingMsg, setLoadingMsg] = useState('');

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const showLoading = useCallback((message: string) => setLoadingMsg(message), []);
  const hideLoading = useCallback(() => setLoadingMsg(''), []);

  return (
    <ToastContext.Provider value={{ showToast, showLoading, hideLoading, isLoading: !!loadingMsg }}>
      {children}
      {toasts.map((t, i) => (
        <View key={t.id} style={[s.toast, s[`toast${t.type}`]]}>
          <Ionicons
            name={t.type === 'success' ? 'checkmark-circle' : t.type === 'error' ? 'alert-circle' : 'information-circle'}
            size={18}
            color={t.type === 'success' ? '#059669' : t.type === 'error' ? '#dc2626' : '#2563eb'}
          />
          <Text style={s.toastText}>{t.message}</Text>
        </View>
      ))}
      {!!loadingMsg && (
        <View style={s.loadingOverlay}>
          <View style={s.loadingBox}>
            <Text style={s.loadingText}>{loadingMsg}</Text>
          </View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const s = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    maxWidth: '90%',
    minWidth: 200,
  },
  toastsuccess: { backgroundColor: '#d1fae5' },
  toasterror: { backgroundColor: '#fee2e2' },
  toastinfo: { backgroundColor: '#dbeafe' },
  toastText: { flex: 1, fontSize: 14, color: '#1e293b', fontWeight: '500' },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 9998,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderRadius: 12,
    elevation: 5,
  },
  loadingText: { fontSize: 15, color: '#1e293b', fontWeight: '600' },
});
