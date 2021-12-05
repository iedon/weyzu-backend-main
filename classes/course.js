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

// /classes/course.js

class Course {
  // 注意这里的 type 字段并不在 course 表中，而是在 scores 表中。放在这里是为了方便数据交换(构建 Score 类需要传递一个 Course 对象)。
  constructor(cid = '', cindex = '', type = '', credit = '', name = '') {
    this.cid = cid;
    this.cindex = cindex;
    this.type = type;
    const creditFormat = parseFloat(credit); // 用于统一学分格式 (比如 3.0 会被统一成 3)
    if (isNaN(creditFormat)) {
      this.credit = '';
    } else {
      this.credit = creditFormat.toString();
    }
    this.name = name;
  }
}

module.exports = Course;
