'use strict';

// app/middleware/microService.js
module.exports = () => {
  return async function microService(ctx, next) {
    if (ctx.request.url !== '/basic' && ctx.request.url !== '/authorization' && ctx.request.url !== '/rpcsync' && ctx.request.url !== '/getaccountinfo' && ctx.request.url !== '/metadata') { await next(); return; }
    try {
      if (ctx.remoteIp) {
        ctx.ip = ctx.remoteIp;
      }
      if (ctx.remoteHeaders && ctx.remoteHeaders['user-agent'] && ctx.remoteHeaders['user-agent'].length !== 0) {
        ctx.headers['user-agent'] = ctx.remoteHeaders['user-agent'][0];
      }
      if (ctx.request.body !== undefined && ctx.request.body !== null) ctx.request.body = JSON.parse((new TextDecoder()).decode(ctx.request.body));
      if (ctx.request.url !== '/authorization' && ctx.request.url !== '/rpcsync' && ctx.request.url !== '/getaccountinfo' && ctx.request.url !== '/metadata') {
        if (!ctx.request.body || !ctx.request.body.route || !ctx.request.body.payload) throw new Error('InvalidRequestException');
      }
    } catch (err) {
      ctx.status = 400;
      // ctx.app.logger.error(err);
      return;
    }

    if (!(ctx.request.url === '/authorization' || ctx.request.url === '/rpcsync' || ctx.request.url === '/getaccountinfo' || ctx.request.url === '/metadata')) {
      ctx.request.url = ctx.request.body.route || '/';
      ctx.request.body = ctx.request.body.payload;
    }

    ctx.set('Content-Type', 'application/json; charset=utf-8');
    ctx.set('Keep-Alive', 'timeout=5');
    ctx.set('Vary', 'Origin');
    ctx.set('X-Content-Type-Options', 'nosniff');
    ctx.set('X-Download-Options', 'noopen');
    ctx.set('X-Frame-Options', 'SAMEORIGIN');
    ctx.set('X-XSS-Protection', '1; mode=block');

    await next();
  };
};
