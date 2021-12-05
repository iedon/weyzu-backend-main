'use strict';
/**
 * @authors iEdon (m [at] iedon.net)
 * @date    2018/12/27 16:30
 * @version V0.1.2
 */

/*
    iEdon UniPlex Project
    高校校园数据服务 2.0
        教室实体类
*/

// /classes/classroom.js

class Classroom {
  constructor(campus = null, building = null, room = null) {
    this.rid = null;
    this.campus = campus;
    this.building = building;
    this.room = room;
  }
}

module.exports = Classroom;
