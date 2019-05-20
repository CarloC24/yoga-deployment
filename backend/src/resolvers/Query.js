const { forwardTo } = require('prisma-binding');
const { hasPermission } = require('../utils');

const Query = {
  items: forwardTo('db'),
  item: forwardTo('db'),
  itemsConnection: forwardTo('db'),
  async me(parent, args, ctx, info) {
    if (!ctx.request.userId) {
      return null;
    }
    return ctx.db.query.user(
      {
        where: {
          id: ctx.request.userId
        }
      },
      info
    );
  },
  async users(parent, args, ctx, info) {
    //1.If they are logged in proceed
    if (!ctx.request.userId) {
      throw new Error('You must be logged in!');
    }
    //2. Check if the user has the permissions to query all the users!
    hasPermission(ctx.request.user, ['ADMIN', 'PERMISSIONUPDATE']);
    console.log('reached me');
    //3. If they do query all the users!!!
    return await ctx.db.query.users({}, info);
  },
  async order(parent, args, ctx, info) {
    //1. Make sure they are logged in
    if (!ctx.request.userId) {
      throw new Error('You must be logged in the view the order');
    }
    //2. Query the current order
    const order = await ctx.db.query.order(
      {
        where: { id: args.id }
      },
      info
    );
    //3. Check if they have the permissions to see this order
    const ownsOrder = order.user.id === ctx.request.userId;
    const hasPermissionToSeeOrder = ctx.request.user.permissions.includes(
      'ADMIN'
    );
    if (!ownsOrder || !hasPermissionToSeeOrder) {
      throw new Error('You cant see this order!');
    }
    //4. Return the order
    return order;
  },
  async orders(parent, args, ctx, info) {
    const { userId } = ctx.request;

    if (!userId) {
      throw new Error('You must be logged in the view the order');
    }
    return await ctx.db.query.orders(
      {
        where: {
          user: { id: userId }
        }
      },
      info
    );
  }

  //   async items(parent, args, ctx, info) {
  //     const item = await ctx.db.query.items();
  //     return item;
  //   }
};
//PARENT ARGS AND CONTEXT FROM PRISMA DB INFO FROM THE GRAPHQL
module.exports = Query;
