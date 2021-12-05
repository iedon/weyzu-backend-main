'use strict';
/**
 * @authors iEdon (m [at] iedon.net)
 * @date    2019/9/21 02:47
 * @version V0.0.1
 */

/*
    iEdon UniPlex Project
    高校校园数据服务 2.0
    研究生教务系统(南京南软)爬虫实现
*/

// /classes/crawlers/yzuyjs_njnr.js

const BaseCrawler = require('../basecrawler');
const Classroom = require('../classroom');
const Course = require('../course');
const Score = require('../score');
const Schedule = require('../schedule');

const querystring = require('querystring');
const cheerio = require('cheerio');

// 教务系统常用参数
const VAR_JW_PATH = {
  // Referer
  referer: '/leftmenu.aspx',
  // 登录
  login: '/login.aspx',
  // 登出(同登录)
  logout: '/login.aspx',
  // 验证码图像
  captcha: '/PageTemplate/NsoftPage/yzm/createyzm.aspx',
  // 学籍信息
  profile: '/grgl/xsinfoshow.aspx',
  // 获取成绩
  getGrades: '/grgl/xskccjcx.aspx',
  // 获取培养计划 (用于在获取成绩课表过程中从培养计划中提取课程号，课序号，课程类型)
  getPlan: '/pygl/pyjhcx.aspx',
  // 查询某一课程的开课信息 (用于查找培养课程信息中不包含的课程信息)
  getCourseDetail: '/pygl/kckksearch.aspx',
  // 获取本学期课程表
  getSchedule: '/pygl/pyxkcx.aspx',
};

class Crawler extends BaseCrawler {

  /**
      * 取用户 session(此方法会附加一段本程序需要用的数据在尾部，因此调用后需要对返回值使用 getNecessaryCookie 处理)。
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
        cookie_ret = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.login}`, null, college.user_agent);
      } catch (err) {
        app.logger.error(`[${college.name}] 院校ID: ${college.id}, UID: ${uid} - 获取教务 Session 失败(获取 Session 方法)，网络错误: ${err}`);
        return null;
      }

      const _$ = cheerio.load(cookie_ret.data);
      const viewState = _$('#Form1 #__VIEWSTATE').val();
      if (!viewState) {
        app.logger.error(`[${college.name}] 院校ID: ${college.id}, UID: ${uid} - ViewState 获取失败 `);
        return null;
      }

      // 从 HTTP Header 中获取新 session 并将新 Session 更新到数据库
      let cookie = '';
      if (cookie_ret.headers['set-cookie']) {
        cookie_ret.headers['set-cookie'].forEach(e => {
          cookie = cookie + e.split(';')[0].trim() + ';';
        });
      }
      cookie = cookie + '_IDN_VIEWSTATE_=' + viewState;

      if (!cookie) { // 无法获取新 session
        app.logger.error(`[${college.name}] 院校ID: ${college.id}, UID: ${uid} - Session 获取失败！(获取 Session 方法)`);
        return null;
      }
      try {
        await this.dao.setSession(uid, cookie);
      } catch (e) {
        app.logger.error(`[${college.name}] 院校ID: ${college.id}, UID: ${uid} - Session 更新失败！(获取 Session 方法)`);
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

    // 登出旧的 Session。
    let cookie_ret = null;
    try {
      cookie_ret = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.login}`, null, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, UID: ${uid} - 获取教务 Session 失败(获取教务验证码方法)，网络错误: ${err}`);
      return false;
    }

    // 此时服务端返回了新 Session，需要更新到数据库
    const _$ = cheerio.load(cookie_ret.data);
    const viewState = _$('#Form1 #__VIEWSTATE').val();
    if (!viewState) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, UID: ${uid} - ViewState 获取失败 `);
      return null;
    }

    let cookie = '';
    if (cookie_ret.headers['set-cookie']) {
      cookie_ret.headers['set-cookie'].forEach(e => {
        cookie = cookie + e.split(';')[0].trim() + ';';
      });
    }
    cookie = cookie + '_IDN_VIEWSTATE_=' + viewState;

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
      const captcha_ret = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.captcha}?id=${(new Date()).toString()}`, { headers: { Cookie: this.getNecessaryCookie(cookie), Referer: `${college.system_url}${VAR_JW_PATH.login}` } }, college.user_agent);
      const captcha = 'data:image/gif;base64,' + captcha_ret.data.toString('base64');
      return captcha;
    } catch (e) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, UID: ${uid} - 验证码获取失败，网络错误: ${e}`);
      return false;
    }

  }

  /**
   * 从 session 中分离出教务所需要的 cookie。
   * 为什么？我们自己在 session 中插入了用于程序处理用的数据。
   * 貌似南软研究生系统发送多余的数据过去后正常运行一段时间后会卡死，因此模仿浏览器只发送必要的。
   * 此方法就是从数据库中的 session 提取中教务所必要的信息。
   * @param {string} session getSession() 中得到的 session
   * @return {string} cookie 返回教务所需要的 cookie
   */
  getNecessaryCookie(session) {
    const app = this.app;
    const college = this.college;
    const split = session.split(';');
    if (split.length !== 2) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 提取必要 session 失败, session: ${session}`);
      return '';
    }
    return split[0].trim();
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

    const _regex = /_IDN_VIEWSTATE_=([^;]*)(;|$)/;
    const viewStateRet = _regex.exec(session);
    if (!viewStateRet || viewStateRet.length !== 3) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 登录学生失败，无法获取 ViewState`);
      return;
    }
    const viewState = viewStateRet[1];

    // 提交登录信息
    const postJson = {
      __VIEWSTATE: viewState,
      ctl00$txtusername: student.sid,
      ctl00$txtpassword: student.password,
      'ctl00$ImageButton1.x': 75,
      'ctl00$ImageButton1.y': 35,
    };
    if (college.userInputCaptcha) { postJson.ctl00$txtyzm = student.captcha; }
    const postData = querystring.stringify(postJson);
    const options = {
      method: 'POST',
      data: postData,
      headers: {
        Cookie: this.getNecessaryCookie(session),
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: `${college.system_url}${VAR_JW_PATH.login}`,
      },
    };

    let result = null;
    try {
      result = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.login}`, options, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 登录学生失败，网络错误: ${err}`);
      return;
    }

    if (result.res.statusCode === 302 && result.res.headers.location && result.res.headers.location.indexOf('/Default.aspx') !== -1) {
      student.session = session;
      return;
    } else if (result.res.statusCode === 302 && result.res.headers.location && result.res.headers.location.indexOf('sorry') !== -1) {
      return '帐号不存在，或研究生管理系统暂不可用。';
    }
    const msg = result.data.toString();
    const _regex_msg = /alert\(\'(.*)\'\)/;
    const msg_ret = _regex_msg.exec(msg);
    if (!msg_ret || msg_ret.length !== 2) return;
    // app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - ${msg_ret[1]}`);
    return msg_ret[1];
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
      app.fetch(app, `${college.system_url}${VAR_JW_PATH.logout}`, { headers: { Cookie: this.getNecessaryCookie(student.session) } }, college.user_agent);
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
        // 更新成绩
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
      result = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.profile}`, { headers: { Cookie: this.getNecessaryCookie(cookie), Referer: `${college.system_url}${VAR_JW_PATH.referer}` } }, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 获取资料失败，网络错误: ${err}`);
      return false;
    }

    // 判断是否需要用户登录(即用户可能已登录过期)
    const needRelogin = (result.res.statusCode === 302);
    if (needRelogin) {
      student.needLogin = needRelogin;
      return false;
    }

    const $ = cheerio.load(result.data);
    const name = $('#lblxm1').text().trim();
    const sfz = $('#lblsfzh').text().trim();
    let sex = $('#lblxb').text().trim();
    if (name.length === 0) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 获取资料失败！`);
      return false;
    }

    sex = ((sex === '男' ? 0 : (sex === '女' ? 1 : 2))); // 0: 男，1: 女 ，2: 人妖
    const year = $('#lblnj').text().trim();
    const bj = $('#lbldsxx').text().trim();
    const faculty = $('#lblyxzy').text().trim()
      .split('_')[0];
    const major = $('#lblyjfx').text().trim();

    try {
      if (student.sid) student.sid = student.sid.toUpperCase();
      await this.dao.addStudent(student, name, sex, year, faculty, major, bj, sfz);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新学生信息失败(写入 students 表异常: ${err})`);
      return false;
    }

    return true;
  }

  /**
    * 更新科目成绩，同时会更新 courses 表
    * @param  {var}    student  学生实例
    * @return {boolean} 操作结果布尔值
  */
  async updateScore(student) {
    // 如果数据库中有缓存的 session, 则用之。如果没有读取到，且教务需要用户输入验证码登录，则直接返回 false。
    const session = await this.getSession(student.uid);
    if (!student.session && !session) { return false; }
    if (!student.session) { student.session = session; }
    const cookie = student.session;

    const app = this.app;
    const college = this.college;
    const options = { headers: { Cookie: this.getNecessaryCookie(cookie), Referer: `${college.system_url}${VAR_JW_PATH.referer}` } };

    // 获取成绩信息页面
    let result = null;
    try {
      result = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.getGrades}`, options, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新成绩失败，网络错误: ${err}`);
      return false;
    }

    // 判断是否需要用户登录(即用户可能已登录过期)
    const needRelogin = (result.res.statusCode === 302);
    if (needRelogin) {
      student.needLogin = needRelogin;
      return false;
    }

    const $ = cheerio.load(result.data);

    // 获取培养计划页面
    let plan = null;
    try {
      plan = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.getPlan}`, options, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新成绩时获取培养计划失败，网络错误: ${err}`);
      return false;
    }
    const _$ = cheerio.load(plan.data);

    const plansData = _$('#Fin_Context .GridViewStyle .GridViewRowStyle').toArray();
    const plans = [];
    for (let i = 0; i < plansData.length; i++) {
      const e = plansData[i];
      const kch = _$('td:nth-child(1)', e).text().trim(); // 课程号
      const kcm = _$('td:nth-child(2)', e).text().trim(); // 课程名
      const xf = _$('td:nth-child(5)', e).text().trim(); // 学分
      const kcsx = _$('td:nth-child(3)', e).text().trim(); // 课程属性(类型)
      plans.push({
        kch,
        kcm,
        xf,
        kcsx,
      });
    }

    const newCourses = []; // 存放与成绩有关的课程
    const newScores = []; // 存放爬取到的成绩

    // 获取学位课程成绩
    const dgScores = $('#MainWork_dgData .GridViewRowStyle').toArray();
    for (let i = 0; i < dgScores.length; i++) {
      const e = dgScores[i];
      const kcm = $('td:nth-child(1)', e).text().trim(); // 课程名
      const xf = $('td:nth-child(2)', e).text().trim(); // 学分
      const kxh = ''; // 课序号，本爬虫不需要
      let kch = null;
      let kcsx = null;
      for (let j = 0; j < plans.length; j++) {
        if (plans[j].kcm === kcm && parseFloat(plans[j].xf) === parseFloat(xf)) {
          kch = plans[j].kch;
          kcsx = plans[j].kcsx;
          break;
        }
      }

      if (kch === null || kcsx === null) { // 有时候从培养计划中获取到的信息不全，只能通过开课搜索功能来查找
        try {
          const ret_getViewState = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.getCourseDetail}`, options, college.user_agent);
          const _$_getViewState = cheerio.load(ret_getViewState.data);
          const viewState = _$_getViewState('#form1 #__VIEWSTATE').val();
          if (!viewState) {
            app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新成绩失败, ViewState 获取失败 `);
            continue;
          }
          // 构建搜课表单信息
          const postJson = {
            __VIEWSTATE: viewState,
            ctl00$MainWork$txtYXSH: '',
            ctl00$MainWork$txtkcbh: kcm,
            'ctl00$MainWork$btnSearch.x': 33,
            'ctl00$MainWork$btnSearch.y': 11,
          };
          const postData = querystring.stringify(postJson);
          const options_search = {
            method: 'POST',
            data: postData,
            headers: {
              Cookie: this.getNecessaryCookie(cookie),
              'Content-Type': 'application/x-www-form-urlencoded',
              Referer: `${college.system_url}${VAR_JW_PATH.getCourseDetail}`,
            },
          };
          const ret_search = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.getCourseDetail}`, options_search, college.user_agent);
          const _$_search = cheerio.load(ret_search.data);
          const searchArrs = _$_search('#MainWork_dgData .GridViewRowStyle').toArray();
          for (let i = 0; i < searchArrs.length; i++) {
            const e = searchArrs[i];
            const search_kch = $('td:nth-child(1)', e).text().trim(); // 课程号
            const search_kcm = $('td:nth-child(2)', e).text().trim(); // 课程名
            const search_xf = $('td:nth-child(7)', e).text().trim(); // 学分
            if (search_kcm === kcm && parseFloat(search_xf) === parseFloat(xf)) {
              kch = search_kch;
              kcsx = '';
              break;
            }
          }
        } catch (err) {
          app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 查询开课信息时发生异常: ${err}`);
          continue;
        }
      }

      const term = '学位课程'; // 学期
      if (kcm.length === 0 || xf.length === 0 || kch === null || kcsx === null) {
        app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 存在成绩更新失败(课名/学分为空)`);
        continue;
      }

      // 检查 courses 表中是否有这些课程，如果有则获得其课程号，没有就插入
      const course = new Course(kch, kxh, kcsx, xf, kcm);
      newCourses.push(course);

      const cj = $('td:nth-child(4)', e).text().trim(); // 成绩
      newScores.push(new Score(student, course, cj, term));
    }

    // 获取选修课程成绩
    const dg1Scores = $('#MainWork_Datagrid1 .GridViewRowStyle').toArray();
    for (let i = 0; i < dg1Scores.length; i++) {
      const e = dg1Scores[i];
      const kcm = $('td:nth-child(1)', e).text().trim(); // 课程名
      const xf = $('td:nth-child(2)', e).text().trim(); // 学分
      const kxh = ''; // 课序号，本爬虫不需要
      let kch = null;
      let kcsx = null;
      for (let j = 0; j < plans.length; j++) {
        if (plans[j].kcm === kcm && parseFloat(plans[j].xf) === parseFloat(xf)) {
          kch = plans[j].kch;
          kcsx = plans[j].kcsx;
          break;
        }
      }

      if (kch === null || kcsx === null) { // 有时候从培养计划中获取到的信息不全，只能通过开课搜索功能来查找
        try {
          const ret_getViewState = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.getCourseDetail}`, options, college.user_agent);
          const _$_getViewState = cheerio.load(ret_getViewState.data);
          const viewState = _$_getViewState('#form1 #__VIEWSTATE').val();
          if (!viewState) {
            app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新成绩失败, ViewState 获取失败 `);
            continue;
          }
          // 构建搜课表单信息
          const postJson = {
            __VIEWSTATE: viewState,
            ctl00$MainWork$txtYXSH: '',
            ctl00$MainWork$txtkcbh: kcm,
            'ctl00$MainWork$btnSearch.x': 33,
            'ctl00$MainWork$btnSearch.y': 11,
          };
          const postData = querystring.stringify(postJson);
          const options_search = {
            method: 'POST',
            data: postData,
            headers: {
              Cookie: this.getNecessaryCookie(cookie),
              'Content-Type': 'application/x-www-form-urlencoded',
              Referer: `${college.system_url}${VAR_JW_PATH.getCourseDetail}`,
            },
          };
          const ret_search = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.getCourseDetail}`, options_search, college.user_agent);
          const _$_search = cheerio.load(ret_search.data);
          const searchArrs = _$_search('#MainWork_dgData .GridViewRowStyle').toArray();
          for (let i = 0; i < searchArrs.length; i++) {
            const e = searchArrs[i];
            const search_kch = $('td:nth-child(1)', e).text().trim(); // 课程号
            const search_kcm = $('td:nth-child(2)', e).text().trim(); // 课程名
            const search_xf = $('td:nth-child(7)', e).text().trim(); // 学分
            if (search_kcm === kcm && parseFloat(search_xf) === parseFloat(xf)) {
              kch = search_kch;
              kcsx = '';
              break;
            }
          }
        } catch (err) {
          app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 查询开课信息时发生异常: ${err}`);
          continue;
        }
      }

      const term = '选修课程'; // 学期
      if (kcm.length === 0 || xf.length === 0 || kch === null || kcsx === null) {
        app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 存在成绩更新失败(课名/学分为空)`);
        continue;
      }

      // 检查 courses 表中是否有这些课程，如果有则获得其课程号，没有就插入
      const course = new Course(kch, kxh, kcsx, xf, kcm);
      newCourses.push(course);

      const cj = $('td:nth-child(4)', e).text().trim(); // 成绩
      newScores.push(new Score(student, course, cj, term));
    }
    await this.dao.persistCourses(newCourses);
    await this.dao.persistScores(student, newScores);
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
    const options = { headers: { Cookie: this.getNecessaryCookie(cookie), Referer: `${college.system_url}${VAR_JW_PATH.referer}` } };

    // 获取课表信息页面
    let result = null;
    try {
      result = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.getSchedule}`, options, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新课表失败，网络错误: ${err}`);
      return false;
    }

    // 判断是否需要用户登录(即用户可能已登录过期)
    const needRelogin = (result.res.statusCode === 302);
    if (needRelogin) {
      student.needLogin = needRelogin;
      return false;
    }

    const $ = cheerio.load(result.data);

    // 获取培养计划页面
    let plan = null;
    try {
      plan = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.getPlan}`, options, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新课表时获取培养计划失败，网络错误: ${err}`);
      return false;
    }
    const _$ = cheerio.load(plan.data);

    const plansData = _$('#Fin_Context .GridViewStyle .GridViewRowStyle').toArray();
    const plans = [];
    for (let i = 0; i < plansData.length; i++) {
      const e = plansData[i];
      const kch = _$('td:nth-child(1)', e).text().trim(); // 课程号
      const kcm = _$('td:nth-child(2)', e).text().trim(); // 课程名
      const xf = _$('td:nth-child(5)', e).text().trim(); // 学分
      const kcsx = _$('td:nth-child(3)', e).text().trim(); // 课程属性(类型)
      plans.push({
        kch,
        kcm,
        xf,
        kcsx,
      });
    }

    const newCourses = [];
    const newSchedules = [];

    // 获取课程
    const dgSchedules = $('#MainWork_dgData .GridViewRowStyle').toArray();
    for (let i = 0; i < dgSchedules.length; i++) {
      const e = dgSchedules[i];
      const kch = $('td:nth-child(4)', e).text().trim(); // 课程号
      const kxh = ''; // 课序号 此爬虫不需要，直接赋予空白串
      const kcm = $('td:nth-child(5)', e).text().trim(); // 课程名
      const xf = $('td:nth-child(9)', e).text().trim(); // 学分
      const jsm = $('td:nth-child(6)', e).text().trim(); // 教师名字
      const xiaoqu = $('td:nth-child(3)', e).text().trim(); // 校区
      let jiaoshi = $('td:nth-child(2)', e).text().trim(); // 教室
      if (jiaoshi === '') jiaoshi = '未知';
      let kcsx = null;
      for (let j = 0; j < plans.length; j++) {
        if (plans[j].kcm === kcm && parseFloat(plans[j].xf) === parseFloat(xf)) {
          kcsx = plans[j].kcsx;
          break;
        }
      }
      if (kcsx === null) kcsx = '';

      if (kch === undefined || !kcm || xf === undefined) {
        app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新课表失败(必要属性为空)`);
        continue;
      }

      const kksd = $('td:nth-child(7)', e).text().trim(); // 开课时段

      const _regex = /第([1-9]\d*)-([1-9]\d*)周/;
      const weeks = _regex.exec(kksd);
      if (!weeks || weeks.length !== 3) continue;
      const beginWeek = weeks[1];
      const endWeek = weeks[2];

      let zc = '';
      // 单双周/全周 (0 = 全周；1 = 单周；2 = 双周； 3 = 无法解析)
      const evenOrOdd = (kksd.indexOf('连续周') !== -1 ? 0 : (kksd.indexOf('单') !== -1 ? 1 : (kksd.indexOf('双') !== -1 ? 2 : 3)));
      if (evenOrOdd === 0) {
        zc = beginWeek + '-' + endWeek;
      } else if (evenOrOdd === 1) {
        for (let i = beginWeek; i <= endWeek; i++) {
          if (i % 2 === 0) continue;
          zc = zc + i;
          if (i !== endWeek) {
            zc = zc + '-';
          }
        }
      } else if (evenOrOdd === 2) {
        for (let i = beginWeek; i <= endWeek; i++) {
          if (i % 2 !== 0) continue;
          zc = zc + i;
          if (i !== endWeek) {
            zc = zc + '-';
          }
        }
      } else {
        continue;
      }

      const _regex_weekday = /星期([\u4e00-\u9fa5])-/;
      const _regex_weekday_ret = _regex_weekday.exec(kksd);
      if (!_regex_weekday_ret || _regex_weekday_ret.length !== 2) continue;
      let day = 0;
      switch (_regex_weekday_ret[1].trim()) {
        case '一': day = 1; break;
        case '二': day = 2; break;
        case '三': day = 3; break;
        case '四': day = 4; break;
        case '五': day = 5; break;
        case '六': day = 6; break;
        case '天': case '日': day = 7; break;
        default: day = 0; break;
      }
      if (day === 0) continue;

      const _regex_jieshu_ret = kksd.match(/(上午[1-9]\d*)|(下午[1-9]\d*)|(晚上[1-9]\d*)/g);
      if (!_regex_jieshu_ret || _regex_jieshu_ret.length === 0) continue;
      const jieshu = _regex_jieshu_ret.length;

      const _regex_jieci = /([1-9]\d*)/;
      const _regex_jieci_ret = _regex_jieci.exec(_regex_jieshu_ret[0]);
      if (!_regex_jieci_ret) continue;

      let jc = 0;
      if (_regex_jieshu_ret[0].indexOf('下午') !== -1) {
        jc = parseInt(_regex_jieci_ret[1]) + 5;
      } else if (_regex_jieshu_ret[0].indexOf('晚上') !== -1) {
        jc = parseInt(_regex_jieci_ret[1]) + 10;
      } else {
        jc = parseInt(_regex_jieci_ret[1]);
      }

      // 检查 courses 表中是否有这些课程，如果有则获得其课程号，没有就插入
      const course = new Course(kch, kxh, kcsx, xf, kcm);
      newCourses.push(course);

      const classroomObj = new Classroom('扬州大学', xiaoqu, jiaoshi);
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
      newSchedules.push(new Schedule(new Course(kch, kxh, kcsx), classroomObj, zc, day, jc, jieshu, jsm));
    }
    await this.dao.persistCourses(newCourses);
    await this.dao.persistSchedules(student, newSchedules);
    return true;
  }

}

module.exports = Crawler;
