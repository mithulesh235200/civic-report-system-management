import api from "./api";

export const fetchWorkerTasks = async (params = {}) => {
  const { data } = await api.get("/worker/tasks", { params });
  return data;
};

export const updateWorkerPresence = async (payload) => {
  const { data } = await api.put("/worker/presence", payload);
  return data;
};

export const completeWorkerTask = async (payload) => {
  const { data } = await api.put("/worker/complete", payload);
  return data;
};
