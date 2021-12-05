'use strict';
/**
 * @authors iEdon (m [at] iedon.net)
 * @date    2018/12/27 17:25
 * @version V0.1.2
 */

/*
    iEdon UniPlex Project
    高校校园数据服务 2.0
        课程实体类
*/

// /classes/schedule.js

class Schedule {
  constructor(course, classroom, weeks, day, tid, period, teacher = null) {
    this.cid = course.cid;
    this.cindex = course.cindex || '';
    this.type = course.type || '';
    this.weeks = weeks;
    this.day = day;
    this.tid = parseInt(tid);
    this.period = parseInt(period);
    this.teacher = teacher;
    this.rid = classroom.rid || null;
  }
}

module.exports = Schedule;
