//CONNECTS TO THE REMOTE PRISMA DB and gives us the ability to run JS on our database
const { Prisma } = require("prisma-binding"); // CONNECTING THE DATABASE ON TO THE PRISMA SERVER;
const db = new Prisma({
  typeDefs: "./generated/prisma.graphql",
  endpoint: process.env.PRISMA_ENDPOINT,
  secret: process.env.PRISMA_SECRET,
  debug: false //console logs all your mutations and queries
});

module.exports = db;
