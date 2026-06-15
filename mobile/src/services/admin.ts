import api from "./api";

export const fetchAdminDashboard = async () => {
  const { data } = await api.get("/admin/dashboard");
  return data;
};
