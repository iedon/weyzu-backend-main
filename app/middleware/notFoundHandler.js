'use strict';
// app/middleware/notFoundHandler.js
module.exports = () => {
  return async function notFoundHandler(ctx, next) {
    await next();
    if (ctx.status === 404 && !ctx.body) {
      ctx.helper.error(ctx, 1000, 'not found');
      return;
    }
  };
};
