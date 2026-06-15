import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";

import { fetchMyIssues } from "../../src/services/issues";
import { useAuth } from "../../src/context/AuthContext";

export default function CitizenDashboardPage() {
  const { logout, user } = useAuth();
  const [issues, setIssues] = useState<any[]>([]);

  useEffect(() => {
    fetchMyIssues().then((response) => setIssues(response.issues)).catch(() => setIssues([]));
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f7fb" }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View style={{ borderRadius: 28, backgroundColor: "white", padding: 24 }}>
          <Text style={{ fontSize: 30, fontWeight: "800", color: "#13203a" }}>Citizen Mobile</Text>
          <Text style={{ marginTop: 8, color: "#5c6986" }}>Welcome {user?.name}. Your Android dashboard is ready.</Text>
          <Pressable
            onPress={logout}
            style={{ marginTop: 16, alignSelf: "flex-start", borderRadius: 999, backgroundColor: "#13203a", paddingHorizontal: 18, paddingVertical: 12 }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Logout</Text>
          </Pressable>
        </View>

        {issues.map((issue) => (
          <View key={issue._id} style={{ borderRadius: 24, backgroundColor: "white", padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#13203a" }}>{issue.title}</Text>
            <Text style={{ marginTop: 6, color: "#5c6986" }}>{issue.address || "Location pending"}</Text>
            <Text style={{ marginTop: 10, color: "#33405f" }}>{issue.description}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
