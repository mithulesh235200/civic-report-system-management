import { useRouter } from "next/router";
import { useEffect } from "react";

import { useAuth } from "../utils/AuthContext";
import { storage } from "../utils/storage";

const ProtectedRoute = ({ roles, children }) => {
  const router = useRouter();
  const { user, loading } = useAuth();
  const hasToken = typeof window !== "undefined" && Boolean(storage.getToken());

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user && !hasToken) {
      router.replace("/");
      return;
    }

    if (user && roles && !roles.includes(user.role)) {
      router.replace("/unauthorized");
    }
  }, [user, loading, roles, router, hasToken]);

  if (loading || (!user && hasToken) || !user || (user && roles && !roles.includes(user.role))) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-2xl bg-white px-6 py-4 shadow-card">Loading CivicTrack...</div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
