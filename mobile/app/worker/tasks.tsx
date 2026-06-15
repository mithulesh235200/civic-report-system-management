import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";

import { fetchWorkerTasks } from "../../src/services/worker";

export default function WorkerTasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    fetchWorkerTasks().then((response) => setTasks(response.tasks)).catch(() => setTasks([]));
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f7fb" }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View style={{ borderRadius: 28, backgroundColor: "white", padding: 24 }}>
          <Text style={{ fontSize: 30, fontWeight: "800", color: "#13203a" }}>Worker Mobile</Text>
          <Text style={{ marginTop: 8, color: "#5c6986" }}>
            Field-ready mobile task view for routing, proof upload, and completion.
          </Text>
        </View>

        {tasks.map((task) => (
          <View key={task._id} style={{ borderRadius: 24, backgroundColor: "white", padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#13203a" }}>{task.issueId?.title}</Text>
            <Text style={{ marginTop: 6, color: "#5c6986" }}>{task.issueId?.address}</Text>
            <Text style={{ marginTop: 10, color: "#33405f" }}>{task.aiBrief}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
