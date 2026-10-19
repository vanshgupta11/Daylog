import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true); // checking existing session

  // Restore session on mount
  useEffect(() => {
    authApi.me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signup = async (name, email, password) => {
    const { user } = await authApi.signup(name, email, password);
    setUser(user);
    return user;
  };

  const signin = async (email, password) => {
    const { user } = await authApi.signin(email, password);
    setUser(user);
    return user;
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signup, signin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
