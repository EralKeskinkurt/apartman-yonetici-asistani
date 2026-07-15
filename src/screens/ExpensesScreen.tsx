import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EXPENSE_CATEGORIES } from '../constants/config';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../components/useResponsive';
import { useToast } from '../components/ToastProvider';
import { showConfirm } from '../utils/confirm';
import { useStore } from '../store';

export default function ExpensesScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { isDesktop, contentMaxWidth } = useResponsive();
  const { showToast } = useToast();
  const c = theme.colors;

  const expenses = useStore((s) => s.expenses);
  const expensesTotal = useStore((s) => s.expensesTotal);
  const loadExpenses = useStore((s) => s.loadExpenses);
  const addExpense = useStore((s) => s.addExpense);
  const updateExpense = useStore((s) => s.updateExpense);
  const deleteExpense = useStore((s) => s.deleteExpense);

  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.building_id) return;
    setInitialLoading(true);
    await loadExpenses(user.building_id);
    setInitialLoading(false);
  }, [user?.building_id]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!description || !amount || !category) { showToast('Tüm alanları doldurun', 'error'); return; }
    setLoading(true);
    try {
      await addExpense(user!.building_id!, category, description, Number(amount));
      showToast('Gider kaydedildi', 'success');
      resetForm();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  const handleEdit = async () => {
    if (!editingId || !description || !amount || !category) { showToast('Tüm alanları doldurun', 'error'); return; }
    setLoading(true);
    try {
      await updateExpense(editingId, category, description, Number(amount));
      showToast('Gider güncellendi', 'success');
      resetForm();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  const resetForm = () => { setShowForm(false); setEditingId(null); setDescription(''); setAmount(''); setCategory(''); };

  const openEdit = (e: any) => {
    setEditingId(e.id); setDescription(e.description); setAmount(String(e.amount)); setCategory(e.category); setShowForm(true);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <ScrollView style={[s.wrapper, { backgroundColor: c.background }]} contentContainerStyle={{ maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%', paddingBottom: 80 }}>
      <View style={s.header}>
        <Text style={[s.title, { color: c.text }]}>Gider Yönetimi</Text>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: c.accent }]} onPress={() => { resetForm(); setShowForm(!showForm); }}>
          <Ionicons name={showForm ? 'close' : 'add'} size={22} color={c.accentText} />
          <Text style={[s.addBtnText, { color: c.accentText }]}>{showForm ? 'İptal' : 'Gider Ekle'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={[s.form, { backgroundColor: c.surface }]}>
          <Text style={[s.formTitle, { color: c.text }]}>{editingId ? 'Gideri Düzenle' : 'Yeni Gider'}</Text>
          <TextInput style={[s.input, { backgroundColor: c.surfaceSecondary, borderColor: c.border, color: c.text }]} placeholder="Açıklama" placeholderTextColor={c.textMuted} value={description} onChangeText={setDescription} />
          <TextInput style={[s.input, { backgroundColor: c.surfaceSecondary, borderColor: c.border, color: c.text }]} placeholder="Tutar (₺)" placeholderTextColor={c.textMuted} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          <Text style={[s.label, { color: c.textSecondary }]}>Kategori</Text>
          <View style={s.catList}>
            {EXPENSE_CATEGORIES.map((cat) => (
              <TouchableOpacity key={cat} style={[s.catItem, { backgroundColor: c.surfaceSecondary }, category === cat && { backgroundColor: c.accent }]} onPress={() => setCategory(cat)}>
                <Text style={[s.catText, { color: c.textSecondary }, category === cat && { color: c.accentText }]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[s.saveBtn, { backgroundColor: c.accent }, loading && { opacity: 0.6 }]} onPress={editingId ? handleEdit : handleAdd} disabled={loading}>
            <Ionicons name="save" size={20} color={c.accentText} />
            <Text style={[s.saveBtnText, { color: c.accentText }]}>{editingId ? 'Güncelle' : 'Kaydet'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[s.totalRow, { backgroundColor: c.surface }]}>
        <Text style={[s.totalLabel, { color: c.textSecondary }]}>Toplam Gider</Text>
        <Text style={[s.totalValue, { color: c.danger }, isDesktop && { fontSize: 24 }]}>₺{expensesTotal}</Text>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: c.text }]}>Gider Kayıtları</Text>
        {initialLoading ? (
          <View style={s.empty}><ActivityIndicator size="large" color={c.primary} /></View>
        ) : expenses.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="receipt-outline" size={64} color={c.textMuted} />
            <Text style={[s.emptyText, { color: c.textMuted }]}>Henüz gider kaydı yok</Text>
          </View>
        ) : expenses.map((e: any, i: number) => (
          <View key={i} style={[s.item, { backgroundColor: c.surface }]}>
            <View style={s.itemLeft}>
              <View style={[s.dot, { backgroundColor: catColor(e.category) }]} />
              <View style={s.itemInfo}>
                <Text style={[s.itemDesc, { color: c.text }]}>{e.description}</Text>
                <View style={s.itemMeta}>
                  <Text style={[s.itemCat, { color: c.textSecondary }]}>{e.category}</Text>
                  <Text style={[s.itemDate, { color: c.textMuted }]}>{formatDate(e.date)}</Text>
                </View>
              </View>
            </View>
            <View style={s.itemRight}>
              <Text style={[s.itemAmount, { color: c.danger }]}>-₺{e.amount}</Text>
              <View style={s.itemActions}>
                <TouchableOpacity onPress={() => openEdit(e)} style={s.actionBtn}><Ionicons name="create-outline" size={18} color={c.primary} /></TouchableOpacity>
                <TouchableOpacity onPress={() => showConfirm('Gideri Sil', `"${e.description}" silinsin mi?`, () => deleteExpense(e.id, e.amount))} style={s.actionBtn}><Ionicons name="trash-outline" size={18} color={c.danger} /></TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function catColor(cat: string) { const m: Record<string, string> = { 'Su Faturası': '#3b82f6', 'Elektrik Faturası': '#f59e0b', 'Doğalgaz Faturası': '#ef4444', 'Temizlik Malzemesi': '#10b981', 'Bakım/Onarım': '#8b5cf6', 'Asansör Bakımı': '#6366f1', 'Personel Maaşı': '#ec4899', 'Çevre Düzenleme': '#14b8a6', Sigorta: '#f97316', Diğer: '#64748b' }; return m[cat] || '#64748b'; }

const s = StyleSheet.create({
  wrapper: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 40 },
  title: { fontSize: 22, fontWeight: 'bold' },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  form: { marginHorizontal: 24, padding: 16, borderRadius: 10, marginBottom: 8 },
  formTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  input: { padding: 14, borderRadius: 8, marginBottom: 12, fontSize: 15, borderWidth: 1 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  catList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  catItem: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  catText: { fontSize: 13 },
  saveBtn: { padding: 14, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, marginHorizontal: 24, borderRadius: 8, marginTop: 8 },
  totalLabel: { fontSize: 15, fontWeight: '600' },
  totalValue: { fontSize: 20, fontWeight: 'bold' },
  section: { padding: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { marginTop: 8, fontSize: 14 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 10, marginBottom: 8 },
  itemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  itemInfo: { flex: 1 },
  itemDesc: { fontSize: 15, fontWeight: '600' },
  itemMeta: { flexDirection: 'row', gap: 12, marginTop: 3 },
  itemCat: { fontSize: 12 },
  itemDate: { fontSize: 12 },
  itemRight: { alignItems: 'flex-end' },
  itemAmount: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  itemActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 4 },
});
