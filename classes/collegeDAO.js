'use strict';
/**
 * @authors iEdon (m [at] iedon.net)
 * @date    2018/9/30 22:08
 * @version V0.0.1
 */

/*
    iEdon UniPlex Project
    高校校园数据服务 2.0
        DAO
*/

// /classes/collegeDAO.js

class CollegeDAO {

  constructor(app, college) {
    this.app = app;
    this.college = college;
  }

  // (已弃用) 删除课表中已出成绩的课程，有必要(因为新学期开学的话，旧课表一定要清理，不然会叠加，这个操作不仅能解决已经出成绩的课程，还能为新学期课表做初始化)
  async deleteSchedulesHasScore(student, transactionObj = null) {
    const obj = transactionObj || this.college.db;
    return await obj.query('DELETE FROM `schedules` WHERE `sid` = ? AND (`cid`, `cindex`) IN (SELECT `cid`, `cindex` FROM `scores` WHERE `sid` = ?)', [ student.sid, student.sid ]);
  }

  // (已弃用) 性能过差，避免使用此方法暴力同步更新课表。删除课表中的所有课程(更新课表前有必要，以防以前的课表与现在冲突)
  async deleteAllSchedules(student, transactionObj = null) {
    const obj = transactionObj || this.college.db;
    return await obj.query('DELETE FROM `schedules` WHERE `sid` = ?', [ student.sid ]);
  }

  // (已弃用) 性能过差，避免使用此方法暴力同步更新成绩。删除此学生的所有成绩(更新成绩前有必要，因为有的科目后来可能退课删除了)
  async deleteAllScores(student, transactionObj = null) {
    const obj = transactionObj || this.college.db;
    return await obj.query('DELETE FROM `scores` WHERE `sid` = ?', [ student.sid ]);
  }

  /**
    * 持久化课程，需要在 persistScores 与 persistSchedules 前先调用一次
    * @param  {array}  newCourses Course 对象数组，用于存放课程对象信息
  */
  async persistCourses(newCourses) {
    await this.getDb().beginTransactionScope(async conn => {
      for (let i = 0; i < newCourses.length; i++) {
        await this.addCourse(newCourses[i], conn);
      }
    }, this.app.ctx);
  }

  /**
    * 比对成绩缓存和从教务获取的新数据，并智能持久化，使用前应该先调用 persistCourses 将与成绩有关的课程信息持久化
    * @param  {var}    student  学生实例
    * @param  {array}  newScores Score 对象数组，用于存放从教务网上获取的最新成绩
  */
  async persistScores(student, newScores) {
    let currentScores = null;
    await this.getDb().beginTransactionScope(async conn => {
      currentScores = await this.getAllScores(student, conn);
      // 遍历当前已有的成绩，然后找出是否有需要删除的。
      for (let i = 0; i < currentScores.length; i++) {
        let needDelete = true; // 检测已有的某些成绩是否需要删除的开关
        for (let j = 0; j < newScores.length; j++) {
          if (currentScores[i].cid === newScores[j].cid &&
              currentScores[i].cindex === newScores[j].cindex) {
            needDelete = false;
            break;
          }
        }
        if (needDelete === true) { // 说明成绩有需要删除的
          await this.deleteScore(student, currentScores[i], conn);
        }
      }
    }, this.app.ctx);

    await this.getDb().beginTransactionScope(async conn => {
      // 遍历新出的成绩，判断成绩是否需要添加，如有必要才添加。
      for (let i = 0; i < newScores.length; i++) {

        // 有时候应用层这里是空字符串而不是null，但是数据库中都是null，这里统一格式化以方便下面判断
        if (newScores[i].comment === '') newScores[i].comment = null;

        let foundSame = false; // 检测成绩是否有无变化的开关
        for (let j = 0; j < currentScores.length; j++) {
          if (currentScores[j].cid === newScores[i].cid &&
              currentScores[j].cindex === newScores[i].cindex &&
              currentScores[j].score === newScores[i].score &&
              currentScores[j].term === newScores[i].term &&
              currentScores[j].type === newScores[i].type &&
              currentScores[j].comment === newScores[i].comment) {
            foundSame = true;
            break;
          }
        }
        if (foundSame !== true) { // 说明成绩有变化或成绩不存在
          await this.addScore(newScores[i], conn);
        }
      }

    }, this.app.ctx);

  }

  /**
    * 比对成绩缓存和从教务获取的新数据，并智能持久化，使用前应该先调用 persistCourses 将与成绩有关的课程信息持久化
    * @param  {var}    student  学生实例
    * @param  {array}  newSchedules 课表实例数组，用于存放从教务网上获取的最新课表
  */
  async persistSchedules(student, newSchedules) {
    let currentSchedules = null;
    await this.getDb().beginTransactionScope(async conn => {
      currentSchedules = await this.getAllSchedules(student, conn);
      // 遍历当前已有的课表，然后找出是否有需要删除的。
      for (let i = 0; i < currentSchedules.length; i++) {
        let needDelete = true; // 检测已有的某些课表是否需要删除的开关
        for (let j = 0; j < newSchedules.length; j++) {
          if (currentSchedules[i].cid === newSchedules[j].cid &&
            currentSchedules[i].cindex === newSchedules[j].cindex &&
            currentSchedules[i].weeks === newSchedules[j].weeks &&
            currentSchedules[i].day === newSchedules[j].day &&
            currentSchedules[i].tid === newSchedules[j].tid &&
            currentSchedules[i].period === newSchedules[j].period) {
            needDelete = false;
            break;
          }
        }
        if (needDelete === true) { // 说明课表有需要删除的
          await this.deleteSchedule(student, currentSchedules[i], conn);
        }
      }
    }, this.app.ctx);

    await this.getDb().beginTransactionScope(async conn => {
      // 遍历新出的课表，判断课表是否需要添加，如有必要才添加。
      for (let i = 0; i < newSchedules.length; i++) {
        let foundSame = false; // 检测课表是否有无变化的开关
        for (let j = 0; j < currentSchedules.length; j++) {
          if (currentSchedules[j].cid === newSchedules[i].cid &&
              currentSchedules[j].cindex === newSchedules[i].cindex &&
              currentSchedules[j].weeks === newSchedules[i].weeks &&
              currentSchedules[j].day === newSchedules[i].day &&
              currentSchedules[j].tid === newSchedules[i].tid &&
              currentSchedules[j].period === newSchedules[i].period &&
              currentSchedules[j].type === newSchedules[i].type &&
              currentSchedules[j].teacher === newSchedules[i].teacher &&
              currentSchedules[j].rid === newSchedules[i].rid) {
            foundSame = true;
            break;
          }
        }
        if (foundSame !== true) { // 说明课表有变化或课表不存在
          await this.addSchedule(student, newSchedules[i], conn);
        }
      }

    }, this.app.ctx);

  }

  // 删除某学生某一项成绩
  async deleteScore(student, score, transactionObj = null) {
    const obj = transactionObj || this.college.db;
    return await obj.query('DELETE FROM `scores` WHERE `sid` = ? AND `cid` = ? AND `cindex` = ?', [ student.sid, score.cid, score.cindex ]);
  }

  // 删除某学生某一项课表
  async deleteSchedule(student, schedule, transactionObj = null) {
    const obj = transactionObj || this.college.db;
    return await obj.query('DELETE FROM `schedules` WHERE `sid` = ? AND `cid` = ? AND `cindex` = ? AND `weeks` = ? AND `day` = ? AND `tid` = ? AND `period` = ?', [ student.sid, schedule.cid, schedule.cindex, schedule.weeks, schedule.day, schedule.tid, schedule.period ]);
  }

  // 增加课程时间表(节次，起始时间，终至时间)(如果已有则更新)
  async addTimetable(timetable, transactionObj = null) {
    const obj = transactionObj || this.college.db;
    const ret = await obj.query('SELECT COUNT(1) AS `found` FROM `timetable` WHERE `tid` = ? AND `begin` = ? AND `end` = ? LIMIT 0, 1', [ timetable.count, timetable.from, timetable.to ]);
    if (ret && ret.length === 1 && ret[0] !== undefined && ret[0] !== null && ret[0].found !== undefined && ret[0].found !== null && ret[0].found === 1) { // 此记录已经存在，无需更改
      return { affectedRows: 0, insertId: 0 };
    }
    let opRet = null;
    const foundRet = await this.college.db.query('SELECT COUNT(1) AS `found` FROM `timetable` WHERE `tid` = ? LIMIT 0, 1', [ timetable.count ]);
    if (!foundRet || foundRet.length === 0 || foundRet[0].found === undefined || foundRet[0].found === null || foundRet[0].found === 0) {
      opRet = await obj.query('INSERT IGNORE INTO `timetable`(`tid`, `begin`, `end`, `date`) VALUES(?, ?, ?, now())',
        [
          /* INSERT 时用的 --> */ timetable.count, timetable.from, timetable.to,
        ]);
    } else {
      opRet = await obj.query('UPDATE `timetable` SET `begin` = ?, `end` = ? WHERE `tid` = ?',
        [ timetable.from, timetable.to, timetable.count ]
      );
    }
    return opRet;
  }

  // 向 classrooms 表添加教室(如果已有则更新)
  async addClassroom(classroom, transactionObj = null) {
    const obj = transactionObj || this.college.db;
    const ret = await obj.query('SELECT COUNT(1) AS `found` FROM `classrooms` WHERE `campus` = ? AND `building` = ? AND `room` = ? LIMIT 0, 1', [ classroom.campus, classroom.building, classroom.room ]);
    if (ret && ret.length === 1 && ret[0] !== undefined && ret[0] !== null && ret[0].found !== undefined && ret[0].found !== null && ret[0].found === 1) { // 此记录已经存在，无需更改
      return { affectedRows: 0, insertId: 0 };
    }
    return await obj.query('INSERT IGNORE INTO `classrooms`(`campus`, `building`, `room`, `date`) VALUES(?, ?, ?, now())', [ classroom.campus, classroom.building, classroom.room ]);
  }

  // 获取 classroom 的主键 rid
  async getRidByClassroom(classroom, transactionObj = null) {
    const obj = transactionObj || this.college.db;
    return await obj.query('SELECT `rid` FROM `classrooms` WHERE `campus` = ? AND `building` = ? AND `room` = ? LIMIT 0, 1', [ classroom.campus, classroom.building, classroom.room ]);
  }

  // 增加课程表(如果已有则更新)
  async addSchedule(student, schedule, transactionObj = null) {
    const obj = transactionObj || this.college.db;
    let opRet = null;
    const foundRet = await this.college.db.query('SELECT COUNT(1) AS `found` FROM `schedules` WHERE `sid` = ? AND `cid` = ? AND `cindex` = ? AND `weeks` = ? AND `day` = ? AND `tid` = ? AND `period` = ? LIMIT 0, 1', [ student.sid, schedule.cid, schedule.cindex, schedule.weeks, schedule.day, schedule.tid, schedule.period ]);
    if (!foundRet || foundRet.length === 0 || foundRet[0].found === undefined || foundRet[0].found === null || foundRet[0].found === 0) {
      opRet = await obj.query('INSERT IGNORE INTO `schedules`(`sid`, `cid`, `cindex`, `type`, `teacher`, `weeks`, `day`, `tid`, `period`, `rid`, `date`) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())',
        [
          /* INSERT 时用的 --> */ student.sid, schedule.cid, schedule.cindex, schedule.type, schedule.teacher, schedule.weeks, schedule.day, schedule.tid, schedule.period, schedule.rid,
        ]);
    } else {
      opRet = await obj.query('UPDATE `schedules` SET `type` = ?, `teacher` = ?, `rid` = ? WHERE `sid` = ? AND `cid` = ? AND `cindex` = ? AND `weeks` = ? AND `day` = ? AND `tid` = ? AND `period` = ?',
        [ schedule.type, schedule.teacher, schedule.rid, student.sid, schedule.cid, schedule.cindex, schedule.weeks, schedule.day, schedule.tid, schedule.period ]
      );
    }
    return opRet;
  }

  // 增加课程(如果已有则更新)
  async addCourse(course, transactionObj = null) {
    const obj = transactionObj || this.college.db;
    const ret = await obj.query('SELECT COUNT(1) AS `found` FROM `courses` WHERE `cid` = ? AND `credit` = ? AND `name` = ? LIMIT 0, 1', [ course.cid, course.credit, course.name ]);
    if (ret && ret.length === 1 && ret[0] !== undefined && ret[0] !== null && ret[0].found !== undefined && ret[0].found !== null && ret[0].found === 1) { // 此记录已经存在，无需更改
      return { affectedRows: 0, insertId: 0 };
    }
    let opRet = null;
    const foundRet = await this.college.db.query('SELECT COUNT(1) AS `found` FROM `courses` WHERE `cid` = ? LIMIT 0, 1', [ course.cid ]);
    if (!foundRet || foundRet.length === 0 || foundRet[0].found === undefined || foundRet[0].found === null || foundRet[0].found === 0) {
      opRet = await obj.query('INSERT IGNORE INTO `courses`(`cid`, `name`, `credit`, `date`) VALUES(?, ?, ?, now())',
        [ /* INSERT 时用的 --> */ course.cid, course.name, course.credit,
        ]);
    } else {
      opRet = await obj.query('UPDATE `courses` SET `name` = ?, `credit` = ? WHERE `cid` = ?', [ course.name, course.credit, course.cid ]);
    }
    return opRet;
  }

  // 查询课程 Cid，存在返回 cid，不存在为 null
  async getCourseId(course, transactionObj = null) {
    const obj = transactionObj || this.college.db;
    const ret = await obj.query('SELECT `cid` FROM `courses` WHERE `name` = ? AND `credit` = ? LIMIT 0, 1', [ course.name, course.credit ]);
    if (ret.length === 0) return null;
    course.cid = ret[0].cid;
    return ret[0].cid;
  }

  // 增加成绩(如果已有则更新)
  async addScore(score, transactionObj = null) {
    if (!score.cindex || score.cindex === undefined || score.cindex === null || score.cindex.length === 0) { score.cindex = ''; }
    if (score.comment !== null && score.comment.length === 0) { score.comment = null; }
    if (score.score !== null && score.score.length === 0) { score.score = null; }
    const obj = transactionObj || this.college.db;
    let opRet = null;
    const foundRet = await this.college.db.query('SELECT COUNT(1) AS `found` FROM `scores` WHERE `sid` = ? AND `cid` = ? AND `cindex` = ? LIMIT 0, 1', [ score.sid, score.cid, score.cindex ]);
    if (!foundRet || foundRet.length === 0 || foundRet[0].found === undefined || foundRet[0].found === null || foundRet[0].found === 0) {
      opRet = await obj.query('INSERT IGNORE INTO `scores`(`sid`, `cid`, `cindex`, `score`, `term`, `type`, `comment`, `date`) VALUES(?, ?, ?, ?, ?, ?, ?, now())',
        [
          /* INSERT 时用的 --> */ score.sid, score.cid, score.cindex, score.score, score.term, score.type, score.comment,
        ]);
    } else {
      opRet = await obj.query('UPDATE `scores` SET `score` = ?, `term` = ?, `type` = ?, `comment` = ? WHERE `sid` = ? AND `cid` = ? AND `cindex` = ?',
        [
          score.score, score.term, score.type, score.comment, score.sid, score.cid, score.cindex,
        ]);
    }
    return opRet;
  }

  // 获取数据库中学生已记录的所有成绩
  async getAllScores(student, transactionObj = null) {
    const obj = transactionObj || this.college.db;
    const ret = await obj.query('SELECT `cid`, `cindex`, `score`, `term`, `type`, `comment` FROM `scores` WHERE `sid` = ?', [ student.sid ]);
    if (!ret || ret.length === 0) return [];
    return ret;
  }

  // 获取数据库中学生已记录的所有成绩
  async getAllSchedules(student, transactionObj = null) {
    const obj = transactionObj || this.college.db;
    const ret = await obj.query('SELECT `cid`, `cindex`, `type`, `teacher`, `weeks`, `day`, `tid`, `period`, `rid` FROM `schedules` WHERE `sid` = ?', [ student.sid ]);
    if (!ret || ret.length === 0) return [];
    return ret;
  }

  // 增加学生(如果已有则更新)
  async addStudent(student, name, sex, year, faculty, major, _class, identity) {
    const encryptedPassword = this.app.encryptData(this.app, student.password);
    const encryptedIdentity = this.app.encryptData(this.app, identity);
    const ret = await this.college.db.query('SELECT COUNT(1) AS `found` FROM `students` WHERE `sid` = ? AND `password` = ? AND `name` = ? AND `sex` = ? AND `year` = ? AND `faculty` = ? AND `major` = ? AND `class` = ? AND `sfz` = ? LIMIT 0, 1', [ student.sid, encryptedPassword, name, sex, year, faculty, major, _class, encryptedIdentity ]);
    if (ret && ret.length === 1 && ret[0] !== undefined && ret[0] !== null && ret[0].found !== undefined && ret[0].found !== null && ret[0].found === 1) { // 此记录已经存在，无需更改
      return { affectedRows: 0, insertId: 0 };
    }
    let opRet = null;
    const foundRet = await this.college.db.query('SELECT COUNT(1) AS `found` FROM `students` WHERE `sid` = ? LIMIT 0, 1', [ student.sid ]);
    if (!foundRet || foundRet.length === 0 || foundRet[0].found === undefined || foundRet[0].found === null || foundRet[0].found === 0) {
      opRet = await this.college.db.query('INSERT IGNORE INTO `students`(`sid`, `password`, `name`, `sex`, `year`, `faculty`, `major`, `class`, `sfz`, `date`) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, now())',
        [
          /* INSERT 时用的 --> */ student.sid, encryptedPassword, name, sex, year, faculty, major, _class, encryptedIdentity,
        ]);
    } else {
      opRet = await this.college.db.query('UPDATE `students` SET `password` = ?, `name` = ?, `sex` = ?, `year` = ?, `faculty` = ?, `major` = ?, `class` = ?, `sfz` = ? WHERE `sid` = ?',
        [ encryptedPassword, name, sex, year, faculty, major, _class, encryptedIdentity, student.sid ]
      );
    }
    return opRet;
  }

  // 通过UID取得教务系统Session
  async getSession(uid) {
    return await this.college.db.query('SELECT `session` FROM `sessions` WHERE `uid` = ? LIMIT 0, 1', [ uid ]);
  }

  // 增加教务系统Session(如果已有则更新)
  async setSession(uid, value) {
    let opRet = null;
    const foundRet = await this.college.db.query('SELECT COUNT(1) AS `found` FROM `sessions` WHERE `uid` = ? LIMIT 0, 1', [ uid ]);
    if (!foundRet || foundRet.length === 0 || foundRet[0].found === undefined || foundRet[0].found === null || foundRet[0].found === 0) {
      opRet = await this.college.db.query('INSERT IGNORE INTO `sessions`(`uid`, `session`, `date`) VALUES(?, ?, now())', [ uid, value ]);
    } else {
      opRet = await this.college.db.query('UPDATE `sessions` SET `session` = ? WHERE `uid` = ?',
        [ value, uid ]
      );
    }
    return opRet;
  }

  // 得到数据库实例，方便在爬虫内使用事务
  getDb() {
    return this.college.db;
  }

}

module.exports = CollegeDAO;
