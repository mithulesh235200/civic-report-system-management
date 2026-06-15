import api from "./api";

export const fetchAdminDashboard = async () => {
  const { data } = await api.get("/admin/dashboard");
  return data;
};

export const fetchWorkers = async () => {
  const { data } = await api.get("/admin/workers");
  return data;
};

export const fetchAiTrainingCenter = async () => {
  const { data } = await api.get("/admin/ai-training");
  return data;
};

export const submitAiTrainingFeedback = async (payload) => {
  const { data } = await api.post("/admin/ai-training", payload);
  return data;
};

export const createWorker = async (payload) => {
  const { data } = await api.post("/admin/workers", payload);
  return data;
};

export const fetchAdminIssues = async () => {
  const { data } = await api.get("/admin/issues");
  return data;
};

export const deleteAdminIssue = async (issueId) => {
  const { data } = await api.delete(`/admin/issues/${issueId}`);
  return data;
};

export const downloadAdminIssuesCsv = async (params = {}) => {
  const response = await api.get("/admin/issues/export", {
    params,
    responseType: "blob",
  });

  return response.data;
};

export const assignIssue = async (payload) => {
  const { data } = await api.put("/admin/assign", payload);
  return data;
};

export const updateAdminIssueStatus = async (payload) => {
  const { data } = await api.put("/admin/status", payload);
  return data;
};
