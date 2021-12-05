'use strict';

const Controller = require('egg').Controller;

class UserAccessController extends Controller {

  constructor(ctx) {
    super(ctx);
    // 下面是 validate 校验用户提交数据用的字段
    this.UserLoginTransfer = {
      account: { type: 'string', required: true, allowEmpty: false },
      password: { type: 'string', required: true, allowEmpty: false },
    };
    this.UserMPQQLoginTransfer = {
      appid: { type: 'string', required: true, allowEmpty: false },
      code: { type: 'string', required: true, allowEmpty: false },
      encrypted_data: { type: 'string', required: true, allowEmpty: false },
      iv: { type: 'string', required: true, allowEmpty: false },
    };
    this.UserBindTransfer = {
      college_id: { type: 'number', required: true, allowEmpty: false },
      student: { type: 'string', required: true, allowEmpty: false },
      password: { type: 'string', required: true, allowEmpty: false },
    };
    this.UserScoreTransfer = {
      sync: { type: 'boolean', required: true, allowEmpty: false },
    };
    this.UserScheduleTransfer = {
      student: { type: 'string', required: true, allowEmpty: false },
      sync: { type: 'boolean', required: true, allowEmpty: false },
    };
    this.UserSearchTransfer = {
      keyword: { type: 'string', required: true, allowEmpty: false },
      page_id: { type: 'number', required: true, allowEmpty: false },
      page_size: { type: 'number', required: true, allowEmpty: false },
    };
    this.UserCaptchaTransfer = {
      captcha: { type: 'string', required: true, allowEmpty: false },
    };
    this.UserProfileTransfer = {
      sync: { type: 'boolean', required: true, allowEmpty: false },
    };
    this.UserScoreRankingTransfer = {
      cid: { type: 'string', required: true, allowEmpty: false },
      cindex: { type: 'string', required: true, allowEmpty: true },
    };
  }

  // 登录&用户信息
  async login() {
    const { ctx, service } = this;
    // 校验用户提交的数据
    try {
      ctx.validate(this.UserLoginTransfer);
    } catch (err) {
      ctx.helper.error(ctx, 1005);
      return;
    }
    // 组装参数
    const payload = ctx.request.body || {};
    // 调用 Service 进行业务处理
    const res = await service.userAccess.login(payload);
    if (res !== null) {
      // 设置响应内容和响应状态码
      ctx.helper.success({ ctx, res });
    }
  }

  // 微信小程序登录&用户信息 利用小程序提交的 code 向微信服务器换取 openid
  async mplogin() {
    const { ctx, service } = this;
    // 校验用户提交的数据
    try {
      ctx.validate(this.UserMPQQLoginTransfer);
    } catch (err) {
      ctx.helper.error(ctx, 1005);
      return;
    }
    // 组装参数
    const payload = ctx.request.body || {};
    // 调用 Service 进行业务处理
    const res = await service.userAccess.mplogin(payload);
    if (res !== null) {
      // 设置响应内容和响应状态码
      ctx.helper.success({ ctx, res });
    }
  }

  // 小程序登录&用户信息 利用小程序提交的 code 向微信服务器换取 openid
  async qqlogin() {
    const { ctx, service } = this;
    // 校验用户提交的数据
    try {
      ctx.validate(this.UserMPQQLoginTransfer);
    } catch (err) {
      ctx.helper.error(ctx, 1005);
      return;
    }
    // 组装参数
    const payload = ctx.request.body || {};
    // 调用 Service 进行业务处理
    const res = await service.userAccess.qqlogin(payload);
    if (res !== null) {
      // 设置响应内容和响应状态码
      ctx.helper.success({ ctx, res });
    }
  }

  // 当开启用户手动输入验证码时，用户提交验证码的请求
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
    const res = await service.userAccess.captcha(payload);
    if (res !== false) {
      // 设置响应内容和响应状态码
      ctx.helper.success({ ctx });
    }
  }

  // 绑定学号
  async bind() {
    const { ctx, service } = this;
    // 校验用户提交的数据
    try {
      ctx.validate(this.UserBindTransfer);
    } catch (err) {
      ctx.helper.error(ctx, 1005);
      return;
    }
    // 组装参数
    const payload = ctx.request.body || {};
    // 调用 Service 进行业务处理
    const res = await service.userAccess.bind(payload);
    if (res !== false) {
      // 设置响应内容和响应状态码
      ctx.helper.success({ ctx });
    }
  }

  // 解除绑定学号
  async unbind() {
    const { ctx, service } = this;
    // 调用 Service 进行业务处理
    const res = await service.userAccess.unbind();
    if (res !== false) {
      // 设置响应内容和响应状态码
      ctx.helper.success({ ctx });
    }
  }

  // 用户学籍信息获取/同步接口
  async profile() {
    const { ctx, service } = this;
    // 校验用户提交的数据
    try {
      ctx.validate(this.UserProfileTransfer);
    } catch (err) {
      ctx.helper.error(ctx, 1005);
      return;
    }
    // 组装参数
    const payload = ctx.request.body || {};
    const res = await service.userAccess.profile(payload);
    if (res !== false) {
      // 设置响应内容和响应状态码
      ctx.helper.success({ ctx, res });
    }
  }

  // 查分接口
  async scores() {
    const { ctx, service } = this;
    // 校验用户提交的数据
    try {
      ctx.validate(this.UserScoreTransfer);
    } catch (err) {
      ctx.helper.error(ctx, 1005);
      return;
    }
    // 组装参数
    const payload = ctx.request.body || {};
    const res = await service.userAccess.scores(payload);
    if (res !== false) {
      // 设置响应内容和响应状态码
      ctx.helper.success({ ctx, res });
    }
  }

  // 查单科成绩排名接口
  async score_ranking() {
    const { ctx, service } = this;
    // 校验用户提交的数据
    try {
      ctx.validate(this.UserScoreRankingTransfer);
    } catch (err) {
      ctx.helper.error(ctx, 1005);
      return;
    }
    // 组装参数
    const payload = ctx.request.body || {};
    const res = await service.userAccess.score_ranking(payload);
    if (res !== false) {
      // 设置响应内容和响应状态码
      ctx.helper.success({ ctx, res });
    }
  }

  // 查课表接口
  async schedules() {
    const { ctx, service } = this;
    // 校验用户提交的数据
    try {
      ctx.validate(this.UserScheduleTransfer);
    } catch (err) {
      ctx.helper.error(ctx, 1005);
      return;
    }
    // 组装参数
    const payload = ctx.request.body || {};
    const res = await service.userAccess.schedules(payload);
    if (res !== false) {
      // 设置响应内容和响应状态码
      ctx.helper.success({ ctx, res });
    }
  }

  // 查人(水表)接口
  async students() {
    const { ctx, service } = this;
    // 校验用户提交的数据
    try {
      ctx.validate(this.UserSearchTransfer);
    } catch (err) {
      ctx.helper.error(ctx, 1005);
      return;
    }
    // 组装参数
    const payload = ctx.request.body || {};
    const res = await service.userAccess.students(payload);
    if (res !== false) {
      // 设置响应内容和响应状态码
      ctx.helper.success({ ctx, res });
    }
  }

  // 查课接口
  async courses() {
    const { ctx, service } = this;
    // 校验用户提交的数据
    try {
      ctx.validate(this.UserSearchTransfer);
    } catch (err) {
      ctx.helper.error(ctx, 1005);
      return;
    }
    // 组装参数
    const payload = ctx.request.body || {};
    const res = await service.userAccess.courses(payload);
    if (res !== false) {
      // 设置响应内容和响应状态码
      ctx.helper.success({ ctx, res });
    }
  }

}

module.exports = UserAccessController;
