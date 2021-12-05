'use strict';

const ResponseCodeType = require('./acorle').ResponseCodeType;
const getRawBody = require('raw-body');

module.exports = async (ctx, next) => {
  if (ctx.request.method !== 'POST') { await next(); return; }
  let data = null;
  try {

    ctx.request.body = await getRawBody(ctx.req, {
      length: ctx.req.headers['content-length'],
      limit: '4mb',
    });

    data = ctx.app.acorle.getRequestData(ctx.request.body);
    ctx.remoteIp = data.remoteIp;
    ctx.remotePort = data.remotePort;
    ctx.remoteHeaders = data.remoteHeaders;

  } catch (err) {
    ctx.body = Buffer.from(ctx.app.acorle.makeResponsePacket(ResponseCodeType.BAD_REQUEST));
    ctx.response.type = 'application/x-protobuf';
    ctx.status = 200;
    ctx.response.status = 200;
    ctx.response.message = 'OK';
    return;
  }

  ctx.request.body = data.data;
  const headers = new Map();
  ctx.acorleSetHeader = (key, value) => {
    if (headers.has(key)) {
      const arr = headers.get(key);
      if (arr) {
        if (Array.isArray(value)) {
          value.forEach(e => arr.push(e));
        } else {
          arr.push(value);
        }
      }
    } else {
      if (Array.isArray(value)) {
        headers.set(key, value);
      } else {
        headers.set(key, [ value ]);
      }
    }
  }
  ctx.set = ctx.acorleSetHeader;

  await next();

  ctx.response.type = 'application/x-protobuf';
  ctx.status = 200;
  ctx.response.status = 200;
  ctx.response.message = 'OK';

  let responseCode = ResponseCodeType.OK;
  switch (ctx.status) {
    default: responseCode = ResponseCodeType.OK; break;
    case 400: responseCode = ResponseCodeType.BAD_REQUEST; break;
    case 403: responseCode = ResponseCodeType.FORBIDDEN; break;
    case 404: responseCode = ResponseCodeType.NOT_FOUND; break;
    case 405: responseCode = ResponseCodeType.METHOD_NOT_ALLOWED; break;
    case 500: responseCode = ResponseCodeType.SERVER_EXCEPTION; break;
    case 502: responseCode = ResponseCodeType.BAD_GATEWAY; break;
    case 503: responseCode = ResponseCodeType.SERVICE_UNAVAILABLE; break;
  }

  if (responseCode !== ResponseCodeType.OK) {
    ctx.body = Buffer.from(ctx.app.acorle.makeResponsePacket(responseCode));
  } else {
    ctx.body = Buffer.from(ctx.app.acorle.makeResponsePacket(
      responseCode,
      ctx.body,
      headers
    ));
  }

};
