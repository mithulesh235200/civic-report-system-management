import api from "./api";

export const fetchWorkerTasks = async () => {
  const { data } = await api.get("/worker/tasks");
  return data;
};
