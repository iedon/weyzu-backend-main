'use strict';

const acorleKoaMiddleware = require('../../acorle-sdk/acorleKoaMiddleware');

module.exports = () => {
  return async function acorleWrapper(ctx, next) {
    if (ctx.request.url !== '/basic' && ctx.request.url !== '/authorization' && ctx.request.url !== '/rpcsync' && ctx.request.url !== '/getaccountinfo' && ctx.request.url !== '/metadata') { await next(); return; }
    return await acorleKoaMiddleware(ctx, next);
  };
};
