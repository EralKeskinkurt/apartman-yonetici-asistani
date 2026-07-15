import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../components/useResponsive';
import { useToast } from '../components/ToastProvider';
import { api, setToken } from '../services/api';
import { useGoogleAuth } from '../utils/googleAuth';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const { theme } = useTheme();
  const { isDesktop } = useResponsive();
  const { showToast, showLoading, hideLoading } = useToast();
  const c = theme.colors;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [isResident, setIsResident] = useState(false);
  const [loading, setLoading] = useState(false);

  const { googleLogin, error: googleError } = useGoogleAuth(
    isResident ? inviteCode : undefined,
    isResident && isRegister ? flatNumber : undefined,
    () => { if (Platform.OS === 'web') window.location.reload(); }
  );

  useEffect(() => { if (googleError) showToast(googleError, 'error'); }, [googleError]);

  const handleSubmit = async () => {
    if (!email || !password) { showToast('Lütfen tüm alanları doldurun', 'error'); return; }
    if (isRegister && !fullName) { showToast('Ad soyad gerekli', 'error'); return; }
    if (isRegister && isResident && !inviteCode) { showToast('Sakin kaydı için davet kodu gerekli', 'error'); return; }
    setLoading(true);
    showLoading(isRegister ? 'Kayıt yapılıyor...' : 'Giriş yapılıyor...');
    try {
      if (isRegister) {
        if (isResident) {
          const result = await api.auth.residentRegister(email, password, fullName, inviteCode, flatNumber || undefined);
          await setToken(result.token);
          showToast('Hesabınız oluşturuldu', 'success');
        } else {
          await signUp(email, password, fullName);
          showToast('Hesabınız oluşturuldu', 'success');
        }
      } else {
        await signIn(email, password);
      }
    } catch (e: any) { showToast(e.message || 'Hata oluştu', 'error'); }
    finally { setLoading(false); hideLoading(); }
  };

  const handleGoogleSignIn = () => {
    if (isResident && !inviteCode) { showToast('Sakin girişi için davet kodu gerekli', 'error'); return; }
    googleLogin();
  };

  return (
    <KeyboardAvoidingView style={[s.container, { backgroundColor: c.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[s.inner, isDesktop && s.innerDesktop]}>
        <View style={[s.iconCircle, { backgroundColor: c.primaryBg, alignSelf: 'center', marginBottom: 20 }]}><Ionicons name="business" size={48} color={c.primary} /></View>
        <Text style={[s.title, { color: c.text }]}>Apartman Asistanı</Text>
        <Text style={[s.subtitle, { color: c.textSecondary }]}>{isRegister ? (isResident ? 'Sakin Kaydı' : 'Yönetici Kaydı') : (isResident ? 'Sakin Girişi' : 'Yönetici Girişi')}</Text>

        <View style={s.roleRow}>
          <TouchableOpacity style={[s.roleBtn, { backgroundColor: !isResident ? c.accent : c.surface, borderColor: c.border }]} onPress={() => setIsResident(false)}>
            <Ionicons name="shield" size={18} color={!isResident ? c.accentText : c.textSecondary} /><Text style={[s.roleText, { color: !isResident ? c.accentText : c.textSecondary }]}>Yönetici</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.roleBtn, { backgroundColor: isResident ? c.accent : c.surface, borderColor: c.border }]} onPress={() => setIsResident(true)}>
            <Ionicons name="person" size={18} color={isResident ? c.accentText : c.textSecondary} /><Text style={[s.roleText, { color: isResident ? c.accentText : c.textSecondary }]}>Sakin</Text>
          </TouchableOpacity>
        </View>

        {isRegister && <TextInput style={[s.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]} placeholder="Ad Soyad" placeholderTextColor={c.textMuted} value={fullName} onChangeText={setFullName} autoCapitalize="words" />}
        <TextInput style={[s.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]} placeholder="E-posta" placeholderTextColor={c.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <TextInput style={[s.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]} placeholder="Şifre" placeholderTextColor={c.textMuted} value={password} onChangeText={setPassword} secureTextEntry />
        {isResident && (
          <>
            <TextInput style={[s.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]} placeholder="Davet Kodu (örn: ABC123)" placeholderTextColor={c.textMuted} value={inviteCode} onChangeText={(t) => setInviteCode(t.toUpperCase())} autoCapitalize="characters" />
            {isRegister && <TextInput style={[s.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]} placeholder="Daire No (isteğe bağlı)" placeholderTextColor={c.textMuted} value={flatNumber} onChangeText={setFlatNumber} keyboardType="number-pad" />}
          </>
        )}

        <TouchableOpacity style={[s.button, { backgroundColor: c.accent }, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color={c.accentText} /> : <Text style={[s.buttonText, { color: c.accentText }]}>{isRegister ? 'Kayıt Ol' : 'Giriş Yap'}</Text>}
        </TouchableOpacity>

        <View style={s.divider}><View style={[s.dividerLine, { backgroundColor: c.border }]} /><Text style={[s.dividerText, { color: c.textMuted }]}>veya</Text><View style={[s.dividerLine, { backgroundColor: c.border }]} /></View>

        <TouchableOpacity style={[s.googleBtn, { borderColor: c.border }]} onPress={handleGoogleSignIn}>
          <Ionicons name="logo-google" size={20} color="#4285F4" /><Text style={s.googleBtnText}>Google ile {isRegister ? 'Kayıt Ol' : 'Giriş Yap'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsRegister(!isRegister)}>
          <Text style={[s.switch, { color: c.primaryLight }]}>{isRegister ? 'Zaten hesabın var mı? Giriş yap' : 'Hesabın yok mu? Kayıt ol'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  inner: { width: '100%', paddingHorizontal: 32 },
  innerDesktop: { maxWidth: 420 },
  iconCircle: { width: 100, height: 100, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 12 },
  input: { padding: 16, borderRadius: 8, marginBottom: 12, fontSize: 16, borderWidth: 1 },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  roleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 8, borderWidth: 1 },
  roleText: { fontSize: 14, fontWeight: '600' },
  button: { padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonText: { fontSize: 16, fontWeight: 'bold' },
  divider: { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 12, fontSize: 13 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 8, borderWidth: 1, gap: 10 },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  switch: { textAlign: 'center', marginTop: 24, fontSize: 14 },
});
