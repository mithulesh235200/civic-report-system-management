import axios from "axios";

import { storage } from "../utils/storage";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = storage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshWaiters = [];

const flushRefreshWaiters = (error) => {
  refreshWaiters.forEach((callback) => callback(error));
  refreshWaiters = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status !== 401 ||
      originalRequest?._retry ||
      originalRequest?.url?.includes("/auth/login") ||
      originalRequest?.url?.includes("/auth/register") ||
      originalRequest?.url?.includes("/auth/refresh")
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshWaiters.push((refreshError) => {
          if (refreshError) {
            reject(refreshError);
            return;
          }

          resolve(api(originalRequest));
        });
      });
    }

    isRefreshing = true;

    try {
      const refreshResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/auth/refresh`,
        {},
        { withCredentials: true }
      );
      if (refreshResponse.data?.token) {
        storage.setToken(refreshResponse.data.token);
      }
      flushRefreshWaiters(null);
      return api(originalRequest);
    } catch (refreshError) {
      storage.clearToken();
      flushRefreshWaiters(refreshError);
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
