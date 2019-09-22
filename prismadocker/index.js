const { GraphQLServer } = require("graphql-yoga");
const { prisma } = require("./generated/prisma-client");
const Mutation = require("./resolvers/Mutations");
const Query = require("./resolvers/Querys");

const server = new GraphQLServer({
  typeDefs: "./schema.graphql",
  resolvers: {
    Mutation,
    Query
  },
  resolverValidationOptions: {
    requireResolversForResolveType: false
  },
  context: req => ({
    ...req,
    prisma
  })
});

server.start(
  {
    cors: {
      credentials: true,
      origin: "http://localhost:3000"
    }
  },
  deets => {
    console.log(`server is running on port ${deets}`);
  }
);
