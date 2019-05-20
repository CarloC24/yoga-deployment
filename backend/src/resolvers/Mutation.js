const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const { promisify } = require('util');
const mail = require('../mail');
const { hasPermission } = require('../utils');
const stripe = require('../stripe');

const mutations = {
  async createItem(parent, args, ctx, info) {
    //TODO: Check if they are logged in
    if (!ctx.request.userId) {
      throw new Error('You must be logged in to do that');
    }
    const item = await ctx.db.mutation.createItem(
      {
        data: {
          ...args,
          user: {
            connect: {
              id: ctx.request.userId
            }
          }
        }
      },
      info
    );
    return item;
  },

  async updateItem(parent, args, ctx, info) {
    //first take a copy of the updates
    const updates = { ...args };
    //remove the id of the updates
    delete updates.id;
    return await ctx.db.mutation.updateItem(
      {
        data: updates,
        where: {
          id: args.id
        }
      },
      info
    );
  },

  async deleteItem(parent, args, ctx, info) {
    const where = { id: args.id };
    //1.find the item
    const item = await ctx.db.query.item(
      { where: { id: args.id } },
      '{id title user {id}}'
    );
    //2. Check if they own the item or have permissions
    //TODO
    console.log(item, 'i am the item!!!');
    const ownsItem = item.user.id === ctx.request.userId;
    const hasPermissions = ctx.request.user.permissions.some(permission =>
      ['ADMIN', 'ITEMDELETE'].includes(permission)
    );

    if (!ownsItem && !hasPermissions) {
      throw new Error('You do not have permission to do that');
    }
    //3. Delete it!
    return ctx.db.mutation.deleteItem({ where: { id: args.id } }, info);
  },

  async signup(parent, args, ctx, info) {
    args.email = args.email.toLowerCase();
    const password = await bcrypt.hash(args.password, 3);
    const user = await ctx.db.mutation.createUser(
      {
        data: {
          ...args,
          password: password,
          permissions: { set: ['USER'] }
        }
      },
      info
    );
    //CREATE A JWT TOKEN(JWTPAYLOAD,JWTSECRET,JWTOPTIONS)
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET, {
      expiresIn: '1hr'
    });
    //set the jwt as a cookie
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60
    });
    return user;
  },
  async signin(parent, { email, password }, ctx, info) {
    //1. check if there is a user with that email
    const user = await ctx.db.query.user({ where: { email: email } });
    if (!user) {
      throw new Error(`No such user found for email ${email}`);
    }
    //2. check if their password is correct
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new Error('Invalid Password!');
    }
    //3. generate the JWT token
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    //4. set the cookie with the token
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60
    });
    //5. return the user
    return user;
  },
  async signout(parent, args, ctx, info) {
    ctx.response.clearCookie('token');
    return { message: 'Goodbye!' };
  },

  async requestReset(parent, args, ctx, info) {
    //1. Check if this is a real user
    const user = await ctx.db.query.user({ where: { email: args.email } });
    if (!user) {
      throw new Error(`No such user found for email ${email}`);
    }
    //2. Set a reset token and expiry to that user
    const promisifiedRandomBytes = promisify(randomBytes);
    const resetToken = (await promisifiedRandomBytes(20)).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000;
    const res = await ctx.db.mutation.updateUser({
      where: { email: args.email },
      data: { resetToken: resetToken, resetTokenExpiry: resetTokenExpiry }
    });

    //3. Email them that reset token
    const mailRes = await mail.transport.sendMail({
      from: 'carlo',
      to: user.email,
      subject: 'Your password reset token',
      html: mail.makeANiceEmail(`Your Password Reset Token is here!
      \n\n
      <a href="${process.env.FRONTEND_URL}/reset?resetToken=${resetToken}">
      Click here to reset!
      </a>
      `)
    });

    //4. Return the message
    return { message: 'thanks!' };
  },
  async resetPassword(parent, args, ctx, info) {
    //1.check is the passwords match
    if (args.password !== args.confirmPassword) {
      throw new Error(' Your passwords dont match');
    }
    //2. check if its a legit reset token
    //3. Check if it is expired
    const [user] = await ctx.db.query.users({
      where: {
        resetToken: args.resetToken,
        resetTokenExpiry_gte: Date.now() - 3600000
      }
    });

    if (!user) {
      throw new Error('This token is either invalid or expired!');
    }
    //4. Hash their new password
    const password = await bcrypt.hash(args.password, 3);
    //5. Save the new password to the user and remove old user reset token fields
    const updatedUser = await ctx.db.mutation.updateUser({
      where: { email: user.email },
      data: {
        password: password,
        resetToken: null,
        resetTokenExpiry: null
      }
    });
    //6.Generate JWT
    const token = jwt.sign({ userId: updatedUser.id }, process.env.APP_SECRET);
    //7. Set the JWT cookie
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60
    });
    //8. return the new user
    return updatedUser;
  },

  async updatePermissions(parent, args, ctx, info) {
    //1. Check if they are logged in
    if (!ctx.request.userId) {
      throw new Error('You need to be logged in to do this');
    }
    //2. Query the current user
    const currentUser = await ctx.db.query.user(
      {
        where: { id: ctx.request.userId }
      },
      info
    );

    //3. Check if they have permissions to do this
    hasPermission(currentUser, ['ADMIN', 'PERMISSIONUPDATE']);
    //4. Update the permissions of the user
    return await ctx.db.mutation.updateUser(
      {
        data: {
          permissions: {
            set: args.permissions
          }
        },
        where: {
          id: args.userId
        }
      },
      info
    );
  },
  async addToCart(parent, args, ctx, info) {
    //1. Make sure they are signed in
    const { userId } = ctx.request;
    if (!userId) {
      throw new Error('Please sign in first');
    }
    //2. Query the users current cart
    const [existingCartItem] = await ctx.db.query.cartItems(
      {
        where: {
          user: { id: userId },
          item: { id: args.id }
        }
      },
      info
    );
    //3. Check if that item is already in their cart if so increment by 1
    if (existingCartItem) {
      return await ctx.db.mutation.updateCartItem(
        {
          where: {
            id: existingCartItem.id
          },
          data: {
            quantity: existingCartItem.quantity + 1
          }
        },
        info
      );
    }

    //4. If its not create a fresh CartItem for that user
    return await ctx.db.mutation.createCartItem(
      {
        data: {
          user: {
            connect: { id: userId }
          },
          item: {
            connect: { id: args.id }
          }
        }
      },
      info
    );
  },
  async removeFromCart(parent, args, ctx, info) {
    //1.Find the cart item
    const cartItem = await ctx.db.query.cartItem(
      {
        where: {
          id: args.id
        }
      },
      '{id user{id}}'
    );
    //1.5 Make sure there is a cart item
    if (!cartItem) throw new Error('No CartItem found');
    //2. Make sure they own the cart item
    if (cartItem.user.id !== ctx.request.userId) {
      throw new Error('Not your item');
    }
    //3. Delete that cart item
    return await ctx.db.mutation.deleteCartItem(
      {
        where: { id: args.id }
      },
      info
    );
  },
  async createOrder(parent, args, ctx, info) {
    //1. Query the current users and make sure they are signed in
    const { userId } = ctx.request;
    if (!userId)
      throw new Error('You must be signed in to complete your order');
    //2. Recalculate the total for the price
    const user = await ctx.db.query.user(
      {
        where: {
          id: userId
        }
      },
      `{id
        name
        email
        cart {
               id
               quantity
               item {
                      title
                      price
                      id
                      description
                      largeImage
                      image
                     }
                    }
                  }`
    );
    const amount = user.cart.reduce(
      (tally, cartItem) => tally + cartItem.item.price * cartItem.quantity,
      0
    );
    console.log(amount, 'amount');
    //3. Create the stripe charge
    const charge = await stripe.charges.create({
      amount: amount,
      currency: 'USD',
      source: args.token
    });
    //4. Convert the CartItems to OrderItems
    const orderItems = user.cart.map(cartItem => {
      const orderItem = {
        ...cartItem.item,
        quantity: cartItem.quantity,
        user: { connect: { id: userId } }
      };
      delete orderItem.id;
      return orderItem;
    }); // array of orderItems
    //5. Create the order
    const order = await ctx.db.mutation.createOrder({
      data: {
        total: charge.amount,
        charge: charge.id,
        items: { create: orderItems },
        user: { connect: { id: userId } }
      }
    }); // items : { create : orderItems} // items : [OrderItems!]! creates the relationship and everything in one fell swoop
    //6. Clean up the users cart and delete the cartItem
    const cartItemIds = user.cart.map(item => item.id);
    await ctx.db.mutation.deleteManyCartItems({
      where: {
        id_in: cartItemIds
      }
    });
    //7. return the order to the client
    return order;
  }
};

module.exports = mutations;
