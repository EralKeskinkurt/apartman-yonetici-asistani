import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { api, setToken } from '../services/api';

const GOOGLE_CLIENT_ID = '656427464240-lqo51qasd990ejpct9d723n7kf5fe2eq.apps.googleusercontent.com';

export function useGoogleAuth(
  inviteCode?: string,
  flatNumber?: string,
  onLogin?: () => void
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleLogin = useGoogleLogin({
    onSuccess: async (response: any) => {
      setLoading(true);
      setError(null);
      try {
        const token = response.credential || response.access_token || response.code;
        if (!token) {
          setError('Google token alınamadı');
          setLoading(false);
          return;
        }
        const res = await api.auth.googleLogin(token, inviteCode, flatNumber);
        await setToken(res.token);
        onLogin?.();
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      } catch (e: any) {
        setError(e.message || 'Google girişi başarısız');
        console.log('Google login error:', e.message);
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      setError('Google girişi iptal edildi');
      setLoading(false);
    },
  });

  return { googleLogin, loading, error };
}

export { GOOGLE_CLIENT_ID };
