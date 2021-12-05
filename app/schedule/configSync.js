'use strict';

/**
 * @authors iEdon (m [at] iedon.net)
 * @date    2019/1/29 18:13
 * @version V0.1.5
 */

/*
    iEdon UniPlex Project
    高校校园数据服务 2.0
        定时任务
*/

// 此文件的作用是实现每5分钟进行一次配置与数据库同步的功能。

const Subscription = require('egg').Subscription;

class ConfigSync extends Subscription {

  // 通过 schedule 属性来设置定时任务的执行间隔等配置
  static get schedule() {
    return {
      interval: '1m', // 1 分钟间隔
      type: 'all', // 指定所有的 worker 都需要执行
    };
  }

  // subscribe 是真正定时任务执行时被运行的函数
  async subscribe() {

    const app = this.app;

    try {
      // 同步主服务器设置
      const name = await app.maindb.query('SELECT `value` FROM `settings` WHERE `key` = \'NAME\' LIMIT 0, 1');
      if (name.length !== 0 && name[0].value && app.config.VAR_APP_INFO.name !== name[0].value) { app.config.VAR_APP_INFO.name = name[0].value; app.logger.info('同步新设置: app.config.VAR_APP_INFO.name'); }

      const version = await app.maindb.query('SELECT `value` FROM `settings` WHERE `key` = \'VERSION\' LIMIT 0, 1');
      if (version.length !== 0 && version[0].value && app.config.VAR_APP_INFO.version !== version[0].value) { app.config.VAR_APP_INFO.version = version[0].value; app.logger.info('同步新设置: app.config.VAR_APP_INFO.version'); }

      const copyright = await app.maindb.query('SELECT `value` FROM `settings` WHERE `key` = \'COPYRIGHT\' LIMIT 0, 1');
      if (copyright.length !== 0 && copyright[0].value && app.config.VAR_APP_INFO.copyright !== copyright[0].value) { app.config.VAR_APP_INFO.copyright = copyright[0].value; app.logger.info('同步新设置: app.config.VAR_APP_INFO.copyright'); }

      const gid_general = await app.maindb.query('SELECT `value` FROM `settings` WHERE `key` = \'ACCOUNT_GID\' LIMIT 0, 1');
      if (gid_general.length !== 0 && gid_general[0].value && app.config.VAR_ACCOUNT_GID.GENERAL !== gid_general[0].value) { app.config.VAR_ACCOUNT_GID.GENERAL = gid_general[0].value; app.logger.info('同步新设置: app.config.VAR_ACCOUNT_GID.GENERAL'); }

      const gid_oauth_wx = await app.maindb.query('SELECT `value` FROM `settings` WHERE `key` = \'ACCOUNT_GID_OAUTH_WX\' LIMIT 0, 1');
      if (gid_oauth_wx.length !== 0 && gid_oauth_wx[0].value && app.config.VAR_ACCOUNT_GID.OAUTH.WX !== gid_oauth_wx[0].value) { app.config.VAR_ACCOUNT_GID.OAUTH.WX = gid_oauth_wx[0].value; app.logger.info('同步新设置: app.config.VAR_ACCOUNT_GID.OAUTH.WX'); }

      const gid_oauth_qq = await app.maindb.query('SELECT `value` FROM `settings` WHERE `key` = \'ACCOUNT_GID_OAUTH_QQ\' LIMIT 0, 1');
      if (gid_oauth_qq.length !== 0 && gid_oauth_qq[0].value && app.config.VAR_ACCOUNT_GID.OAUTH.QQ !== gid_oauth_qq[0].value) { app.config.VAR_ACCOUNT_GID.OAUTH.QQ = gid_oauth_qq[0].value; app.logger.info('同步新设置: app.config.VAR_ACCOUNT_GID.OAUTH.QQ'); }

      if (app.config.VAR_APP_INFO.name === null || app.config.VAR_APP_INFO.version === null || app.config.VAR_APP_INFO.copyright === null) {
        app.logger.error('同步设置时，发现新设置无效，将继续使用旧设置。');
      }

      // 同步院校设置(主要是检查教务URL设置是否更改了需要更新，如果在管理端的修改了数据库信息等，那么必须要重启服务端)
      const ret = await app.maindb.select('colleges');
      ret.forEach(c => { // c 是数据库查询后的每行数据，注意字段和 college 类中的定义有部分有区别(数据库：college_name <-> 类：name, 数据库：college_id <-> 类：id)
        app.colleges.forEach(e => {
          if (c.college_id === e.id) { // 找到相符的（注意管理端的删除等操作也必须重启服务端，否则此处紊乱）
            if (c.system_url !== e.system_url) {
              e.system_url = c.system_url;
              app.logger.info(`同步新设置: college_id(${e.id}).system_url`);
            }
            if (c.user_agent !== e.user_agent) {
              e.user_agent = c.user_agent || app.defaultCrawlerUserAgent;
              if (c.user_agent) app.logger.info(`同步新设置: college_id(${e.id}).user_agent`); // 因为 college 类中的 user_agent 会自动设置默认UA，而数据库返回的是 NULL，会造成每次同步都会记录日志。因此仅当数据库中 user_agent 设置了值得时候才会记录日志。
            }
            if (c.college_name !== e.name) {
              e.name = c.college_name;
              app.logger.info(`同步新设置: college_id(${e.id}).name`);
            }
            if (c.captcha !== undefined && c.captcha !== null && e.userInputCaptcha !== (parseInt(c.captcha) === 1)) {
              e.userInputCaptcha = (parseInt(c.captcha) === 1);
              app.logger.info(`同步新设置: college_id(${e.id}).captcha`);
            }
            if (c.comment !== e.comment) {
              e.comment = c.comment;
              app.logger.info(`同步新设置: college_id(${e.id}).comment`);
            }
          }
        });
      });
    } catch (err) {
      app.logger.error(`执行设置同步的计划任务执行失败, 异常: ${err}`);
    }

  }
}

module.exports = ConfigSync;
