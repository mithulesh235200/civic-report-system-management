import api from "./api";

export const createIssue = async (payload) => {
  const { data } = await api.post("/issues", payload);
  return data;
};

export const analyzeIssueDraft = async (payload) => {
  const { data } = await api.post("/issues/analyze", payload);
  return data;
};

export const composeIssueDraft = async (payload) => {
  const { data } = await api.post("/issues/compose", payload);
  return data;
};

export const fetchMyIssues = async () => {
  const { data } = await api.get("/issues/my");
  return data;
};

export const fetchIssueDetails = async (id) => {
  const { data } = await api.get(`/issues/${id}`);
  return data;
};

export const fetchMapIssues = async (params = {}) => {
  const { data } = await api.get("/issues/map", { params });
  return data;
};

export const fetchNearbyIssues = async (params) => {
  const { data } = await api.get("/issues/nearby", { params });
  return data;
};

export const addIssueComment = async (id, payload) => {
  const { data } = await api.post(`/issues/${id}/comments`, payload);
  return data;
};

export const joinExistingIssue = async (id) => {
  const { data } = await api.post(`/issues/${id}/join`);
  return data;
};
