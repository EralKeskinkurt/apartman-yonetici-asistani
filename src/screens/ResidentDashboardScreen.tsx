import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../components/useResponsive';
import { useToast } from '../components/ToastProvider';
import { showConfirm } from '../utils/confirm';
import { useStore } from '../store';

const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export default function ResidentDashboardScreen() {
  const { user, signOut } = useAuth();
  const { theme } = useTheme();
  const { contentMaxWidth } = useResponsive();
  const { showToast } = useToast();
  const c = theme.colors;

  const announcements = useStore((s) => s.announcements);
  const annTotal = useStore((s) => s.annTotal);
  const polls = useStore((s) => s.polls);
  const loadDashboard = useStore((s) => s.loadDashboard);
  const loadPolls = useStore((s) => s.loadPolls);
  const loadAnnouncements = useStore((s) => s.loadAnnouncements);
  const loadMoreAnnouncements = useStore((s) => s.loadMoreAnnouncements);
  const votePoll = useStore((s) => s.votePoll);
  const loadDues = useStore((s) => s.loadDues);
  const dues = useStore((s) => s.dues);
  const building = useStore((s) => s.building);
  const flats = useStore((s) => s.flats);
  const loadFlats = useStore((s) => s.loadFlats);

  const [myDues, setMyDues] = useState<any[]>([]);
  const [myFlat, setMyFlat] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [annOffset, setAnnOffset] = useState(6);
  const [annLoadingMore, setAnnLoadingMore] = useState(false);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!user?.building_id) return;
    setLoading(true);
    Promise.all([
      loadDashboard(user.building_id),
      loadPolls(user.building_id),
      loadFlats(user.building_id),
      loadDues(user.building_id, currentMonth, currentYear),
    ]).finally(() => setLoading(false));
  }, [user?.building_id]);

  useEffect(() => {
    if (user?.flat_id && flats.length > 0) {
      const f = flats.find((x: any) => x.id === user.flat_id);
      setMyFlat(f || null);
    }
    const my = dues.filter((d: any) => d.flat_id === user?.flat_id);
    setMyDues(my);
  }, [dues, flats, user?.flat_id]);

  const handleLoadMore = async () => {
    if (!user?.building_id) return;
    setAnnLoadingMore(true);
    await loadMoreAnnouncements(user.building_id, annOffset);
    setAnnOffset((p) => p + 6);
    setAnnLoadingMore(false);
  };

  const totalUnpaid = myDues.reduce((s: number, d: any) => s + (d.is_paid ? 0 : d.amount), 0);
  const totalPaid = myDues.filter((d: any) => d.is_paid).length;

  if (loading) return <View style={[s.loading, { backgroundColor: c.background }]}><ActivityIndicator size="large" color={c.primary} /></View>;

  return (
    <ScrollView style={[s.wrapper, { backgroundColor: c.background }]} contentContainerStyle={{ maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%', paddingBottom: 80 }}>
      <View style={s.header}>
        {user?.picture ? <Image source={{ uri: user.picture }} style={s.avatar} /> : null}
        <Text style={[s.greeting, { color: c.textSecondary }]}>Hoş geldin,</Text>
        <Text style={[s.name, { color: c.text }]}>{user?.full_name}</Text>
        {building && <Text style={[s.building, { color: c.primary }]}>{building.name}</Text>}
        {myFlat && <Text style={[s.flatInfo, { color: c.textSecondary }]}>Daire #{myFlat.number} · {myFlat.is_rented ? 'Kiracı' : 'Ev Sahibi'}</Text>}
        <TouchableOpacity style={[s.logoutBtn, { backgroundColor: c.dangerBg }]} onPress={() => showConfirm('Çıkış', 'Emin misiniz?', signOut)}>
          <Text style={[s.logoutText, { color: c.danger }]}>Çıkış</Text>
        </TouchableOpacity>
      </View>

      {myFlat && (
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: c.text }]}>Aidat Durumum</Text>
          <View style={[s.duesCard, { backgroundColor: c.surface }]}>
            <View style={s.duesRow}>
              {myDues.length === 0 ? (
                <Text style={[s.duesValue, { color: c.textMuted, textAlign: 'center', flex: 1 }]}>Bu ay aidat kaydı yok</Text>
              ) : (
              <>
              <View style={s.duesStat}>
                <Text style={[s.duesLabel, { color: c.textSecondary }]}>{months[currentMonth]} {totalUnpaid > 0 ? 'Borcum' : 'Durum'}</Text>
                <Text style={[s.duesValue, { color: totalUnpaid > 0 ? c.danger : c.success }]}>{totalUnpaid > 0 ? `₺${totalUnpaid}` : 'Ödendi'}</Text>
              </View>
              <View style={s.duesStat}><Text style={[s.duesLabel, { color: c.textSecondary }]}>Bu Ay</Text><Text style={[s.duesValue, { color: totalPaid > 0 ? c.success : c.textMuted }]}>{totalPaid > 0 ? `${totalPaid}/${myDues.length} ödendi` : 'Ödenmedi'}</Text></View>
              </>
              )}
            </View>
          </View>
        </View>
      )}

      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: c.text }]}>Duyurular</Text>
        {announcements.length === 0 ? (
          <View style={[s.emptyState, { backgroundColor: c.surface }]}><Ionicons name="newspaper-outline" size={32} color={c.textMuted} /><Text style={[s.emptyText, { color: c.textMuted }]}>Henüz duyuru yok</Text></View>
        ) : (
          <>
          {announcements.map((a: any, i: number) => (
            <View key={i} style={[s.announcement, { backgroundColor: c.surface }]}>
              <Text style={[s.annTitle, { color: c.text }]}>{a.title}</Text>
              <Text style={[s.annContent, { color: c.textSecondary }]}>{a.content}</Text>
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

      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: c.text }]}>Oylamalar</Text>
        {polls.length === 0 ? (
          <View style={[s.emptyState, { backgroundColor: c.surface }]}><Ionicons name="stats-chart-outline" size={32} color={c.textMuted} /><Text style={[s.emptyText, { color: c.textMuted }]}>Henüz oylama yok</Text></View>
        ) : polls.map((poll: any) => (
          <View key={poll.id} style={[s.pollCard, { backgroundColor: c.surface }]}>
            <Text style={[s.pollTitle, { color: c.text }]}>{poll.title}</Text>
            {poll.description ? <Text style={[s.pollDesc, { color: c.textSecondary }]}>{poll.description}</Text> : null}
            {poll.options.map((opt: string, idx: number) => {
              const isMyVote = poll.myVote === idx;
              const voteCount = poll.votes?.[idx] || 0;
              const pct = poll.totalVotes > 0 ? Math.round((voteCount / poll.totalVotes) * 100) : 0;
              return (
                <TouchableOpacity key={idx} style={[s.pollOption, { borderColor: c.border }, isMyVote && { borderColor: c.primary, backgroundColor: c.primaryBg }]} onPress={() => votePoll(poll.id, idx, isMyVote)}>
                  <View style={s.pollOptionLeft}>
                    <Ionicons name={isMyVote ? 'radio-button-on' : 'radio-button-off'} size={20} color={isMyVote ? c.primary : c.textMuted} />
                    <Text style={[s.pollOptionText, { color: c.text }, isMyVote && { fontWeight: 'bold' }]}>{opt}</Text>
                    {isMyVote && <Text style={s.unvoteHint}>(iptal için tekrar tıkla)</Text>}
                  </View>
                  <View style={s.pollVoteInfo}>
                    <View style={[s.pollBar, { backgroundColor: c.border }]}><View style={[s.pollBarFill, { width: `${pct}%`, backgroundColor: isMyVote ? c.primary : c.textMuted }]} /></View>
                    <Text style={[s.pollVoteCount, { color: c.textSecondary }]}>{voteCount} ({pct}%)</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <Text style={[s.pollTotal, { color: c.textMuted }]}>Toplam {poll.totalVotes} oy</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrapper: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 24, paddingTop: 40 },
  avatar: { width: 64, height: 64, borderRadius: 32, marginBottom: 12 },
  greeting: { fontSize: 16 },
  name: { fontSize: 24, fontWeight: 'bold' },
  building: { fontSize: 14, marginTop: 4, fontWeight: '600' },
  flatInfo: { fontSize: 13, marginTop: 2 },
  logoutBtn: { position: 'absolute', top: 44, right: 24, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  logoutText: { fontSize: 13, fontWeight: '600' },
  section: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 24, borderRadius: 10 },
  emptyText: { marginTop: 8, fontSize: 14 },
  duesCard: { padding: 16, borderRadius: 10 },
  duesRow: { flexDirection: 'row', marginBottom: 12 },
  duesStat: { flex: 1 },
  duesLabel: { fontSize: 13, marginBottom: 4 },
  duesValue: { fontSize: 22, fontWeight: 'bold' },
  announcement: { padding: 16, borderRadius: 10, marginBottom: 8 },
  annTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  annContent: { fontSize: 13, lineHeight: 20 },
  annDate: { fontSize: 11, marginTop: 6 },
  loadMoreBtn: { padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  loadMoreText: { fontSize: 14, fontWeight: '600' },
  pollCard: { padding: 16, borderRadius: 10, marginBottom: 12 },
  pollTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  pollDesc: { fontSize: 13, marginBottom: 12 },
  pollOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 6 },
  pollOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  pollOptionText: { fontSize: 14 },
  unvoteHint: { fontSize: 10, color: '#9ca3af', marginLeft: 4 },
  pollVoteInfo: { alignItems: 'flex-end', minWidth: 80 },
  pollBar: { width: 60, height: 6, borderRadius: 3, marginBottom: 2, overflow: 'hidden' },
  pollBarFill: { height: '100%', borderRadius: 3 },
  pollVoteCount: { fontSize: 11 },
  pollTotal: { fontSize: 12, marginTop: 4 },
});
