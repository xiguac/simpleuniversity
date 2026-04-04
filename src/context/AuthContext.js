import React, { createContext, useContext, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('user_data');
    } finally {
      setIsLoggedIn(false);
    }
  };

  const authFetchJson = async (url, options = {}) => {
    const response = await fetch(url, options);
    const text = await response.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch (error) {
      await logout();
      const authError = new Error('AUTH_EXPIRED');
      authError.code = 'AUTH_EXPIRED';
      throw authError;
    }

    if (json?.code === 401 || json?.msg === 'Please Login') {
      await logout();
      const authError = new Error('AUTH_EXPIRED');
      authError.code = 'AUTH_EXPIRED';
      throw authError;
    }

    return json;
  };

  const value = useMemo(
    () => ({
      isLoggedIn,
      setIsLoggedIn,
      logout,
      authFetchJson,
    }),
    [isLoggedIn]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
