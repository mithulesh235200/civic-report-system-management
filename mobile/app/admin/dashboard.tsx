import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";

import { fetchAdminDashboard } from "../../src/services/admin";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchAdminDashboard().then((response) => setStats(response.stats)).catch(() => setStats(null));
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f7fb" }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View style={{ borderRadius: 28, backgroundColor: "white", padding: 24 }}>
          <Text style={{ fontSize: 30, fontWeight: "800", color: "#13203a" }}>Admin Mobile</Text>
          <Text style={{ marginTop: 8, color: "#5c6986" }}>
            Mobile command view for stats, forecasting, and dispatch-ready visibility.
          </Text>
        </View>

        {stats ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {[
              ["Total", stats.totalIssues],
              ["Pending", stats.pendingIssues],
              ["Resolved", stats.resolvedIssues],
              ["Workers", stats.workers?.length || 0],
            ].map(([label, value]) => (
              <View
                key={String(label)}
                style={{ width: "47%", borderRadius: 24, backgroundColor: "white", padding: 18 }}
              >
                <Text style={{ color: "#5c6986", fontWeight: "700" }}>{label}</Text>
                <Text style={{ marginTop: 8, fontSize: 28, fontWeight: "800", color: "#13203a" }}>{String(value)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
