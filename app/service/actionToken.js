'use strict';

const Service = require('egg').Service;

class ActionTokenService extends Service {

  async apply(_uid, _college_id) {
    const { ctx } = this;
    const _expires = Date.now() + ctx.app.config.tokenExpires;
    return ctx.app.jwt.sign({
      data: {
        expires: _expires,
        uid: _uid,
        college_id: _college_id,
      },
      exp: _expires,
    }, ctx.app.config.jwt.secret);
  }

  async verify(token) {
    const { ctx } = this;
    return ctx.app.jwt.verify(token);
  }

}

module.exports = ActionTokenService;
