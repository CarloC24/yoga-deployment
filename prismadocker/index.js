const { GraphQLServer } = require("graphql-yoga");
const { prisma } = require("./generated/prisma-client");
const Mutation = require("./resolvers/Mutation");
const Query = require("./resolvers/Querys");
const { typeDefs } = require("./generated/prisma-client/prisma-schema");
// const { print } = require("graphql/language/printer");
// const schema = require("./schema.graphql");
// const gql = require("graphql-tag")

// console.log("this is a graphql file", print(schema));

const server = new GraphQLServer({
  typeDefs,
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
server.express.use((req, res, next) => {
  console.log("hello");
  next();
});

server.start(
  {
    cors: {
      credentials: true,
      origin: "http://localhost:3000"
    }
  },
  deets => {
    console.log(`server is running on port ${deets.port}`);
  }
);
