const request = require("supertest");

const app = require("../app");
const User = require("../models/User");

describe("Authentication flows", () => {
  test("registers a citizen user and returns a token", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Citizen One",
      email: "citizen@example.com",
      password: "Password@123",
    });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.user.role).toBe("user");
    expect(response.headers["set-cookie"]).toBeTruthy();
  });

  test("prevents public registration as admin", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Admin Attempt",
      email: "admin-attempt@example.com",
      password: "Password@123",
      role: "admin",
    });

    expect(response.statusCode).toBe(403);
  });

  test("blocks citizen from admin portal login", async () => {
    await User.create({
      name: "Citizen",
      email: "citizen-login@example.com",
      password: "Password@123",
      role: "user",
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "citizen-login@example.com",
      password: "Password@123",
      portal: "admin",
    });

    expect(response.statusCode).toBe(403);
  });

  test("refreshes the session using the refresh cookie", async () => {
    const agent = request.agent(app);

    await agent.post("/api/auth/register").send({
      name: "Citizen Refresh",
      email: "refresh@example.com",
      password: "Password@123",
    });

    const response = await agent.post("/api/auth/refresh").send({});

    expect(response.statusCode).toBe(200);
    expect(response.body.user.email).toBe("refresh@example.com");
  });
});
