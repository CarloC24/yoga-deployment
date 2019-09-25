const Query = {
  async user(parent, args, ctx, info) {
    console.log(ctx.prisma.user, args.id);
    return await ctx.prisma.user({ ...args }, info);
  },
  //   users: forwardTo("prisma")
  async users(parent, args, ctx, info) {
    return await ctx.prisma.users();
  }
};

module.exports = Query;
