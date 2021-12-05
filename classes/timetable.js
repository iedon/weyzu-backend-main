'use strict';
/**
 * @authors iEdon (m [at] iedon.net)
 * @date    2018/12/27 01:18
 * @version V0.1.2
 */

/*
    iEdon UniPlex Project
    高校校园数据服务 2.0
        时间表实体类
*/

// /classes/timetable.js

class Timetable {
  constructor(count = null, from = null, to = null) {
    this.count = count;
    this.from = from;
    this.to = to;
  }
}

module.exports = Timetable;
