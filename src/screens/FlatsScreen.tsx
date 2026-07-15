import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../components/useResponsive';
import { useToast } from '../components/ToastProvider';
import { useStore } from '../store';

export default function FlatsScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { isDesktop, contentMaxWidth } = useResponsive();
  const { showToast } = useToast();
  const c = theme.colors;

  const flats = useStore((s) => s.flats);
  const loadFlats = useStore((s) => s.loadFlats);
  const updateFlat = useStore((s) => s.updateFlat);

  const [selectedFlat, setSelectedFlat] = useState<any>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [isRented, setIsRented] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.building_id) return;
    setLoading(true);
    await loadFlats(user.building_id);
    setLoading(false);
  }, [user?.building_id]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (flat: any) => {
    setSelectedFlat(flat); setOwnerName(flat.owner_name || ''); setOwnerPhone(flat.owner_phone || '');
    setOwnerEmail(flat.owner_email || ''); setIsRented(flat.is_rented === 1); setEditVisible(true);
  };

  const handleSave = async () => {
    if (!selectedFlat) return;
    try {
      await updateFlat(selectedFlat.id, { ownerName, ownerPhone, ownerEmail, isRented });
      setEditVisible(false);
      showToast('Daire güncellendi', 'success');
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  return (
    <ScrollView style={[s.wrapper, { backgroundColor: c.background }]} contentContainerStyle={{ maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%', paddingBottom: 80 }}>
      <View style={s.header}>
        <View>
          <Text style={[s.title, { color: c.text }]}>Daireler</Text>
          <Text style={[s.subtitle, { color: c.textSecondary }]}>{flats.length} daire</Text>
        </View>
      </View>
      <View style={[s.list, isDesktop && s.listDesktop]}>
        {loading ? (
          <View style={s.loadingContainer}><ActivityIndicator size="large" color={c.primary} /></View>
        ) : flats.map((flat: any) => (
          <TouchableOpacity key={flat.id} style={[s.flatItem, { backgroundColor: c.surface }, isDesktop && s.flatItemDesktop]} onPress={() => openEdit(flat)}>
            <View style={s.flatLeft}>
              <View style={[s.flatNum, { backgroundColor: c.primaryBg }]}><Text style={[s.flatNumText, { color: c.primary }]}>#{flat.number}</Text></View>
              <View style={s.flatInfo}>
                <Text style={[s.flatOwner, { color: c.text }]}>{flat.owner_name || 'Boş'}</Text>
                <Text style={[s.flatMeta, { color: c.textMuted }]}>Kat {flat.floor}{flat.is_rented ? ' · Kiracı' : ' · Ev Sahibi'}{flat.owner_phone ? ` · ${flat.owner_phone}` : ''}</Text>
              </View>
            </View>
            <Ionicons name="create-outline" size={20} color={c.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      <Modal visible={editVisible} animationType="slide" transparent>
        <View style={[s.modalOverlay, { backgroundColor: c.overlay }]}>
          <View style={[s.modal, { backgroundColor: c.surface }, isDesktop && s.modalDesktop]}>
            <View style={[s.modalH, { borderBottomColor: c.border }]}>
              <Text style={[s.modalTitle, { color: c.text }]}>Daire #{selectedFlat?.number}</Text>
              <TouchableOpacity onPress={() => setEditVisible(false)}><Ionicons name="close" size={24} color={c.textSecondary} /></TouchableOpacity>
            </View>
            <View style={[s.modalBody, isDesktop && { padding: 28 }]}>
              <Text style={[s.label, { color: c.textSecondary }]}>Sahip Adı</Text>
              <TextInput style={[s.input, { backgroundColor: c.surfaceSecondary, borderColor: c.border, color: c.text }]} value={ownerName} onChangeText={setOwnerName} placeholder="Ad Soyad" placeholderTextColor={c.textMuted} />
              <Text style={[s.label, { color: c.textSecondary }]}>Telefon</Text>
              <TextInput style={[s.input, { backgroundColor: c.surfaceSecondary, borderColor: c.border, color: c.text }]} value={ownerPhone} onChangeText={setOwnerPhone} placeholder="05XX XXX XX XX" keyboardType="phone-pad" placeholderTextColor={c.textMuted} />
              <Text style={[s.label, { color: c.textSecondary }]}>E-posta</Text>
              <TextInput style={[s.input, { backgroundColor: c.surfaceSecondary, borderColor: c.border, color: c.text }]} value={ownerEmail} onChangeText={setOwnerEmail} placeholder="email@ornek.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={c.textMuted} />
              <TouchableOpacity style={s.toggle} onPress={() => setIsRented(!isRented)}>
                <Ionicons name={isRented ? 'checkbox' : 'square-outline'} size={22} color={isRented ? c.success : c.textMuted} />
                <Text style={[s.toggleText, { color: c.textSecondary }]}>Kiracı</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, { backgroundColor: c.accent }]} onPress={handleSave}>
                <Text style={[s.saveBtnText, { color: c.accentText }]}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrapper: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 24, paddingTop: 40 },
  title: { fontSize: 22, fontWeight: 'bold' },
  subtitle: { fontSize: 14, marginTop: 4 },
  list: { paddingHorizontal: 24 },
  loadingContainer: { alignItems: 'center', paddingVertical: 48 },
  listDesktop: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  flatItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 10, marginBottom: 8 },
  flatItemDesktop: { width: '48%' as any, marginBottom: 0 },
  flatLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  flatNum: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flatNumText: { fontSize: 14, fontWeight: 'bold' },
  flatInfo: { flex: 1 },
  flatOwner: { fontSize: 15, fontWeight: '600' },
  flatMeta: { fontSize: 12, marginTop: 2 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '90%', width: '100%' },
  modalDesktop: { maxWidth: 560, alignSelf: 'center', borderRadius: 12, marginBottom: 0, maxHeight: '80%' },
  modalH: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalBody: { padding: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  input: { padding: 14, borderRadius: 8, marginBottom: 14, fontSize: 15, borderWidth: 1 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, marginBottom: 16 },
  toggleText: { fontSize: 15 },
  saveBtn: { padding: 16, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
