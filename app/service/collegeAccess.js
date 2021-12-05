'use strict';

const Service = require('egg').Service;

class CollegeAccessService extends Service {

  // 通过 college_id 查找到 colleges 数组的对应下标
  // 成功返回下标，失败返回 -1。
  async getArrayIndexByCollegeId(college_id) {

    const { ctx } = this;

    let idx = -1;
    ctx.app.colleges.forEach((e, i) => {
      if (e.id === college_id) {
        idx = i;
      }
    });

    return idx;
  }

  // 获得院校列表
  // 成功返回JSON数组。
  async list() {
    const { ctx } = this;
    const arr = [];
    ctx.app.colleges.forEach(e => {
      arr.push({
        college_id: e.id,
        college_name: e.name,
        comment: e.comment,
        captcha: e.userInputCaptcha,
      });
    });
    return arr;
  }

  // 当开启用户手动输入验证码时，获取后端教务系统验证码的请求。
  // 成功返回 base64 编码的验证码数据，失败返回 false。返回空字符串代表发生内部错误(院校ID为-1[不存在])。
  async captcha(payload) {
    const { ctx } = this;
    const idx = await this.getArrayIndexByCollegeId(payload.college_id);
    if (idx === -1) { return ''; }
    return await ctx.app.colleges[idx].crawler.getCaptcha(ctx.state.uid);
  }

  // 获得院校新闻/文章的分类目录
  // 成功返回JSON数组。失败返回false。返回空字符串代表发生内部错误(院校ID为-1[不存在])。
  async post_categories() {
    const { ctx } = this;
    const idx = await this.getArrayIndexByCollegeId(ctx.state.college_id);
    if (idx === -1) { return ''; }
    return await ctx.app.colleges[idx].db.query('SELECT * FROM `post_categories`');
  }

  // 获得文章列表/文章内容
  // PATH: /college/post/category/[/:pcid(文章分类ID)]
  // PATH: /college/post/[:pid(文章唯一ID)]
  // 成功返回JSON数组。失败返回false。返回空字符串代表发生内部错误(院校ID为-1[不存在])。
  async posts(payload) {
    const { ctx } = this;
    const idx = await this.getArrayIndexByCollegeId(ctx.state.college_id);
    if (idx === -1) { return ''; }

    // 如果 pid 未提供，则是获取文章当前分类目录模式
    if (ctx.params.pid === undefined) {
      if (payload.page_id === undefined || payload.page_size === undefined) { return false; }
      // 数据库下标从零开始，每page_size个进行一次分页(当用户提交非法数据时，设置为默认数据)
      const page_size = (payload.page_size > 0) ? payload.page_size : 20;
      const page_id = (payload.page_id > 0) ? payload.page_id : 0;
      const paging = page_id * page_size;

      let total = 0;
      if (page_id === 0) {
        // 获取结果总数
        if (ctx.params.pcid === undefined) {
          // 没有 pcid，则说明是按时间获取最新文章目录的模式
          total = await ctx.app.colleges[idx].db.query('SELECT COUNT(*) FROM `posts`');
        } else {
          // 有 pcid，则说明是取文章当前分类目录模式
          total = await ctx.app.colleges[idx].db.query('SELECT COUNT(*) FROM `posts` WHERE `pcid` = ?', [ ctx.params.pcid ]);
        }
        total = (total.length === 1 && total[0]['COUNT(*)']) ? (total[0]['COUNT(*)']) : 0;
      }

      // 查表返回结果给调用方。
      let records = null;
      if (ctx.params.pcid === undefined) {
        // 没有 pcid，则说明是按时间获取最新文章目录的模式
        records = await ctx.app.colleges[idx].db.query('SELECT `pid`, `pcid`, `uid`, `source`, `title`, `date` FROM `posts` ORDER BY `date` DESC, `pid` DESC LIMIT ?, ?', [ paging, page_size ]);
      } else {
        // 有 pcid，则说明是取文章当前分类目录模式
        records = await ctx.app.colleges[idx].db.query('SELECT `pid`, `pcid`, `uid`, `source`, `title`, `date` FROM `posts` WHERE `pcid` = ? ORDER BY `date` DESC, `pid` DESC LIMIT ?, ?', [ ctx.params.pcid, paging, page_size ]);
      }
      // 用空字符串剔除数据库中返回的'null'字样。
      records.forEach(e => {
        if (e.source === null) { e.source = ''; }
      });

      // 查找用户名，并放入缓存，后续循环不再执行SQL。
      const uid_name_cache = [];
      for (let r = 0; r < records.length; r++) {
        let found = false;
        let i = 0;
        for (; i < uid_name_cache.length; i++) {
          if (uid_name_cache[i].uid === records[r].uid) {
            found = true;
            break;
          }
        }
        if (found) {
          records[r].author = uid_name_cache[i].author;
        } else {
          let _name = await ctx.app.maindb.query('SELECT `name` FROM `accounts` WHERE `uid` = ? LIMIT 0, 1', [ records[r].uid ]);
          if (!_name || _name.length === 0) { _name = ''; }
          records[r].author = _name[0].name;
          uid_name_cache.push({ uid: records[r].uid, author: _name[0].name });
        }
      }

      if (page_id === 0) {
        return {
          total,
          page_id,
          page_size,
          records,
        };
      }
      // 非第一页(page_id===0)就不返回sum，不然浪费性能
      return {
        page_id,
        page_size,
        records,
      };
    }

    // 显示文章内容
    const post = await ctx.app.colleges[idx].db.query('SELECT `pid`, `pcid`, `uid`, `source`, `title`, `date`, `content` FROM `posts` WHERE `pid` = ? LIMIT 0, 1', [ ctx.params.pid ]);
    if (post.length !== 0 && post[0].uid !== undefined && post[0].uid !== null) {
      if (!post[0].source || post[0].source === null || post[0].source === undefined) { post[0].source = ''; }
      let _name = await ctx.app.maindb.query('SELECT `name` FROM `accounts` WHERE `uid` = ? LIMIT 0, 1', [ post[0].uid ]);
      if (!_name || _name.length === 0) { _name = ''; }
      post[0].author = _name[0].name;
    }
    return post[0];
  }

  // 获取当前院校的设置
  // 成功返回JSON数组。返回空字符串代表发生内部错误(院校ID为-1[不存在])。
  async settings() {
    const { ctx } = this;
    const idx = await this.getArrayIndexByCollegeId(ctx.state.college_id);
    if (idx === -1) { return ''; }

    // 获取当前教学周次
    let currentWeek = 1;
    try {
      const ret = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'CURRENT_WEEK\' LIMIT 0, 1');
      if (ret.length !== 0 && ret[0].value) {
        currentWeek = parseInt(ret[0].value);
        if (isNaN(currentWeek)) currentWeek = 1;
      }
    } catch (err) {
      ctx.app.logger.error(`读取当前教学周次失败: ${err}`);
    }

    // 获取当前校区的服务器公告
    let _notice = '';
    try {
      const ret = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'NOTICE_TEXT\' LIMIT 0, 1');
      if (ret.length !== 0 && ret[0].value) {
        _notice = ret[0].value;
      }
    } catch (err) {
      ctx.app.logger.error(`读取当前校区服务器公告失败: ${err}`);
    }

    // 获取当前校区的维护公告，如果不为空，客户端将显示为维护状态
    let _maintenance = '';
    try {
      const ret = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'MAINTENANCE_TEXT\' LIMIT 0, 1');
      if (ret.length !== 0 && ret[0].value) {
        _maintenance = ret[0].value;
      }
    } catch (err) {
      ctx.app.logger.error(`读取当前校区的维护公告失败: ${err}`);
    }

    // 获取课程时间表
    let timetable = [];
    try {
      timetable = await ctx.app.colleges[idx].db.query('SELECT `tid`, `begin`, `end` FROM `timetable`');
    } catch (err) {
      ctx.app.logger.error(`读取课程时间表失败: ${err}`);
    }

    // 获取首页图片轮播
    const arr = [];
    let _interval = 0;
    let _enabled = 0;
    let _mainElement = null;
    try {
      const swiper_enabled = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'ENABLE_SWIPER\' LIMIT 0, 1');
      if (swiper_enabled.length !== 0 && swiper_enabled[0].value) { _enabled = parseInt(swiper_enabled[0].value); }
      if (_enabled === 1) {
        const swiper_interval = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_INTERVAL_MS\' LIMIT 0, 1');
        if (swiper_interval.length !== 0 && swiper_interval[0].value) { _interval = parseInt(swiper_interval[0].value); }
        const swiper_main_img = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_MAIN_IMG\' LIMIT 0, 1');
        const swiper_main_pid = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_MAIN_PID\' LIMIT 0, 1');
        const swiper_main_type = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_MAIN_TYPE\' LIMIT 0, 1');
        const swiper_main_url = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_MAIN_URL\' LIMIT 0, 1');
        const swiper_main_appid = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_MAIN_APPID\' LIMIT 0, 1');
        const swiper_1_img = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_1_IMG\' LIMIT 0, 1');
        const swiper_1_pid = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_1_PID\' LIMIT 0, 1');
        const swiper_1_type = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_1_TYPE\' LIMIT 0, 1');
        const swiper_1_url = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_1_URL\' LIMIT 0, 1');
        const swiper_1_appid = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_1_APPID\' LIMIT 0, 1');
        const swiper_2_img = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_2_IMG\' LIMIT 0, 1');
        const swiper_2_pid = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_2_PID\' LIMIT 0, 1');
        const swiper_2_type = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_2_TYPE\' LIMIT 0, 1');
        const swiper_2_url = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_2_URL\' LIMIT 0, 1');
        const swiper_2_appid = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_2_APPID\' LIMIT 0, 1');
        const swiper_3_img = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_3_IMG\' LIMIT 0, 1');
        const swiper_3_pid = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_3_PID\' LIMIT 0, 1');
        const swiper_3_type = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_3_TYPE\' LIMIT 0, 1');
        const swiper_3_url = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_3_URL\' LIMIT 0, 1');
        const swiper_3_appid = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_3_APPID\' LIMIT 0, 1');
        const swiper_4_img = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_4_IMG\' LIMIT 0, 1');
        const swiper_4_pid = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_4_PID\' LIMIT 0, 1');
        const swiper_4_type = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_4_TYPE\' LIMIT 0, 1');
        const swiper_4_url = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_4_URL\' LIMIT 0, 1');
        const swiper_4_appid = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_4_APPID\' LIMIT 0, 1');
        const swiper_5_img = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_5_IMG\' LIMIT 0, 1');
        const swiper_5_pid = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_5_PID\' LIMIT 0, 1');
        const swiper_5_type = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_5_TYPE\' LIMIT 0, 1');
        const swiper_5_url = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_5_URL\' LIMIT 0, 1');
        const swiper_5_appid = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'SWIPER_5_APPID\' LIMIT 0, 1');
        if (swiper_main_img.length !== 0 && swiper_main_img[0].value) {
          const arrData = {
            image: swiper_main_img[0].value,
          };
          if (swiper_main_type.length !== 0 && swiper_main_type[0].value) {
            arrData.type = swiper_main_type[0].value;
          }
          if (swiper_main_pid.length !== 0 && swiper_main_pid[0].value) {
            arrData.pid = parseInt(swiper_main_pid[0].value);
          }
          if (swiper_main_url.length !== 0 && swiper_main_url[0].value) {
            arrData.url = swiper_main_url[0].value;
          }
          if (swiper_main_appid.length !== 0 && swiper_main_appid[0].value) {
            arrData.appId = swiper_main_appid[0].value;
          }
          _mainElement = arrData;
        }
        if (swiper_1_img.length !== 0 && swiper_1_img[0].value) {
          const arrData = {
            image: swiper_1_img[0].value,
          };
          if (swiper_1_type.length !== 0 && swiper_1_type[0].value) {
            arrData.type = swiper_1_type[0].value;
          }
          if (swiper_1_pid.length !== 0 && swiper_1_pid[0].value) {
            arrData.pid = parseInt(swiper_1_pid[0].value);
          }
          if (swiper_1_url.length !== 0 && swiper_1_url[0].value) {
            arrData.url = swiper_1_url[0].value;
          }
          if (swiper_1_appid.length !== 0 && swiper_1_appid[0].value) {
            arrData.appId = swiper_1_appid[0].value;
          }
          arr.push(arrData);
        }
        if (swiper_2_img.length !== 0 && swiper_2_img[0].value) {
          const arrData = {
            image: swiper_2_img[0].value,
          };
          if (swiper_2_type.length !== 0 && swiper_2_type[0].value) {
            arrData.type = swiper_2_type[0].value;
          }
          if (swiper_2_pid.length !== 0 && swiper_2_pid[0].value) {
            arrData.pid = parseInt(swiper_2_pid[0].value);
          }
          if (swiper_2_url.length !== 0 && swiper_2_url[0].value) {
            arrData.url = swiper_2_url[0].value;
          }
          if (swiper_2_appid.length !== 0 && swiper_2_appid[0].value) {
            arrData.appId = swiper_2_appid[0].value;
          }
          arr.push(arrData);
        }
        if (swiper_3_img.length !== 0 && swiper_3_img[0].value) {
          const arrData = {
            image: swiper_3_img[0].value,
          };
          if (swiper_3_type.length !== 0 && swiper_3_type[0].value) {
            arrData.type = swiper_3_type[0].value;
          }
          if (swiper_3_pid.length !== 0 && swiper_3_pid[0].value) {
            arrData.pid = parseInt(swiper_3_pid[0].value);
          }
          if (swiper_3_url.length !== 0 && swiper_3_url[0].value) {
            arrData.url = swiper_3_url[0].value;
          }
          if (swiper_3_appid.length !== 0 && swiper_3_appid[0].value) {
            arrData.appId = swiper_3_appid[0].value;
          }
          arr.push(arrData);
        }
        if (swiper_4_img.length !== 0 && swiper_4_img[0].value) {
          const arrData = {
            image: swiper_4_img[0].value,
          };
          if (swiper_4_type.length !== 0 && swiper_4_type[0].value) {
            arrData.type = swiper_4_type[0].value;
          }
          if (swiper_4_pid.length !== 0 && swiper_4_pid[0].value) {
            arrData.pid = parseInt(swiper_4_pid[0].value);
          }
          if (swiper_4_url.length !== 0 && swiper_4_url[0].value) {
            arrData.url = swiper_4_url[0].value;
          }
          if (swiper_4_appid.length !== 0 && swiper_4_appid[0].value) {
            arrData.appId = swiper_4_appid[0].value;
          }
          arr.push(arrData);
        }
        if (swiper_5_img.length !== 0 && swiper_5_img[0].value) {
          const arrData = {
            image: swiper_5_img[0].value,
          };
          if (swiper_5_type.length !== 0 && swiper_5_type[0].value) {
            arrData.type = swiper_5_type[0].value;
          }
          if (swiper_5_pid.length !== 0 && swiper_5_pid[0].value) {
            arrData.pid = parseInt(swiper_5_pid[0].value);
          }
          if (swiper_5_url.length !== 0 && swiper_5_url[0].value) {
            arrData.url = swiper_5_url[0].value;
          }
          if (swiper_5_appid.length !== 0 && swiper_5_appid[0].value) {
            arrData.appId = swiper_5_appid[0].value;
          }
          arr.push(arrData);
        }
      }
    } catch (err) {
      ctx.app.logger.error(`读取图片轮播设置失败: ${err}`);
    }

    const swipers = { interval: _interval, elements: arr };
    if (_mainElement !== null) swipers.main = _mainElement;
    return {
      current_week: currentWeek,
      notice: _notice,
      maintenance: _maintenance,
      timetable,
      swipers,
    };
  }

  // 获取包含校车/校历等信息的校园信息文章页面
  // 失败或不存在返回false。返回空字符串代表发生内部错误(院校ID为-1[不存在])。
  async info_page() {
    const { ctx } = this;
    const idx = await this.getArrayIndexByCollegeId(ctx.state.college_id);
    if (idx === -1) { return ''; }
    const _data = await ctx.app.colleges[idx].db.query('SELECT `value` FROM `settings` WHERE `key` = \'INFO_PAGE\' LIMIT 0, 1');
    if (_data.length === 0 || !_data[0].value) { return false; }
    return _data[0].value;
  }

  // 获取社团信息
  // 返回空字符串代表发生内部错误(院校ID为-1[不存在])。
  async clubs() {
    const { ctx } = this;
    const idx = await this.getArrayIndexByCollegeId(ctx.state.college_id);
    if (idx === -1) { return ''; }
    const club_id = ctx.params.club_id === undefined ? null : ctx.params.club_id;
    let _childs = null;
    if (club_id) {
      _childs = await ctx.app.colleges[idx].db.query('SELECT `club_id`, `name`, `logo` FROM `clubs` WHERE `parent` = ?', [ club_id ]);
    } else {
      _childs = await ctx.app.colleges[idx].db.query('SELECT `club_id`, `name`, `logo` FROM `clubs` WHERE `parent` IS NULL');
    }
    _childs.forEach(e => {
      if (e.logo === null) { e.logo = ''; }
    });
    if (club_id === null) { // 如果是顶级目录，直接返回
      return _childs;
    }
    const club = await ctx.app.colleges[idx].db.query('SELECT `club_id`, `name`, `logo`, `detail` FROM `clubs` WHERE `club_id` = ? LIMIT 0, 1', [ club_id ]);
    club.forEach(e => {
      if (e.detail === null) { e.detail = ''; }
    });
    return {
      club_id: club[0].club_id,
      name: club[0].name,
      logo: club[0].logo || '',
      detail: club[0].detail || '',
      childs: _childs,
    };
  }

  // 获取通联信息
  // 返回空字符串代表发生内部错误(院校ID为-1[不存在])。
  async contact() {
    const { ctx } = this;
    const idx = await this.getArrayIndexByCollegeId(ctx.state.college_id);
    if (idx === -1) { return ''; }
    const contact_id = ctx.params.contact_id === undefined ? null : ctx.params.contact_id;
    let _childs = null;
    if (contact_id) {
      _childs = await ctx.app.colleges[idx].db.query('SELECT `contact_id`, `name`, `detail` FROM `contact` WHERE `parent` = ?', [ contact_id ]);
    } else {
      _childs = await ctx.app.colleges[idx].db.query('SELECT `contact_id`, `name`, `detail` FROM `contact` WHERE `parent` IS NULL');
    }
    _childs.forEach(e => {
      if (e.detail === null) { e.detail = ''; }
    });
    if (contact_id === null) { // 如果是顶级目录，直接返回
      return _childs;
    }
    const contact = await ctx.app.colleges[idx].db.query('SELECT `contact_id`, `name`, `detail` FROM `contact` WHERE `contact_id` = ? LIMIT 0, 1', [ contact_id ]);
    contact.forEach(e => {
      if (e.detail === null) { e.detail = ''; }
    });
    return {
      contact_id: contact[0].contact_id,
      name: contact[0].name,
      detail: contact[0].detail || '',
      childs: _childs,
    };
  }

}

module.exports = CollegeAccessService;
