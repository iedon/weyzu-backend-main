'use strict';
/**
 * @authors iEdon (m [at] iedon.net)
 * @date    2018/9/30 22:08
 * @version V0.0.1
 */

/*
    iEdon UniPlex Project
    高校校园数据服务 2.0
    URP 1.50 (~2008)教务系统爬虫实现
*/

// /classes/crawlers/urp.js

const BaseCrawler = require('../basecrawler');
const Timetable = require('../timetable');
const Classroom = require('../classroom');
const Course = require('../course');
const Score = require('../score');
const Schedule = require('../schedule');

const querystring = require('querystring');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

// URP 教务系统常用参数
const VAR_URP_PATH = {
  // 登录
  login: '/loginAction.do',
  // 登出
  logout: '/logout.do',
  // 验证码图像
  captcha: '/validateCodeAction.do',
  // 学籍信息
  profile: '/xjInfoAction.do?oper=xjxx',
  // 获取当前学期成绩
  currentTermGrade: '/bxqcjcxAction.do?pageSize=100',
  // 获取通过的成绩
  allPassedGrades: '/gradeLnAllAction.do?type=ln&oper=qbinfo',
  // 获取挂科的成绩
  allFailedGrades: '/gradeLnAllAction.do?type=ln&oper=bjg',
  // 获取本学期课程表
  currentSchedule: '/xkAction.do?actionType=6',
  // 学期电子注册
  termRegistration: '/dzzcAction.do',
  // <title> == 500 Servlet Exception 代表需要登录，<title> == 错误信息中，.errTop 提示繁忙或登录 则也代表需要登录，.errTop 提示注册则需要电子注册
};

class Crawler extends BaseCrawler {

  /**
      * 取用户 session。
      * @param  {var}    uid         用户ID
      * @return {string}             失败返回null。若成功，返回主数据库 sessions 表中缓存的 session，空值情况下也为 null。
  */
  async getSession(uid) {
    const app = this.app;
    const college = this.college;

    const cachedSession = await this.getCachedSession(uid);
    if (!cachedSession) { // 没有找到缓存的 Session，直接获取新 Session
      let cookie_ret = null;
      try {
        cookie_ret = await app.fetch(app, `${college.system_url}${VAR_URP_PATH.login}`, null, college.user_agent);
      } catch (err) {
        app.logger.error(`[${college.name}] 院校ID: ${college.id}, UID: ${uid} - 获取教务 Session 失败(获取 Session 方法)，网络错误: ${err}`);
        return null;
      }
      // 从 HTTP Header 中获取新 session 并将新 Session 更新到数据库
      let cookie = null;
      if (cookie_ret.headers['set-cookie']) { cookie = cookie_ret.headers['set-cookie'].join().split(';')[0].trim(); }
      if (!cookie) { // 无法获取新 session
        app.logger.error(`[${college.name}] 院校ID: ${college.id}, UID: ${uid} - Session 获取失败！(获取 Session 方法)`);
        return null;
      }
      try {
        await this.dao.setSession(uid, cookie);
      } catch (e) {
        app.logger.error(`[${college.name}] 院校ID: ${college.id}, UID: ${uid} - Session 存库失败！(获取 Session 方法), ${e}`);
        return null;
      }
      return cookie;
    }
    return cachedSession;
  }

  /**
    * 取验证码
    * @param  {var}    uid  用户ID
    * @return {string}      失败返回false。若成功，session 将写入 主数据库 sessions 表。
  */
  async getCaptcha(uid) {
    const app = this.app;
    const college = this.college;
    if (!college.userInputCaptcha) { return false; }

    let cookie_ret = null;
    try {
      cookie_ret = await app.fetch(app, `${college.system_url}${VAR_URP_PATH.login}`, null, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, UID: ${uid} - 获取教务 Session 失败(获取教务验证码方法)，网络错误: ${err}`);
      return false;
    }
    // 此时服务端返回了新 Session，需要更新到数据库
    let cookie = null;
    if (cookie_ret.headers['set-cookie']) { cookie = cookie_ret.headers['set-cookie'].join().split(';')[0].trim(); }
    if (!cookie) { // 无法获取新 session
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, UID: ${uid} - Session 获取失败！(获取教务验证码方法)`);
      return false;
    }
    try {
      await this.dao.setSession(uid, cookie);
    } catch (e) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, UID: ${uid} - Session 更新失败！(获取教务验证码方法)`);
      return false;
    }

    // 获取验证码
    try {
      const captcha_ret = await app.fetch(app, `${college.system_url}${VAR_URP_PATH.captcha}`, { headers: { Cookie: cookie } }, college.user_agent);
      const captcha = 'data:' + captcha_ret.headers['content-type'].split(';')[0].trim() + ';base64,' + captcha_ret.data.toString('base64');
      return captcha;
    } catch (e) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, UID: ${uid} - 验证码获取失败，网络错误: ${e}`);
      return false;
    }

  }

  /**
    * 登录教务系统
    * @param  {var}    student  学生实例。当教务系统需要验证码验证时，还一定要设置 student.captcha 传入(验证码)。
    * @return {string}          失败返回错误消息。若成功，session 将写入 Student 对象。
  */
  async login(student) {

    const app = this.app;
    const college = this.college;

    // 获取教务Cookie (session)
    const session = await this.getSession(student.uid);

    // 提交登录信息
    const postJson = {
      zjh: student.sid,
      mm: student.password,
    };
    if (college.userInputCaptcha) { postJson.v_yzm = student.captcha; }
    const postData = querystring.stringify(postJson);
    const options = {
      method: 'POST',
      data: postData,
      headers: {
        Cookie: session,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    let result = null;
    try {
      result = await app.fetch(app, `${college.system_url}${VAR_URP_PATH.login}`, options, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 登录学生失败，网络错误: ${err}`);
      return;
    }

    // 解析文档，获取登录结果或是错误信息
    const $ = cheerio.load(iconv.decode(result.data, 'gbk'));
    const title = $('html head title').text();
    const successText = '学分制综合教务';
    if (title === successText) {
      student.session = session;
      return;
    }

    const err = $('td .errorTop strong font').text();
    // app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - ${err}`);
    return err;
  }

  /**
    * 登出教务系统
    * @param  {var}    student  学生实例
  */
  async logout(student) {
    const app = this.app;
    const college = this.college;

    // 如果数据库中有缓存的 session, 则用之。如果没有读取到，且教务需要用户输入验证码登录，则直接返回 false。
    const session = await this.getSession(student.uid);
    if (!student.session && !session) { return; }
    if (!student.session) { student.session = session; }

    try {
      app.fetch(app, `${college.system_url}${VAR_URP_PATH.logout}`, { headers: { Cookie: student.session } }, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, UID: ${student.uid} - 登出学生失败，网络错误: ${err}`);
    }
    student.session = null;
    student.captcha = null;
  }

  /**
    * 更新学生所有信息
    * @param  {var}    student  学生实例
    * @return {boolean} 操作结果布尔值
  */
  async update(student) {

    const app = this.app;
    const college = this.college;

    let result = false;
    try {
      // 更新学籍信息
      if (await this.updateProfile(student)) {
        // 更新成绩信息
        if (await this.updateScore(student)) {
          // 更新课表
          if (await this.updateSchedule(student)) {
            result = true;
          }
        }
      }
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 同步资料失败: ${err}`);
      return false;
    }

    return result;
  }

  /**
    * 更新学籍信息
    * @param  {var}    student  学生实例
    * @return {boolean} 操作结果布尔值
  */
  async updateProfile(student) {
    // 如果数据库中有缓存的 session, 则用之。如果没有读取到，且教务需要用户输入验证码登录，则直接返回 false。
    const session = await this.getSession(student.uid);
    if (!student.session && !session) { return false; }
    if (!student.session) { student.session = session; }
    const cookie = student.session;

    const app = this.app;
    const college = this.college;

    // 获取学籍信息页面
    let result = null;
    try {
      result = await app.fetch(app, `${college.system_url}${VAR_URP_PATH.profile}`, { headers: { Cookie: cookie } }, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 获取资料失败，网络错误: ${err}`);
      return false;
    }
    const $ = cheerio.load(iconv.decode(result.data, 'gbk'));

    // 判断是否需要用户登录(即用户可能已登录过期)
    const title = $('title').text().trim();
    const needRelogin = (title.indexOf('错误信息') !== -1 || title.indexOf('500 Servlet Exception') !== -1);
    if (needRelogin) {
      student.needLogin = needRelogin;
      return false;
    }

    const name = $('table.titleTop3 table#tblView:nth-child(1) tr:nth-child(1) td:nth-child(4)').text().trim();
    const sfz = $('table.titleTop3 table#tblView:nth-child(1) tr:nth-child(3) td:nth-child(4)').text().trim();
    let sex = $('table.titleTop3 table#tblView:nth-child(1) tr:nth-child(4) td:nth-child(2)').text().trim();
    if (name.length === 0) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 获取资料失败！`);
      return false;
    }

    sex = ((sex === '男' ? 0 : (sex === '女' ? 1 : 2))); // 0: 男，1: 女 ，2: 人妖
    let year = $('table.titleTop3 table#tblView:nth-child(1) tr:nth-child(15) td:nth-child(2)').text().trim();
    if (year.length === 0) { year = $('table.titleTop2 table#tblView:nth-child(1) tr:nth-child(3) td:nth-child(2)').text().trim(); }
    let bj = $('table.titleTop3 table#tblView:nth-child(1) tr:nth-child(15) td:nth-child(4)').text().trim();
    if (bj.length === 0) { bj = $('table.titleTop2 table#tblView:nth-child(1) tr:nth-child(3) td:nth-child(4)').text().trim(); }
    let faculty = $('table.titleTop3 table#tblView:nth-child(1) tr:nth-child(13) td:nth-child(4)').text().trim();
    if (faculty.length === 0) { faculty = $('table.titleTop2 table#tblView:nth-child(1) tr:nth-child(1) td:nth-child(4)').text().trim(); }
    let major = $('table.titleTop3 table#tblView:nth-child(1) tr:nth-child(14) td:nth-child(2)').text().trim();
    if (major.length === 0) { major = $('table.titleTop2 table#tblView:nth-child(1) tr:nth-child(2) td:nth-child(2)').text().trim(); }

    try {
      await this.dao.addStudent(student, name, sex, year, faculty, major, bj, sfz);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新学生信息失败(写入 students 表异常: ${err})`);
      return false;
    }

    return true;
  }

  /**
    * 电子注册
    * @param  {var}    student  学生实例
    * @return {boolean} 操作结果布尔值，返回 false 时，调用方应该立即停止后续处理。
  */
  async termRegister(student) {
    const app = this.app;
    const college = this.college;

    let dzzcRet = null;
    try {
      dzzcRet = await app.fetch(app, `${college.system_url}${VAR_URP_PATH.termRegistration}`, { headers: { Cookie: student.session } }, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 获取学期电子注册信息失败，网络错误: ${err}`);
      return false;
    }
    const $ = cheerio.load(iconv.decode(dzzcRet.data, 'gbk'));
    const term = $('select[name="zxjxjhh"] option[selected]').val().trim();
    try {
      const options = {
        method: 'POST',
        data: `zxjxjhh=${term}`,
        headers: {
          Cookie: student.session,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      };
      const regRet = await app.fetch(app, `${college.system_url}${VAR_URP_PATH.termRegistration}?zc=zc&zxjxjhh=${term}`, options, college.user_agent);
      const regRet$ = cheerio.load(iconv.decode(regRet.data, 'gbk'));
      const ret = regRet$('#tdSubmitInfo').text().trim();
      if (ret.indexOf('注册成功') !== -1) {
        app.logger.info(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 需要学期电子注册，已经自动注册成功`);
      } else {
        app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 需要学期电子注册，但注册失败`);
        return false;
      }
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 学期电子注册失败，网络错误: ${err}`);
      return false;
    }
    return true;
  }

  /**
    * 更新成绩，同时会更新 courses 表
    * @param  {var}    student  学生实例
    * @return {boolean} 操作结果布尔值
  */
  async updateScore(student) {
    // 如果数据库中有缓存的 session, 则用之。如果没有读取到，且教务需要用户输入验证码登录，则直接返回 false。
    const session = await this.getSession(student.uid);
    if (!student.session && !session) { return false; }
    if (!student.session) { student.session = session; }
    const cookie = student.session;

    const newCourses = []; // 存放与成绩有关的课程
    const newScores = []; // 存放爬取到的成绩

    // 处理当前学期的成绩(必须放在第一个处理)
    await this._getScoreCurrentTerm(student, cookie, newCourses, newScores);

    // 处理通过成绩信息
    await this._getScorePassed(student, cookie, newCourses, newScores);

    // 处理未通过成绩信息
    await this._getScoreFailed(student, cookie, newCourses, newScores);

    // 比对缓存并持久化
    await this.dao.persistCourses(newCourses);
    await this.dao.persistScores(student, newScores);
    return true;
  }

  /**
    * 更新同步当前学期的学生成绩
    * @param  {var}    student  学生实例
    * @param  {string} cookie  updateScores 中的 cookie
    * @param  {array}  newCourses updateScores 中的 newCourses
    * @param  {array}  newScores updateScores 中的 newScores
    * @return {boolean} 操作结果布尔值
  */
  async _getScoreCurrentTerm(student, cookie, newCourses, newScores) {

    const app = this.app;
    const college = this.college;

    // 获取本学期成绩页面
    let result = null;
    try {
      result = await app.fetch(app, `${college.system_url}${VAR_URP_PATH.currentTermGrade}`, { headers: { Cookie: cookie } }, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新本学期成绩失败，网络错误: ${err}`);
      return false;
    }
    let $ = cheerio.load(iconv.decode(result.data, 'gbk'));

    // ============================= 判断是否需要用户登录(即用户可能已登录过期)，以及是否需要电子注册 ======================================
    const title = $('title').text().trim();
    let needRelogin = (title.indexOf('500 Servlet Exception') !== -1); // 出现这个也代表可能需要重新登录
    if (title.indexOf('错误信息') !== -1) {
      const errMsg = $('.errorTop').text().trim();
      if (errMsg.indexOf('繁忙') !== -1 || errMsg.indexOf('登录') !== -1) { // 教务数据库繁忙或请登录再使用。出现这个代表可能需要重新登录。
        needRelogin = true;
      } else if (errMsg.indexOf('您没有注册') !== -1) { // 需要电子注册
        const ret = await this.termRegister(student);
        if (!ret) return false;
        // 电子注册后，重新获取本学期成绩页面
        let result = null;
        try {
          result = await app.fetch(app, `${college.system_url}${VAR_URP_PATH.currentTermGrade}`, { headers: { Cookie: cookie } }, college.user_agent);
        } catch (err) {
          app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新本学期成绩失败，网络错误: ${err}`);
          return false;
        }
        $ = cheerio.load(iconv.decode(result.data, 'gbk'));
      }
    }
    if (needRelogin) {
      student.needLogin = needRelogin;
      return false;
    }
    // ===============================================================================================================================

    // 处理成绩信息
    const trs = $('table.displayTag thead tr:not(:first-child)').toArray();
    for (let i = 0; i < trs.length; i++) {
      const e = trs[i];

      const kch = $('td:nth-child(1)', e).text().trim(); // 课程号
      const kcm = $('td:nth-child(3)', e).text().trim(); // 课程名
      const xf = $('td:nth-child(5)', e).text().trim(); // 学分

      if (kch.length === 0 || kcm.length === 0 || xf.length === 0) {
        app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 存在本学期成绩更新失败(课号/课名/学分为空)`);
        continue;
      }

      const kxh = $('td:nth-child(2)', e).text().trim(); // 课序号
      const kcsx = $('td:nth-child(6)', e).text().trim(); // 课程属性(类型)
      const course = new Course(kch, kxh, kcsx, xf, kcm);
      newCourses.push(course);

      let cj = $('td:nth-child(10)', e).text().trim(); // 成绩
      if (cj === '') cj = '未出';
      const wtgyy = $('td:nth-child(12)', e).text().trim(); // 未通过原因(备注)
      newScores.push(new Score(student, course, cj, '当前学期', wtgyy));
    }
    return true;
  }

  /**
    * 内部方法，获取所有通过的科目的成绩
    * @param  {var}    student  学生实例
    * @param  {string} cookie  updateScores 中的 cookie
    * @param  {array}  newCourses updateScores 中的 newCourses
    * @param  {array}  newScores updateScores 中的 newScores
    * @return {boolean} 操作结果布尔值
  */
  async _getScorePassed(student, cookie, newCourses, newScores) {

    const app = this.app;
    const college = this.college;

    // 获取已通过成绩信息页面
    let result = null;
    try {
      result = await app.fetch(app, `${college.system_url}${VAR_URP_PATH.allPassedGrades}`, { headers: { Cookie: cookie } }, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新已通过成绩失败，网络错误: ${err}`);
      return false;
    }
    let $ = cheerio.load(iconv.decode(result.data, 'gbk'));

    // ============================= 判断是否需要用户登录(即用户可能已登录过期)，以及是否需要电子注册 ======================================
    const title = $('title').text().trim();
    let needRelogin = (title.indexOf('500 Servlet Exception') !== -1); // 出现这个也代表可能需要重新登录
    if (title.indexOf('错误信息') !== -1) {
      const errMsg = $('.errorTop').text().trim();
      if (errMsg.indexOf('繁忙') !== -1 || errMsg.indexOf('登录') !== -1) { // 教务数据库繁忙或请登录再使用。出现这个代表可能需要重新登录。
        needRelogin = true;
      } else if (errMsg.indexOf('您没有注册') !== -1) { // 需要电子注册
        const ret = await this.termRegister(student);
        if (!ret) return false;
        // 重新获取已通过成绩信息页面
        let result = null;
        try {
          result = await app.fetch(app, `${college.system_url}${VAR_URP_PATH.allPassedGrades}`, { headers: { Cookie: cookie } }, college.user_agent);
        } catch (err) {
          app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新已通过成绩失败，网络错误: ${err}`);
          return false;
        }
        $ = cheerio.load(iconv.decode(result.data, 'gbk'));
      }
    }
    if (needRelogin) {
      student.needLogin = needRelogin;
      return false;
    }
    // ===============================================================================================================================

    const terms = [];
    // 获取所有的学期名(term)
    $('body a').each((i, e) => {
      // 将学期名做一个美化，然后放入数组，供稍后使用
      terms.push($(e).attr('name').trim());
      /* replace('(两学期)', '')
        .replace('学年', ' ')
        .replace('学期', '')
        .replace('(', '')
        .replace(')', '')); */
    });

    const tbodys = $('table.displayTag tbody').toArray();
    for (let i = 0; i < tbodys.length; i++) {
      const trs = $('tr', tbodys[i]);

      for (let j = 0; j < trs.length; j++) {
        const e = trs[j];

        const kch = $('td:nth-child(1)', e).text().trim(); // 课程号
        const kxh = $('td:nth-child(2)', e).text().trim(); // 课序号
        const kcm = $('td:nth-child(3)', e).text().trim(); // 课程名
        const xf = $('td:nth-child(5)', e).text().trim(); // 学分
        if (kch.length === 0 || kcm.length === 0 || xf.length === 0) {
          app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 存在已通过成绩更新失败(课号/课名/学分为空)`);
          continue;
        }

        let alreadyAddedByCurrentTerm = false;
        for (let k = 0; k < newScores.length; k++) {
          if (newScores[k].cid === kch && newScores[k].cindex === kxh) { // 说明在第一步更新本学期成绩的时候更新过了，这里不再重复添加
            alreadyAddedByCurrentTerm = true;
            break;
          }
        }
        if (alreadyAddedByCurrentTerm) continue; // 已经添加过，跳过本条成绩

        const kcsx = $('td:nth-child(6)', e).text().trim(); // 课程属性(类型)
        const cj = $('td:nth-child(7)', e).text().trim(); // 成绩
        const _course = new Course(kch, kxh, kcsx, xf, kcm);
        newCourses.push(_course);
        newScores.push(new Score(student, _course, cj, (i + 1 <= terms.length ? terms[i] : '其他成绩') /* URP 系统中，通过科目没有未通过原因(所以备注为空)，省去一个参数(默认为空串)*/));
      }
    }
    return true;
  }

  /**
    * 内部方法，获取所有挂科的科目的成绩
    * @param  {var}    student  学生实例
    * @param  {string} cookie  updateScores 中的 cookie
    * @param  {array}  newCourses updateScores 中的 newCourses
    * @param  {array}  newScores updateScores 中的 newScores
    * @return {boolean} 操作结果布尔值
  */
  async _getScoreFailed(student, cookie, newCourses, newScores) {

    const app = this.app;
    const college = this.college;
    const newFailedScores = [];

    // 获取未通过成绩信息信息页面
    let result = null;
    try {
      result = await app.fetch(app, `${college.system_url}${VAR_URP_PATH.allFailedGrades}`, { headers: { Cookie: cookie } }, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新未通过成绩失败，网络错误: ${err}`);
      return false;
    }
    let $ = cheerio.load(iconv.decode(result.data, 'gbk'));

    // ============================= 判断是否需要用户登录(即用户可能已登录过期)，以及是否需要电子注册 ======================================
    const title = $('title').text().trim();
    let needRelogin = (title.indexOf('500 Servlet Exception') !== -1); // 出现这个也代表可能需要重新登录
    if (title.indexOf('错误信息') !== -1) {
      const errMsg = $('.errorTop').text().trim();
      if (errMsg.indexOf('繁忙') !== -1 || errMsg.indexOf('登录') !== -1) { // 教务数据库繁忙或请登录再使用。出现这个代表可能需要重新登录。
        needRelogin = true;
      } else if (errMsg.indexOf('您没有注册') !== -1) { // 需要电子注册
        const ret = await this.termRegister(student);
        if (!ret) return false;
        // 重新获取未通过成绩信息页面
        let result = null;
        try {
          result = await app.fetch(app, `${college.system_url}${VAR_URP_PATH.allFailedGrades}`, { headers: { Cookie: cookie } }, college.user_agent);
        } catch (err) {
          app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新未通过成绩失败，网络错误: ${err}`);
          return false;
        }
        $ = cheerio.load(iconv.decode(result.data, 'gbk'));
      }
    }
    if (needRelogin) {
      student.needLogin = needRelogin;
      return false;
    }
    // ===============================================================================================================================

    // 处理成绩信息
    const displayTags = $('table.displayTag').toArray();
    for (let i = 0; i < displayTags.length; i++) {

      if (i > 0) continue; // 跳过表头

      const trs = $('tbody tr', displayTags[i]);
      for (let i = 0; i < trs.length; i++) {
        const e = trs[i];

        const kch = $('td:nth-child(1)', e).text().trim(); // 课程号
        const kxh = $('td:nth-child(2)', e).text().trim(); // 课序号
        const kcm = $('td:nth-child(3)', e).text().trim(); // 课程名
        const xf = $('td:nth-child(5)', e).text().trim(); // 学分
        if (kch.length === 0 || kcm.length === 0 || xf.length === 0) {
          app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 存在未通过成绩更新失败(课号/课名/学分为空)`);
          continue;
        }

        let alreadyAddedByCurrentTerm = false;
        for (let k = 0; k < newScores.length; k++) {
          if (newScores[k].cid === kch && newScores[k].cindex === kxh) { // 说明在第一步更新本学期成绩的时候更新过了，这里不再重复添加
            alreadyAddedByCurrentTerm = true;
            break;
          }
        }
        if (alreadyAddedByCurrentTerm) continue; // 已经添加过，跳过本条成绩

        const kcsx = $('td:nth-child(6)', e).text().trim(); // 课程属性(类型)

        // 对于 courses 表的操作结束了，下面就将成绩写入 scores 表
        const cj = $('td:nth-child(7)', e).text().trim(); // 成绩
        let term = $('td:nth-child(8)', e).text().trim(); // 考试时间，这里用考试时间充当学期
        if (term.length === 0) { term = '0'; /* 如果没有考试时间，默认给0 */ }
        const wtgyy = $('td:nth-child(9)', e).text().trim(); // 未通过原因(备注)

        const _course = new Course(kch, kxh, kcsx, xf, kcm);
        newCourses.push(_course);
        const _score = new Score(student, _course, cj, term, wtgyy);
        // 因为 URP 的尿性，一个学生同一科目多次重修未通过，这里会有所有未通过的记录，所以我们要选取 term 最新的
        const nowTerm = parseInt(term);
        let donotadd = false;
        for (let j = 0; j < newFailedScores.length; j++) {
          const originalTerm = parseInt(newFailedScores[j].term);
          if (newFailedScores[j].cid === kch && newFailedScores[j].cindex === kxh) {
            if (!isNaN(originalTerm) && !isNaN(nowTerm) && (nowTerm > originalTerm)) {
              newFailedScores[j].type = _score.type;
              newFailedScores[j].score = _score.score;
              newFailedScores[j].term = _score.term;
              newFailedScores[j].comment = _score.comment;
            }
            donotadd = true;
            break;
          }
        }
        if (donotadd === false) newFailedScores.push(_score);
      }
    }
    newFailedScores.forEach(e => newScores.push(e));
    return true;
  }

  /**
    * 更新本学期课程表，同时会更新 courses 表，classrooms 表
    * @param  {var}    student  学生实例
    * @return {boolean} 操作结果布尔值
  */
  async updateSchedule(student) {
    // 如果数据库中有缓存的 session, 则用之。如果没有读取到，且教务需要用户输入验证码登录，则直接返回 false。
    const session = await this.getSession(student.uid);
    if (!student.session && !session) { return false; }
    if (!student.session) { student.session = session; }
    const cookie = student.session;

    const app = this.app;
    const college = this.college;

    // 获取课表信息页面
    let result = null;
    try {
      result = await app.fetch(app, `${college.system_url}${VAR_URP_PATH.currentSchedule}`, { headers: { Cookie: cookie } }, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新课表失败，网络错误: ${err}`);
      return false;
    }
    let $ = cheerio.load(iconv.decode(result.data, 'gbk'));

    // ============================= 判断是否需要用户登录(即用户可能已登录过期)，以及是否需要电子注册 ======================================
    const title = $('title').text().trim();
    let needRelogin = (title.indexOf('500 Servlet Exception') !== -1); // 出现这个也代表可能需要重新登录
    if (title.indexOf('错误信息') !== -1) {
      const errMsg = $('.errorTop').text().trim();
      if (errMsg.indexOf('繁忙') !== -1 || errMsg.indexOf('登录') !== -1) { // 教务数据库繁忙或请登录再使用。出现这个代表可能需要重新登录。
        needRelogin = true;
      } else if (errMsg.indexOf('您没有注册') !== -1) { // 需要电子注册
        const ret = await this.termRegister(student);
        if (!ret) return false;
        // 重新获取课表信息页面
        let result = null;
        try {
          result = await app.fetch(app, `${college.system_url}${VAR_URP_PATH.currentSchedule}`, { headers: { Cookie: cookie } }, college.user_agent);
        } catch (err) {
          app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新课表失败，网络错误: ${err}`);
          return false;
        }
        $ = cheerio.load(iconv.decode(result.data, 'gbk'));
      }
    }
    if (needRelogin) {
      student.needLogin = needRelogin;
      return false;
    }
    // ===============================================================================================================================

    // 将JSON数组进行分类的函数
    const groupBy = (array, f) => {
      const groups = {};
      array.forEach(function(o) {
        const group = JSON.stringify(f(o));
        groups[group] = groups[group] || [];
        groups[group].push(o);
      });
      return Object.keys(groups).map(function(group) {
        return groups[group];
      });
    };

    let jctable = []; // 原始timetable
    const queryJcFromJcTable = jc => {
      for (let i = 0; i < jctable.length; i++) {
        if (jc === jctable[i].index) { return i + 1; }
      }
    };

    const tbodys = $('table.displayTag tbody').toArray();
    let flag = false;

    const newCourses = [];
    const newSchedules = [];
    for (let i = 0; i < tbodys.length; i++) { // 遍历 tbody 里面的表格
      const ex = tbodys[i];
      if (!flag) { // 第一次(上面部分的 table)，爬取上面的 table 里面的课程时间
        flag = true;
        let timetable = [];
        const top_table_trs = $('tr[bgcolor="#FFFFFF"]', ex).toArray();
        for (let i = 0; i < top_table_trs.length; i++) {
          const top_table_td = top_table_trs[i];
          const str = $('td[width="11%"]', top_table_td).text().trim()
            .replace('第', '')
            .replace('(', '')
            .replace(')', '')
            .replace('小', '')
            .replace('节', '-');
          if (str.length !== 0) {
            const t = str.split('-');
            if (t.length === 3 && t[0].toLowerCase() !== 'null' /* 没错确实是null字样的字符串 */ && t[1].length !== 0 && t[2].length !== 0) { // 某些 shabby 的 URP 系统居然第X节课的X能是null字符
              timetable.push({ index: t[0], from: t[1], to: t[2] });
            }
          }
        }

        jctable = [ ...timetable ];
        timetable = groupBy(timetable, item => { return item.index; });

        await this.dao.getDb().beginTransactionScope(async conn => {
          let count = 0;
          for (let i = 0; i < timetable.length; i++) {
            const t = timetable[i];
            for (let i = 0; i < t.length; i++) {
              const tt = t[i];
              count++;
              await this.dao.addTimetable(new Timetable(count, tt.from, tt.to), conn);
            }
          }
        }, app.ctx);

        // 第一次结束之前，删掉已有的课程，第二次将会用新的数据来更新。

      } else { // 第二次，这是下面部分的table的每一行，从这里抓取每门课程信息

        // URP 系统中的课程，如果一门课有多个教室或节次，会断行，但是课程号课序号信息是共用行头元素的。
        const multipleBackup = []; // 在课程信息有多行的时候，由于第二行子信息没有课号课序号了，要给第一行信息做个备份map，在后续行的时候方便读取

        // 预处理，打好标记
        let lastOkIndex = 0;
        $('tr', ex).each((i, e) => {
          const isNotFirstRow = ($('td', e).toArray().length === 7); // 断行后的子行元素个数是 7 个，正常子行是 18 个。
          if (!isNotFirstRow) {
            lastOkIndex = i;
          } else {
            multipleBackup.push([ i, lastOkIndex ]);
          }
        });

        // 正式解析
        const bot_table_trs = $('tr', ex).toArray();
        for (let i = 0; i < bot_table_trs.length; i++) {
          const e = bot_table_trs[i];
          const isNotFirstRow = ($('td', e).toArray().length === 7); // 断行后的子行元素个数是 7 个，正常子行是 18 个。
          let kch = null;
          let kxh = null;
          let kcm = null;
          let xf = null;
          let jsm = null;
          let kcsx = null;

          if (isNotFirstRow) {

            let lastOkIndex = 0;
            for (let j = 0; j < multipleBackup.length; j++) {
              if (multipleBackup[j][0] === i) {
                lastOkIndex = multipleBackup[j][1];
                break;
              }
            }

            kch = $(`tr:nth-child(${lastOkIndex + 1}) td:nth-child(2)`, ex).text().trim(); // 课程号
            kxh = $(`tr:nth-child(${lastOkIndex + 1}) td:nth-child(4)`, ex).text().trim(); // 课序号
            kcm = $(`tr:nth-child(${lastOkIndex + 1}) td:nth-child(3)`, ex).text().trim(); // 课程名
            xf = $(`tr:nth-child(${lastOkIndex + 1}) td:nth-child(5)`, ex).text().trim(); // 学分
            kcsx = $(`tr:nth-child(${lastOkIndex + 1}) td:nth-child(6)`, ex).text().trim(); // 课程属性(类型)
            jsm = $(`tr:nth-child(${lastOkIndex + 1}) td:nth-child(8)`, ex).text().trim()
              .replace('*', ''); // 教师名字

          } else {

            kch = $('td:nth-child(2)', e).text().trim(); // 课程号
            kxh = $('td:nth-child(4)', e).text().trim(); // 课序号
            kcm = $('td:nth-child(3)', e).text().trim(); // 课程名
            xf = $('td:nth-child(5)', e).text().trim(); // 学分
            kcsx = $('td:nth-child(6)', e).text().trim(); // 课程属性(类型)
            jsm = $('td:nth-child(8)', e).text().trim()
              .replace('*', ''); // 教师名字
          }

          if (kch.length === 0 || kcm.length === 0 || xf.length === 0) {
            app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新课表失败(课号/序号/课名/学分为空)`);
            continue;
          }

          // 检查 courses 表中是否有这些课程，如果有则按需更新，没有就插入
          newCourses.push(new Course(kch, '', '', xf, kcm));
          let zc = null; let xq = null; let jc = null; let jieshu = null; let xiaoqu = null; let jxl = null; let jiaoshi = null;

          if (!isNotFirstRow) {

            zc = $('td:nth-child(12)', e).text().trim()
              .replace('周', '')
              .replace('上', '');

            // 星期
            xq = $('td:nth-child(13)', e).text().trim()
              .replace('一', '1')
              .replace('二', '2')
              .replace('三', '3')
              .replace('四', '4')
              .replace('五', '5')
              .replace('六', '6')
              .replace('七', '7')
              .replace('日', '7');
            xq = parseInt(xq);
            if (isNaN(xq)) { xq = 0; }

            jc = $('td:nth-child(14)', e).text().trim(); // 节次
            jieshu = $('td:nth-child(15)', e).text().trim(); // 节数
            xiaoqu = $('td:nth-child(16)', e).text().trim(); // 校区
            jxl = $('td:nth-child(17)', e).text().trim(); // 教学楼
            jiaoshi = $('td:nth-child(18)', e).text().trim(); // 教室

          } else {

            zc = $('td:nth-child(1)', e).text().trim()
              .replace('周', '')
              .replace('上', '');

            // 星期
            xq = $('td:nth-child(2)', e).text().trim()
              .replace('一', '1')
              .replace('二', '2')
              .replace('三', '3')
              .replace('四', '4')
              .replace('五', '5')
              .replace('六', '6')
              .replace('七', '7')
              .replace('日', '7');
            xq = parseInt(xq);
            if (isNaN(xq)) { xq = 0; }

            jc = $('td:nth-child(3)', e).text().trim(); // 节次
            jieshu = $('td:nth-child(4)', e).text().trim(); // 节数
            xiaoqu = $('td:nth-child(5)', e).text().trim(); // 校区
            jxl = $('td:nth-child(6)', e).text().trim(); // 教学楼
            jiaoshi = $('td:nth-child(7)', e).text().trim(); // 教室
          }

          if (zc.length === 0 || xq.length === 0 || jc.length === 0 || jieshu.length === 0) { continue; } // 跳过

          if (xiaoqu.length === 0) xiaoqu = '';
          if (jxl.length === 0) jxl = '';
          if (jiaoshi.length === 0) jiaoshi = '未知';

          // 适配节次数据(兼容多种奇葩数据：一，一小节，一节，一大节，1 等等)
          jc = jc.replace('节', '').replace('第', '');
          if (jc.indexOf('小') !== -1) {
            jc = jc.replace('小', '')
              .replace('一', '1')
              .replace('二', '2')
              .replace('三', '3')
              .replace('四', '4')
              .replace('五', '5')
              .replace('六', '6')
              .replace('七', '7')
              .replace('八', '8')
              .replace('九', '9')
              .replace('十', '10')
              .replace('十一', '11')
              .replace('十二', '12')
              .replace('十三', '13')
              .replace('十四', '14')
              .replace('十五', '15');
          } else { // 下面处理大节，将大节转化成小节
            jc = jc.replace('一', queryJcFromJcTable('一'))
              .replace('二', queryJcFromJcTable('二'))
              .replace('三', queryJcFromJcTable('三'))
              .replace('四', queryJcFromJcTable('四'))
              .replace('五', queryJcFromJcTable('五'))
              .replace('六', queryJcFromJcTable('六'))
              .replace('七', queryJcFromJcTable('七'))
              .replace('八', queryJcFromJcTable('八'))
              .replace('九', queryJcFromJcTable('九'))
              .replace('十', queryJcFromJcTable('十'))
              .replace('十一', queryJcFromJcTable('十一'))
              .replace('十二', queryJcFromJcTable('十二'))
              .replace('十三', queryJcFromJcTable('十三'))
              .replace('十四', queryJcFromJcTable('十四'))
              .replace('十五', queryJcFromJcTable('十五'))
              .replace('大', '');
          }

          const classroomObj = new Classroom(xiaoqu, jxl, jiaoshi);
          let rid = 0;
          // 检查 classrooms 表中是否有这个教室，如果没有就插入，如果有则找出它的ID。
          await this.dao.getDb().beginTransactionScope(async conn => {
            const ret = await this.dao.getRidByClassroom(classroomObj, conn);
            if (!ret || ret.length === 0) {
              const result_class = await this.dao.addClassroom(classroomObj, conn);
              if (result_class && result_class.insertId !== 0) {
                rid = result_class.insertId;
              }
            } else {
              rid = ret[0].rid;
            }
          }, app.ctx);
          classroomObj.rid = rid;
          newSchedules.push(new Schedule(new Course(kch, kxh, kcsx), classroomObj, zc, xq, jc, jieshu, jsm));
        }
      }
    }
    await this.dao.persistCourses(newCourses);
    await this.dao.persistSchedules(student, newSchedules);
    return true;
  }

}

module.exports = Crawler;
