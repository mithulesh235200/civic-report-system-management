import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

import {
  fetchCurrentUser,
  loginUser,
  logoutSession,
  refreshSession,
  registerUser,
  updateProfile as updateProfileRequest,
} from "../services/auth";
import { fetchNotifications } from "../services/notifications";
import { storage } from "./storage";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [liveMessage, setLiveMessage] = useState("");
  const authRequestRef = useRef(0);
  const socketRef = useRef(null);
  const notificationsRequestRef = useRef(null);

  const refreshNotifications = useCallback(async () => {
    if (notificationsRequestRef.current) {
      return notificationsRequestRef.current;
    }

    notificationsRequestRef.current = (async () => {
      try {
        const response = await fetchNotifications();
        setNotifications(response.notifications);
        return response.notifications;
      } catch (error) {
        setNotifications([]);
        return [];
      } finally {
        notificationsRequestRef.current = null;
      }
    })();

    return notificationsRequestRef.current;
  }, []);

  useEffect(() => {
    const bootstrapRequestId = authRequestRef.current;

    const bootstrap = async () => {
      try {
        const response = await fetchCurrentUser();
        if (authRequestRef.current !== bootstrapRequestId) {
          return;
        }
        setUser(response.user);
        await refreshNotifications();
      } catch (error) {
        try {
          const refreshed = await refreshSession();
          if (authRequestRef.current !== bootstrapRequestId) {
            return;
          }
          if (refreshed.token) {
            storage.setToken(refreshed.token);
          }
          setUser(refreshed.user);
          await refreshNotifications();
        } catch (refreshError) {
          if (authRequestRef.current !== bootstrapRequestId) {
            return;
          }
          storage.clearToken();
          setUser(null);
        }
      } finally {
        if (authRequestRef.current === bootstrapRequestId) {
          setLoading(false);
        }
      }
    };

    bootstrap();
  }, [refreshNotifications]);

  useEffect(() => {
    if (!user) {
      socketRef.current = null;
      return undefined;
    }

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000");
    socket.emit("join:user", user.id);
    socket.on("issue:assigned", async () => {
      setLiveMessage("A new assignment update arrived.");
      await refreshNotifications();
    });
    socket.on("issue:status-updated", async () => {
      setLiveMessage("An issue status was updated.");
      await refreshNotifications();
    });
    socket.on("issue:resolved", async () => {
      setLiveMessage("An issue was marked resolved.");
      await refreshNotifications();
    });
    socket.on("issue:commented", async () => {
      await refreshNotifications();
    });
    socketRef.current = socket;

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [refreshNotifications, user]);

  const login = async (payload) => {
    authRequestRef.current += 1;
    setLoading(true);
    try {
      const response = await loginUser(payload);
      if (response.token) {
        storage.setToken(response.token);
      }
      setUser(response.user);
      await refreshNotifications();
      return response;
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload) => {
    authRequestRef.current += 1;
    setLoading(true);
    try {
      const response = await registerUser(payload);
      if (response.token) {
        storage.setToken(response.token);
      }
      setUser(response.user);
      await refreshNotifications();
      return response;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (payload) => {
    const response = await updateProfileRequest(payload);
    setUser(response.user);
    return response;
  };

  const logout = () => {
    authRequestRef.current += 1;
    socketRef.current?.disconnect();
    logoutSession().finally(() => {
      storage.clearToken();
      setUser(null);
      setNotifications([]);
      setLiveMessage("");
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        updateProfile,
        logout,
        notifications,
        unreadNotifications: notifications.filter((item) => item.status === "unread").length,
        refreshNotifications,
        liveMessage,
        clearLiveMessage: () => setLiveMessage(""),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
