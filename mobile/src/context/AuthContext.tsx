import { createContext, ReactNode, useContext, useEffect, useState } from "react";

import { fetchCurrentUser, loginUser, logoutUser } from "../services/auth";
import { storage } from "../services/storage";

type AuthContextValue = {
  user: any;
  bootstrapped: boolean;
  login: (payload: { email: string; password: string; portal: string }) => Promise<any>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      const storedUser = await storage.getUser();
      const token = await storage.getToken();

      if (!storedUser || !token) {
        setBootstrapped(true);
        return;
      }

      try {
        const response = await fetchCurrentUser();
        setUser(response.user);
        await storage.setUser(response.user);
      } catch (error) {
        await storage.clearToken();
        await storage.clearUser();
        setUser(null);
      } finally {
        setBootstrapped(true);
      }
    };

    bootstrap();
  }, []);

  const login = async (payload: { email: string; password: string; portal: string }) => {
    const response = await loginUser(payload);
    if (response.token) {
      await storage.setToken(response.token);
    }
    await storage.setUser(response.user);
    setUser(response.user);
    return response;
  };

  const logout = async () => {
    await logoutUser().catch(() => undefined);
    await storage.clearToken();
    await storage.clearUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        bootstrapped,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
