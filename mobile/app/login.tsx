import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, SafeAreaView, Text, TextInput, View } from "react-native";

import { useAuth } from "../src/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
    portal: "user",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await login(form);
      if (response.user.role === "admin") {
        router.replace("/admin/dashboard");
        return;
      }

      if (response.user.role === "worker") {
        router.replace("/worker/tasks");
        return;
      }

      router.replace("/citizen/dashboard");
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f7fb" }}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <View style={{ borderRadius: 28, backgroundColor: "white", padding: 24, gap: 14 }}>
          <Text style={{ fontSize: 32, fontWeight: "800", color: "#13203a" }}>CivicTrack Mobile</Text>
          <Text style={{ fontSize: 14, color: "#5c6986" }}>
            Use the same backend and role-based accounts on Android.
          </Text>
          <TextInput
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={form.email}
            onChangeText={(email) => setForm((current) => ({ ...current, email }))}
            style={{ borderRadius: 18, backgroundColor: "#eef3ff", paddingHorizontal: 16, paddingVertical: 14 }}
          />
          <TextInput
            placeholder="Password"
            secureTextEntry
            value={form.password}
            onChangeText={(password) => setForm((current) => ({ ...current, password }))}
            style={{ borderRadius: 18, backgroundColor: "#eef3ff", paddingHorizontal: 16, paddingVertical: 14 }}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              { label: "Citizen", value: "user" },
              { label: "Admin", value: "admin" },
              { label: "Worker", value: "worker" },
            ].map((portal) => (
              <Pressable
                key={portal.value}
                onPress={() => setForm((current) => ({ ...current, portal: portal.value }))}
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  backgroundColor: form.portal === portal.value ? "#13203a" : "#e7ecf7",
                }}
              >
                <Text style={{ color: form.portal === portal.value ? "white" : "#33405f", fontWeight: "700" }}>
                  {portal.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {error ? <Text style={{ color: "#d14343", fontWeight: "700" }}>{error}</Text> : null}
          <Pressable
            onPress={handleLogin}
            style={{
              borderRadius: 999,
              backgroundColor: "#0d7a68",
              paddingVertical: 16,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>
              {loading ? "Signing in..." : "Login"}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
