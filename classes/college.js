'use strict';
/**
 * @authors iEdon (m [at] iedon.net)
 * @date    2018/9/30 21:12
 * @version V0.0.1
 */

/*
    iEdon UniPlex Project
    高校校园数据服务 2.0
        院校类
*/

// /classes/college.js

const path = require('path');

class College {

  constructor(app, info) {

    // 用传入的院校信息 info 来填充类成员
    this.id = info.college_id; // 院校ID
    this.name = info.college_name; // 院校名称
    this.system_type = info.system_type; // 院校教务系统类型
    this.system_url = info.system_url; // 院校教务系统地址
    this.user_agent = info.user_agent || app.defaultCrawlerUserAgent; // 院校爬虫的 User-Agent，如果为空，则设置默认值为程序包名和版本。
    this.comment = info.comment; // 院校其他信息(备注)
    this.userInputCaptcha = (parseInt(info.captcha) === 1);

    // 填充数据库连接信息
    const db_info = {
      host: info.db_server,
      port: info.db_port,
      user: info.db_user,
      password: info.db_password,
      database: info.db_name,
      charset: 'utf8mb4',
    };

    // 将性能设置应用到院校数据库服务器中
    Object.assign(db_info, app.config.VAR_DATABASE_SETTINGS);

    // 利用数据库连接信息创建数据库实例
    app.logger.info(`[${this.name}] 正在创建数据库实例...`);
    this.db = app.mysql.createInstance(db_info);

    // 根据院校教务系统类型来实例化一个爬虫的实现(爬虫的实现代码存放在/classes/crawlers/xxx.js)
    app.logger.info(`[${this.name}] 正在创建爬虫实例...`);
    const crawlerPath = path.join(app.config.baseDir, `classes/crawlers/${this.system_type}.js`);
    const crawlerImpl = app.loader.loadFile(crawlerPath);
    if (!crawlerImpl) {
      app.logger.error(`[${this.name}] 爬虫实例创建失败, 找不到实现文件(${crawlerPath})`);
      return;
    }

    this.crawler = new crawlerImpl(app, this);
  }
}

module.exports = College;
