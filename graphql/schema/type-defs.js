const { gql } = require("apollo-server")

const typeDefs = gql`
  type Actor {
    Id: Int!
    Name: String!
  }

  # Actor type for nested actors in movies (Id is optional since CSV data might not have actor IDs)
  type MovieActor {
    Id: Int
    Name: String!
  }

  type Movie {
    Id: Int!
    Title: String!
    Genres: [String!]!
    Description: String
    Director: String
    Actors: [MovieActor]
    Year: Int
    Runtime: Int
    Rating: Float
    Votes: Int
    Revenue: Float
  }

  type Query {
    getMovies: [Movie!]!
    getMovie(Id: Int!): Movie
    getActors: [Actor!]!
    getActor(Id: Int!): Actor
  }

  type AIResponse {
    message: String!
    movies: [Movie!]!
    actors: [Actor!]!
    displayFocus: String
  }

  type Mutation {
    askAI(prompt: String!): AIResponse! # AI-driven CRUD for movies and actors
  }
`

module.exports = typeDefs
