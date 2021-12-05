'use strict';

// 处理成功响应
exports.success = ({ ctx, res = '', message = 'ok' }) => {
  ctx.body = {
    code: 0,
    message,
    data: res,
  };
  ctx.status = 200;
};

// 处理其他状况的响应
exports.error = (ctx, _code, _data = '') => {
  let _message = '';
  switch (_code) {
    case 1000: _message = 'server error'; break;
    case 1001: _message = 'authorization required'; break;
    case 1002: _message = 'token expired'; break;
    case 1003: _message = 'oauth failed'; break;
    case 1004: _message = 'add user failed'; break;
    case 1005: _message = 'invalid request entity'; break;
    case 1006: _message = 'invalid college_id'; break;
    case 1007: _message = 'already bound'; break;
    case 1008: _message = 'peer auth failed'; break; // 1008 包含data的消息实体为教务网的登录错误信息
    case 1009: _message = 'get captcha failed'; break;
    case 1010: _message = 'db operation failed'; break;
    case 1011: _message = 'captcha required'; break;
    case 1012: _message = 'invalid account or password'; break;
    case 1013: _message = 'account has been banned'; break;
    case 1014: _message = 'peer temporarily unavailable'; break;
    default: _message = 'error'; break;
  }
  ctx.body = {
    code: _code,
    message: _message,
    data: _data,
  };
  ctx.status = 200;
};
