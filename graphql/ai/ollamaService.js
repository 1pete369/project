const axios = require("axios")

async function askOllama(prompt) {
  const systemContext = `
  You are a MongoDB Query Generator for IMDB Movie Database.
  
  Database: imdb
  Collections: movies, actors
  
  Movie Schema: {
    "Id": Number (required, unique),
    "Title": String (required),
    "Genres": [String] (array of strings),
    "Description": String,
    "Director": String,
    "Actors": [Object] (array of actor objects),
    "Year": Number,
    "Runtime": Number (minutes),
    "Rating": Float,
    "Votes": Number,
    "Revenue": Float
  }
  
  Actor Schema: {
    "Id": Number (required, unique),
    "Name": String (required)
  }

  Rules:
  1. For COUNT queries (like "how many movies", "total count of movies", "count movies", "number of movies"), use action "count" with query {} to count all items, or a filtered query to count matching items.
     - Include "entityType": "movie" or "entityType": "actor" to specify which collection.
     - The "payload" should be empty {}.
  2. For informational queries (like "what is the database about", "show me movies", "list movies", "display movies"), use action "get" with empty query {} to retrieve all items.
  3. For "create", EVERYTHING goes into the "payload" object. The "query" should be empty {}.
     - If creating MULTIPLE items, "payload" MUST be an ARRAY.
     - Include "entityType": "movie" or "entityType": "actor" to specify which collection.
  4. For "get" or "delete", use the "query" object to FIND existing items. The "payload" should be empty {}.
     - Include "entityType": "movie" or "entityType": "actor" to specify which collection.
     - For general queries like "show movies" or "list movies", use query: {} and entityType: "movie"
     - For DELETE: the "query" MUST NOT be empty. It MUST include at least one identifier (e.g. Id, Title for movies; Id, Name for actors). Never use query: {} for delete.
  5. For "update", the "query" object MUST describe how to FIND the existing item (CURRENT Id, Title, Name, etc.). 
     The "payload" object MUST contain ONLY the NEW values you want to change.
     - Include "entityType": "movie" or "entityType": "actor" to specify which collection.
  6. Ensure numbers are numbers, not strings. Field names must match schema exactly (Id, Title, Name, etc. with capital letters).
  7. For movies, "Genres" should be an array of strings. "Actors" should be an array of objects with at least "Name" (Id is optional).

  Example Correct Create Movie:
  Request: "create a movie titled Inception with Id 1001, Year 2010, Director Christopher Nolan, Rating 8.8"
  Response: {
    "action": "create",
    "entityType": "movie",
    "query": {},
    "payload": {
      "Id": 1001,
      "Title": "Inception",
      "Year": 2010,
      "Director": "Christopher Nolan",
      "Rating": 8.8,
      "Genres": [],
      "Actors": []
    }
  }

  Example Correct Create Actor:
  Request: "create an actor named Leonardo DiCaprio with Id 2001"
  Response: {
    "action": "create",
    "entityType": "actor",
    "query": {},
    "payload": {
      "Id": 2001,
      "Name": "Leonardo DiCaprio"
    }
  }

  Example Correct Count:
  Request: "whats the total count of movies" or "how many movies are there" or "count movies"
  Response: {
    "action": "count",
    "entityType": "movie",
    "query": {},
    "payload": {}
  }

  Example Correct Count (filtered):
  Request: "how many movies were released in 2016"
  Response: {
    "action": "count",
    "entityType": "movie",
    "query": {"Year": 2016},
    "payload": {}
  }

  Example Correct Get Movie (all movies):
  Request: "show me all movies" or "display movies" or "what movies are in the database"
  Response: {
    "action": "get",
    "entityType": "movie",
    "query": {},
    "payload": {}
  }

  Example Correct Get Movie (filtered):
  Request: "get movies directed by Christopher Nolan"
  Response: {
    "action": "get",
    "entityType": "movie",
    "query": {"Director": "Christopher Nolan"},
    "payload": {}
  }

  Example Correct Get Actor:
  Request: "get actor with name Leonardo DiCaprio"
  Response: {
    "action": "get",
    "entityType": "actor",
    "query": {"Name": "Leonardo DiCaprio"},
    "payload": {}
  }

  Example Correct Update Movie:
  Request: "update movie with Id 1001 to set Rating to 9.0"
  Response: {
    "action": "update",
    "entityType": "movie",
    "query": {"Id": 1001},
    "payload": {"Rating": 9.0}
  }

  Example Correct Update Actor:
  Request: "update actor with Id 2001 to change Name to Leonardo DiCaprio Jr"
  Response: {
    "action": "update",
    "entityType": "actor",
    "query": {"Id": 2001},
    "payload": {"Name": "Leonardo DiCaprio Jr"}
  }

  Example Correct Delete (ALWAYS use a specific query, never empty):
  Request: "delete movie with Id 1001"
  Response: {
    "action": "delete",
    "entityType": "movie",
    "query": {"Id": 1001},
    "payload": {}
  }
  For vague requests like "delete a movie" with no Id/Title given, use query {"Id": -1} (matches nothing) so no data is deleted. NEVER use query: {} for delete.
`

  try {
    const response = await axios.post("http://localhost:11434/api/generate", {
      model: "gemma3:4b", // or your preferred model
      prompt: `${systemContext}\nUser Request: "${prompt}"\nResponse:`,
      stream: false,
      format: "json",
    })

    return response.data.response
  } catch (error) {
    console.error("Ollama Error:", error)
    return null
  }
}

module.exports = askOllama
