'use strict';

const Controller = require('egg').Controller;

class CollegeAccessController extends Controller {

  constructor(ctx) {
    super(ctx);
    // 下面是 validate 校验用户提交数据用的字段
    this.UserCaptchaTransfer = {
      college_id: { type: 'number', required: true, allowEmpty: false },
    };
    this.PostListTransfer = {
      page_id: { type: 'number', required: false, allowEmpty: false },
      page_size: { type: 'number', required: false, allowEmpty: false },
    };
  }

  async list() {
    const { ctx, service } = this;
    // 调用 Service 进行业务处理
    const res = await service.collegeAccess.list();
    // 设置响应内容和响应状态码
    ctx.helper.success({ ctx, res });
  }

  async captcha() {
    const { ctx, service } = this;
    // 校验用户提交的数据
    try {
      ctx.validate(this.UserCaptchaTransfer);
    } catch (err) {
      ctx.helper.error(ctx, 1005);
      return;
    }
    // 组装参数
    const payload = ctx.request.body || {};
    // 调用 Service 进行业务处理
    const res = await service.collegeAccess.captcha(payload);
    if (res === false || res === '') { ctx.helper.error(ctx, 1009); return; }
    // 设置响应内容和响应状态码
    ctx.helper.success({ ctx, res });
  }

  async post_categories() {
    const { ctx, service } = this;
    // 调用 Service 进行业务处理
    let res = await service.collegeAccess.post_categories();
    if (res === '') { ctx.helper.error(ctx, 1006); return; }
    if (res === false) { res = ''; }
    // 设置响应内容和响应状态码
    ctx.helper.success({ ctx, res });
  }

  async posts() {
    const { ctx, service } = this;
    // 校验用户提交的数据
    try {
      ctx.validate(this.PostListTransfer);
    } catch (err) {
      ctx.helper.error(ctx, 1005);
      return;
    }
    // 组装参数
    const payload = ctx.request.body || {};
    // 调用 Service 进行业务处理
    let res = await service.collegeAccess.posts(payload);
    if (res === '') { ctx.helper.error(ctx, 1006); return; }
    if (res === false) { res = ''; }
    // 设置响应内容和响应状态码
    ctx.helper.success({ ctx, res });
  }

  async settings() {
    const { ctx, service } = this;
    // 调用 Service 进行业务处理
    const res = await service.collegeAccess.settings();
    if (res === '') { ctx.helper.error(ctx, 1006); return; }
    // 设置响应内容和响应状态码
    ctx.helper.success({ ctx, res });
  }

  async info_page() {
    const { ctx, service } = this;
    // 调用 Service 进行业务处理
    let res = await service.collegeAccess.info_page();
    if (res === '') { ctx.helper.error(ctx, 1006); return; }
    if (res === false) { res = ''; }
    // 设置响应内容和响应状态码
    ctx.helper.success({ ctx, res });
  }

  async clubs() {
    const { ctx, service } = this;
    // 调用 Service 进行业务处理
    const res = await service.collegeAccess.clubs();
    if (res === '') { ctx.helper.error(ctx, 1006); return; }
    // 设置响应内容和响应状态码
    ctx.helper.success({ ctx, res });
  }

  async contact() {
    const { ctx, service } = this;
    // 调用 Service 进行业务处理
    const res = await service.collegeAccess.contact();
    if (res === '') { ctx.helper.error(ctx, 1006); return; }
    // 设置响应内容和响应状态码
    ctx.helper.success({ ctx, res });
  }

}

module.exports = CollegeAccessController;
