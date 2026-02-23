const Movie = require("../models/Movie")
const Actor = require("../models/Actor")
const askOllama = require("../ai/ollamaService")

const NUMERIC_KEYS = new Set(["Id", "Year", "Runtime", "Rating", "Votes", "Revenue"])

const emptyResponse = (message, movies = [], actors = []) => ({ message, movies, actors })

function getDisplayFocus(prompt) {
  if (!prompt || typeof prompt !== "string") return "full"
  const p = prompt.toLowerCase()
  const askGenres = /\b(genre|genres)\b/.test(p) && !/\b(actor|actors|cast)\b/.test(p)
  const askActors = /\b(actor|actors|cast)\b/.test(p) || /\bwho\s+(is|are)\s+in\b/.test(p) || /\blist\s+.*\bactor/.test(p)
  if (askGenres) return "genres"
  if (askActors) return "actors"
  return "full"
}

function upgradeQuery(q) {
  const out = { ...q }
  // DB uses "Genre" (string like "Action,Adventure,Sci-Fi"); LLM may send Genres or Genre
  if (out.Genres != null) {
    const val = out.Genres
    delete out.Genres
    out.Genre = typeof val === "string"
      ? { $regex: new RegExp(val.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }
      : val
  }
  if (out.Genre != null && typeof out.Genre === "string") {
    out.Genre = { $regex: new RegExp(out.Genre.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }
  }
  for (const key in out) {
    if (key === "Genre" && typeof out[key] === "object" && out[key].$regex) continue
    if (typeof out[key] === "string" && !NUMERIC_KEYS.has(key))
      out[key] = { $regex: new RegExp(`^${out[key].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }
  }
  return out
}

function getModel(entityType, query = {}, payload = {}) {
  if (entityType === "actor" || query.entityType === "actor") return Actor
  if (payload.Name && !payload.Title) return Actor
  if (Object.keys(query).length === 1 && query.Name) return Actor
  return Movie
}

function normalizeActors(actors) {
  if (!actors) return []
  // DB may store Actors as comma-separated string: "Chris Pratt, Vin Diesel"
  if (typeof actors === "string") {
    return actors
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((Name) => ({ Id: null, Name }))
  }
  if (!Array.isArray(actors)) return []
  return actors
    .map((a) => {
      if (typeof a === "string") return { Id: null, Name: a }
      if (typeof a === "object" && a?.Name)
        return { Id: a.Id != null ? Number(a.Id) : null, Name: a.Name }
      return null
    })
    .filter((a) => a && a.Name)
}

function toGenres(genres, genreStr) {
  if (Array.isArray(genres) && genres.length > 0) return genres
  if (typeof genreStr === "string")
    return genreStr.split(",").map((s) => s.trim()).filter(Boolean)
  return []
}

function toMovie(doc) {
  const obj = doc.toObject ? doc.toObject() : doc
  return {
    ...obj,
    Genres: toGenres(obj.Genres, obj.Genre),
    Actors: normalizeActors(obj.Actors),
  }
}

// --- Action handlers ---
async function runCount(parsed) {
  const { query = {}, entityType } = parsed
  const Model = getModel(entityType, query)
  const q = upgradeQuery(query)
  const count = await Model.countDocuments(q)
  const entity = Model.modelName.toLowerCase()
  const msg =
    count === 0
      ? `There are no ${entity}s matching your query.`
      : count === 1
        ? `There is 1 ${entity} in the database.`
        : `There are ${count} ${entity}s in the database.`
  return emptyResponse(msg)
}

async function runGet(parsed, isCountQuery) {
  const { query = {}, entityType } = parsed
  const Model = getModel(entityType, query)
  const q = upgradeQuery(query)

  if (entityType !== "actor" && !query.entityType && isCountQuery && Object.keys(q).length === 0) {
    const count = await Movie.countDocuments({})
    return emptyResponse(`There are ${count} movies in the database.`)
  }

  if (Model === Actor) {
    const actors = await Actor.find(q)
    const msg =
      !actors.length
        ? "I couldn't find any actors matching your request."
        : actors.length === 1
          ? `I found 1 actor: ${actors[0].Name} (Id ${actors[0].Id}).`
          : `I found ${actors.length} actors matching your request.`
    return { message: msg, movies: [], actors }
  }

  const raw = await Movie.find(q)
  const movies = raw.map(toMovie)
  const msg =
    !movies.length
      ? "I couldn't find any movies matching your request."
      : movies.length === 1
        ? `I found 1 movie: ${movies[0].Title} (Id ${movies[0].Id}, Year ${movies[0].Year || "N/A"}).`
        : `I found ${movies.length} movies matching your request.`
  return { message: msg, movies, actors: [] }
}

function normalizeActorPayload(a) {
  const Id = Number(a.Id)
  const Name = a.Name || a.name
  return Number.isFinite(Id) && typeof Name === "string" && Name.trim()
    ? { Id, Name }
    : null
}

function normalizeMoviePayload(m) {
  const Id = Number(m.Id)
  const Title = m.Title || m.title
  if (!Number.isFinite(Id) || !(typeof Title === "string" && Title.trim())) return null
  return {
    Id,
    Title,
    Genres: Array.isArray(m.Genres) ? m.Genres : m.Genres ? [m.Genres] : [],
    Description: m.Description ?? m.description,
    Director: m.Director ?? m.director,
    Actors: Array.isArray(m.Actors) ? m.Actors : [],
    Year: m.Year != null ? Number(m.Year) : undefined,
    Runtime: m.Runtime != null ? Number(m.Runtime) : undefined,
    Rating: m.Rating != null ? Number(m.Rating) : undefined,
    Votes: m.Votes != null ? Number(m.Votes) : undefined,
    Revenue: m.Revenue != null ? Number(m.Revenue) : undefined,
  }
}

async function runCreate(parsed) {
  const { query = {}, payload = {}, entityType } = parsed
  const raw = Array.isArray(payload) ? payload.flat(Infinity) : [{ ...query, ...payload }]
  const items = raw
    .filter((x) => x && typeof x === "object" && !Array.isArray(x))
    .map((x) => (x.Name && !x.Title ? normalizeActorPayload(x) : normalizeMoviePayload(x)))
    .filter(Boolean)

  const isActor = entityType === "actor" || query.entityType === "actor" || (items[0] && items[0].Name && !items[0].Title)

  if (isActor) {
    const Model = Actor
    if (!items.length)
      return emptyResponse("I couldn't understand which actors to create from your request.")

    const ids = items.map((a) => a.Id)
    const existing = await Model.find({ Id: { $in: ids } })
    const existingIds = new Set(existing.map((e) => e.Id))
    const toCreate = items.filter((a) => !existingIds.has(a.Id))
    const created = toCreate.length ? await Model.insertMany(toCreate) : []
    const actors = [...existing, ...created]

    let msg
    if (created.length && existing.length)
      msg = `I created ${created.length} new actor${created.length > 1 ? "s" : ""}, but skipped ${existing.length} because the Id${existing.length > 1 ? "s" : ""} already exist${existing.length > 1 ? "" : "s"}: ${existing.map((a) => `${a.Name} (Id ${a.Id})`).join(", ")}.`
    else if (created.length)
      msg = `I created ${created.length} new actor${created.length > 1 ? "s" : ""}.`
    else if (existing.length === 1)
      msg = `I couldn't create a new actor because an actor with Id ${existing[0].Id} already exists: ${existing[0].Name}.`
    else if (existing.length > 1)
      msg = `I couldn't create any new actors because these Ids already exist: ${existing.map((a) => `${a.Name} (Id ${a.Id})`).join(", ")}.`
    else
      msg = "I couldn't create any new actors from your request."

    return { message: msg, movies: [], actors }
  }

  const Model = Movie
  if (!items.length)
    return emptyResponse("I couldn't understand which movies to create from your request.")

  const ids = items.map((m) => m.Id)
  const existing = await Model.find({ Id: { $in: ids } })
  const existingIds = new Set(existing.map((m) => m.Id))
  const toCreate = items.filter((m) => !existingIds.has(m.Id))
  const created = toCreate.length ? await Model.insertMany(toCreate) : []
  const movies = [...existing, ...created].map(toMovie)

  let msg
  if (created.length && existing.length)
    msg = `I created ${created.length} new movie${created.length > 1 ? "s" : ""}, but skipped ${existing.length} because the Id${existing.length > 1 ? "s" : ""} already exist${existing.length > 1 ? "" : "s"}: ${existing.map((m) => `${m.Title} (Id ${m.Id})`).join(", ")}.`
  else if (created.length)
    msg = `I created ${created.length} new movie${created.length > 1 ? "s" : ""}.`
  else if (existing.length === 1)
    msg = `I couldn't create a new movie because a movie with Id ${existing[0].Id} already exists: ${existing[0].Title}.`
  else if (existing.length > 1)
    msg = `I couldn't create any new movies because these Ids already exist: ${existing.map((m) => `${m.Title} (Id ${m.Id})`).join(", ")}.`
  else
    msg = "I couldn't create any new movies from your request."

  return { message: msg, movies, actors: [] }
}

async function runUpdate(parsed) {
  const { query = {}, payload = {}, entityType } = parsed
  const Model = getModel(entityType, query, payload)
  const q = upgradeQuery(query)

  const updated = await Model.findOneAndUpdate(q, { $set: payload }, { new: true })
  if (!updated) {
    const entity = Model.modelName.toLowerCase()
    return emptyResponse(`I couldn't find any ${entity} matching your update request, so nothing was changed.`)
  }

  if (Model === Actor)
    return { message: `I updated actor ${updated.Name} (Id ${updated.Id}).`, movies: [], actors: [updated] }

  const parts = [`I updated movie ${updated.Title} (Id ${updated.Id}`]
  if (updated.Year) parts.push(`Year ${updated.Year}`)
  if (updated.Rating) parts.push(`Rating ${updated.Rating}`)
  return { message: parts.join(", ") + ").", movies: [toMovie(updated)], actors: [] }
}

async function runDelete(parsed) {
  const { query = {}, entityType } = parsed
  const Model = getModel(entityType, query)
  const q = upgradeQuery(query)

  // Safety: refuse delete when query is empty or has no specific identifier (prevents "delete all")
  const hasIdentifier = q.Id != null || q.Title != null || q.Name != null || q.Director != null || q.Year != null
  if (!hasIdentifier) {
    return emptyResponse(
      "Delete request must specify which item(s) to delete (e.g. by Id, Title, or Name). I won't delete without a specific filter."
    )
  }

  const result = await Model.deleteMany(q)
  const n = result?.deletedCount ?? 0
  const entity = Model.modelName.toLowerCase()

  if (n === 0)
    return emptyResponse(`I couldn't find any ${entity} matching your delete request, so nothing was removed.`)

  const msg =
    Object.keys(q).length === 0
      ? `I deleted all ${n} ${entity}${n > 1 ? "s" : ""} from the database.`
      : `I deleted ${n} ${entity}${n > 1 ? "s" : ""} matching your request.`
  return emptyResponse(msg)
}

const HANDLERS = {
  count: runCount,
  get: runGet,
  create: runCreate,
  update: runUpdate,
  delete: runDelete,
}

const resolvers = {
  Movie: {
    Actors: (parent) => normalizeActors(parent.Actors),
  },

  Query: {
    async getMovies() {
      const movies = await Movie.find({})
      return movies.map(toMovie)
    },
    async getMovie(_, { Id }) {
      const movie = await Movie.findOne({ Id: Number(Id) })
      return movie ? toMovie(movie) : null
    },
    async getActors() {
      return Actor.find({})
    },
    async getActor(_, { Id }) {
      return Actor.findOne({ Id: Number(Id) })
    },
  },

  Mutation: {
    async askAI(_, { prompt }) {
      console.log("--- NEW REQUEST ---")
      console.log("PROMPT:", prompt)

      const isCountQuery =
        /count|how many|total count|number of|total number/i.test(prompt) &&
        !/show|display|list|get|find/i.test(prompt)

      const withFocus = (result) => ({ ...result, displayFocus: getDisplayFocus(prompt) })

      const aiResponse = await askOllama(prompt)
      if (!aiResponse)
        return withFocus(emptyResponse("I couldn't connect to the AI service."))

      let parsed
      try {
        parsed = JSON.parse(aiResponse)
        console.log("AI STRUCTURE:", parsed)
      } catch (err) {
        console.error("JSON PARSE ERROR:", err)
        return withFocus(emptyResponse("I couldn't understand the AI's response."))
      }

      const { action } = parsed
      const handler = HANDLERS[action]

      if (!handler)
        return withFocus(emptyResponse(`I don't understand the action "${action}". Please use create, get, update, or delete.`))

      try {
        const result = action === "get" ? await runGet(parsed, isCountQuery) : await handler(parsed)
        return withFocus(result)
      } catch (err) {
        console.error("DB ERROR:", err)
        return withFocus(emptyResponse("I ran into a database error. Please check the server logs."))
      }
    },
  },
}

module.exports = resolvers
