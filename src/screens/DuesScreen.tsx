import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../components/useResponsive';
import { sendWhatsApp } from '../utils/whatsapp';
import { useStore } from '../store';

const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export default function DuesScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { isDesktop, contentMaxWidth } = useResponsive();
  const c = theme.colors;

  const dues = useStore((s) => s.dues);
  const stats = useStore((s) => s.duesStats);
  const loadDues = useStore((s) => s.loadDues);
  const payDues = useStore((s) => s.payDues);
  const unpayDues = useStore((s) => s.unpayDues);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.building_id) return;
    setLoading(true);
    await loadDues(user.building_id, selectedMonth, selectedYear);
    setLoading(false);
  }, [user?.building_id, selectedMonth, selectedYear]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(selectedYear - 1); }
    else setSelectedMonth(selectedMonth - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(selectedYear + 1); }
    else setSelectedMonth(selectedMonth + 1);
  };

  return (
    <ScrollView style={[s.wrapper, { backgroundColor: c.background }]} contentContainerStyle={{ maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%', paddingBottom: 80 }}>
      <View style={s.header}>
        <Text style={[s.title, { color: c.text }]}>Aidat Takibi</Text>
        <Text style={[s.subtitle, { color: c.textSecondary }]}>{months[selectedMonth]} {selectedYear}</Text>
      </View>
      <View style={s.monthSelector}>
        <TouchableOpacity onPress={prevMonth}><Ionicons name="chevron-back" size={24} color={c.primary} /></TouchableOpacity>
        <Text style={[s.monthText, { color: c.text }]}>{months[selectedMonth]} {selectedYear}</Text>
        <TouchableOpacity onPress={nextMonth}><Ionicons name="chevron-forward" size={24} color={c.primary} /></TouchableOpacity>
      </View>
      <View style={[s.card, { backgroundColor: c.surface }]}>
        <View style={s.statRow}>
          <View style={s.stat}>
            <Text style={[s.statValue, { color: c.primary }, isDesktop && s.statValueDesktop]}>{stats?.paid || 0}/{stats?.total || 0}</Text>
            <Text style={[s.statLabel, { color: c.textSecondary }]}>Ödenen / Toplam</Text>
          </View>
          <View style={[s.divider, { backgroundColor: c.border }]} />
          <View style={s.stat}>
            <Text style={[s.statValue, { color: c.primary }, isDesktop && s.statValueDesktop]}>{stats?.total > 0 ? Math.round(((stats?.paid || 0) / stats.total) * 100) : 0}%</Text>
            <Text style={[s.statLabel, { color: c.textSecondary }]}>Tahsilat Oranı</Text>
          </View>
        </View>
      </View>
      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: c.text }]}>Daire Listesi</Text>
        {loading ? (
          <View style={s.emptyState}><ActivityIndicator size="large" color={c.primary} /></View>
        ) : dues.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="home-outline" size={48} color={c.textMuted} />
            <Text style={[s.emptyText, { color: c.textMuted }]}>Bu ay için aidat kaydı yok</Text>
          </View>
        ) : (
          <View style={[s.flatGrid, isDesktop && s.flatGridDesktop]}>
            {dues.map((d: any, i: number) => (
              <View key={i} style={[s.flatRow, { backgroundColor: c.surface }, isDesktop && s.flatRowDesktop]}>
                <View style={s.flatInfo}>
                  <Text style={[s.flatNumber, { color: c.text }]}>Daire {d.flat_number}</Text>
                  <Text style={[s.flatOwner, { color: c.textSecondary }]}>{d.owner_name || 'Bilinmiyor'}</Text>
                </View>
                <View style={s.flatAmount}>
                  <Text style={[s.amount, { color: c.text }]}>₺{d.amount}</Text>
                  {d.is_paid ? (
                    <TouchableOpacity style={[s.paidBadge, { backgroundColor: c.successBg }]} onPress={() => unpayDues(d.id, selectedMonth, selectedYear)}>
                      <Ionicons name="checkmark-circle" size={16} color={c.success} />
                      <Text style={[s.paidText, { color: c.success }]}>Ödendi</Text>
                      <Ionicons name="close-circle" size={14} color={c.danger} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  ) : (
                    <View style={s.payRow}>
                      <TouchableOpacity style={[s.payButton, { backgroundColor: c.accent }]} onPress={() => payDues(d.id, selectedMonth, selectedYear)}>
                        <Text style={[s.payButtonText, { color: c.accentText }]}>Öde</Text>
                      </TouchableOpacity>
                      {d.owner_phone ? (
                        <TouchableOpacity style={[s.waButton, { backgroundColor: '#25D366' }]} onPress={() => sendWhatsApp(d.owner_phone, `Sayın ${d.owner_name || 'komşu'}, ${months[selectedMonth]} ${selectedYear} ayına ait ₺${d.amount} aidat borcunuz bulunmaktadır.`)}>
                          <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrapper: { flex: 1 },
  header: { padding: 24, paddingTop: 40, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold' },
  subtitle: { fontSize: 14, marginTop: 4 },
  monthSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 8 },
  monthText: { fontSize: 18, fontWeight: '600' },
  card: { marginHorizontal: 24, padding: 20, borderRadius: 10, marginTop: 8 },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: 'bold' },
  statValueDesktop: { fontSize: 36 },
  statLabel: { fontSize: 12, marginTop: 4 },
  divider: { width: 1, height: 40 },
  section: { padding: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  flatGrid: { gap: 8 },
  flatGridDesktop: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  flatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 10 },
  flatRowDesktop: { width: 'calc(50% - 6px)' as any, marginBottom: 0 },
  flatInfo: { flex: 1 },
  flatNumber: { fontSize: 16, fontWeight: '600' },
  flatOwner: { fontSize: 13, marginTop: 2 },
  flatAmount: { alignItems: 'flex-end' },
  amount: { fontSize: 16, fontWeight: 'bold' },
  paidBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  paidText: { fontSize: 12, fontWeight: '600' },
  payButton: { marginTop: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  payButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  payRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  waButton: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { marginTop: 8, fontSize: 14 },
});
