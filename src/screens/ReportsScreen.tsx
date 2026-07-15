import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../components/useResponsive';
import { useStore } from '../store';

const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export default function ReportsScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { isDesktop, contentMaxWidth } = useResponsive();
  const c = theme.colors;

  const loadDues = useStore((s) => s.loadDues);
  const loadExpenses = useStore((s) => s.loadExpenses);

  const [monthlyData, setMonthlyData] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!user?.building_id) return;
    const now = new Date();
    const data: any[] = [];
    for (let i = 5; i >= 0; i--) {
      let m = now.getMonth() - i;
      let y = now.getFullYear();
      if (m < 0) { m += 12; y -= 1; }
      const dues = await loadDues(user.building_id, m, y);
      const dState = useStore.getState().duesStats;
      const exp = await loadExpenses(user.building_id);
      const eTotal = useStore.getState().expensesTotal;
      data.push({ month: m, year: y, collected: dState?.paid_amount || 0, expected: dState?.total_amount || 0, expenses: eTotal || 0 });
    }
    setMonthlyData(data);
  }, [user?.building_id]);

  useEffect(() => { load(); }, [load]);

  const totalCollected = monthlyData.reduce((s, d) => s + d.collected, 0);
  const totalExpenses = monthlyData.reduce((s, d) => s + d.expenses, 0);
  const balance = totalCollected - totalExpenses;

  return (
    <ScrollView style={[s.wrapper, { backgroundColor: c.background }]} contentContainerStyle={{ maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%', paddingBottom: 80 }}>
      <View style={s.header}><Text style={[s.title, { color: c.text }]}>Raporlar</Text><Text style={[s.subtitle, { color: c.textSecondary }]}>Son 6 ay</Text></View>
      <View style={[s.summaryRow, isDesktop && s.summaryRowDesktop]}>
        <View style={[s.summaryCard, { backgroundColor: c.successBg }]}><Text style={[s.summaryLabel, { color: c.textSecondary }]}>Toplam Tahsilat</Text><Text style={[s.summaryValue, { color: c.success }]}>₺{totalCollected}</Text></View>
        <View style={[s.summaryCard, { backgroundColor: c.dangerBg }]}><Text style={[s.summaryLabel, { color: c.textSecondary }]}>Toplam Gider</Text><Text style={[s.summaryValue, { color: c.danger }]}>₺{totalExpenses}</Text></View>
        <View style={[s.summaryCard, { backgroundColor: balance >= 0 ? c.primaryBg : c.dangerBg }]}><Text style={[s.summaryLabel, { color: c.textSecondary }]}>Bakiye</Text><Text style={[s.summaryValue, { color: balance >= 0 ? c.success : c.danger }]}>₺{balance}</Text></View>
      </View>
      <View style={s.section}><Text style={[s.sectionTitle, { color: c.text }]}>Aylık Döküm</Text>
        {monthlyData.map((d: any, i: number) => (
          <View key={i} style={[s.row, { backgroundColor: c.surface }]}>
            <Text style={[s.rowMonth, { color: c.text }]}>{months[d.month]} {d.year}</Text>
            <View style={s.rowRight}>
              <View style={s.rowStat}><Ionicons name="arrow-down" size={14} color={c.success} /><Text style={[s.rowStatText, { color: c.success }]}>₺{d.collected}</Text></View>
              <View style={s.rowStat}><Ionicons name="arrow-up" size={14} color={c.danger} /><Text style={[s.rowStatText, { color: c.danger }]}>₺{d.expenses}</Text></View>
              <Text style={[s.rowNet, { color: (d.collected - d.expenses) >= 0 ? c.success : c.danger }]}>₺{d.collected - d.expenses}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrapper: { flex: 1 },
  header: { padding: 24, paddingTop: 40 },
  title: { fontSize: 22, fontWeight: 'bold' },
  subtitle: { fontSize: 14, marginTop: 4 },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 10, marginBottom: 8 },
  summaryRowDesktop: { gap: 16 },
  summaryCard: { flex: 1, padding: 16, borderRadius: 10, alignItems: 'center' },
  summaryLabel: { fontSize: 11, marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: 'bold' },
  section: { padding: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 10, marginBottom: 8 },
  rowMonth: { fontSize: 14, fontWeight: '600' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowStatText: { fontSize: 14, fontWeight: '500' },
  rowNet: { fontSize: 14, fontWeight: 'bold', minWidth: 60, textAlign: 'right' },
});
