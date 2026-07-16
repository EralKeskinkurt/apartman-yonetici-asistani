import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../components/useResponsive';
import { useToast } from '../components/ToastProvider';
import { showConfirm } from '../utils/confirm';
import { sendBulkWhatsApp } from '../utils/whatsapp';
import { sendAnnouncementNotification } from '../utils/notifications';
import { useStore } from '../store';
import { api } from '../services/api';

const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export default function DashboardScreen() {
  const { user, refreshUser } = useAuth();
  const { theme } = useTheme();
  const { isDesktop, contentMaxWidth } = useResponsive();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const c = theme.colors;

  const building = useStore((s) => s.building);
  const duesStats = useStore((s) => s.duesStats);
  const expensesTotal = useStore((s) => s.expensesTotal);
  const announcements = useStore((s) => s.announcements);
  const annTotal = useStore((s) => s.annTotal);
  const loadDashboard = useStore((s) => s.loadDashboard);
  const addAnnouncement = useStore((s) => s.addAnnouncement);
  const deleteAnnouncement = useStore((s) => s.deleteAnnouncement);
  const loadMoreAnnouncements = useStore((s) => s.loadMoreAnnouncements);
  const loadFlats = useStore((s) => s.loadFlats);
  const flats = useStore((s) => s.flats);

  const [showAnnounce, setShowAnnounce] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annLoading, setAnnLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [waSending, setWaSending] = useState(false);
  const [annOffset, setAnnOffset] = useState(6);
  const [annLoadingMore, setAnnLoadingMore] = useState(false);

  const load = useCallback(async () => {
    if (!user?.building_id) return;
    try {
      await loadDashboard(user.building_id);
      await loadFlats(user.building_id);
    } catch {}
    setInitialLoading(false);
  }, [user?.building_id]);

  useEffect(() => { load(); }, [load]);

  const verifyPayment = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('iyzico_pending_token');
      if (!token) return;
      const r = await api.payment.verify(token);
      if (r.success) {
        await AsyncStorage.removeItem('iyzico_pending_token');
        await refreshUser();
        showToast('Ödeme başarılı, abonelik aktif!', 'success');
      }
    } catch {}
  }, [refreshUser, showToast]);

  useEffect(() => {
    verifyPayment();
    if (Platform.OS === 'web') {
      const handler = () => verifyPayment();
      window.addEventListener('pageshow', handler);
      return () => window.removeEventListener('pageshow', handler);
    }
  }, [verifyPayment]);

  const handleCreateAnnouncement = async () => {
    if (!annTitle || !annContent) { showToast('Başlık ve içerik gerekli', 'error'); return; }
    setAnnLoading(true);
    try {
      await addAnnouncement(user!.building_id!, annTitle, annContent);
      showToast('Duyuru yayınlandı', 'success');
      setShowAnnounce(false);
      setAnnTitle('');
      setAnnContent('');

      sendAnnouncementNotification(annTitle, annContent);

      const recipients = (flats || [])
        .filter((f: any) => f.owner_phone && f.owner_phone.trim())
        .map((f: any) => ({ phone: f.owner_phone, name: f.owner_name || `Daire ${f.number}` }));

      if (recipients.length > 0) {
        setWaSending(true);
        const message = `*${building?.name || 'Apartman'}* - Yeni Duyuru\n\n*${annTitle}*\n\n${annContent}`;
        const result = await sendBulkWhatsApp(recipients, message, () => {});
        setWaSending(false);
        if (result.failed.length > 0) showToast(`${result.sent} kişiye gönderildi, ${result.failed.length} başarısız`, 'info');
        else showToast(`${result.sent} sakine WhatsApp ile gönderildi`, 'success');
      }
    } catch (e: any) { showToast(e.message || 'Hata oluştu', 'error'); }
    finally { setAnnLoading(false); }
  };

  const handleLoadMore = async () => {
    if (!user?.building_id) return;
    setAnnLoadingMore(true);
    await loadMoreAnnouncements(user.building_id, annOffset);
    setAnnOffset((p) => p + 6);
    setAnnLoadingMore(false);
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const navigation = useNavigation<any>();
  const subTier = user?.subscription_tier;
  const trialDaysLeft = useMemo(() => {
    if (subTier !== 'trial' || !user?.trial_end) return 0;
    const end = new Date(user.trial_end);
    return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
  }, [subTier, user?.trial_end]);

  const activeDaysLeft = useMemo(() => {
    if (subTier !== 'active' || !user?.subscription_expiry) return 0;
    const end = new Date(user.subscription_expiry);
    return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
  }, [subTier, user?.subscription_expiry]);

  return (
    <ScrollView style={[s.wrapper, { backgroundColor: c.background }]} contentContainerStyle={{ maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%', paddingBottom: 80 }}>
      <View style={s.header}>
        <Text style={[s.greeting, { color: c.textSecondary }]}>Hoş geldin,</Text>
        <Text style={[s.name, { color: c.text }]}>{user?.full_name}</Text>
        {building && <Text style={[s.building, { color: c.primary }]}>{building.name}</Text>}
      </View>

      {subTier === 'trial' && trialDaysLeft > 0 && (
        <View style={[s.subBanner, { backgroundColor: c.warningBg, marginHorizontal: 24 }]}>
          <View style={s.subBannerLeft}>
            <Ionicons name="time-outline" size={22} color={c.warning} />
            <View>
              <Text style={[s.subBannerTitle, { color: c.text }]}>Deneme Sürümü</Text>
              <Text style={[s.subBannerSub, { color: c.textSecondary }]}>{trialDaysLeft} gün kaldı · Tüm özellikler ücretsiz</Text>
            </View>
          </View>
          <TouchableOpacity style={[s.subBtn, { backgroundColor: c.warning }]} onPress={() => navigation.navigate('Subscription')}>
            <Text style={[s.subBtnText, { color: '#000' }]}>Abone Ol</Text>
          </TouchableOpacity>
        </View>
      )}

      {subTier === 'active' && activeDaysLeft > 0 && (
        <View style={[s.subBanner, { backgroundColor: c.successBg, marginHorizontal: 24 }]}>
          <View style={s.subBannerLeft}>
            <Ionicons name="checkmark-circle" size={22} color={c.success} />
            <View>
              <Text style={[s.subBannerTitle, { color: c.success }]}>Abonelik Aktif</Text>
              <Text style={[s.subBannerSub, { color: c.success }]}>{activeDaysLeft} gün kaldı</Text>
            </View>
          </View>
        </View>
      )}

      {initialLoading ? (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : (
        <>
        <View style={s.summaryRow}>
          <View style={[s.summaryCard, { backgroundColor: c.primaryBg }]}>
            <Text style={[s.summaryLabel, { color: c.textSecondary }]}>{months[currentMonth]} Toplanan</Text>
            <Text style={[s.summaryValue, { color: c.primary }, isDesktop && s.summaryValueDesktop]}>₺{duesStats?.paid_amount || 0}</Text>
            <Text style={[s.summarySub, { color: c.textMuted }]}>{duesStats?.paid || 0}/{duesStats?.total || 0} ödendi</Text>
          </View>
          <View style={[s.summaryCard, { backgroundColor: c.dangerBg }]}>
            <Text style={[s.summaryLabel, { color: c.textSecondary }]}>Bu Ay Gider</Text>
            <Text style={[s.summaryValue, { color: c.danger }, isDesktop && s.summaryValueDesktop]}>₺{expensesTotal}</Text>
            <Text style={[s.summarySub, { color: c.textMuted }]}>{months[currentMonth]} {currentYear}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: c.text }]}>Duyurular</Text>
          <View style={s.sectionHeader}>
            <TouchableOpacity onPress={() => setShowAnnounce(true)}>
              <Ionicons name="add-circle" size={28} color={c.textSecondary} />
            </TouchableOpacity>
          </View>
          {announcements.length === 0 ? (
            <View style={s.emptyState}>
              <Ionicons name="newspaper-outline" size={48} color={c.textMuted} />
              <Text style={[s.emptyText, { color: c.textMuted }]}>Henüz duyuru yok</Text>
            </View>
          ) : (
            <>
            {announcements.map((a: any, i: number) => (
              <View key={i} style={[s.announcement, { backgroundColor: c.surface }]}>
                <View style={s.annHeader}>
                  <Text style={[s.annTitle, { color: c.text }]}>{a.title}</Text>
                  <TouchableOpacity onPress={() => showConfirm('Duyuruyu Sil', `"${a.title}" silinsin mi?`, () => deleteAnnouncement(a.id))}>
                    <Ionicons name="trash-outline" size={16} color={c.danger} />
                  </TouchableOpacity>
                </View>
                <Text style={[s.annContent, { color: c.textSecondary }]} numberOfLines={2}>{a.content}</Text>
                <Text style={[s.annDate, { color: c.textMuted }]}>{new Date(a.created_at).toLocaleDateString('tr-TR')}</Text>
              </View>
            ))}
            {annTotal > announcements.length && (
              <TouchableOpacity style={[s.loadMoreBtn, { backgroundColor: c.surface }]} onPress={handleLoadMore} disabled={annLoadingMore}>
                {annLoadingMore ? <ActivityIndicator size="small" color={c.primary} /> : <Text style={[s.loadMoreText, { color: c.primary }]}>Daha Fazla ({annTotal - announcements.length})</Text>}
              </TouchableOpacity>
            )}
            </>
          )}
        </View>
        </>
      )}

      <Modal visible={showAnnounce} animationType="slide" transparent>
        <View style={[s.modalOverlay, { backgroundColor: c.overlay }]}>
          <View style={[s.modal, { backgroundColor: c.surface }, isDesktop && s.modalDesktop]}>
            <View style={[s.modalH, { borderBottomColor: c.border }]}>
              <Text style={[s.modalTitle, { color: c.text }]}>Yeni Duyuru</Text>
              <TouchableOpacity onPress={() => setShowAnnounce(false)}><Ionicons name="close" size={24} color={c.textSecondary} /></TouchableOpacity>
            </View>
            <View style={[s.modalBody, { paddingBottom: Math.max(20, insets.bottom + 8) }, isDesktop && { padding: 28 }]}>
              <Text style={[s.label, { color: c.textSecondary }]}>Başlık</Text>
              <TextInput style={[s.input, { backgroundColor: c.surfaceSecondary, borderColor: c.border, color: c.text }]} value={annTitle} onChangeText={setAnnTitle} placeholder="Duyuru başlığı" placeholderTextColor={c.textMuted} />
              <Text style={[s.label, { color: c.textSecondary }]}>İçerik</Text>
              <TextInput style={[s.input, { height: 120, textAlignVertical: 'top', backgroundColor: c.surfaceSecondary, borderColor: c.border, color: c.text }]} value={annContent} onChangeText={setAnnContent} placeholder="Duyuru metni..." multiline placeholderTextColor={c.textMuted} />
              <TouchableOpacity style={[s.button, { backgroundColor: c.accent }, annLoading && { opacity: 0.6 }]} onPress={handleCreateAnnouncement} disabled={annLoading}>
                {annLoading ? <ActivityIndicator size="small" color={c.accentText} /> : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="logo-whatsapp" size={20} color={c.accentText} />
                    <Text style={[s.buttonText, { color: c.accentText }]}>Yayınla ve WhatsApp ile Bildir</Text>
                  </View>
                )}
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
  header: { padding: 24, paddingTop: 40 },
  greeting: { fontSize: 16 },
  name: { fontSize: 24, fontWeight: 'bold' },
  building: { fontSize: 14, marginTop: 4, fontWeight: '600' },
  subBanner: { flexDirection: 'row', padding: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  subBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  subBannerTitle: { fontSize: 14, fontWeight: 'bold' },
  subBannerSub: { fontSize: 12, marginTop: 2 },
  subBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  subBtnText: { fontSize: 13, fontWeight: 'bold' },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 12, marginBottom: 8 },
  summaryCard: { flex: 1, padding: 20, borderRadius: 10 },
  summaryLabel: { fontSize: 13, marginBottom: 4 },
  summaryValue: { fontSize: 24, fontWeight: 'bold' },
  summaryValueDesktop: { fontSize: 32 },
  summarySub: { fontSize: 12, marginTop: 4 },
  section: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { marginTop: 8, fontSize: 14 },
  announcement: { padding: 16, borderRadius: 10, marginBottom: 8 },
  annHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  annTitle: { fontSize: 15, fontWeight: '600' },
  annContent: { fontSize: 13, lineHeight: 20 },
  annDate: { fontSize: 11, marginTop: 6 },
  loadMoreBtn: { padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  loadMoreText: { fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 16, borderTopRightRadius: 16, width: '100%' },
  modalDesktop: { maxWidth: 560, alignSelf: 'center', borderRadius: 12, marginBottom: 0 },
  modalH: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalBody: { padding: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  input: { padding: 14, borderRadius: 8, marginBottom: 14, fontSize: 15, borderWidth: 1 },
  button: { padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
