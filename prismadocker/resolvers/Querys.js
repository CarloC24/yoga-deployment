const { forwardTo } = require("prisma-binding");

const Query = {
  async user(parent, args, ctx, info) {
    console.log(ctx.prisma.user, args.id);
    return await ctx.prisma.user({ id: args.id }, info);
  },
  async users(parent, args, ctx, info) {
    return await ctx.prisma.users();
  }
};

module.exports = Query;
