import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { authApi } from '../api/auth';
import { SESSION_EXPIRED_EVENT } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the session from the httpOnly cookie on first load
  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Any 401 from a protected endpoint means the cookie expired or was cleared
  useEffect(() => {
    const onExpired = () => {
      setUser((current) => {
        if (current) toast.error('Your session has expired. Please log in again.');
        return null;
      });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  // login/signup throw on failure so the pages can render the error
  const login = useCallback(async (email, password) => {
    setUser(await authApi.login({ email, password }));
  }, []);

  const signup = useCallback(async ({ name, email, password }) => {
    setUser(await authApi.signup({ name: name || undefined, email, password }));
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Clear local state even if the network call fails
    }
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, signup, logout }), [user, loading, login, signup, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
