'use strict';
/**
 * @authors iEdon (m [at] iedon.net)
 * @date    2018/12/27 01:18
 * @version V0.1.2
 */

/*
    iEdon UniPlex Project
    高校校园数据服务 2.0
        学生实体类
*/

// /classes/student.js

class Student {
  constructor(uid = null, sid = null, password = null, captcha = null) {
    this.uid = uid;
    this.sid = sid;
    this.password = password;
    this.session = null;
    this.captcha = captcha;
    this.needLogin = false;
  }
}

module.exports = Student;
