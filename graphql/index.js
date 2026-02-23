require("dotenv").config()
const { ApolloServer } = require("apollo-server")
const connectDB = require("./config/db")
const typeDefs = require("./schema/type-defs.js")
const resolvers = require("./schema/resolvers.js")

const startServer = async () => {
  await connectDB()

  const server = new ApolloServer({
    typeDefs,
    resolvers,
  })

  const { url } = await server.listen({ port: 4000 })
  console.log(`Server running at ${url}`)
}

startServer()
