'use strict';
/**
 * @authors iEdon (m [at] iedon.net)
 * @date    2018/12/27 17:25
 * @version V0.1.2
 */

/*
    iEdon UniPlex Project
    高校校园数据服务 2.0
        成绩实体类
*/

// /classes/score.js

class Score {
  constructor(student, course, score = null, term = '0', comment = null) {
    this.sid = student.sid;
    this.cid = course.cid;
    this.cindex = course.cindex;
    this.type = course.type;
    this.score = score;
    this.term = term;
    this.comment = comment;
  }
}

module.exports = Score;
