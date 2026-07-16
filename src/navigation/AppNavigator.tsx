import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import LoginScreen from '../screens/LoginScreen';
import SetupScreen from '../screens/SetupScreen';
import DashboardScreen from '../screens/DashboardScreen';
import DuesScreen from '../screens/DuesScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import FlatsScreen from '../screens/FlatsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import BuildingScreen from '../screens/BuildingScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import PollsScreen from '../screens/PollsScreen';
import ResidentDashboardScreen from '../screens/ResidentDashboardScreen';
import ResidentMyDuesScreen from '../screens/ResidentMyDuesScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AdminTabs({ initialTab }: { initialTab?: string }) {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      initialRouteName={initialTab || 'Dashboard'} screenOptions={({ route }) => ({
      headerShown: false,
      freezeOnBlur: false,
      tabBarIcon: ({ focused, color, size }) => {
        const icons: Record<string, string> = { Dashboard: 'home', Dues: 'card', Expenses: 'wallet', Flats: 'people', Profile: 'person' };
        const name = focused ? icons[route.name] : `${icons[route.name]}-outline`;
        return <Ionicons name={name as any} size={size} color={color} />;
      },
      tabBarActiveTintColor: theme.colors.primary,
      tabBarInactiveTintColor: theme.colors.textMuted,
      tabBarStyle: { backgroundColor: theme.colors.tabBar, borderTopColor: theme.colors.tabBarBorder, borderTopWidth: 0, elevation: 0 },
      tabBarLabelStyle: { fontSize: 11, marginBottom: 4 },
    })}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Anasayfa' }} />
      <Tab.Screen name="Dues" component={DuesScreen} options={{ title: 'Aidatlar' }} />
      <Tab.Screen name="Expenses" component={ExpensesScreen} options={{ title: 'Giderler' }} />
      <Tab.Screen name="Flats" component={FlatsScreen} options={{ title: 'Daireler' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
}

function ResidentTabs() {
  const { theme } = useTheme();
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      freezeOnBlur: false,
      tabBarIcon: ({ focused, color, size }) => {
        const icons: Record<string, string> = { ResidentDashboard: 'home', MyDuesTab: 'card' };
        const name = focused ? icons[route.name] : `${icons[route.name]}-outline`;
        return <Ionicons name={name as any} size={size} color={color} />;
      },
      tabBarActiveTintColor: theme.colors.primary,
      tabBarInactiveTintColor: theme.colors.textMuted,
      tabBarStyle: { backgroundColor: theme.colors.tabBar, borderTopColor: theme.colors.tabBarBorder, borderTopWidth: 0, elevation: 0 },
      tabBarLabelStyle: { fontSize: 11, marginBottom: 4 },
    })}>
      <Tab.Screen name="ResidentDashboard" component={ResidentDashboardScreen} options={{ title: 'Anasayfa' }} />
      <Tab.Screen name="MyDuesTab" component={ResidentMyDuesScreen} options={{ title: 'Aidatlarım' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const navRef = useRef<NavigationContainerRef<any>>(null);
  const prevUserRef = useRef(user);
  const [lastScreenLoaded, setLastScreenLoaded] = useState(false);
  const [lastScreen, setLastScreen] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('last_screen').then((s) => {
      if (s && s !== 'Login' && s !== 'Setup') setLastScreen(s);
      setLastScreenLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!navRef.current || authLoading) return;
    const prev = prevUserRef.current;
    prevUserRef.current = user;

    if (prev && !user) {
      navRef.current.reset({ index: 0, routes: [{ name: 'Login' }] });
      AsyncStorage.removeItem('last_screen');
    } else if (user && (!prev || !prev?.building_id && user?.building_id || !prev?.building_id && !user?.building_id)) {
      const route = user.building_id ? (user.role === 'admin' ? 'AdminMain' : 'ResidentMain') : 'Setup';
      setTimeout(() => {
        navRef.current?.reset({ index: 0, routes: [{ name: route }] });
      }, 100);
    }
  }, [user, authLoading]);

  if (authLoading || !lastScreenLoaded) return null;

  const hasBuilding = !!user?.building_id;
  const isAdmin = user?.role === 'admin';
  const initialRoute = !user ? 'Login' : !hasBuilding ? 'Setup' : isAdmin ? 'AdminMain' : 'ResidentMain';

  return (
    <NavigationContainer
      ref={navRef}
      onStateChange={(state) => {
        if (!state) return;
        const route = state.routes[state.index];
        const tabState = route?.state;
        const tabRoute = tabState?.routes?.[tabState?.index ?? 0];
        const screen = tabRoute?.name || route?.name;
        if (screen) {
          AsyncStorage.setItem('last_screen', screen);
        }
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Setup" component={SetupScreen} />
        <Stack.Screen name="AdminMain">{() => <AdminTabs initialTab={lastScreen && ['Dashboard', 'Dues', 'Expenses', 'Flats', 'Profile'].includes(lastScreen) ? lastScreen : undefined} />}</Stack.Screen>
        <Stack.Screen name="ResidentMain" component={ResidentTabs} />
        <Stack.Screen name="Building" component={BuildingScreen} options={{ headerShown: true, headerTitle: 'Apartman Bilgileri', headerTintColor: theme.colors.text, headerStyle: { backgroundColor: theme.colors.surface } }} />
        <Stack.Screen name="Reports" component={ReportsScreen} options={{ headerShown: true, headerTitle: 'Raporlar', headerTintColor: theme.colors.text, headerStyle: { backgroundColor: theme.colors.surface } }} />
        <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ headerShown: true, headerTitle: 'Abonelik', headerTintColor: theme.colors.text, headerStyle: { backgroundColor: theme.colors.surface } }} />
        <Stack.Screen name="Polls" component={PollsScreen} options={{ headerShown: true, headerTitle: 'Oylamalar', headerTintColor: theme.colors.text, headerStyle: { backgroundColor: theme.colors.surface } }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
