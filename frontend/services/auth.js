import api from "./api";

export const registerUser = async (payload) => {
  const { data } = await api.post("/auth/register", payload);
  return data;
};

export const loginUser = async (payload) => {
  const { data } = await api.post("/auth/login", payload);
  return data;
};

export const fetchCurrentUser = async () => {
  const { data } = await api.get("/auth/me");
  return data;
};

export const refreshSession = async () => {
  const { data } = await api.post("/auth/refresh");
  return data;
};

export const updateProfile = async (payload) => {
  const { data } = await api.put("/auth/profile", payload);
  return data;
};

export const logoutSession = async () => {
  const { data } = await api.post("/auth/logout");
  return data;
};
