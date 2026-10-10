const store = require("../models/_store");

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
  process.env.ACCESS_TOKEN_EXPIRES_IN = "15m";
  process.env.REFRESH_TOKEN_EXPIRES_IN = "1d";
  process.env.COOKIE_SECURE = "false";
  process.env.CLIENT_URL = "http://localhost:3000";
});

beforeEach(() => {
  store.reset();
});

afterAll(async () => {
  store.reset();
});
