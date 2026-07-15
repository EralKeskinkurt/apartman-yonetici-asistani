import { enableFreeze } from 'react-native-screens';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { setupNotifications } from './src/utils/notifications';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { ToastProvider } from './src/components/ToastProvider';
import ScrollbarStyle from './src/components/ScrollbarStyle';
import ErrorBoundary from './src/components/ErrorBoundary';
import AppNavigator from './src/navigation/AppNavigator';
import { GOOGLE_CLIENT_ID } from './src/utils/googleAuth';

enableFreeze(false);

if (Platform.OS === 'web') {
  const style = document.createElement('style');
  style.textContent = 'input:focus, textarea:focus, select:focus { outline: none !important; box-shadow: none !important; }';
  document.head.appendChild(style);
}

const GoogleProvider = Platform.OS === 'web'
  ? require('@react-oauth/google').GoogleOAuthProvider
  : ({ children }: any) => children;

export default function App() {
  useEffect(() => { setupNotifications(); }, []);

  return (
    <GoogleProvider clientId={GOOGLE_CLIENT_ID}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <ErrorBoundary>
              <StatusBar style="auto" />
              <ScrollbarStyle />
              <AppNavigator />
            </ErrorBoundary>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </GoogleProvider>
  );
}
