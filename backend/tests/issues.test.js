const request = require("supertest");

const app = require("../app");
const User = require("../models/User");

const loginAs = async (agent, { email, password, portal }) => {
  await agent.post("/api/auth/login").send({
    email,
    password,
    portal,
  });
};

describe("Issue and role-protection flows", () => {
  test("allows a citizen to create and fetch their issue", async () => {
    const agent = request.agent(app);
    await User.create({
      name: "Citizen",
      email: "issue-user@example.com",
      password: "Password@123",
      role: "user",
    });

    await loginAs(agent, {
      email: "issue-user@example.com",
      password: "Password@123",
      portal: "user",
    });

    const createResponse = await agent
      .post("/api/issues")
      .send({
        title: "Large pothole near market",
        description: "A dangerous pothole is causing accidents near the market entrance.",
        category: "pothole",
        latitude: 22.5726,
        longitude: 88.3639,
        address: "Main Market Road",
      });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.body.issue.category).toBe("pothole");
    expect(createResponse.body.issue.severity).toBe("critical");

    const listResponse = await agent.get("/api/issues/my");

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.body.issues).toHaveLength(1);
  });

  test("blocks citizen access to admin APIs", async () => {
    const agent = request.agent(app);
    await User.create({
      name: "Citizen",
      email: "citizen-admin-block@example.com",
      password: "Password@123",
      role: "user",
    });

    await loginAs(agent, {
      email: "citizen-admin-block@example.com",
      password: "Password@123",
      portal: "user",
    });

    const response = await agent.get("/api/admin/issues");

    expect(response.statusCode).toBe(403);
  });

  test("allows admin to create a worker account", async () => {
    const agent = request.agent(app);
    await User.create({
      name: "Admin",
      email: "admin@example.com",
      password: "Password@123",
      role: "admin",
    });

    await loginAs(agent, {
      email: "admin@example.com",
      password: "Password@123",
      portal: "admin",
    });

    const response = await agent
      .post("/api/admin/workers")
      .send({
        name: "Worker One",
        email: "worker-one@example.com",
        password: "Password@123",
        phone: "1234567890",
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.worker.role).toBe("worker");
  });
});
