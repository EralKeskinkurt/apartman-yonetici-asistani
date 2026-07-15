import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../components/useResponsive';
import { useToast } from '../components/ToastProvider';

export default function SetupScreen() {
  const { user, refreshUser } = useAuth();
  const { theme } = useTheme();
  const { isDesktop } = useResponsive();
  const { showToast, showLoading, hideLoading } = useToast();
  const c = theme.colors;
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [totalFlats, setTotalFlats] = useState('');
  const [monthlyDues, setMonthlyDues] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateBuilding = async () => {
    if (!name || !address || !totalFlats || !monthlyDues) { showToast('Tüm alanları doldurun', 'error'); return; }
    const flatCount = Number(totalFlats);
    if (isNaN(flatCount) || flatCount < 1 || flatCount > 200) { showToast('Daire sayısı 1-200 arasında olmalı', 'error'); return; }
    setLoading(true);
    showLoading('Apartman oluşturuluyor...');
    try {
      const building: any = await api.buildings.create(name, address, flatCount, Number(monthlyDues));
      const flatRecords: any[] = [];
      for (let i = 1; i <= flatCount; i++) flatRecords.push({ floor: Math.ceil(i / 4), number: i, ownerName: '', ownerPhone: '' });
      const createdFlats: any[] = await api.flats.createBatch(building.id, flatRecords);
      await refreshUser();
      const now = new Date();
      const dueRecords = createdFlats.map((f: any) => ({ flatId: f.id, amount: Number(monthlyDues), month: now.getMonth(), year: now.getFullYear() }));
      await api.dues.createBatch(building.id, dueRecords);
      showToast(`${name} başarıyla oluşturuldu`, 'success');
    } catch (e: any) { showToast(e.message || 'Bir hata oluştu', 'error'); }
    finally { setLoading(false); hideLoading(); }
  };

  return (
    <KeyboardAvoidingView style={[s.container, { backgroundColor: c.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[s.scroll, isDesktop && { maxWidth: 500, alignSelf: 'center', width: '100%' }]} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <View style={[s.iconCircle, { backgroundColor: c.primaryBg }]}>
            <Ionicons name="business" size={48} color={c.primary} />
          </View>
          <Text style={[s.title, { color: c.text }]}>Apartmanını Oluştur</Text>
          <Text style={[s.subtitle, { color: c.textSecondary }]}>Apartman bilgilerini girerek yönetime başla.</Text>
        </View>

        <View style={s.form}>
          <Text style={[s.label, { color: c.textSecondary }]}>Apartman Adı</Text>
          <TextInput style={[s.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]} placeholder="örn. Gül Apartmanı" placeholderTextColor={c.textMuted} value={name} onChangeText={setName} />
          <Text style={[s.label, { color: c.textSecondary }]}>Adres</Text>
          <TextInput style={[s.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]} placeholder="Mahalle, Sokak, No, İlçe/İl" placeholderTextColor={c.textMuted} value={address} onChangeText={setAddress} multiline />
          <View style={s.row}>
            <View style={s.half}>
              <Text style={[s.label, { color: c.textSecondary }]}>Daire Sayısı</Text>
              <TextInput style={[s.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]} placeholder="10" placeholderTextColor={c.textMuted} value={totalFlats} onChangeText={setTotalFlats} keyboardType="number-pad" />
            </View>
            <View style={s.half}>
              <Text style={[s.label, { color: c.textSecondary }]}>Aylık Aidat (₺)</Text>
              <TextInput style={[s.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]} placeholder="500" placeholderTextColor={c.textMuted} value={monthlyDues} onChangeText={setMonthlyDues} keyboardType="decimal-pad" />
            </View>
          </View>
          <TouchableOpacity style={[s.button, { backgroundColor: c.accent }, loading && { opacity: 0.6 }]} onPress={handleCreateBuilding} disabled={loading}>
            {loading ? <ActivityIndicator color={c.accentText} /> : (
              <>
                <Ionicons name="checkmark-circle" size={22} color={c.accentText} />
                <Text style={[s.buttonText, { color: c.accentText }]}>Apartmanı Oluştur</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40, paddingHorizontal: 24 },
  header: { alignItems: 'center', paddingTop: 48, paddingBottom: 24, paddingHorizontal: 32 },
  iconCircle: { width: 100, height: 100, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  form: { paddingHorizontal: 24 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  input: { padding: 14, borderRadius: 8, marginBottom: 14, fontSize: 15, borderWidth: 1 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  button: { padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});

