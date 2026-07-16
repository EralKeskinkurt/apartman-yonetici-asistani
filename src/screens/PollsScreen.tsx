import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../components/useResponsive';
import { useToast } from '../components/ToastProvider';
import { showConfirm } from '../utils/confirm';
import { useStore } from '../store';

export default function PollsScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { contentMaxWidth } = useResponsive();
  const { showToast } = useToast();
  const c = theme.colors;

  const polls = useStore((s) => s.polls);
  const loadPolls = useStore((s) => s.loadPolls);
  const addPoll = useStore((s) => s.addPoll);
  const deletePoll = useStore((s) => s.deletePoll);

  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.building_id) return;
    setLoading(true);
    loadPolls(user.building_id).finally(() => setLoading(false));
  }, [user?.building_id]);

  const addOption = () => { if (options.length < 10) setOptions([...options, '']); };
  const removeOption = (idx: number) => { if (options.length > 2) setOptions(options.filter((_, i) => i !== idx)); };

  const handleCreate = async () => {
    if (!title.trim()) { showToast('Başlık gerekli', 'error'); return; }
    const validOptions = options.filter((o) => o.trim());
    if (validOptions.length < 2) { showToast('En az 2 seçenek gerekli', 'error'); return; }
    setSaving(true);
    try {
      await addPoll(user!.building_id!, title, desc, validOptions);
      showToast('Oylama oluşturuldu', 'success');
      setShowForm(false); setTitle(''); setDesc(''); setOptions(['', '']);
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <ScrollView style={[s.wrapper, { backgroundColor: c.background }]} contentContainerStyle={{ maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%', paddingBottom: 80 }}>
      <View style={s.header}>
        <Text style={[s.title, { color: c.text }]}>Oylamalar</Text>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: c.accent }]} onPress={() => setShowForm(true)}>
          <Ionicons name="add" size={20} color={c.accentText} />
          <Text style={[s.addBtnText, { color: c.accentText }]}>Yeni Oylama</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showForm} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent>
        <View style={[s.modalWrapper, { backgroundColor: c.background }]}>
          <View style={[s.modalHeader, { borderBottomColor: c.border }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>Yeni Oylama</Text>
            <TouchableOpacity onPress={() => { setShowForm(false); setTitle(''); setDesc(''); setOptions(['', '']); }}>
              <Ionicons name="close" size={26} color={c.textSecondary} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
              <TextInput style={[s.input, { backgroundColor: c.surfaceSecondary, borderColor: c.border, color: c.text }]} placeholder="Oylama başlığı" placeholderTextColor={c.textMuted} value={title} onChangeText={setTitle} />
              <TextInput style={[s.input, { backgroundColor: c.surfaceSecondary, borderColor: c.border, color: c.text }]} placeholder="Açıklama" placeholderTextColor={c.textMuted} value={desc} onChangeText={setDesc} multiline />
              <Text style={[s.label, { color: c.textSecondary }]}>Seçenekler</Text>
              {options.map((o, i) => (
                <View key={i} style={s.optRow}>
                  <TextInput style={[s.optInput, { backgroundColor: c.surfaceSecondary, borderColor: c.border, color: c.text }]} placeholder={`${i + 1}. seçenek`} placeholderTextColor={c.textMuted} value={o} onChangeText={(v) => { const o2 = [...options]; o2[i] = v; setOptions(o2); }} />
                  {options.length > 2 && <TouchableOpacity onPress={() => removeOption(i)}><Ionicons name="close-circle" size={22} color={c.danger} /></TouchableOpacity>}
                </View>
              ))}
              <TouchableOpacity style={s.addOpt} onPress={addOption}><Ionicons name="add-circle-outline" size={20} color={c.primaryLight} /><Text style={[s.addOptText, { color: c.primaryLight }]}>Seçenek Ekle</Text></TouchableOpacity>
            </ScrollView>
            <View style={[s.modalFooter, { backgroundColor: c.surface, borderTopColor: c.border }]}>
              <TouchableOpacity style={[s.cancelBtn, { backgroundColor: c.border }]} onPress={() => { setShowForm(false); setTitle(''); setDesc(''); setOptions(['', '']); }}>
                <Text style={[s.cancelBtnText, { color: c.text }]}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, { backgroundColor: c.accent, flex: 1 }, saving && { opacity: 0.6 }]} onPress={handleCreate} disabled={saving}>
                <Text style={[s.saveBtnText, { color: c.accentText }]}>{saving ? 'Oluşturuluyor...' : 'Oluştur'}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <View style={s.list}>
        {loading ? <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 48 }} /> :
        polls.length === 0 ? (
          <View style={s.empty}><Ionicons name="stats-chart-outline" size={64} color={c.textMuted} /><Text style={[s.emptyText, { color: c.textMuted }]}>Henüz oylama yok</Text></View>
        ) : polls.map((p: any) => (
          <View key={p.id} style={[s.pollCard, { backgroundColor: c.surface }]}>
            <View style={s.pollHeader}>
              <Text style={[s.pollTitle, { color: c.text }]}>{p.title}</Text>
              <TouchableOpacity onPress={() => showConfirm('Oylamayı Sil', `"${p.title}" silinsin mi?`, () => deletePoll(p.id))}>
                <Ionicons name="trash-outline" size={16} color={c.danger} />
              </TouchableOpacity>
            </View>
            {p.options.map((opt: string, idx: number) => {
              const count = p.votes?.[idx] || 0;
              const pct = p.totalVotes > 0 ? Math.round((count / p.totalVotes) * 100) : 0;
              return (
                <View key={idx} style={s.resultRow}>
                  <Text style={[s.resultLabel, { color: c.textSecondary }]}>{opt}</Text>
                  <View style={s.resultRight}>
                    <View style={[s.resultBar, { backgroundColor: c.border }]}><View style={[s.resultBarFill, { width: `${pct}%`, backgroundColor: c.primary }]} /></View>
                    <Text style={[s.resultCount, { color: c.textMuted }]}>{count} (%{pct})</Text>
                  </View>
                </View>
              );
            })}
            <Text style={[s.pollMeta, { color: c.textMuted }]}>Toplam {p.totalVotes} oy · {new Date(p.created_at).toLocaleDateString('tr-TR')}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrapper: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 40 },
  title: { fontSize: 22, fontWeight: 'bold' },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, gap: 6 },
  addBtnText: { fontWeight: '600', fontSize: 14 },
  form: { marginHorizontal: 24, padding: 16, borderRadius: 10, marginBottom: 8 },
  input: { padding: 14, borderRadius: 8, marginBottom: 10, fontSize: 15, borderWidth: 1 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  optInput: { flex: 1, padding: 12, borderRadius: 8, fontSize: 14, borderWidth: 1 },
  addOpt: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  addOptText: { fontSize: 14 },
  saveBtn: { padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  saveBtnText: { fontWeight: 'bold', fontSize: 15 },
  modalWrapper: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalFooter: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1 },
  cancelBtn: { padding: 14, borderRadius: 8, alignItems: 'center', minWidth: 80 },
  cancelBtnText: { fontWeight: '600', fontSize: 15 },
  list: { paddingHorizontal: 24 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { marginTop: 8, fontSize: 14 },
  pollCard: { padding: 16, borderRadius: 10, marginBottom: 12 },
  pollHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  pollTitle: { fontSize: 16, fontWeight: 'bold' },
  resultRow: { marginBottom: 6 },
  resultLabel: { fontSize: 13, marginBottom: 3 },
  resultRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultBar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  resultBarFill: { height: '100%', borderRadius: 4 },
  resultCount: { fontSize: 11, minWidth: 50, textAlign: 'right' },
  pollMeta: { fontSize: 11, marginTop: 6 },
});
