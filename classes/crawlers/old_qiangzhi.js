'use strict';
/**
 * @authors iEdon (m [at] iedon.net)
 * @date    2019/6/23 04:12
 * @version V0.0.1
 */

/*
    iEdon UniPlex Project
    高校校园数据服务 2.0
     老版强智教务系统爬虫实现
*/

// /classes/crawlers/old_qiangzhi.js

const BaseCrawler = require('../basecrawler');
const Classroom = require('../classroom');
const Course = require('../course');
const Score = require('../score');
const Schedule = require('../schedule');

const querystring = require('querystring');
const cheerio = require('cheerio');
const { v1: uuid } = require('uuid');
const _BASE62_ = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const bs62 = require('base-x')(_BASE62_);

// 教务系统常用参数
const VAR_JW_PATH = {
  // 登录
  login: '/Logon.do?method=logon',
  // 登出
  logout: '/Logon.do?method=logout',
  // 验证码图像
  captcha: '/verifycode.servlet',
  // 学籍信息
  profile: '/xszhxxAction.do?method=addStudentPic',
  // 获取成绩
  getGrades: '/xszqcjglAction.do?method=queryxscj',
  // 获取本学期课表当前学期
  getScheduleTerm: '/tkglAction.do?method=kbxxXs',
  // 获取本学期课程表
  getSchedule: '/jiaowu/pkgl/llsykb/llsykb_list.jsp?isview=0&type=xs0101&printPageSize=5000',
  // <title> 为 出错页面 代表需要登录
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
      let cookie = null;
      if (cookie_ret.headers['set-cookie']) { cookie = cookie_ret.headers['set-cookie'].join().split(';')[0].trim(); }
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

    // 提交登录信息
    const postJson = {
      dlfl: 0,
      USERNAME: student.sid,
      PASSWORD: student.password,
      useDogCode: '',
    };
    if (college.userInputCaptcha) { postJson.RANDOMCODE = student.captcha; }
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
      result = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.login}`, options, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 登录学生失败，网络错误: ${err}`);
      return;
    }

    // 解析文档，获取登录结果或是错误信息
    const $ = cheerio.load(result.data);
    const title = $('script').html();
    const successText = 'main.jsp';
    if (title.indexOf(successText) !== -1) {
      student.session = session;
      return;
    }

    const err = $('#errorinfo').text();
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
      app.fetch(app, `${college.system_url}${VAR_JW_PATH.logout}`, { headers: { Cookie: student.session } }, college.user_agent);
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
      result = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.profile}`, { headers: { Cookie: cookie } }, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 获取资料失败，网络错误: ${err}`);
      return false;
    }
    const $ = cheerio.load(result.data);

    // 判断是否需要用户登录(即用户可能已登录过期)
    const title = $('title').text().trim();
    const needRelogin = (title.indexOf('出错页面') !== -1);
    if (needRelogin) {
      student.needLogin = needRelogin;
      return false;
    }

    const name = $('input[name="xm"]').val().trim();
    const sfz = $('form div table.xtable tr:nth-child(2) td:nth-child(4)').text().trim();
    let sex = $('form div table.xtable tr:nth-child(1) td:nth-child(6)').text().trim();
    if (name.length === 0) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 获取资料失败！`);
      return false;
    }

    const _text = $('form div table tbody tr:nth-child(2) td:nth-child(1)[align="center"]').text().trim();
    const infos = _text.split('\n');
    if (!infos || infos.length !== 4) { return false; }
    const infoArr = [];
    for (let i = 0; i < 4; i++) {
      const val = infos[i].split('：');
      if (!val || val.length !== 2) { return false; }
      infoArr.push(val[1].trim());
    }

    sex = ((sex === '男' ? 0 : (sex === '女' ? 1 : 2))); // 0: 男，1: 女 ，2: 人妖
    const year = '';
    const bj = infoArr[3];
    const faculty = infoArr[0];
    const major = infoArr[1];

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
      result = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.getGrades}`, { headers: { Cookie: cookie } }, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新成绩失败，网络错误: ${err}`);
      return false;
    }
    let $ = cheerio.load(result.data);

    // ======================================= 判断是否需要用户登录(即用户可能已登录过期) ================================================
    const title = $('title').text().trim();
    const needRelogin = (title.indexOf('出错页面') !== -1); // 出现这个也代表可能需要重新登录
    if (needRelogin) {
      student.needLogin = needRelogin;
      return false;
    }
    // ===============================================================================================================================

    const newCourses = []; // 存放与成绩有关的课程
    const newScores = []; // 存放爬取到的成绩

    // 成绩有多页，分页获取成绩
    const _pagesObj = $('input[name="txtpage"]').val();
    let pages = 1;
    if (_pagesObj) {
      pages = parseInt(_pagesObj.split('/')[1]);
    }
    if (isNaN(pages)) pages = 1;
    for (let p = 0; p < pages; p++) {
      if (p !== 0) {
        // 获取成绩信息页面
        let result = null;
        try {
          result = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.getGrades}&PageNum=${p + 1}`, { headers: { Cookie: cookie } }, college.user_agent);
        } catch (err) {
          app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新成绩失败，网络错误: ${err}`);
          return false;
        }
        $ = cheerio.load(result.data);
      }
      // 处理成绩信息
      const trs = $('#mxh tr').toArray();
      for (let i = 0; i < trs.length; i++) {
        const e = trs[i];
        let kch = ''; // 课程号
        const kxh = ''; // 课序号（此爬虫实现不需要）
        const kcm = $('td:nth-child(6)', e).text().trim(); // 课程名
        const xf = $('td:nth-child(12)', e).text().trim(); // 学分
        const kcsx = $('td:nth-child(10)', e).text().trim(); // 课程属性(类型)
        let term = $('td:nth-child(5)', e).text().trim(); // 学期
        const bcx_term = $('td:nth-child(14)', e).text().trim(); // 补重修学期
        if (bcx_term.length !== 0) term = bcx_term;

        if (kcm.length === 0 || xf.length === 0) {
          app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新成绩失败(课名/学分为空)`);
          return false;
        }

        // 检查 courses 表中是否有这些课程，如果有则获得其课程号，没有就插入
        const course = new Course(kch, kxh, kcsx, xf, kcm);
        let cid = await this.dao.getCourseId(course);
        if (!cid) {
          const buf = Buffer.alloc(16);
          const _uuid = uuid(null, buf); // UUID 生成的二进制是16字节
          const _encoded = bs62.encode(_uuid);
          cid = `${p}-${i}-${_encoded}`;
          course.cid = cid;
          newCourses.push(course);
        }
        course.cid = cid;
        kch = cid;

        const cj = $('td:nth-child(7)', e).text().trim(); // 成绩
        newScores.push(new Score(student, course, cj, term));
      }
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

    // 获取课表当前周次
    let result = null;
    try {
      result = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.getScheduleTerm}`, { headers: { Cookie: cookie } }, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新课表失败，网络错误: ${err}`);
      return false;
    }
    let $ = cheerio.load(result.data);
    const currentTerm = $('select[name="xnxqh"] option:selected').text().trim();

    // 获取课表信息页面
    result = null;
    try {
      result = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.getSchedule}&xnxq01id=${currentTerm}&xs0101id=${student.sid}`, { headers: { Cookie: cookie } }, college.user_agent);
    } catch (err) {
      app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新课表失败，网络错误: ${err}`);
      return false;
    }
    $ = cheerio.load(result.data);

    // ======================================= 判断是否需要用户登录(即用户可能已登录过期) ================================================
    const title = $('title').text().trim();
    const needRelogin = (title.indexOf('出错页面') !== -1); // 出现这个也代表可能需要重新登录
    if (needRelogin) {
      student.needLogin = needRelogin;
      return false;
    }
    // ===============================================================================================================================

    const newCourses = [];
    const newSchedules = [];
    // 课表有多页，分页获取课表
    const _pagesObj = $('input[name="txtpage"]').val();
    let pages = 1;
    if (_pagesObj) {
      pages = parseInt(_pagesObj.split('/')[1]);
    }
    if (isNaN(pages)) pages = 1;
    for (let p = 0; p < pages; p++) {
      if (p !== 0) {
        // 获取成绩信息页面
        let result = null;
        try {
          result = await app.fetch(app, `${college.system_url}${VAR_JW_PATH.getSchedule}&xnxq01id=${currentTerm}&xs0101id=${student.sid}&PageNum=${p + 1}`, { headers: { Cookie: cookie } }, college.user_agent);
        } catch (err) {
          app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新成绩失败，网络错误: ${err}`);
          return false;
        }
        $ = cheerio.load(result.data);
      }
      const trs = $('#mxhDiv table:nth-child(1) tr').toArray();
      for (let i = 0; i < trs.length; i++) {
        const e = trs[i];

        let kch = null;
        let kxh = null;
        let kcm = null;
        let xf = null;
        let jsm = null;
        let kcsx = null;

        kch = ''; // 课程号 此爬虫不需要，直接赋予空白串
        kxh = ''; // 课序号 此爬虫不需要，直接赋予空白串
        kcm = $('td:nth-child(5)', e).text().trim(); // 课程名
        xf = ''; // 学分 此爬虫不需要，直接赋予空白串
        kcsx = ''; // 课程属性(类型) 此爬虫不需要，直接赋予空白串
        jsm = $('td:nth-child(6)', e).text().trim(); // 教师名字

        if (kcm.length === 0) {
          app.logger.error(`[${college.name}] 院校ID: ${college.id}, 学号: ${student.sid} - 更新课表失败(课名为空)`);
          continue;
        }

        // 上课周次
        let zc = $('td:nth-child(10)', e).text().trim()
          .replace('周', '')
          .replace('上', '');
        const dsz = $('td:nth-child(11)', e).text().trim();
        if (dsz.indexOf('单') !== -1 && dsz.indexOf('双') === -1) zc = `${zc} 单周`;
        if (dsz.indexOf('双') !== -1 && dsz.indexOf('单') === -1) zc = `${zc} 双周`;

        // 星期
        const xq = $('td:nth-child(8)', e).text().trim()
          .substring(0, 1);

        const jc = parseInt($('td:nth-child(8)', e).text().trim()
          .substring(1, 3)); // 节次(开始上课节次)
        const jc_end = parseInt($('td:nth-child(8)', e).text().trim()
          .substring(3)); // 结束上课节次

        const xiaoqu = ''; // 校区 此爬虫不需要，直接赋予空白串
        const jxl = ''; // 教学楼 此爬虫不需要，直接赋予空白串
        let jiaoshi = $('td:nth-child(9)', e).text().trim(); // 教室

        if (zc.length === 0 || xq.length === 0 || isNaN(jc) || isNaN(jc_end)) { continue; } // 跳过
        const jieshu = jc_end - jc + 1; // 节数

        // 检查 courses 表中是否有这些课程，如果有则获得其课程号，没有就插入
        const course = new Course(kch, kxh, kcsx, xf, kcm);
        let cid = await this.dao.getCourseId(course);
        if (!cid) {
          const buf = Buffer.alloc(16);
          const _uuid = uuid(null, buf); // UUID 生成的二进制是16字节
          const _encoded = bs62.encode(_uuid);
          cid = `S${i}-${_encoded}`;
          course.cid = cid;
          newCourses.push(course);
        }
        course.cid = cid;
        kch = cid;

        if (jiaoshi.length === 0) jiaoshi = '未知';
        jiaoshi = jiaoshi.replace('第', '')
          .replace('学楼', '');

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
        newSchedules.push(new Schedule(course, classroomObj, zc, xq, jc, jieshu, jsm));
      }
    }
    await this.dao.persistCourses(newCourses);
    await this.dao.persistSchedules(student, newSchedules);
    return true;
  }

}

module.exports = Crawler;
