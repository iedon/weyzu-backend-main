'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;
  // 基本接口设置
  router.get('/', controller.default.index);
  // 授权中心 微服务
  router.post('/authorization', controller.default.authorization);
  // RPC成绩课表同步 微服务
  router.post('/rpcsync', controller.default.rpcsync);
  // 帐户信息 微服务
  router.post('/getaccountinfo', controller.default.getaccountinfo);
  // 元数据存取 微服务
  router.post('/metadata', controller.default.metadata);
  // 用户学籍信息
  router.post('/user/profile', controller.userAccess.profile);
  // 登录&用户学籍信息
  router.post('/user/login', controller.userAccess.login);
  // 微信小程序登录&用户学籍信息
  router.post('/user/mplogin', controller.userAccess.mplogin);
  // QQ小程序登录&用户学籍信息
  router.post('/user/qqlogin', controller.userAccess.qqlogin);
  // 获取院校列表
  router.post('/college/list', controller.collegeAccess.list);
  // 当开启用户手动输入验证码时，获取验证码的请求
  router.post('/college/captcha', controller.collegeAccess.captcha);
  // 获取院校新闻/文章的分类
  router.post('/college/post_categories', controller.collegeAccess.post_categories);
  // 获取院校新闻/文章的列表与内容
  router.post('/college/post/category', controller.collegeAccess.posts); // 按最新发布时间显示列表
  router.post('/college/post/category/:pcid', controller.collegeAccess.posts); // 按分类最新显示列表
  router.post('/college/post/:pid', controller.collegeAccess.posts); // 显示具体文章内容
  // 获取首页图片轮播
  router.post('/college/settings', controller.collegeAccess.settings);
  // 获取包含校车/校历等信息的校园信息文章页面
  router.post('/college/info_page', controller.collegeAccess.info_page);
  // 获取通联信息
  router.post('/college/contact', controller.collegeAccess.contact);
  router.post('/college/contact/:contact_id', controller.collegeAccess.contact);
  // 获取社团信息
  router.post('/college/club', controller.collegeAccess.clubs);
  router.post('/college/club/:club_id', controller.collegeAccess.clubs);
  // 绑定学号
  router.post('/user/bind', controller.userAccess.bind);
  // 解绑学号
  router.post('/user/unbind', controller.userAccess.unbind);
  // 当开启用户手动输入验证码时，用户提交验证码的请求
  router.post('/user/captcha', controller.userAccess.captcha);
  // 获取成绩
  router.post('/user/scores', controller.userAccess.scores);
  // 查询单科成绩排名
  router.post('/user/scores/ranking', controller.userAccess.score_ranking);
  // 获取课表
  router.post('/user/schedules', controller.userAccess.schedules);
  // 学生搜索(查水表)
  router.post('/user/students', controller.userAccess.students);
  // 课程搜索(蹭课)
  router.post('/user/courses', controller.userAccess.courses);
};

