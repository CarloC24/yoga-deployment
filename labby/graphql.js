const { ApolloServer, gql } = require("apollo-server-lambda");
const { prisma } = require("./generated/prisma-client");
// Construct a schema, using GraphQL schema language
const typeDefs = gql`
  type Query {
    hello: [User]
    name: String
    lastname: String
  }
  type User {
    id: ID!
    name: String!
  }
`;

// Provide resolver functions for your schema fields
const resolvers = {
  Query: {
    hello: async (source, args, context, state) => await context.prisma.users(),
    name: () => "carlo",
    lastname: () => "carlo clamucha"
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ event, context }) => ({
    headers: event.headers,
    functionName: context.functionName,
    event,
    context,
    prisma
  }),
  introspection: true,
  playground: true
});
console.log("hey");
prisma.user().then(res => console.log(res));

exports.graphqlHandler = server.createHandler({
  cors: {
    origin: "*",
    credentials: true
  }
});
