'use strict';

/**
 * @authors iEdon (m [at] iedon.net)
 * @date    2018/9/29 20:41
 * @version V0.0.1
 */

/*
    iEdon UniPlex Project
    高校校园数据服务 2.0
        引导文件
*/

// app.js

const pkg = require('./package.json');
const College = require('./classes/college');
const { AcorleClient, AcorleService } = require('./acorle-sdk/acorle');

class AppBootHook {

  constructor(app) {
    this.app = app;
  }

  configDidLoad() {
    // 配置和插件文件已经加载
  }

  async didLoad() {
    // 所有内容已经加载后执行
    const app = this.app;

    const services = [
      new AcorleService('basicservice', `${app.config.baseUrl}/basic`, '基本服务', false, app.config.serviceWeight),
      new AcorleService('authorization', `${app.config.baseUrl}/authorization`, '授权服务', true, app.config.serviceWeight),
      new AcorleService('rpcsync', `${app.config.baseUrl}/rpcsync`, 'RPC同步', true, app.config.serviceWeight),
      new AcorleService('getaccountinfo', `${app.config.baseUrl}/getaccountinfo`, '帐户信息', true, app.config.serviceWeight),
      new AcorleService('metadata', `${app.config.baseUrl}/metadata`, '元数据存取', true, app.config.serviceWeight),
    ];

    app.acorle = new AcorleClient(app.config.clientId, app.config.clientSecret, services, 60, app.config.centerServer,
      async (url, options) => await app.fetch(app, url === undefined ? app.config.centerServer : url, options),
      logContent => app.logger.info(logContent)
    );
  }

  async willReady() {

    const app = this.app;

    app.defaultCrawlerUserAgent = `${pkg.name}/${pkg.version}`;
    app.logger.info('正在连接主数据库...');

    // 从配置中心获取 MySQL 的配置
    try {
      app.maindb = app.mysql.createInstance(app.config.VAR_MAIN_MYSQL_SERVER);
    } catch (err) {
      app.logger.info(`初始化失败，主数据库无法连接: ${err}`);
      return;
    }

    app.logger.info('正在获取主系统配置信息...');
    try {
      const name = await app.maindb.query('SELECT value FROM settings WHERE `key` = \'NAME\' LIMIT 0, 1');
      const version = await app.maindb.query('SELECT value FROM settings WHERE `key` = \'VERSION\' LIMIT 0, 1');
      const copyright = await app.maindb.query('SELECT value FROM settings WHERE `key` = \'COPYRIGHT\' LIMIT 0, 1');
      const gid_general = await app.maindb.query('SELECT value FROM settings WHERE `key` = \'ACCOUNT_GID\' LIMIT 0, 1');
      const gid_oauth_wx = await app.maindb.query('SELECT value FROM settings WHERE `key` = \'ACCOUNT_GID_OAUTH_WX\' LIMIT 0, 1');
      const gid_oauth_qq = await app.maindb.query('SELECT value FROM settings WHERE `key` = \'ACCOUNT_GID_OAUTH_QQ\' LIMIT 0, 1');
      if (name.length !== 0 && name[0].value) app.config.VAR_APP_INFO.name = name[0].value;
      if (version.length !== 0 && version[0].value) app.config.VAR_APP_INFO.version = version[0].value;
      if (copyright.length !== 0 && copyright[0].value) app.config.VAR_APP_INFO.copyright = copyright[0].value;
      if (gid_general.length !== 0 && gid_general[0].value) app.config.VAR_ACCOUNT_GID.GENERAL = gid_general[0].value;
      if (gid_oauth_wx.length !== 0 && gid_oauth_wx[0].value) app.config.VAR_ACCOUNT_GID.OAUTH.WX = gid_oauth_wx[0].value;
      if (gid_oauth_qq.length !== 0 && gid_oauth_qq[0].value) app.config.VAR_ACCOUNT_GID.OAUTH.QQ = gid_oauth_qq[0].value;
      if (app.config.VAR_APP_INFO.name === null || app.config.VAR_APP_INFO.version === null || app.config.VAR_APP_INFO.copyright === null || app.config.VAR_ACCOUNT_GID.GENERAL === null) {
        app.logger.error('初始化失败，请确认数据库配置信息正确！');
        return;
      }
    } catch (err) {
      app.logger.info(`初始化失败，从主数据库读取配置失败: ${err}`);
      return;
    }

    // 框架启动完成，开始初始化
    app.logger.info('*****************************');
    app.logger.info(app.config.VAR_APP_INFO.name);
    app.logger.info('版本: ' + app.config.VAR_APP_INFO.version);
    app.logger.info(app.config.VAR_APP_INFO.copyright);
    app.logger.info('*****************************');

    app.logger.info('正在初始化院校...');
    // 加载所有院校信息，并实例化院校类
    const result = await app.maindb.select('colleges');
    app.colleges = [];
    result.forEach(e => {
      app.logger.info(`[${e.college_name}] 院校ID: ${e.college_id}, 系统类型: ${e.system_type}${e.comment ? (', ' + e.comment) : ''}`);
      const college = new College(app, e);
      app.colleges.push(college);
    });

    app.logger.info('初始化完成 ---> 总共加载了 ' + app.colleges.length + ' 个院校 <---');
  }

  async didReady() {
    // Worker 启动就绪
  }

  async serverDidReady() {
    // 服务器开始监听
  }

  async beforeClose() {
    // 应用程序结束前的动作
  }
}

module.exports = AppBootHook;
