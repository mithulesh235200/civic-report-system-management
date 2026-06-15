import api from "./api";

export const fetchMyIssues = async () => {
  const { data } = await api.get("/issues/my");
  return data;
};
