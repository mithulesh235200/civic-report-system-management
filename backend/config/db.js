const mongoose = require("mongoose");

const connectDB = async () => {
  let mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    console.log("MONGODB_URI is not configured. Falling back to MongoDB Memory Server...");
    try {
      // Dynamically require to avoid loading it in production if not needed
      const { MongoMemoryServer } = require("mongodb-memory-server");
      const mongoServer = await MongoMemoryServer.create();
      mongoURI = mongoServer.getUri();
      console.log(`MongoDB Memory Server started at: ${mongoURI}`);
    } catch (err) {
      console.error("Failed to start MongoDB Memory Server:", err);
      throw new Error("MONGODB_URI is not configured and MongoDB Memory Server failed to start");
    }
  }

  await mongoose.connect(mongoURI);
  console.log("MongoDB connected");
};

module.exports = connectDB;
