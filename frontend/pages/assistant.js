import ChatbotPanel from "../components/ChatbotPanel";
import LayoutShell from "../components/LayoutShell";
import ProtectedRoute from "../components/ProtectedRoute";
import { useAuth } from "../utils/AuthContext";
import { ROLES } from "../utils/roles";

export default function AssistantPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute roles={[ROLES.USER, ROLES.ADMIN, ROLES.WORKER]}>
      <LayoutShell title="Civic AI Assistant">
        {user ? <ChatbotPanel user={user} /> : null}
      </LayoutShell>
    </ProtectedRoute>
  );
}
