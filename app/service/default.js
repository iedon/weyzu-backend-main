'use strict';

const Service = require('egg').Service;

class DefaultService extends Service {

  // 内部方法，给定 uid 和 college_id 获取一个 uid 的基础性息(帐号信息，OAuth, 绑定的学生信息)
  async _getuidinfo(_uid, _college_id) {

    const { ctx, service } = this;
    const basic = {
      uid: _uid,
      college_id: _college_id,
    };
    const idx = await service.collegeAccess.getArrayIndexByCollegeId(_college_id);
    const found = (idx !== -1);
    if (!found) {
      basic.college_id = -1;
      return {
        basic,
      };
    }

    const _basic = await ctx.app.maindb.query('SELECT `name`, `email`, `phone`, `reg_date`, `reg_ip`, `last_login`, `last_ip` FROM `accounts` WHERE `uid` = ? LIMIT 0, 1', [ _uid ]);
    if (!_basic || _basic.length === 0) {
      ctx.logger.error(`[${ctx.app.colleges[idx].name}] 院校ID: ${ctx.app.colleges[idx].id}, UID(${_uid}): 无法读取用户信息 @ Collplex 微服务业务间调用`);
      return {
        basic,
      };
    }

    const metadata = await ctx.app.maindb.query('SELECT `meta_key`, `meta_value` FROM `metadata` WHERE `uid` = ?', [ _uid ]);
    const metas = [];
    for (let i = 0; i < metadata.length; i++) {
      if (metadata[i].meta_key !== undefined) {
        const _item = {};
        _item[`${metadata[i].meta_key}`] = metadata[i].meta_value;
        metas.push(_item);
      }
    }

    _basic[0].metadata = metas;
    _basic[0].name = _basic[0].name || '';
    _basic[0].email = _basic[0].email || '';
    _basic[0].phone = _basic[0].phone || '';
    _basic[0].reg_date = _basic[0].reg_date || '';
    _basic[0].reg_ip = _basic[0].reg_ip || '';
    _basic[0].last_login = _basic[0].last_login || '';
    _basic[0].last_ip = _basic[0].last_ip || '';
    Object.assign(_basic[0], basic);

    const _student = await ctx.app.colleges[idx].db.query('SELECT `students`.`sid`, `students`.`name`, `students`.`sex`, `students`.`year`, `students`.`faculty`, `students`.`major`, `students`.`class` FROM `bindings` LEFT JOIN `students` ON `bindings`.`sid` = `students`.`sid` WHERE `bindings`.`uid` = ? LIMIT 0, 1', [ _uid ]);
    if (_student && _student.length !== 0) {
      _student[0].sid = _student[0].sid || '';
      _student[0].name = _student[0].name || '';
      _student[0].sex = _student[0].sex || '';
      _student[0].year = _student[0].year || '';
      _student[0].faculty = _student[0].faculty || '';
      _student[0].major = _student[0].major || '';
      _student[0].class = _student[0].class || '';
    }

    const _oauth = await ctx.app.maindb.query('SELECT `name`, `avatar`, `gender`, `language`, `country`, `province`, `city` FROM `oauth` WHERE `uid` = ? LIMIT 0, 1', [ _uid ]);
    if (_oauth && _oauth.length !== 0) {
      _oauth[0].name = _oauth[0].name || '';
      _oauth[0].avatar = _oauth[0].avatar || '';
      _oauth[0].gender = _oauth[0].gender || '';
      _oauth[0].language = _oauth[0].language || '';
      _oauth[0].country = _oauth[0].country || '';
      _oauth[0].province = _oauth[0].province || '';
      _oauth[0].city = _oauth[0].city || '';
    }

    if ((!_student || _student.length === 0) && (_oauth && _oauth.length !== 0)) {
      return {
        basic: _basic[0],
        oauth: _oauth[0],
      };
    }
    if ((_student && _student.length !== 0) && (_oauth && _oauth.length !== 0)) {
      return {
        basic: _basic[0],
        student: _student[0],
        oauth: _oauth[0],
      };
    }
    if ((!_student || _student.length === 0) && (!_oauth || _oauth.length === 0)) {
      return {
        basic: _basic[0],
      };
    }
    if ((_student && _student.length !== 0) && (!_oauth || _oauth.length === 0)) {
      return {
        basic: _basic[0],
        student: _student[0],
      };
    }
  }

  // 微服务授权中心(中间件负责验证 token，授权验证失败由 verifyToken 拦截请求，通过验证后运行到这里，返回此账号的信息)
  async authorization() {
    const { ctx } = this;
    return await this._getuidinfo(ctx.state.uid, ctx.state.college_id);
  }

  // 成绩课表远程获取/同步接口
  async rpcsync(payload) {

    const { ctx, service } = this;
    const ret = await service.userAccess.getStudentAndCollegeIndexByUid(payload.uid);
    if (ret === null) { ctx.helper.error(ctx, 1000); return false; }
    const student = ret.student;
    const idx = ret.college_idx;

    if (payload.type === 'scores') {
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
          ctx.logger.error(`[${ctx.app.colleges[idx].name}] 院校ID(${ctx.app.colleges[idx].id}), UID(${payload.uid}), 同步学生ID(${student.sid}) 的成绩信息失败, 将返回缓存, 错误信息: ${e}`);
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
    } else if (payload.type === 'schedules') {
      if (payload.sync === true) {
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
          ctx.logger.error(`[${ctx.app.colleges[idx].name}] 院校ID(${ctx.app.colleges[idx].id}), UID(${payload.uid}), 同步学生ID(${student.sid}) 的课表信息失败, 将返回缓存, 错误信息: ${e}`);
        } finally {
          // 教务不需要输入验证码的情况下，可以放心登出教务系统
          if (!ctx.app.colleges[idx].userInputCaptcha) { await ctx.app.colleges[idx].crawler.logout(student); }
        }
      }
      // 查表返回结果给调用方
      return await ctx.app.colleges[idx].db.query('SELECT schedules.cid, schedules.cindex, schedules.type, schedules.teacher, schedules.weeks, schedules.day, schedules.tid, schedules.period, schedules.date, courses.name, courses.credit, classrooms.rid, classrooms.campus, classrooms.building, classrooms.room FROM `schedules` INNER JOIN `courses` ON schedules.cid = courses.cid INNER JOIN `classrooms` ON schedules.rid = classrooms.rid WHERE schedules.sid = ?', [ student.sid ]);
    }
  }

  // 获取任意UID的用户信息的接口
  async getaccountinfo(payload) {

    const { ctx } = this;
    let college_id = -1;

    const _ret = await ctx.app.maindb.query('SELECT `college_id` FROM `maps` WHERE `uid` = ? LIMIT 0, 1', [ payload.uid ]);
    if (_ret && _ret.length === 1 && _ret[0].college_id !== undefined && _ret[0].college_id !== null) {
      college_id = _ret[0].college_id;
    }

    return await this._getuidinfo(payload.uid, college_id);
  }

  // 设置/获取/删除 用户元数据方法
  // uid(必须), key(必须 + 非空), value(非必须 + 可空)
  // 如果只有 uid + key，则为获取对应 uid 的对应 key 的元数据
  // 如果 uid + key + 空值 value，则为删除对应 uid 的对应 key 的元数据
  // 如果 uid + key + value 均有值，则为更新对应 uid 对应 key 的元数据
  async metadata(payload) {
    const { ctx } = this;
    if (payload.value === undefined || payload.value === null) { // 查询模式
      const ret = {
        success: false,
      };
      try {
        const _ret = await ctx.app.maindb.query('SELECT `meta_value` FROM `metadata` WHERE `uid` = ? AND `meta_key` = ? LIMIT 0, 1', [ payload.uid, payload.key ]);
        if (_ret && _ret.length === 1 && _ret[0].meta_value !== undefined && _ret[0].meta_value !== null) {
          ret.value = _ret[0].meta_value;
          ret.success = true;
        }
      } catch {
        ret.success = false;
      }
      return ret;
    }
    if (payload.value === '') { // 删除模式
      try {
        await ctx.app.maindb.query('DELETE FROM `metadata` WHERE `uid` = ? AND `meta_key` = ?', [ payload.uid, payload.key ]);
        return {
          success: true,
        };
      } catch {
        return {
          success: false,
        };
      }
    } else { // 更新模式
      try {
        await ctx.app.maindb.query('UPDATE `metadata` SET `meta_value` = ? WHERE `uid` = ? AND `meta_key` = ?', [ payload.value, payload.uid, payload.key ]);
        return {
          success: true,
        };
      } catch {
        return {
          success: false,
        };
      }
    }
  }

}

module.exports = DefaultService;
