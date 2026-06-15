import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "civictrack_mobile_token";
const USER_KEY = "civictrack_mobile_user";

export const storage = {
  async getToken() {
    return AsyncStorage.getItem(TOKEN_KEY);
  },
  async setToken(token: string) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  },
  async clearToken() {
    await AsyncStorage.removeItem(TOKEN_KEY);
  },
  async getUser() {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  async setUser(user: any) {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  async clearUser() {
    await AsyncStorage.removeItem(USER_KEY);
  },
};
