import { StatusBar } from 'expo-status-bar';
import { enableFreeze } from 'react-native-screens';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useEffect } from 'react';
import { setupNotifications } from './src/utils/notifications';

enableFreeze(false);
import { ThemeProvider } from './src/contexts/ThemeContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { ToastProvider } from './src/components/ToastProvider';
import ScrollbarStyle from './src/components/ScrollbarStyle';
import AppNavigator from './src/navigation/AppNavigator';
import { GOOGLE_CLIENT_ID } from './src/utils/googleAuth';

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = 'input:focus, textarea:focus, select:focus { outline: none !important; box-shadow: none !important; }';
  document.head.appendChild(style);
}

export default function App() {
  useEffect(() => { setupNotifications(); }, []);

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <StatusBar style="auto" />
            <ScrollbarStyle />
            <AppNavigator />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}
