const mongoose = require("mongoose")

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/imdb")
    console.log("✅ MongoDB Connected")
  } catch (err) {
    console.error("❌ Connection Error:", err.message)
    process.exit(1)
  }
}

module.exports = connectDB