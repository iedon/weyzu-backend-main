'use strict';

// app/middleware/verifyToken.js

module.exports = () => {
  return async function verifyToken(ctx, next) {

    // 排除微服务。为什么不排除 authorization？因为 authorization 中含有 token 字段需要利用本中间件验证用户合法性。
    if (ctx.request.url === '/rpcsync' || ctx.request.url === '/getaccountinfo' || ctx.request.url === '/metadata') { await next(); return; }

    // 排除几个无需 token 认证的 url
    if (ctx.request.url === '/') { await next(); return; }
    if (ctx.request.url === '/user/login' || ctx.request.url === '/user/mplogin' || ctx.request.url === '/user/qqlogin' || ctx.request.url === '/college/list') { await next(); return; }

    // 检查请求中是否存在 token 且不为空
    try {
      ctx.validate({
        token: { type: 'string', required: true, allowEmpty: false },
      });
    } catch (err) {
      ctx.helper.error(ctx, 1001);
      return;
    }

    // 组装参数
    const payload = ctx.request.body || {};

    let ret = null;
    try {
      // 验证 token 是否合法
      ret = await ctx.service.actionToken.verify(payload.token);
      if (ret && ret.exp < Date.now()) {
        ctx.helper.error(ctx, 1002);
        return;
      }
    } catch (err) {
      ctx.helper.error(ctx, 1002);
      return;
    }

    // 定义并赋值uid,type到会话
    ctx.state.uid = ret.data.uid;
    ctx.state.college_id = ret.data.college_id;

    await next();
  };
};
