'use strict';
/**
 * @authors iEdon (m [at] iedon.net)
 * @date    2019/9/21 02:47
 * @version V0.0.1
 */

/*
    iEdon UniPlex Project
    高校校园数据服务 2.0
    新版正方教务系统爬虫实现
*/

// /classes/crawlers/zf_hnsw.js

const BaseCrawler = require('../basecrawler');
const Classroom = require('../classroom');
const Course = require('../course');
const Score = require('../score');
const Schedule = require('../schedule');

const querystring = require('querystring');
const cheerio = require('cheerio');
const NodeRSA = require('node-rsa');

// 教务系统常用参数
const VAR_JW_PATH = {
  // 获得加密公钥
  getEncryptKey: '/jwglxt/xtgl/login_getPublicKey.html?time=',
  // 登录
  login: '/jwglxt/xtgl/login_slogin.html',
  // 登出
  logout: '/jwglxt/logout?login_type=&t=',
  // 验证码图像
  captcha: '',
  // 学籍信息
  profile: '/jwglxt/xsxxxggl/xsgrxxwh_cxXsgrxx.html?gnmkdm=N100801&layout=default&su=',
  // 获取成绩
  getGrades: '/jwglxt/cjcx/cjcx_cxDgXscj.html?doType=query&gnmkdm=N100801&su=',
  // 获取本学期课程表
  getSchedule: '/jwglxt/xsxxxggl/xsxxwh_cxXsxkxx.html?gnmkdm=N100801&su=',
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
        cookie_ret = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.login}`, null, college.user_agent);
      } catch (err) {
        app.logger.error(`[${college.name}] 院校ID: ${college.id}, UID: ${uid} - 获取教务 Session 失败(获取 Session 方法)，网络错误: ${err}`);
        return null;
      }
      // 从 HTTP Header 中获取新 session 并将新 Session 更新到数据库
      let cookie = '';
      if (cookie_ret.headers['set-cookie']) {
        cookie_ret.headers['set-cookie'].forEach(e => {
          cookie = cookie + e.split(';')[0].trim() + ';';
        });
      }
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
      const captcha_ret = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.captcha}`, { headers: { Cookie: cookie } }, college.user_agent);
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

    let csrfTokenReq = null;
    try {
      csrfTokenReq = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.login}`, { headers: { Cookie: session } }, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 登录学生失败(CSRF)，网络错误: ${err}`);
      return;
    }
    // 解析CSRF
    const _$ = cheerio.load(csrfTokenReq.data);
    const token = _$('#csrftoken').val();
    const mmsfjm = (_$('#mmsfjm').val() === '1');
    if (!token) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 登录学生失败(CSRF)，csrf token 获取失败 `);
      return;
    }

    let modulus = null;
    let exponent = null;
    let encryptKeyReq = null;
    if (mmsfjm) {
      try {
        encryptKeyReq = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.getEncryptKey}${new Date().getTime() - 150}`, { headers: { Cookie: session } }, college.user_agent);
      } catch (err) {
        app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 登录学生失败(Key)，网络错误: ${err}`);
        return;
      }
    }

    const encryptKey = JSON.parse(encryptKeyReq.data.toString());
    if (!encryptKey.modulus || !encryptKey.exponent) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 登录学生失败(CSRF)，加密参数获取失败`);
      return;
    }

    modulus = encryptKey.modulus;
    exponent = encryptKey.exponent;
    let mima = student.password;
    if (mmsfjm) {
      const key = new NodeRSA();
      key.setOptions({ encryptionScheme: 'pkcs1' }); // (此处是重点关注对象，如果多端加解密对应不上，请修改此处，更多细节参考node-rsa文档 )
      key.importKey({
        n: Buffer.from(modulus, 'base64'),
        e: Buffer.from(exponent, 'base64'),
      }, 'components-public');
      mima = key.encrypt(student.password, 'base64');
    }

    // 提交登录信息
    const postJson = {
      yhm: student.sid,
      csrftoken: token,
      mm: mima,
    };
    if (college.userInputCaptcha) { postJson.RANDOMCODE = student.captcha; }
    const postData = querystring.stringify(postJson) + '&mm=' + mima;
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
      result = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.login}?time=${new Date().getTime()}`, options, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 登录学生失败，网络错误: ${err}`);
      return;
    }

    // 解析文档，获取登录结果或是错误信息
    const $ = cheerio.load(result.data);
    const tips = $('#tips').text().trim();
    if (tips.length === 0) {
      student.session = session;
      return;
    }

    const err = tips;
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
      app.fetch(app, `${college.system_url}${VAR_JW_PATH.logout}${new Date().getTime()}`, { headers: { Cookie: student.session } }, college.user_agent);
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
      result = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.profile}${student.sid}`, { headers: { Cookie: cookie } }, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 获取资料失败，网络错误: ${err}`);
      return false;
    }
    const $ = cheerio.load(result.data);

    const name = $('#col_xm').text().trim();
    const sfz = $('#col_zjhm').text().trim();
    let sex = $('#col_xbm').text().trim();
    if (name.length === 0) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 获取资料失败！`);
      return false;
    }

    sex = ((sex === '男' ? 0 : (sex === '女' ? 1 : 2))); // 0: 男，1: 女 ，2: 人妖
    const year = $('#col_rxrq').text().trim();
    const bj = $('#col_bh_id').text().trim();
    const faculty = $('#col_jg_id').text().trim();
    const major = $('#col_zyh_id').text().trim();

    try {
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

    // 获取成绩信息页面
    let result = null;
    try {
      const options = {
        method: 'POST',
        data: {
          xh_id: student.sid,
          xnm: '',
          xqm: '',
          _search: false,
          nd: new Date().getTime(),
          'queryModel.showCount': 5000,
          'queryModel.currentPage': 1,
          'queryModel.sortName': '',
          'queryModel.sortOrder': 'asc',
          time: 0,
        },
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      };

      result = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.getGrades}${student.sid}`, options, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新成绩失败，网络错误: ${err}`);
      return false;
    }
    const data = JSON.parse(result.data.toString());

    // ======================================= 判断是否需要用户登录(即用户可能已登录过期) ================================================
    const needRelogin = (!data || data.items === undefined); // 出现这个也代表可能需要重新登录
    if (needRelogin) {
      student.needLogin = needRelogin;
      return false;
    }
    // ===============================================================================================================================

    const newCourses = []; // 存放与成绩有关的课程
    const newScores = []; // 存放爬取到的成绩

    for (let i = 0; i < data.items.length; i++) {
      const kch = data.items[i].kch; // 课程号
      const kxh = ''; // 课序号（此爬虫实现不需要）
      const kcm = data.items[i].kcmc; // 课程名
      const xf = data.items[i].xf; // 学分
      const kcsx = data.items[i].kcxzmc; // 课程属性(类型)
      let term = data.items[i].xnmmc; // 学期
      if (data.items[i].xqmmc) term = term + '-' + data.items[i].xqmmc;

      if (kcm.length === 0 || xf.length === 0) {
        app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新成绩失败(课名/学分为空)`);
        return false;
      }

      // 检查 courses 表中是否有这些课程，如果有则获得其课程号，没有就插入
      const course = new Course(kch, kxh, kcsx, xf, kcm);
      newCourses.push(course);

      const cj = data.items[i].cj; // 成绩
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

    // 获取成绩信息页面
    let result = null;
    try {
      const options = {
        method: 'POST',
        data: {
          xh_id: student.sid,
          xnm: '',
          xqm: '',
          _search: false,
          nd: new Date().getTime(),
          'queryModel.showCount': 5000,
          'queryModel.currentPage': 1,
          'queryModel.sortName': '',
          'queryModel.sortOrder': 'asc',
          time: 0,
        },
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      };

      result = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.getSchedule}${student.sid}`, options, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新课表失败，网络错误: ${err}`);
      return false;
    }
    const data = JSON.parse(result.data.toString());

    // ======================================= 判断是否需要用户登录(即用户可能已登录过期) ================================================
    const needRelogin = (!data || data.items === undefined); // 出现这个也代表可能需要重新登录
    if (needRelogin) {
      student.needLogin = needRelogin;
      return false;
    }
    // ===============================================================================================================================

    const newCourses = [];
    const newSchedules = [];

    // 第一步: 获得当前学年
    let currentStartYear = 0;
    let index = 0;
    for (let i = 0; i < data.items.length; i++) {
      const xnmc = data.items[i].xnmc;
      if (!xnmc) continue;
      const arr = xnmc.split('-');
      if (arr.length !== 2) continue;
      if (currentStartYear < arr[0]) currentStartYear = arr[0];
      index = i;
    }
    const currentYearRange = data.items[index].xnmc;

    // 第二步：获取学期
    let currentTerm = 0;
    for (let i = 0; i < data.items.length; i++) {
      const xnmc = data.items[i].xnmc;
      const xqmmc = data.items[i].xqmmc;
      if (!xnmc || !xqmmc) continue;
      if (xnmc !== currentYearRange) continue;
      if (currentTerm < xqmmc) currentTerm = xqmmc;
    }

    // 第三步：获取课表信息
    for (let i = 0; i < data.items.length; i++) {
      if (data.items[i].xnmc !== currentYearRange || data.items[i].xqmmc !== currentTerm) continue;

      const kch = data.items[i].kch; // 课程号
      const kxh = ''; // 课序号 此爬虫不需要，直接赋予空白串
      const kcm = data.items[i].kcmc; // 课程名
      const xf = data.items[i].xf; // 学分
      const kcsx = data.items[i].kclbmc; // 课程属性(类型)
      const jsm = data.items[i].jsxm; // 教师名字

      if (kch === undefined || !kcm || xf === undefined) {
        app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新课表失败(必要属性为空)`);
        continue;
      }

      const zc = data.items[i].sksj;
      const jiaoshi = data.items[i].jxdd;
      if (!zc || !jiaoshi) continue;
      const jsArr = jiaoshi.split(';');
      const zcArr = zc.split(';');
      const _regex = /星期(.)第(.*)节\{(.*)\}/;
      if (jsArr.length !== zcArr.length) continue;

      for (let i = 0; i < zcArr.length; i++) {
        const ret = _regex.exec(zcArr[i]);
        if (!ret || ret.length !== 4) continue;

        let day = 0;
        switch (ret[1].trim()) {
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

        const jcArr = ret[2].trim().split('-');
        if (jcArr.length !== 2) continue;

        const jc = jcArr[0];
        const jieshu = jcArr[1] - jc + 1;
        let classroomName = jsArr[i];
        const zc = ret[3].trim().replace('周', '')
          .replace('(', ' ')
          .replace(')', '');

        // 检查 courses 表中是否有这些课程，如果有则获得其课程号，没有就插入
        const course = new Course(kch, kxh, kcsx, xf, kcm);
        newCourses.push(course);

        // 检查 classrooms 表中是否有这个教室，如果没有就插入，如果有则找出它的ID。
        if (!classroomName || classroomName.length === 0) classroomName = '未知';
        const classroomObj = new Classroom('主校区', '', classroomName);
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
        newSchedules.push(new Schedule(course, classroomObj, zc, day, jc, jieshu, jsm));
      }
    }
    await this.dao.persistCourses(newCourses);
    await this.dao.persistSchedules(student, newSchedules);
    return true;
  }

}

module.exports = Crawler;
