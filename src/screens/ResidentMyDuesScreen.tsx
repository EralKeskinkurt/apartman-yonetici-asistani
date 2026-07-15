import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../components/useResponsive';
import { useStore } from '../store';

const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export default function ResidentMyDuesScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { contentMaxWidth } = useResponsive();
  const c = theme.colors;

  const dues = useStore((s) => s.dues);
  const loadDues = useStore((s) => s.loadDues);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.building_id) return;
    setLoading(true);
    Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        let m = new Date().getMonth() - i;
        let y = new Date().getFullYear();
        if (m < 0) { m += 12; y -= 1; }
        return loadDues(user.building_id, m, y);
      })
    ).finally(() => setLoading(false));
  }, [user?.building_id]);

  const myDues = dues.filter((d: any) => d.flat_id === user?.flat_id);

  return (
    <ScrollView style={[s.wrapper, { backgroundColor: c.background }]} contentContainerStyle={{ maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%', paddingBottom: 80 }}>
      <View style={s.header}><Text style={[s.title, { color: c.text }]}>Aidat Geçmişim</Text></View>
      {loading ? (
        <View style={s.loading}><ActivityIndicator size="large" color={c.primary} /></View>
      ) : myDues.length === 0 ? (
        <View style={s.empty}><Ionicons name="receipt-outline" size={64} color={c.textMuted} /><Text style={[s.emptyText, { color: c.textMuted }]}>Henüz aidat kaydı yok</Text></View>
      ) : myDues.map((d: any, i: number) => (
        <View key={i} style={[s.item, { backgroundColor: c.surface }]}>
          <Text style={[s.itemMonth, { color: c.text }]}>{months[d.month]} {d.year}</Text>
          <View style={s.itemRight}>
            <Text style={[s.itemAmount, { color: c.text }]}>₺{d.amount}</Text>
            {d.is_paid ? (
              <View style={[s.badge, { backgroundColor: c.successBg }]}><Ionicons name="checkmark-circle" size={14} color={c.success} /><Text style={[s.badgeText, { color: c.success }]}>Ödendi</Text></View>
            ) : (
              <View style={[s.badge, { backgroundColor: c.dangerBg }]}><Ionicons name="alert-circle" size={14} color={c.danger} /><Text style={[s.badgeText, { color: c.danger }]}>Bekliyor</Text></View>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrapper: { flex: 1 },
  header: { padding: 24, paddingTop: 40 },
  title: { fontSize: 22, fontWeight: 'bold' },
  loading: { paddingVertical: 48, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { marginTop: 8, fontSize: 14 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 10, marginHorizontal: 24, marginBottom: 8 },
  itemMonth: { fontSize: 15, fontWeight: '600' },
  itemRight: { alignItems: 'flex-end' },
  itemAmount: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: '600' },
});
