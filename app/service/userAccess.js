'use strict';

const Service = require('egg').Service;
const Student = require('../../classes/student');
const bcrypt = require('bcrypt');
const WXBizDataCrypt = require('../../classes/WXBizDataCrypt');

class UserAccessService extends Service {

  // 通过 uid，利用 collegeAccess.getArrayIndexByCollegeId 进而取得 学校下标 乃至 student 对象的方法
  async getStudentAndCollegeIndexByUid(uid) {

    const { ctx, service } = this;

    const idx = await service.collegeAccess.getArrayIndexByCollegeId(ctx.state.college_id || await this.getCollegeIdByUid(uid));
    const found = (idx !== -1);
    if (!found) {
      return null;
    }

    const _ret = await ctx.app.colleges[idx].db.query('SELECT `students`.`sid`, `students`.`password` FROM `bindings` LEFT JOIN `students` ON `bindings`.`sid` = `students`.`sid` WHERE `bindings`.`uid` = ? LIMIT 0, 1', [ uid ]);
    if (_ret.length === 0 || !_ret[0].sid || !_ret[0].password) {
      ctx.logger.error(`[${ctx.app.colleges[idx].name}] 院校ID: ${ctx.app.colleges[idx].id}, UID(${uid}): 无法读取用户绑定的学生信息`);
      ctx.helper.error(ctx, 1010);
      return null;
    }

    return { college_idx: idx, student: new Student(uid, _ret[0].sid, ctx.app.decryptData(ctx.app, _ret[0].password)) };
  }

  // 给 login() mplogin() 用的获取对应帐户(UID)所绑定的院校代号(college_id)的方法（获取对应UID绑定的院校代号的方法）
  // 成功返回绑定的院校ID，失败或未绑定返回 -1
  async getCollegeIdByUid(uid) {

    const { ctx } = this;

    const ret = await ctx.app.maindb.query('SELECT `college_id` FROM `maps` WHERE `uid` = ? LIMIT 0, 1', [ uid ]);
    if (ret.length !== 0 && ret[0].college_id !== null) {
      return ret[0].college_id;
    }

    return -1;
  }

  // 给 login() mplogin() 用的生成 JSON user 对象的方法（获取学生信息的方法）
  // 成功返回 json user 对象，未绑定时，user 只包含 uid, college_id(未绑定情况下为-1)。失败还将抛出异常并记录错误日志。
  async info(_uid, _college_id) {

    const { ctx, service } = this;

    const metadata = await ctx.app.maindb.query('SELECT `meta_key`, `meta_value` FROM `metadata` WHERE `uid` = ?', [ _uid ]);
    const metas = [];
    for (let i = 0; i < metadata.length; i++) {
      if (metadata[i].meta_key !== undefined) {
        const _item = {};
        _item[`${metadata[i].meta_key}`] = metadata[i].meta_value;
        metas.push(_item);
      }
    }

    const sharedResponse = {
      uid: _uid,
      college_id: -1,
      metadata: metas,
    };

    if (_college_id === -1) { // 如果主数据库中显示未绑定，直接返回未绑定
      return sharedResponse;
    }

    const idx = await service.collegeAccess.getArrayIndexByCollegeId(_college_id);
    const found = (idx !== -1);

    if (!found) { // 如果无法找到院校下表，则是错误情况
      ctx.logger.error(`UID(${_uid}), 院校ID(${_college_id}): 无法通过院校ID找到对应院校`);
      throw 'getArrayIndexByCollegeId failed';
    }

    const bindings = await ctx.app.colleges[idx].db.query('SELECT `sid` FROM `bindings` WHERE `uid` = ? LIMIT 0, 1', [ _uid ]);
    if (bindings.length === 0) { // 如果院校数据库中无绑定记录，则是未绑定
      return sharedResponse;
    }

    const _sid = bindings[0].sid;
    const selectRet = await ctx.app.colleges[idx].db.query('SELECT `name`, `sex`, `year`, `faculty`, `major`, `class` FROM `students` WHERE `sid` = ? LIMIT 0, 1', [ _sid ]);
    if (selectRet.length === 0) { // 如果院校数据库中学生表无记录，也是未绑定
      return sharedResponse;
    }

    const bindStudentResponse = {
      captcha: ctx.app.colleges[idx].userInputCaptcha,
      sid: _sid, // 学号
      name: selectRet[0].name, // 学生姓名
      sex: (selectRet[0].sex === 0 ? '男' : (selectRet[0].sex === 1 ? '女' : '保密')), // 性别
      year: selectRet[0].year, // 学生年级
      faculty: selectRet[0].faculty, // 学生系所
      major: selectRet[0].major, // 学生专业
      class: selectRet[0].class, // 学生班级
    };

    Object.assign(bindStudentResponse, sharedResponse); // 将共用字段添加到上述字段中
    bindStudentResponse.college_id = _college_id; // 院校代号，-1为未绑定 (由于公用字段中院校绑定为默认值未绑定，现在需要手动设置)
    return bindStudentResponse;
  }

  // 获取/同步用户学籍信息接口
  async profile(payload) {
    const { ctx } = this;
    const ret = await this.getStudentAndCollegeIndexByUid(ctx.state.uid);
    if (ret === null) { ctx.helper.error(ctx, 1000); return false; }
    const student = ret.student;
    const idx = ret.college_idx;

    // 无视结果，直接联机更新学籍信息。这么做是为了当联机更新失败不至于抛出错误给客户端而是继续发数据库中的缓存。
    if (payload.sync === true) {
      try {
        if (!ctx.app.colleges[idx].userInputCaptcha) { // 如果此院校不需要输入验证码则直接登录。如果此院校要输入验证码，则不进行登录，直接进行操作，由院校教务系统抛出登录超时提示，用户手动输入验证码。
          const msg = await ctx.app.colleges[idx].crawler.login(student);
          if (student.session === null) {
            ctx.helper.error(ctx, 1008, msg);
            return false;
          }
        }
        await ctx.app.colleges[idx].crawler.updateProfile(student);
        if (student.needLogin) { // 如果需要教务系统需要登录，后续请求肯定也走不了，告知用户输入验证码以便我们登录
          ctx.helper.error(ctx, 1011);
          return false;
        }
      } catch (e) {
        ctx.logger.error(`[${ctx.app.colleges[idx].name}] 院校ID(${ctx.state.college_id}), UID(${ctx.state.uid}), 同步学生ID(${student.sid}) 的资料信息失败, 将返回缓存, 错误信息: ${e}`);
      } finally {
        // 教务不需要输入验证码的情况下，可以放心登出教务系统
        if (!ctx.app.colleges[idx].userInputCaptcha) { await ctx.app.colleges[idx].crawler.logout(student); }
      }
    }

    try {
      const user = await this.info(ctx.state.uid, ctx.state.college_id);
      return user;
    } catch (err) {
      ctx.helper.error(ctx, 1000);
      return false;
    }
  }

  // [预留方法] 给 register() 注册用的 bcrypt 加密加盐方法，目前未实现未开放并且无计划使用API注册。
  async hashPassword(password) {
    const salt = await bcrypt.genSalt(this.ctx.app.config.saltTimes);
    const hash = await bcrypt.hash(password, salt);
    return { salt, hash };
  }

  // 当开启用户手动输入验证码时，用户提交验证码的请求
  // 成功返回 true, 失败返回 false
  async captcha(payload) {
    const { ctx } = this;
    const ret = await this.getStudentAndCollegeIndexByUid(ctx.state.uid);
    if (ret === null) { ctx.helper.error(ctx, 1000); return false; }
    const student = ret.student;
    const idx = ret.college_idx;
    student.captcha = payload.captcha;

    const msg = await ctx.app.colleges[idx].crawler.login(student);
    if (student.session === null) {
      ctx.helper.error(ctx, 1008, msg);
      return false;
    }
    return true;
  }

  // 检查帐户是否被封停，被封返回{date(封禁日期), release(解禁日期), reason(理由)}，未被封返回 null.
  async checkAccountBan(uid) {
    const { ctx } = this;
    // 检查帐户封停情况
    const banned = await ctx.app.maindb.query('SELECT `reason`, `date`, `release` FROM `account_bans` WHERE `uid` = ? LIMIT 0, 1', [ uid ]);
    // 如果无封停记录，或无封禁日期(理论无此可能，因为 date 为非空字段)，允许登录
    if (banned.length === 0 || !banned[0].date || banned[0].date === null) {
      return null;
    }
    // 检查是否已经到了解封日，如果到了，自动解封
    if (banned[0].release && banned[0].release !== null) {
      const release_date = new Date(banned[0].release);
      const _now = Date.now();
      if (release_date <= _now) {
        const ret = await ctx.app.maindb.query('DELETE FROM `account_bans` WHERE `uid` = ?', [ uid ]);
        if (ret.affectedRows === 1) {
          ctx.app.logger.info(`[自动解封] UID(${uid}), 封禁日期：${banned[0].date}, 解封日期：${banned[0].release}, 已符合解封条件，自动解封成功。`);
          return null;
        }
      }
    }
    return {
      date: banned[0].date,
      release: (!banned[0].release || banned[0].release === null) ? '' : banned[0].release,
      reason: (!banned[0].reason || banned[0].reason === null) ? '' : banned[0].reason,
    };
  }

  // APP登录&用户信息
  async login(payload) {

    const { ctx, service } = this;

    // 普通帐户 (gid = ctx.app.config.VAR_ACCOUNT_GID.GENERAL)
    const ret = await ctx.app.maindb.query('SELECT `uid`, `password` FROM `accounts` WHERE `user` = ? AND `gid` = ? LIMIT 0, 1', [ payload.account, ctx.app.config.VAR_ACCOUNT_GID.GENERAL ]);
    if (ret.length === 0 || !ret[0].uid || !ret[0].password || ret[0].password === null) {
      ctx.helper.error(ctx, 1012);
      return null;
    }
    const match = await bcrypt.compare(payload.password, ret[0].password);
    if (!match) {
      ctx.helper.error(ctx, 1012);
      return null;
    }

    // 更新上次操作IP与时间。
    await ctx.app.maindb.query('UPDATE `accounts` SET `last_ip` = ?, `last_login` = now() WHERE `uid` = ? AND `gid` = ?', [ ctx.ip, ret[0].uid, ctx.app.config.VAR_ACCOUNT_GID.GENERAL ]);

    // 检查封号情况
    const account_ban = await this.checkAccountBan(ret[0].uid);
    if (account_ban !== null) {
      ctx.helper.error(ctx, 1013, account_ban);
      return null;
    }

    const bind_college_id = await this.getCollegeIdByUid(ret[0].uid); // 成功返回绑定的院校ID，失败或未绑定返回 -1

    // 以 _openid 为契机，生成自己的 token
    const _token = await service.actionToken.apply(ret[0].uid, bind_college_id);
    try {
      const user = await this.info(ret[0].uid, bind_college_id);
      return {
        token: _token,
        user,
      };
    } catch (err) {
      ctx.helper.error(ctx, 1000);
    }
    return null;
  }

  // 微信小程序登录 利用小程序提交的 code 向微信服务器换取 openid
  async mplogin(payload) {

    const { ctx, service } = this;
    const code = payload.code;

    const appId = payload.appid;
    const ret = await ctx.app.maindb.query('SELECT `wx_secret` FROM `colleges` WHERE `wx_appid` = ? LIMIT 0, 1', [ appId ]);
    if (!ret || ret.length === 0 || !ret[0].wx_secret) {
      ctx.helper.error(ctx, 1000);
      ctx.app.logger.error('获取 wx_secret 失败, 传入 appID: ' + appId);
      return null;
    }
    const appSecret = ret[0].wx_secret;

    let result = null;
    try {
      result = await ctx.app.fetch(ctx.app, `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`, { dataType: 'json' });
    } catch (err) {
      ctx.helper.error(ctx, 1000);
      ctx.app.logger.error(`获取用户 openid 失败(oauth request code: ${code}) 网络错误: ${err}`);
      return null;
    }

    const _openid = result.data.openid;
    if (!_openid || _openid.length === 0) {
      ctx.helper.error(ctx, 1003);
      const errmsg = result.data.errmsg;
      ctx.app.logger.warn(`获取用户 openid 失败(oauth request code: ${code})${errmsg && errmsg.length !== 0 ? ', ' + errmsg : ''}`);
      return null;
    }

    const session_key = result.data.session_key;
    if (!session_key || session_key.length === 0) {
      ctx.helper.error(ctx, 1003);
      ctx.app.logger.error(`获取用户 session_key 失败(oauth request code: ${code}, openid: ${_openid})`);
      return null;
    }

    const encryptedData = payload.encrypted_data;
    const iv = payload.iv;
    let userData = null;
    try {
      const decrypt_util = new WXBizDataCrypt(appId, session_key);
      userData = decrypt_util.decryptData(encryptedData, iv);
    } catch (err) {
      ctx.helper.error(ctx, 1003);
      ctx.app.logger.error(`解开用户(openid: ${_openid}) 的信息失败 - ${err}`);
      return null;
    }

    // 微信小程序创建的账户类型 (gid = ctx.app.config.VAR_ACCOUNT_GID.OAUTH.WX)
    let _uid = null;
    const _gid = ctx.app.config.VAR_ACCOUNT_GID.OAUTH.WX; // 微信小程序用户
    const getRet = await ctx.app.maindb.query('SELECT `uid` FROM `accounts` WHERE `user` = ? AND `gid` = ? LIMIT 0, 1', [ _openid, _gid ]);
    if (!getRet || getRet.length === 0) {
      try {
        const insertRet = await ctx.app.maindb.query('INSERT IGNORE INTO `accounts` SET `gid` = ?, `user` = ?, `reg_date` = now(), `last_login` = now(), `reg_ip` = ?, `last_ip` = ?', [ _gid, _openid, ctx.ip, ctx.ip ]);
        _uid = insertRet.insertId;
      } catch (err) {
        ctx.helper.error(ctx, 1004);
        return null;
      }
    } else {
      _uid = getRet[0].uid;
      // 更新上次操作IP与时间。
      await ctx.app.maindb.query('UPDATE `accounts` SET `last_ip` = ?, `last_login` = now() WHERE `uid` = ? AND `gid` = ?', [ ctx.ip, _uid, _gid ]);
      // 检查封号情况
      const account_ban = await this.checkAccountBan(_uid);
      if (account_ban !== null) {
        ctx.helper.error(ctx, 1013, account_ban);
        return null;
      }
    }

    const bind_college_id = await this.getCollegeIdByUid(_uid); // 成功返回绑定的院校ID，失败或未绑定返回 -1

    try {
      const foundRet = await ctx.app.maindb.query('SELECT COUNT(1) AS `found` FROM `oauth` WHERE `uid` = ? LIMIT 0, 1', [ _uid ]);
      if (!foundRet || foundRet.length === 0 || foundRet[0].found === undefined || foundRet[0].found === null || foundRet[0].found === 0) {
        await ctx.app.maindb.query('INSERT IGNORE INTO `oauth`(`uid`, `openid`, `unionid`, `name`, `avatar`, `gender`, `language`, `country`, `province`, `city`, `date`) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())',
          [ /* INSERT 时用的 --> */ _uid, _openid, userData.unionId, userData.nickName, userData.avatarUrl, userData.gender, userData.language, userData.country, userData.province, userData.city ]
        );
      } else {
        await ctx.app.maindb.query('UPDATE `oauth` SET `openid` = ?, `unionid` = ?, `name` = ?, `avatar` = ?, `gender` = ?, `language` = ?, `country` = ?, `province` = ?, `city` = ? WHERE `uid` = ?',
          [ _openid, userData.unionId, userData.nickName, userData.avatarUrl, userData.gender, userData.language, userData.country, userData.province, userData.city, _uid ]
        );
      }
    } catch (err) {
      ctx.helper.error(ctx, 1003);
      ctx.app.logger.error(`用户(uid: ${_uid}, openid: ${_openid}) OAuth 资料更新失败 - ${err}`);
      return null;
    }

    // 以 _openid 为契机，生成自己的 token
    const _token = await service.actionToken.apply(_uid, bind_college_id);
    try {
      const user = await this.info(_uid, bind_college_id);
      return {
        token: _token,
        user,
      };
    } catch (err) {
      ctx.helper.error(ctx, 1000);
    }
    return null;
  }

  // 微信小程序登录 利用小程序提交的 code 向微信服务器换取 openid
  async qqlogin(payload) {

    const { ctx, service } = this;
    const code = payload.code;

    const appId = payload.appid;
    const ret = await ctx.app.maindb.query('SELECT `qq_secret` FROM `colleges` WHERE `qq_appid` = ? LIMIT 0, 1', [ appId ]);
    if (!ret || ret.length === 0 || !ret[0].qq_secret) {
      ctx.helper.error(ctx, 1000);
      ctx.app.logger.error('获取 qq_secret 失败, 传入 appID: ' + appId);
      return null;
    }
    const appSecret = ret[0].qq_secret;

    let result = null;
    try {
      result = await ctx.app.fetch(ctx.app, `https://api.q.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`, { dataType: 'json' });
    } catch (err) {
      ctx.helper.error(ctx, 1000);
      ctx.app.logger.error(`获取用户 openid 失败(oauth request code: ${code}) 网络错误: ${err}`);
      return null;
    }

    const _openid = result.data.openid;
    if (!_openid || _openid.length === 0) {
      ctx.helper.error(ctx, 1003);
      const errmsg = result.data.errmsg;
      ctx.app.logger.warn(`获取用户 openid 失败(oauth request code: ${code})${errmsg && errmsg.length !== 0 ? ', ' + errmsg : ''}`);
      return null;
    }

    const session_key = result.data.session_key;
    if (!session_key || session_key.length === 0) {
      ctx.helper.error(ctx, 1003);
      ctx.app.logger.error(`获取用户 session_key 失败(oauth request code: ${code}, openid: ${_openid})`);
      return null;
    }

    const encryptedData = payload.encrypted_data;
    const iv = payload.iv;
    let userData = null;
    try {
      const decrypt_util = new WXBizDataCrypt(appId, session_key);
      userData = decrypt_util.decryptData(encryptedData, iv);
    } catch (err) {
      ctx.helper.error(ctx, 1003);
      ctx.app.logger.error(`解开用户(openid: ${_openid}) 的信息失败 - ${err}`);
      return null;
    }

    // 微信小程序创建的账户类型 (gid = ctx.app.config.VAR_ACCOUNT_GID.OAUTH.QQ)
    let _uid = null;
    const _gid = ctx.app.config.VAR_ACCOUNT_GID.OAUTH.QQ; // QQ小程序用户
    const getRet = await ctx.app.maindb.query('SELECT `uid` FROM `accounts` WHERE `user` = ? AND `gid` = ? LIMIT 0, 1', [ _openid, _gid ]);
    if (!getRet || getRet.length === 0) {
      try {
        const insertRet = await ctx.app.maindb.query('INSERT IGNORE INTO `accounts` SET `gid` = ?, `user` = ?, `reg_date` = now(), `last_login` = now(), `reg_ip` = ?, `last_ip` = ?', [ _gid, _openid, ctx.ip, ctx.ip ]);
        _uid = insertRet.insertId;
      } catch (err) {
        ctx.helper.error(ctx, 1004);
        return null;
      }
    } else {
      _uid = getRet[0].uid;
      // 更新上次操作IP与时间。
      await ctx.app.maindb.query('UPDATE `accounts` SET `last_ip` = ?, `last_login` = now() WHERE `uid` = ? AND `gid` = ?', [ ctx.ip, _uid, _gid ]);
      // 检查封号情况
      const account_ban = await this.checkAccountBan(_uid);
      if (account_ban !== null) {
        ctx.helper.error(ctx, 1013, account_ban);
        return null;
      }
    }

    const bind_college_id = await this.getCollegeIdByUid(_uid); // 成功返回绑定的院校ID，失败或未绑定返回 -1

    try {
      const foundRet = await ctx.app.maindb.query('SELECT COUNT(1) AS `found` FROM `oauth` WHERE `uid` = ? LIMIT 0, 1', [ _uid ]);
      if (!foundRet || foundRet.length === 0 || foundRet[0].found === undefined || foundRet[0].found === null || foundRet[0].found === 0) {
        await ctx.app.maindb.query('INSERT IGNORE INTO `oauth`(`uid`, `openid`, `unionid`, `name`, `avatar`, `gender`, `language`, `country`, `province`, `city`, `date`) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())',
          [ /* INSERT 时用的 --> */ _uid, _openid, userData.unionId, userData.nickName, userData.avatarUrl, userData.gender, userData.language, userData.country, userData.province, userData.city ]
        );
      } else {
        await ctx.app.maindb.query('UPDATE `oauth` SET `openid` = ?, `unionid` = ?, `name` = ?, `avatar` = ?, `gender` = ?, `language` = ?, `country` = ?, `province` = ?, `city` = ? WHERE `uid` = ?',
          [ _openid, userData.unionId, userData.nickName, userData.avatarUrl, userData.gender, userData.language, userData.country, userData.province, userData.city, _uid ]
        );
      }
    } catch (err) {
      ctx.helper.error(ctx, 1003);
      ctx.app.logger.error(`用户(uid: ${_uid}, openid: ${_openid}) OAuth 资料更新失败 - ${err}`);
      return null;
    }

    // 以 _openid 为契机，生成自己的 token
    const _token = await service.actionToken.apply(_uid, bind_college_id);
    try {
      const user = await this.info(_uid, bind_college_id);
      return {
        token: _token,
        user,
      };
    } catch (err) {
      ctx.helper.error(ctx, 1000);
    }
    return null;
  }

  // 学号绑定服务。
  async bind(payload) {

    const { ctx, service } = this;

    const college_id = payload.college_id;
    const student_account = payload.student.toUpperCase();
    const password = payload.password;

    const idx = await service.collegeAccess.getArrayIndexByCollegeId(college_id);
    const found = (idx !== -1);

    if (!found) {
      ctx.helper.error(ctx, 1000);
      return false;
    }

    let captcha = null;
    if (ctx.app.colleges[idx].userInputCaptcha && !payload.captcha) {
      ctx.helper.error(ctx, 1005);
      return false;
    } else if (ctx.app.colleges[idx].userInputCaptcha) { captcha = payload.captcha.trim(); }

    // 检查是否已经绑定过(检查对应院校数据库中绑定表中所有关于此 sid 的 uid，然后判断 uid 是不是同一组别的，如果是，说明同一类型的账户多次绑定)
    const ret = await ctx.app.colleges[idx].db.query('SELECT `uid` FROM `bindings` WHERE `sid` = ?', [ student_account ]);
    const gids = [];
    for (let i = 0; i < ret.length; i++) {
      if (ret[i].uid !== ctx.state.uid) { // 假如这个uid和要绑定此学号的uid一样，说明是同一个类型同一个账户的绑定，放行，不算在内
        const ret2 = await ctx.app.maindb.query('SELECT `gid` FROM `accounts` WHERE `uid` = ? LIMIT 0, 1', [ ret[i].uid ]);
        if (ret2.length !== 0 && ret2[0].gid !== undefined && ret2[0].gid !== null) {
          gids.push(ret2[0].gid);
        }
      }
    }
    const ret3 = await ctx.app.maindb.query('SELECT `gid` FROM `accounts` WHERE `uid` = ? LIMIT 0, 1', [ ctx.state.uid ]);
    if (ret3.length !== 0 && ret3[0].gid !== undefined && ret3[0].gid !== null) {
      gids.push(ret3[0].gid);
    }
    gids.sort();
    let last = null;
    let alreadyBound = false;
    gids.forEach(e => {
      if (e === last) {
        alreadyBound = true;
      } else {
        last = e;
      }
    });
    if (alreadyBound) {
      // 有时候会遇到 bindings 表中已有绑定成功的记录，但是 students 表中没有学生信息的情况
      // 这种情况可能是先前绑定时同步学生信息失败导致的。
      // 因此此时判断下 students 表中有没有此学生信息，如果没有，则不反会已绑定的错误而让用户继续绑定
      const ret = await ctx.app.colleges[idx].db.query('SELECT COUNT(1) AS `found` FROM `students` WHERE `sid` = ? LIMIT 0, 1', [ student_account ]);
      if (ret && ret.length === 1 && ret[0].found !== undefined && ret[0].found !== null && ret[0].found === 1) {
        ctx.helper.error(ctx, 1007);
        return false;
      }
    }

    // 构建学生并登录教务系统
    const student = new Student(ctx.state.uid, student_account, password, captcha);
    const login_msg = await ctx.app.colleges[idx].crawler.login(student);
    if (student.session === null) {
      ctx.helper.error(ctx, 1008, login_msg);
      return false;
    }

    // 向院校数据库写入绑定信息
    try {
      const foundRet = await ctx.app.colleges[idx].db.query('SELECT COUNT(1) AS `found` FROM `bindings` WHERE `uid` = ? LIMIT 0, 1', [ ctx.state.uid ]);
      if (!foundRet || foundRet.length === 0 || foundRet[0].found === undefined || foundRet[0].found === null || foundRet[0].found === 0) {
        await ctx.app.colleges[idx].db.query('INSERT IGNORE INTO `bindings`(`uid`, `sid`, `date`) VALUES(?, ?, now())', [ ctx.state.uid, student_account ]);
      } else {
        await ctx.app.colleges[idx].db.query('UPDATE `bindings` SET `sid` = ? WHERE `uid` = ?', [ student_account, ctx.state.uid ]);
      }
    } catch (err) {
      ctx.helper.error(ctx, 1010);
      ctx.logger.error(`UID(${ctx.state.uid}), 学生ID(${student_account}) 绑定失败, 院校数据库写入绑定信息失败: ${err}`);
      return false;
    }

    // 将绑定信息写入主库
    try {
      const foundRet = await ctx.app.maindb.query('SELECT COUNT(1) AS `found` FROM `maps` WHERE `uid` = ? LIMIT 0, 1', [ ctx.state.uid ]);
      if (!foundRet || foundRet.length === 0 || foundRet[0].found === undefined || foundRet[0].found === null || foundRet[0].found === 0) {
        await ctx.app.maindb.query('INSERT IGNORE INTO `maps`(`uid`, `college_id`, `date`) VALUES(?, ?, now())', [ ctx.state.uid, college_id ]);
      } else {
        await ctx.app.maindb.query('UPDATE `maps` SET `college_id` = ? WHERE `uid` = ?', [ college_id, ctx.state.uid ]);
      }
    } catch (err) {
      ctx.helper.error(ctx, 1010);
      ctx.logger.error(`UID(${ctx.state.uid}), 学生ID(${student.sid}) 绑定失败, 主数据库写入绑定信息失败: ${err}`);
      return false;
    }

    // 更新信息
    await ctx.app.colleges[idx].crawler.update(student);

    // 教务不需要输入验证码的情况下，可以放心登出教务系统（需要验证码的情况下就这么留着登录状态等教务让其自然过期）
    if (!ctx.app.colleges[idx].userInputCaptcha) { await ctx.app.colleges[idx].crawler.logout(student); }
    return true;
  }

  // 解除绑定操作
  async unbind() {

    const { ctx } = this;

    const ret = await this.getStudentAndCollegeIndexByUid(ctx.state.uid);
    if (ret === null) { ctx.helper.error(ctx, 1000); return false; }
    const idx = ret.college_idx;
    const sid = ret.student.sid;

    // 用事务改善性能
    const transactionResult = await ctx.app.colleges[idx].db.beginTransactionScope(async conn => {

      await conn.query('DELETE FROM `bindings` WHERE `uid` = ?', [ ctx.state.uid ]);
      await conn.query('DELETE FROM `sessions` WHERE `uid` = ?', [ ctx.state.uid ]);

      const countRet = await conn.query('SELECT COUNT(*) FROM `bindings` WHERE `sid` = ?', [ sid ]);
      let count = -1;
      if (countRet.length !== 0 && countRet[0]['COUNT(*)'] !== undefined && countRet[0]['COUNT(*)'] !== null) count = countRet[0]['COUNT(*)'];
      if (count !== -1 && count === 0) { // 证明所有的绑定都解绑了，就可以把学生缓存全部清除了
        const deleteRet = await conn.query('DELETE FROM `students` WHERE `sid` = ?', [ sid ]);
        if (deleteRet.affectedRows !== 1) return false;
        // 然后删除成绩，课表等信息，可以不用关心结果
        await conn.query('DELETE FROM `scores` WHERE `sid` = ?', [ sid ]);
        await conn.query('DELETE FROM `schedules` WHERE `sid` = ?', [ sid ]);
      }
      return true;
    }, ctx);

    if (!transactionResult) { // 解绑事务失败
      ctx.helper.error(ctx, 1010);
      return false;
    }

    // 删除主数据库中的绑定信息
    await ctx.app.maindb.query('DELETE FROM `maps` WHERE `uid` = ?', [ ctx.state.uid ]);
    return true;
  }

  // 查分服务。成功返回成绩JSON数组，失败返回 false。
  async scores(payload) {

    const { ctx } = this;
    const ret = await this.getStudentAndCollegeIndexByUid(ctx.state.uid);
    if (ret === null) { ctx.helper.error(ctx, 1000); return false; }
    const student = ret.student;
    const idx = ret.college_idx;

    // 无视结果，直接联机更新成绩。这么做是为了当联机更新失败不至于抛出错误给客户端而是继续发数据库中的缓存。
    if (payload.sync === true) {
      try {
        if (!ctx.app.colleges[idx].userInputCaptcha) { // 如果此院校不需要输入验证码则直接登录。如果此院校要输入验证码，则不进行登录，直接进行操作，由院校教务系统抛出登录超时提示，用户手动输入验证码。
          const msg = await ctx.app.colleges[idx].crawler.login(student);
          if (student.session === null) {
            ctx.helper.error(ctx, 1008, msg);
            return false;
          }
        }
        await ctx.app.colleges[idx].crawler.updateScore(student);
        if (student.needLogin) { // 如果需要教务系统需要登录，后续请求肯定也走不了
          if (ctx.app.colleges[idx].userInputCaptcha) {
            ctx.helper.error(ctx, 1011); // 告知用户输入验证码以便我们登录
          } else {
            ctx.helper.error(ctx, 1014); // 不需要验证码且刚才也登录成功了，但是还是需要登录，说明教务可能暂时繁忙或不可用
          }
          return false;
        }
      } catch (e) {
        ctx.logger.error(`[${ctx.app.colleges[idx].name}] 院校ID(${ctx.state.college_id}), UID(${ctx.state.uid}), 同步学生ID(${student.sid}) 的成绩信息失败, 将返回缓存, 错误信息: ${e}`);
      } finally {
        // 教务不需要输入验证码的情况下，可以放心登出教务系统
        if (!ctx.app.colleges[idx].userInputCaptcha) { await ctx.app.colleges[idx].crawler.logout(student); }
      }
    }

    // 查表返回结果给调用方
    const _ret = await ctx.app.colleges[idx].db.query('SELECT scores.cid, scores.cindex, scores.score, scores.term, scores.type, scores.comment, scores.date, courses.name, courses.credit FROM `scores` INNER JOIN `courses` ON scores.cid = courses.cid WHERE scores.sid = ?', [ student.sid ]);
    _ret.forEach(e => {
      if (e.score === null) { e.score = ''; }
      if (e.comment === null) { e.comment = ''; }
    });
    return _ret;
  }

  // 查单科成绩排名。成功返回排名JSON，失败返回 false。
  async score_ranking(payload) {
    const { ctx } = this;
    const ret = await this.getStudentAndCollegeIndexByUid(ctx.state.uid);
    if (ret === null) { return {}; }
    const student = ret.student;
    const idx = ret.college_idx;

    const _cid = payload.cid || '';
    const _cindex = payload.cindex || '';

    let _max = 0;
    let _min = 0xFFFE;
    let _avg = 0;
    let _rank = 0;
    let _count = 0;

    await ctx.app.colleges[idx].db.beginTransactionScope(async conn => {
      let myScore = await conn.query('SELECT `score` FROM `scores` WHERE `sid` = ? AND `cid` = ? AND `cindex` = ? LIMIT 0, 1', [ student.sid, _cid, _cindex ]);
      if (!myScore || myScore.length === 0 || myScore[0].score === undefined || myScore[0].score === null || myScore[0].score === '') return false;
      myScore = parseFloat(myScore[0].score);
      if (isNaN(myScore)) return;
      const classScores = [];
      let _sum = 0;
      const classScore = await conn.query('SELECT `score` FROM `scores` WHERE `sid` IN (SELECT `sid` FROM `students` WHERE `class` IN (SELECT `class` FROM `students` WHERE `sid` = ?)) AND `cid` = ? AND `cindex` = ?', [ student.sid, _cid, _cindex ]);
      classScore.forEach(s => {
        if (s.score !== undefined && s.score !== null && s.score !== '') {
          const floatScore = parseFloat(s.score);
          if (!isNaN(floatScore)) {
            if (_max < floatScore) _max = floatScore;
            if (_min > floatScore) _min = floatScore;
            classScores.push(floatScore);
            _sum = _sum + floatScore;
            _count++;
          }
        }
      });
      if (_count > 0) {
        _avg = parseFloat((_sum / _count).toFixed(2));
      } else {
        return;
      }
      classScores.sort((a, b) => (b - a));
      _rank = classScores.indexOf(myScore);
      if (_rank === -1) return;
      _rank++;
      return;
    }, ctx);

    const resp = {
      count: _count,
    };
    if (_max !== 0) Object.assign(resp, { max: _max });
    if (_min !== 0xFFFFFFFF) Object.assign(resp, { min: _min });
    if (_avg !== 0) Object.assign(resp, { avg: _avg });
    if (_rank !== 0 && _rank !== -1) Object.assign(resp, { ranking: _rank });
    return resp;
  }

  // 查课表服务。成功返回成绩JSON数组，失败返回 false。
  async schedules(payload) {

    const { ctx } = this;
    const ret = await this.getStudentAndCollegeIndexByUid(ctx.state.uid);
    if (ret === null) { ctx.helper.error(ctx, 1000); return false; }
    const student = ret.student;
    const idx = ret.college_idx;

    // 无视结果，直接联机更新成绩。这么做是为了当联机更新失败不至于抛出错误给客户端而是继续发数据库中的缓存。
    if (payload.sync === true && payload.student === student.sid) {
      try {
        if (!ctx.app.colleges[idx].userInputCaptcha) { // 如果此院校不需要输入验证码则直接登录。如果此院校要输入验证码，则不进行登录，直接进行操作，由院校教务系统抛出登录超时提示，用户手动输入验证码。
          const msg = await ctx.app.colleges[idx].crawler.login(student);
          if (student.session === null) {
            ctx.helper.error(ctx, 1008, msg);
            return false;
          }
        }
        await ctx.app.colleges[idx].crawler.updateSchedule(student);
        if (student.needLogin) { // 如果需要教务系统需要登录，后续请求肯定也走不了
          if (ctx.app.colleges[idx].userInputCaptcha) {
            ctx.helper.error(ctx, 1011); // 告知用户输入验证码以便我们登录
          } else {
            ctx.helper.error(ctx, 1014); // 不需要验证码且刚才也登录成功了，但是还是需要登录，说明教务可能暂时繁忙或不可用
          }
          return false;
        }
      } catch (e) {
        ctx.logger.error(`[${ctx.app.colleges[idx].name}] 院校ID(${ctx.state.college_id}), UID(${ctx.state.uid}), 同步学生ID(${student.sid}) 的课表信息失败, 将返回缓存, 错误信息: ${e}`);
      } finally {
        // 教务不需要输入验证码的情况下，可以放心登出教务系统
        if (!ctx.app.colleges[idx].userInputCaptcha) { await ctx.app.colleges[idx].crawler.logout(student); }
      }
    }

    // 查表返回结果给调用方
    return await ctx.app.colleges[idx].db.query('SELECT schedules.cid, schedules.cindex, schedules.type, schedules.teacher, schedules.weeks, schedules.day, schedules.tid, schedules.period, schedules.date, courses.name, courses.credit, classrooms.rid, classrooms.campus, classrooms.building, classrooms.room FROM `schedules` INNER JOIN `courses` ON schedules.cid = courses.cid INNER JOIN `classrooms` ON schedules.rid = classrooms.rid WHERE schedules.sid = ?', [ student.sid !== payload.student ? payload.student /* 查的不是本人课表 */ : student.sid /* 查的本人课表 */]);
  }

  // 查人服务。成功返回成绩JSON数组，失败返回 false。每次返回 page_size 条记录。
  async students(payload) {
    const { ctx } = this;
    const ret = await this.getStudentAndCollegeIndexByUid(ctx.state.uid);
    if (ret === null) { ctx.helper.error(ctx, 1000); return false; }
    const idx = ret.college_idx;

    // 数据库下标从零开始，每page_size个进行一次分页(当用户提交非法数据时，设置为默认数据)
    const page_size = (payload.page_size > 0) ? payload.page_size : 20;
    const page_id = (payload.page_id > 0) ? payload.page_id : 0;
    const paging = page_id * page_size;

    // 当包含查询关键字%时过滤，避免用户利用来消耗系统资源
    if (payload.keyword.indexOf('%') !== -1) {
      return {
        total: 0,
        page_id,
        page_size,
        records: [],
      };
    }

    // 上课查询 ===========================================================================================================================
    // 如果是查询某一节课的上课学生，数据格式为："cid:12345678" 的格式。

    if (payload.keyword.indexOf('cid:') !== -1) {
      const split = payload.keyword.split(':');
      let total = 0;
      let records = [];
      if (split.length !== 2) { // 如果格式不对(分割失败)
        return {
          total: 0,
          page_id,
          page_size,
          records: [],
        };
      }

      await ctx.app.colleges[idx].db.beginTransactionScope(async conn => {
        if (page_id === 0) {
          // 获取结果总数
          total = await conn.query('SELECT COUNT(*) FROM(SELECT 1 FROM `schedules` WHERE `cid` = ? GROUP BY `sid`) total',
            [
              split[1],
            ]);
          total = (total.length === 1 && total[0]['COUNT(*)']) ? (total[0]['COUNT(*)']) : 0;
        }
        // 查表返回结果给调用方。
        records = await conn.query('SELECT `sid`, `name`, `sex`, `year`, `faculty`, `major`, `class`, `date` FROM `students` WHERE `sid` IN(SELECT `sid` FROM `schedules` WHERE `cid` = ? GROUP BY `sid`) LIMIT ?, ?',
          [
            split[1], paging, page_size,
          ]);
      }, ctx);

      if (page_id === 0) {
        return {
          total,
          page_id,
          page_size,
          records,
        };
      }
      // 非第一页(page_id===0)就不返回sum，不然浪费性能
      return {
        page_id,
        page_size,
        records,
      };
    }

    // 正常查询 ===========================================================================================================================
    // 查询关键字
    const keyword = `${payload.keyword}%`;
    const _sid = payload.keyword;
    let total = 0;
    let records = [];

    await ctx.app.colleges[idx].db.beginTransactionScope(async conn => {
      if (page_id === 0) {
        // 获取结果总数
        total = await conn.query('SELECT COUNT(*) FROM `students` WHERE `sid` = ? OR `name` LIKE ? OR `class` LIKE ?',
          [
            /* 单关键字查询多个键 */ _sid, keyword, keyword,
          ]);
        total = (total.length === 1 && total[0]['COUNT(*)']) ? (total[0]['COUNT(*)']) : 0;
      }

      // 查表返回结果给调用方。
      records = await conn.query('SELECT `sid`, `name`, `sex`, `year`, `faculty`, `major`, `class` FROM `students` WHERE `sid` = ? OR `name` LIKE ? OR `class` LIKE ? LIMIT ?, ?',
        [
          /* 单关键字查询多个键 */ _sid, keyword, keyword, paging, page_size,
        ]);
    }, ctx);

    if (page_id === 0) {
      return {
        total,
        page_id,
        page_size,
        records,
      };
    }
    // 非第一页(page_id===0)就不返回sum，不然浪费性能
    return {
      page_id,
      page_size,
      records,
    };

  }

  // 查课服务。成功返回成绩JSON数组，失败返回 false。每次返回 page_size 条记录。
  async courses(payload) {
    const { ctx } = this;
    const ret = await this.getStudentAndCollegeIndexByUid(ctx.state.uid);
    if (ret === null) { ctx.helper.error(ctx, 1000); return false; }
    const idx = ret.college_idx;

    // 数据库下标从零开始，每page_size个进行一次分页(当用户提交非法数据时，设置为默认数据)
    const page_size = (payload.page_size > 0) ? payload.page_size : 20;
    const page_id = (payload.page_id > 0) ? payload.page_id : 0;
    const paging = page_id * page_size;

    // 当包含查询关键字%时过滤，避免用户利用来消耗系统资源
    if (payload.keyword.indexOf('%') !== -1) {
      return {
        total: 0,
        page_id,
        page_size,
        records: [],
      };
    }

    // 查询关键字
    const keyword = `${payload.keyword}%`;
    const _cid = payload.keyword;
    let total = 0;
    let records = [];

    await ctx.app.colleges[idx].db.beginTransactionScope(async conn => {
      if (page_id === 0) {
        // 获取结果总数
        total = await conn.query('SELECT COUNT(*) FROM (SELECT DISTINCT * FROM ((SELECT courses.cid, schedules.cindex, courses.name, courses.credit, schedules.teacher, schedules.weeks, schedules.day, schedules.period, schedules.tid, schedules.date, classrooms.campus, classrooms.building, classrooms.room FROM `schedules` LEFT JOIN `courses` ON schedules.cid = courses.cid LEFT JOIN `classrooms` ON schedules.rid = classrooms.rid WHERE schedules.teacher LIKE ?) UNION (SELECT courses.cid, schedules.cindex, courses.name, courses.credit, schedules.teacher, schedules.weeks, schedules.day, schedules.period, schedules.tid, schedules.date, classrooms.campus, classrooms.building, classrooms.room FROM `schedules` LEFT JOIN `courses` ON schedules.cid = courses.cid LEFT JOIN `classrooms` ON schedules.rid = classrooms.rid WHERE courses.cid = ? OR courses.name LIKE ?)) AS `result`) AS `total`',
          [
            /* 单关键字查询多个键 */ keyword, _cid, keyword,
          ]);
        total = (total.length === 1 && total[0]['COUNT(*)']) ? (total[0]['COUNT(*)']) : 0;
      }

      // 查表返回结果给调用方。
      records = await conn.query('SELECT DISTINCT * FROM ((SELECT courses.cid, schedules.cindex, courses.name, courses.credit, schedules.teacher, schedules.weeks, schedules.day, schedules.period, schedules.tid, schedules.date, classrooms.campus, classrooms.building, classrooms.room FROM `schedules` LEFT JOIN `courses` ON schedules.cid = courses.cid LEFT JOIN `classrooms` ON schedules.rid = classrooms.rid WHERE schedules.teacher LIKE ?) UNION (SELECT courses.cid, schedules.cindex, courses.name, courses.credit, schedules.teacher, schedules.weeks, schedules.day, schedules.period, schedules.tid, schedules.date, classrooms.campus, classrooms.building, classrooms.room FROM `schedules` LEFT JOIN `courses` ON schedules.cid = courses.cid LEFT JOIN `classrooms` ON schedules.rid = classrooms.rid WHERE courses.cid = ? OR courses.name LIKE ?)) AS `result` LIMIT ?, ?',
        [
          /* 单关键字查询多个键 */ keyword, _cid, keyword, paging, page_size,
        ]);
    }, ctx);

    if (page_id === 0) {
      return {
        total,
        page_id,
        page_size,
        records,
      };
    }
    // 非第一页(page_id===0)就不返回sum，不然浪费性能
    return {
      page_id,
      page_size,
      records,
    };

  }

}

module.exports = UserAccessService;
