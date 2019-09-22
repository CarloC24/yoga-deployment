const Mutations = {
  async createUser(parent, args, ctx, info) {
    console.log(args);
    const item = await ctx.prisma.createUser({ ...args });
    return item;
  },
  async updateUser(parent, args, ctx, info) {
    const updateBody = { ...args };
    delete updateBody.id;
    const item = await ctx.prisma.updateUser(
      { data: updateBody, where: { id: args.id } },
      info
    );
    return item;
  },
  async deleteUser(parent, args, ctx, info) {
    const item = await ctx.prisma.deleteUser({ where: { id: args.id } }, info);
    return item;
  }
};

module.exports = Mutations;
