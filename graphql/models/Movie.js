const mongoose = require("mongoose")

const movieSchema = new mongoose.Schema({
  Id: { type: Number, required: true, unique: true },
  Title: { type: String, required: true },
  Genres: { type: [String], default: [] },
  Genre: { type: String }, // CSV from DB e.g. "Action,Adventure,Sci-Fi"
  Description: { type: String },
  Director: { type: String },
  Actors: { type: mongoose.Schema.Types.Mixed, default: [] }, // Array or comma-separated string from DB
  Year: { type: Number },
  Runtime: { type: Number },
  Rating: { type: Number },
  Votes: { type: Number },
  Revenue: { type: Number },
}, { strict: true })

module.exports = mongoose.model("Movie", movieSchema, "movies")
