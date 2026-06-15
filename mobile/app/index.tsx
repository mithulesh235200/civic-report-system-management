import { Redirect } from "expo-router";

import { useAuth } from "../src/context/AuthContext";

export default function IndexPage() {
  const { user, bootstrapped } = useAuth();

  if (!bootstrapped) {
    return null;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (user.role === "admin") {
    return <Redirect href="/admin/dashboard" />;
  }

  if (user.role === "worker") {
    return <Redirect href="/worker/tasks" />;
  }

  return <Redirect href="/citizen/dashboard" />;
}
