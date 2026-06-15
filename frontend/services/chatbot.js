import api from "./api";

export const sendChatMessage = async (payload) => {
  const { data } = await api.post("/chatbot/message", payload);
  return data;
};
