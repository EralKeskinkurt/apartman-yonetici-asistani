import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, TextInput, Modal, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../components/useResponsive';
import { requestPermission, scheduleDailyDuesReminder, isEnabled, setEnabled } from '../utils/notifications';
import { api } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { showConfirm } from '../utils/confirm';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const { contentMaxWidth } = useResponsive();
  const { showToast } = useToast();
  const navigation = useNavigation<any>();
  const c = theme.colors;

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);

  useEffect(() => { isEnabled().then(setNotifEnabled); }, []);

  const toggleNotifications = async (val: boolean) => {
    if (val) {
      const granted = await requestPermission();
      if (!granted) { showToast('Bildirim izni reddedildi', 'error'); return; }
      await setEnabled(true);
      await scheduleDailyDuesReminder();
      showToast('Bildirimler aktif', 'info');
    } else {
      await setEnabled(false);
      showToast('Bildirimler kapatıldı', 'info');
    }
    setNotifEnabled(val);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) { showToast('Tüm alanları doldurun', 'error'); return; }
    if (newPassword.length < 6) { showToast('Yeni şifre en az 6 karakter olmalı', 'error'); return; }
    setChangingPassword(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      showToast('Şifre değiştirildi', 'success');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (e: any) { showToast(e.message || 'Hata oluştu', 'error'); }
    finally { setChangingPassword(false); }
  };

  return (
    <ScrollView
      style={[s.wrapper, { backgroundColor: c.background }]}
      contentContainerStyle={{ maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%', paddingBottom: 80 }}
    >
      <View style={s.profileHeader}>
        <View style={[s.avatar, { backgroundColor: c.primary }]}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={s.avatarImg} />
          ) : (
            <Text style={s.avatarText}>{user?.full_name?.charAt(0)?.toUpperCase()}</Text>
          )}
        </View>
        <Text style={[s.name, { color: c.text }]}>{user?.full_name}</Text>
        <Text style={[s.email, { color: c.textSecondary }]}>{user?.email}</Text>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: c.textMuted }]}>Görünüm</Text>
        <View style={[s.menuItem, { backgroundColor: c.surface }]}>
          <Ionicons name={isDark ? 'moon' : 'sunny'} size={22} color={c.primary} />
          <Text style={[s.menuText, { color: c.text }]}>Karanlık Mod</Text>
          <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: c.border, true: c.primary }} thumbColor="#fff" />
        </View>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: c.textMuted }]}>Bildirimler</Text>
        <View style={[s.menuItem, { backgroundColor: c.surface }]}>
          <Ionicons name="notifications-outline" size={22} color={c.primary} />
          <Text style={[s.menuText, { color: c.text }]}>Aidat Hatırlatması</Text>
          <Switch
            value={notifEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ false: c.border, true: c.primary }}
            thumbColor="#fff"
          />
        </View>
        <Text style={[s.hint, { color: c.textMuted }]}>Her gün 09:00'da ödenmemiş aidatlar için hatırlatma gönderilir.</Text>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: c.textMuted }]}>Yönetim</Text>
        <TouchableOpacity style={[s.menuItem, { backgroundColor: c.surface }]} onPress={() => navigation.navigate('Building')}>
          <Ionicons name="business-outline" size={22} color={c.primary} />
          <Text style={[s.menuText, { color: c.text }]}>Apartman Bilgileri</Text>
          <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.menuItem, { backgroundColor: c.surface }]} onPress={() => navigation.navigate('Flats')}>
          <Ionicons name="people-outline" size={22} color={c.primary} />
          <Text style={[s.menuText, { color: c.text }]}>Sakinler</Text>
          <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.menuItem, { backgroundColor: c.surface }]} onPress={() => navigation.navigate('Subscription')}>
          <Ionicons name="card-outline" size={22} color={c.success} />
          <Text style={[s.menuText, { color: c.text }]}>Abonelik</Text>
          <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.menuItem, { backgroundColor: c.surface }]} onPress={() => navigation.navigate('Reports')}>
          <Ionicons name="document-text-outline" size={22} color={c.primary} />
          <Text style={[s.menuText, { color: c.text }]}>Raporlar</Text>
          <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.menuItem, { backgroundColor: c.surface }]} onPress={() => navigation.navigate('Polls')}>
          <Ionicons name="stats-chart-outline" size={22} color={c.primary} />
          <Text style={[s.menuText, { color: c.text }]}>Oylamalar</Text>
          <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: c.textMuted }]}>Ayarlar</Text>
        <TouchableOpacity style={[s.menuItem, { backgroundColor: c.surface }]} onPress={() => setShowPasswordModal(true)}>
          <Ionicons name="lock-closed-outline" size={22} color={c.primary} />
          <Text style={[s.menuText, { color: c.text }]}>Şifre Değiştir</Text>
          <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.menuItem, { backgroundColor: c.surface }]}>
          <Ionicons name="help-circle-outline" size={22} color={c.primary} />
          <Text style={[s.menuText, { color: c.text }]}>Yardım</Text>
          <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
        </TouchableOpacity>
      </View>

      <Modal visible={showPasswordModal} animationType="slide" transparent>
        <View style={[s.modalOverlay, { backgroundColor: c.overlay }]}>
          <View style={[s.modal, { backgroundColor: c.surface }]}>
            <View style={[s.modalH, { borderBottomColor: c.border }]}>
              <Text style={[s.modalTitle, { color: c.text }]}>Şifre Değiştir</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                <Ionicons name="close" size={24} color={c.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={s.modalBody}>
              <TextInput
                style={[s.input, { backgroundColor: c.surfaceSecondary, borderColor: c.border, color: c.text }]}
                placeholder="Mevcut Şifre"
                placeholderTextColor={c.textMuted}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
              />
              <TextInput
                style={[s.input, { backgroundColor: c.surfaceSecondary, borderColor: c.border, color: c.text }]}
                placeholder="Yeni Şifre (en az 6 karakter)"
                placeholderTextColor={c.textMuted}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: c.accent }, changingPassword && { opacity: 0.6 }]}
                onPress={handleChangePassword}
                disabled={changingPassword}
              >
                <Text style={[s.saveBtnText, { color: c.accentText }]}>{changingPassword ? 'Değiştiriliyor...' : 'Şifreyi Değiştir'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TouchableOpacity style={[s.signOutButton, { backgroundColor: c.dangerBg }]} onPress={() => showConfirm('Çıkış Yap', 'Emin misiniz?', signOut)}>
        <Ionicons name="log-out-outline" size={20} color={c.danger} />
        <Text style={[s.signOutText, { color: c.danger }]}>Çıkış Yap</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrapper: { flex: 1 },
  profileHeader: { alignItems: 'center', padding: 32, paddingTop: 40 },
  avatar: { width: 80, height: 80, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden' },
  avatarImg: { width: 80, height: 80, borderRadius: 30 },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  name: { fontSize: 20, fontWeight: 'bold' },
  email: { fontSize: 14, marginTop: 4 },
  section: { paddingHorizontal: 24, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 8, marginBottom: 6, gap: 12 },
  menuText: { flex: 1, fontSize: 15 },
  signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 24, padding: 14, borderRadius: 8, gap: 8 },
  signOutText: { fontWeight: '600', fontSize: 15 },
  hint: { fontSize: 12, paddingHorizontal: 14, marginTop: -2, marginBottom: 8 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxWidth: 560, alignSelf: 'center', width: '100%' },
  modalH: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalBody: { padding: 20 },
  input: { padding: 14, borderRadius: 8, marginBottom: 14, fontSize: 15, borderWidth: 1 },
  saveBtn: { padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 15, fontWeight: 'bold' },
});
