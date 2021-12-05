'use strict';
/**
 * @authors iEdon (m [at] iedon.net)
 * @date    2018/9/30 22:08
 * @version V0.0.1
 */

/*
    iEdon UniPlex Project
    高校校园数据服务 2.0
        爬虫基类
*/

// /classes/basecrawler.js

const collegeDAO = require('./collegeDAO');

class BaseCrawler {

  constructor(app, college) {
    this.app = app;
    this.college = college;
    this.dao = new collegeDAO(app, college);
  }

  /**
      * 取用户缓存的 session。
      * @param  {var}    uid         用户ID
      * @return {string}             失败返回null。若成功，返回主数据库 sessions 表中缓存的 session，空值情况下也为 null。
  */
  async getCachedSession(uid) {
    const college = this.college;
    if (!college.userInputCaptcha) { return null; }
    // 从数据库获取 Cookie
    let session = null;
    if (college.userInputCaptcha) {
      const sessRet = await this.dao.getSession(uid);
      if (sessRet.length !== 0 && sessRet[0].session) {
        session = sessRet[0].session;
      }
    }
    return session;
  }

  /**
    * 更新学生所有信息
    * @param  {var}    student  学生实例
    * @return {boolean} 操作结果布尔值
  */
  async update(student) { this.app.logger.error(`UID(${student.uid}), 学生ID(${student.sid}) - 警告：未实现 update()`); }

  /**
    * 更新成绩，同时会更新 courses 表
    * @param  {var}    student  学生实例
    * @return {boolean} 操作结果布尔值
  */
  async updateScore(student) { this.app.logger.error(`UID(${student.uid}), 学生ID(${student.sid}) - 警告：未实现 updateScore()`); }

  /**
    * 更新本学期课程表，同时会更新 courses 表，classrooms 表
    * @param  {var}    student  学生实例
    * @return {boolean} 操作结果布尔值
  */
  async updateSchedule(student) { this.app.logger.error(`UID(${student.uid}), 学生ID(${student.sid}) - 警告：未实现 updateSchedule()`); }

  /**
    * 取验证码
    * @param  {var}    uid  用户ID
    * @return {string}      失败返回false。若成功，session 将写入 主数据库 sessions 表。
  */
  async getCaptcha(uid) { this.app.logger.error(`UID(${uid}), - 警告：未实现 getCaptcha()`); }

}

module.exports = BaseCrawler;
