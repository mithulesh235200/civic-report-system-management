import api from "./api";

export const loginUser = async (payload: { email: string; password: string; portal: string }) => {
  const { data } = await api.post("/auth/login", payload);
  return data;
};

export const fetchCurrentUser = async () => {
  const { data } = await api.get("/auth/me");
  return data;
};

export const logoutUser = async () => {
  const { data } = await api.post("/auth/logout");
  return data;
};
