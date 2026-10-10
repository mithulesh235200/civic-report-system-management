const dotenv = require("dotenv");

dotenv.config();

const connectDB = require("../config/db");
const User = require("../models/User");

const seedUsers = async () => {
  await connectDB();

  const users = [
    {
      name: "System Admin",
      email: "admin@civictrack.local",
      password: "Admin@123",
      role: "admin",
    },
    {
      name: "Field Worker One",
      email: "worker@civictrack.local",
      password: "Worker@123",
      role: "worker",
    },
  ];

  for (const userData of users) {
    const existing = await User.findByEmail(userData.email);
    if (!existing) {
      await User.create(userData);
    }
  }

  console.log("Default admin and worker accounts are ready.");
  process.exit(0);
};

seedUsers().catch((error) => {
  console.error("Failed to seed users", error);
  process.exit(1);
});
