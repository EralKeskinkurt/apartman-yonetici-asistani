import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../components/useResponsive';
import { useToast } from '../components/ToastProvider';
import { showConfirm } from '../utils/confirm';

export default function BuildingScreen() {
  const { user, refreshUser } = useAuth();
  const { theme } = useTheme();
  const { contentMaxWidth } = useResponsive();
  const { showToast } = useToast();
  const c = theme.colors;
  const [building, setBuilding] = useState<any>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [monthlyDues, setMonthlyDues] = useState('');
  const [saving, setSaving] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [loadingInvite, setLoadingInvite] = useState(false);

  useEffect(() => {
    if (user?.building_id) {
      api.buildings.getById(user.building_id).then((b: any) => {
        setBuilding(b);
        setName(b.name || '');
        setAddress(b.address || '');
        setMonthlyDues(String(b.monthly_dues || 0));
      }).catch(() => {
        showToast('Apartman bilgileri yüklenemedi', 'error');
      });
      loadInviteCode();
    }
  }, [user?.building_id]);

  const loadInviteCode = async () => {
    try {
      const res = await api.auth.getInviteCode();
      setInviteCode(res.inviteCode || res.invite_code || '');
    } catch (e: any) {
      showToast(e.message || 'Davet kodu alınamadı', 'error');
    }
  };

  const handleSave = async () => {
    if (!name || !address || !monthlyDues) {
      showToast('Tüm alanları doldurun', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.buildings.update(user!.building_id!, {
        name,
        address,
        monthlyDues: Number(monthlyDues),
      });
      showToast('Apartman bilgileri güncellendi', 'success');
      refreshUser();
    } catch (e: any) {
      showToast(e.message || 'Hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateCode = async () => {
    showConfirm('Kodu Yenile', 'Eski kod geçersiz olacak. Emin misiniz?', async () => {
      try {
        const res = await api.auth.regenerateInvite();
        setInviteCode(res.inviteCode);
        showToast('Davet kodu yenilendi', 'success');
      } catch (e: any) { showToast(e.message, 'error'); }
    });
  };

  const handleShare = () => {
    if (!inviteCode) return;
    const msg = `${building?.name || 'Apartmanınız'} sizi Apartman Asistanı'na davet ediyor!\n\nDavet Kodunuz: *${inviteCode}*\n\nUygulamaya giriş yapıp bu kodla kaydolabilir, aidatlarınızı takip edebilir, duyuru ve oylamalara katılabilirsiniz.`;
    Share.share({ message: msg });
  };

  return (
    <ScrollView
      style={[s.wrapper, { backgroundColor: c.background }]}
      contentContainerStyle={{ maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%', paddingBottom: 80 }}
    >
      <View style={s.header}>
        <Text style={[s.title, { color: c.text }]}>Apartman Bilgileri</Text>
      </View>

      <View style={[s.card, { backgroundColor: c.surface }]}>
        <Text style={[s.label, { color: c.textSecondary }]}>Apartman Adı</Text>
        <TextInput style={[s.input, { backgroundColor: c.surfaceSecondary, borderColor: c.border, color: c.text }]} value={name} onChangeText={setName} placeholderTextColor={c.textMuted} />

        <Text style={[s.label, { color: c.textSecondary }]}>Adres</Text>
        <TextInput style={[s.input, { backgroundColor: c.surfaceSecondary, borderColor: c.border, color: c.text }]} value={address} onChangeText={setAddress} multiline placeholderTextColor={c.textMuted} />

        <Text style={[s.label, { color: c.textSecondary }]}>Aylık Aidat (₺)</Text>
        <TextInput style={[s.input, { backgroundColor: c.surfaceSecondary, borderColor: c.border, color: c.text }]} value={monthlyDues} onChangeText={setMonthlyDues} keyboardType="decimal-pad" placeholderTextColor={c.textMuted} />

        {building && (
          <View style={s.info}>
            <Text style={[s.infoText, { color: c.textSecondary }]}>Daire Sayısı: {building.total_flats}</Text>
          </View>
        )}

        <TouchableOpacity style={[s.btn, { backgroundColor: c.accent }, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          <Text style={[s.btnText, { color: c.accentText }]}>Kaydet</Text>
        </TouchableOpacity>
      </View>

      <View style={[s.inviteCard, { backgroundColor: c.surface }]}>
        <Text style={[s.inviteTitle, { color: c.text }]}>Sakin Davet Kodu</Text>
        <Text style={[s.inviteDesc, { color: c.textSecondary }]}>Bu kodu apartman sakinlerinizle paylaşın. Kod ile kaydolan sakinler duyuruları, aidatlarını ve oylamaları görebilir.</Text>
        <View style={s.codeRow}>
          <Text style={[s.code, { color: c.primary }]}>{inviteCode || 'Yükleniyor...'}</Text>
          <View style={s.codeActions}>
            <TouchableOpacity style={[s.codeBtn, { backgroundColor: c.primaryBg }]} onPress={handleShare}>
              <Ionicons name="share-outline" size={18} color={c.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.codeBtn, { backgroundColor: c.dangerBg }]} onPress={handleRegenerateCode}>
              <Ionicons name="refresh" size={18} color={c.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrapper: { flex: 1 },
  header: { padding: 24, paddingTop: 40 },
  title: { fontSize: 22, fontWeight: 'bold' },
  card: { marginHorizontal: 24, padding: 20, borderRadius: 10 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { padding: 14, borderRadius: 8, marginBottom: 8, fontSize: 15, borderWidth: 1 },
  info: { marginTop: 12, marginBottom: 8 },
  infoText: { fontSize: 14 },
  btn: { padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  btnText: { fontSize: 15, fontWeight: 'bold' },
  inviteCard: { marginHorizontal: 24, marginTop: 20, padding: 20, borderRadius: 10 },
  inviteTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  inviteDesc: { fontSize: 13, lineHeight: 20, marginBottom: 16 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 28, fontWeight: 'bold', letterSpacing: 4 },
  codeActions: { flexDirection: 'row', gap: 8 },
  codeBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
