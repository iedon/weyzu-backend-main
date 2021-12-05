'use strict';

const Controller = require('egg').Controller;

// 此类包含 Collplex 微服务调用接口以及缺省访问处理
class DefaultController extends Controller {

  constructor(ctx) {
    super(ctx);
    // 下面是 validate 校验用户提交数据用的字段
    this.RpcSyncTransfer = {
      type: { type: 'string', required: true, allowEmpty: false },
      uid: { type: 'number', required: true, allowEmpty: false },
      sync: { type: 'boolean', required: true, allowEmpty: false },
    };
    this.GetAccountInfoTransfer = {
      uid: { type: 'number', required: true, allowEmpty: false },
    };
    this.MetaDataTransfer = {
      uid: { type: 'number', required: true, allowEmpty: false },
      key: { type: 'string', required: true, allowEmpty: false },
      value: { type: 'string', required: false, allowEmpty: true },
    };
  }

  async index() {
    this.ctx.body = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"><title>Acorle Microservices</title></head><body style="padding:50px;font: 14px \'Lucida Grande\', Helvetica, Arial, sans-serif;"><h1>Acorle Microservices</h1><p>Welcome to Acorle Microservices, the integrated microservice solution.</p><hr><p><span>Client SDK:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><b><code>${this.app.config.VAR_APP_INFO.sdkName}/${this.app.config.VAR_APP_INFO.sdkVersion}</code></b></p><p><span>Framework:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><b><code>${this.app.config.VAR_APP_INFO.package}</code></b></p><p><span>Configured services:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><b><code>${this.app.acorle.services.length}</code></b></p><p><span>Registration status:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><b><code>${this.app.acorle.status}</code></b></p><hr><address>Copyright &copy; 2019-${new Date().getFullYear()} iEdon</address></body></html>`;
  }

  async authorization() {
    const { ctx, service } = this;
    // 调用 Service 进行业务处理
    const res = await service.default.authorization();
    // 设置响应内容和响应状态码
    ctx.helper.success({ ctx, res });
  }

  async rpcsync() {
    const { ctx, service } = this;
    // 校验用户提交的数据
    try {
      ctx.validate(this.RpcSyncTransfer);
    } catch (err) {
      ctx.helper.error(ctx, 1005);
      return;
    }
    // 组装参数
    const payload = ctx.request.body || {};
    // 调用 Service 进行业务处理
    const res = await service.default.rpcsync(payload);
    if (res !== false) {
      // 设置响应内容和响应状态码
      ctx.helper.success({ ctx, res });
    }
  }

  async getaccountinfo() {
    const { ctx, service } = this;
    // 校验用户提交的数据
    try {
      ctx.validate(this.GetAccountInfoTransfer);
    } catch (err) {
      ctx.helper.error(ctx, 1005);
      return;
    }
    // 组装参数
    const payload = ctx.request.body || {};
    // 调用 Service 进行业务处理
    const res = await service.default.getaccountinfo(payload);
    // 设置响应内容和响应状态码
    ctx.helper.success({ ctx, res });
  }

  async metadata() {
    const { ctx, service } = this;
    // 校验用户提交的数据
    try {
      ctx.validate(this.MetaDataTransfer);
    } catch (err) {
      ctx.helper.error(ctx, 1005);
      return;
    }
    // 组装参数
    const payload = ctx.request.body || {};
    // 调用 Service 进行业务处理
    const res = await service.default.metadata(payload);
    // 设置响应内容和响应状态码
    ctx.helper.success({ ctx, res });
  }

}

module.exports = DefaultController;
