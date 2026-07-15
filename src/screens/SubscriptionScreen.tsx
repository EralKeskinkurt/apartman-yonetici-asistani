import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../components/useResponsive';
import { useToast } from '../components/ToastProvider';
import { api } from '../services/api';

const PENDING_TOKEN_KEY = 'iyzico_pending_token';

export default function SubscriptionScreen() {
  const { user, refreshUser } = useAuth();
  const { theme } = useTheme();
  const { contentMaxWidth } = useResponsive();
  const { showToast } = useToast();
  const c = theme.colors;

  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [expireMonth, setExpireMonth] = useState('');
  const [expireYear, setExpireYear] = useState('');
  const [cvc, setCvc] = useState('');
  const [showCardForm, setShowCardForm] = useState(false);

  const loadStatus = async () => {
    try { setStatus(await api.payment.status()); } catch {}
  };

  const verifyPendingPayment = useCallback(async () => {
    try {
      const storedToken = await AsyncStorage.getItem(PENDING_TOKEN_KEY);
      if (storedToken) {
        setVerifying(true);
        const result = await api.payment.verify(storedToken);
        if (result.success) {
          await AsyncStorage.removeItem(PENDING_TOKEN_KEY);
          showToast('Ödeme başarılı, abonelik aktif!', 'success');
          refreshUser();
          loadStatus();
        } else {
          showToast(result.error || 'Ödeme doğrulanamadı', 'error');
        }
        setVerifying(false);
      }
    } catch {
      setVerifying(false);
    }
  }, [showToast, refreshUser]);

  useEffect(() => { 
    loadStatus(); 
    verifyPendingPayment();
    if (Platform.OS === 'web') {
      const handler = () => verifyPendingPayment();
      window.addEventListener('pageshow', handler);
      return () => window.removeEventListener('pageshow', handler);
    }
  }, [verifyPendingPayment]);

  const handlePayWithCard = async () => {
    const rawCard = cardNumber.replace(/\D/g, '');
    if (rawCard.length < 15 || !cardHolder || !expireMonth || !expireYear || !cvc) {
      showToast('Tüm kart bilgilerini doldurun', 'error');
      return;
    }
    setLoading(true);
    try {
      const result = await api.payment.payWithCard({
        cardNumber: rawCard,
        expireMonth,
        expireYear,
        cvc,
        cardHolderName: cardHolder,
      });
      if (result.success) {
        showToast('Ödeme başarılı, abonelik aktif!', 'success');
        refreshUser();
        loadStatus();
      } else if (result.threeds && result.htmlContent) {
        if (Platform.OS === 'web') {
          document.open();
          document.write(result.htmlContent);
          document.close();
        } else {
          showToast('3D Secure doğrulaması gerekiyor. Lütfen web üzerinden deneyin.', 'error');
        }
      } else {
        showToast(result.error || 'Ödeme başarısız', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Hata oluştu', 'error');
    }
    setLoading(false);
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      await api.payment.cancelSubscription();
      showToast('Abonelik iptal edildi', 'success');
      refreshUser();
      loadStatus();
    } catch (e: any) { showToast(e.message, 'error'); }
    setLoading(false);
  };

  const isActive = status?.tier === 'active' && !status?.isExpired;
  const daysLeft = status?.daysLeft || 0;

  return (
    <ScrollView style={[s.wrapper, { backgroundColor: c.background }]} contentContainerStyle={{ maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%', paddingBottom: 80 }}>
      <View style={s.header}><Text style={[s.title, { color: c.text }]}>Abonelik</Text></View>

      {isActive ? (
        <View style={[s.banner, { backgroundColor: c.successBg }]}>
          <Ionicons name="checkmark-circle" size={24} color={c.success} />
          <View style={s.bannerContent}>
            <Text style={[s.bannerTitle, { color: c.success }]}>Abonelik Aktif</Text>
            <Text style={[s.bannerSub, { color: c.success }]}>{daysLeft} gün kaldı{status?.cardLast4 ? ` · Kart: **** ${status.cardLast4}` : ''}</Text>
          </View>
        </View>
      ) : (
        <View style={[s.banner, { backgroundColor: c.primaryBg }]}>
          <Ionicons name="card-outline" size={24} color={c.primary} />
          <View style={s.bannerContent}>
            <Text style={[s.bannerTitle, { color: c.text }]}>Aylık Abonelik</Text>
            <Text style={[s.bannerSub, { color: c.textSecondary }]}>Apartman yönetimini tam sürüm kullanın</Text>
          </View>
        </View>
      )}

      <View style={[s.card, { backgroundColor: c.surface }]}>
        <Text style={[s.cardTitle, { color: c.text }]}>Apartman Pro</Text>
        <Text style={[s.price, { color: c.text }]}>₺99<Text style={s.period}>/ay</Text></Text>

        <View style={s.features}>
          {['Sınırsız daire', 'Aidat takibi', 'Gider yönetimi', 'Raporlar', 'WhatsApp hatırlatma', 'Sakin girişi', 'Oylama sistemi'].map((f, i) => (
            <View key={i} style={s.feat}>
              <Ionicons name="checkmark" size={18} color={c.success} />
              <Text style={[s.featText, { color: c.textSecondary }]}>{f}</Text>
            </View>
          ))}
        </View>

        {verifying ? (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <ActivityIndicator size="large" color={c.primary} style={{ marginBottom: 12 }} />
            <Text style={[s.cardTitle, { color: c.text }]}>Ödeme doğrulanıyor...</Text>
            <Text style={[s.bannerSub, { color: c.textSecondary, marginTop: 4 }]}>Lütfen bekleyin</Text>
          </View>
        ) : isActive ? (
          <>
            {status?.cardLast4 && (
              <View style={[s.cardInfo, { backgroundColor: c.successBg }]}>
                <Ionicons name="card" size={18} color={c.success} />
                <Text style={[s.cardInfoText, { color: c.success }]}>Kart: **** {status.cardLast4}</Text>
              </View>
            )}
            <TouchableOpacity style={[s.btn, { backgroundColor: c.dangerBg }]} onPress={handleCancel} disabled={loading}>
              <Ionicons name="close-circle-outline" size={20} color={c.danger} />
              <Text style={[s.btnText, { color: c.danger }]}>Aboneliği İptal Et</Text>
            </TouchableOpacity>
          </>
        ) : !showCardForm ? (
          <TouchableOpacity style={[s.btn, { backgroundColor: c.accent }]} onPress={() => setShowCardForm(true)}>
            <Ionicons name="card-outline" size={20} color={c.accentText} />
            <Text style={[s.btnText, { color: c.accentText }]}>Abone Ol - ₺99/ay</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TextInput
              style={[s.cardInput, { backgroundColor: c.surfaceSecondary, borderColor: c.border, color: c.text }]}
              placeholder="Kart Numarası"
              placeholderTextColor={c.textMuted}
              keyboardType="number-pad"
              maxLength={19}
              value={cardNumber}
              onChangeText={(t) => setCardNumber(t.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 '))}
            />
            <TextInput
              style={[s.cardInput, { backgroundColor: c.surfaceSecondary, borderColor: c.border, color: c.text }]}
              placeholder="Kart Üzerindeki Ad Soyad"
              placeholderTextColor={c.textMuted}
              value={cardHolder}
              onChangeText={setCardHolder}
            />
            <View style={s.expireRow}>
              <TextInput
                style={[s.cardInput, { flex: 1, backgroundColor: c.surfaceSecondary, borderColor: c.border, color: c.text }]}
                placeholder="Ay (AA)"
                placeholderTextColor={c.textMuted}
                keyboardType="number-pad"
                maxLength={2}
                value={expireMonth}
                onChangeText={(t) => setExpireMonth(t.replace(/\D/g, '').slice(0, 2))}
              />
              <TextInput
                style={[s.cardInput, { flex: 1, backgroundColor: c.surfaceSecondary, borderColor: c.border, color: c.text }]}
                placeholder="Yıl (YY)"
                placeholderTextColor={c.textMuted}
                keyboardType="number-pad"
                maxLength={2}
                value={expireYear}
                onChangeText={(t) => setExpireYear(t.replace(/\D/g, '').slice(0, 2))}
              />
            </View>
            <TextInput
              style={[s.cardInput, { backgroundColor: c.surfaceSecondary, borderColor: c.border, color: c.text }]}
              placeholder="CVC (Kart arkasındaki 3 haneli kod)"
              placeholderTextColor={c.textMuted}
              keyboardType="number-pad"
              maxLength={3}
              secureTextEntry
              value={cvc}
              onChangeText={(t) => setCvc(t.replace(/\D/g, '').slice(0, 3))}
            />
            <View style={s.row}>
              <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: c.border }]} onPress={() => { setShowCardForm(false); setCardNumber(''); setCardHolder(''); setExpireMonth(''); setExpireYear(''); setCvc(''); }} disabled={loading}>
                <Text style={[s.btnText, { color: c.textSecondary }]}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: c.accent }]} onPress={handlePayWithCard} disabled={loading}>
                {loading ? <ActivityIndicator color={c.accentText} /> : (
                  <Text style={[s.btnText, { color: c.accentText }]}>₺99 Öde</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrapper: { flex: 1 },
  header: { padding: 24, paddingTop: 40 },
  title: { fontSize: 22, fontWeight: 'bold' },
  banner: { flexDirection: 'row', gap: 14, marginHorizontal: 24, padding: 16, borderRadius: 10, alignItems: 'center' },
  bannerContent: { flex: 1 },
  bannerTitle: { fontSize: 15, fontWeight: 'bold' },
  bannerSub: { fontSize: 13, marginTop: 2 },
  card: { marginHorizontal: 24, marginTop: 16, padding: 24, borderRadius: 10 },
  cardTitle: { fontSize: 20, fontWeight: 'bold' },
  price: { fontSize: 36, fontWeight: 'bold', marginTop: 8, marginBottom: 16 },
  period: { fontSize: 16, fontWeight: '400' },
  features: { gap: 10, marginBottom: 20 },
  feat: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featText: { fontSize: 14 },
  cardInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, marginBottom: 12 },
  cardInfoText: { fontSize: 13, fontWeight: '500' },
  btn: { flexDirection: 'row', padding: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  btnText: { fontSize: 15, fontWeight: 'bold' },
  inputGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, marginTop: 8, overflow: 'hidden' },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, outlineWidth: 0 },
  cardInput: { width: '100%', padding: 12, borderRadius: 8, borderWidth: 1, fontSize: 15, marginTop: 8, outlineWidth: 0 },
  expireRow: { flexDirection: 'row', gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
});
