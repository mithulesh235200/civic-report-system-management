export const storage = {
  getToken() {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage.getItem("civictrack_token");
  },
  setToken(token) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("civictrack_token", token);
    }
  },
  clearToken() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("civictrack_token");
    }
  },
};
