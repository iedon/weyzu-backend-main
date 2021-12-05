'use strict';

const CryptoJS = require('crypto-js');

exports.encryptData = (app, rawText) => {
  if (!rawText || rawText === '') return '';
  const encrypted = CryptoJS.AES.encrypt(
    rawText,
    CryptoJS.enc.Utf8.parse(app.config.encrypt.key),
    {
      iv: CryptoJS.enc.Utf8.parse(app.config.encrypt.iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
      asBytes: true,
    }
  );
  return encrypted.toString();
};

exports.decryptData = (app, encryptedText) => {
  if (!encryptedText || encryptedText === '') return '';
  const decrypted = CryptoJS.AES.decrypt(
    encryptedText,
    CryptoJS.enc.Utf8.parse(app.config.encrypt.key),
    {
      iv: CryptoJS.enc.Utf8.parse(app.config.encrypt.iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
      asBytes: true,
    }
  );
  return decrypted.toString(CryptoJS.enc.Utf8);
};

// 爬虫方法的包装，目的是检测请求的头中是否有 User-Agent，如果没有则向其中加入 User-Agent
exports.fetch = async (app, url, opt = null, _ua = null) => {
  let _options = opt;
  const user_agent = _ua || this.defaultCrawlerUserAgent;
  if (opt === null) {
    _options = {
      headers: { 'User-Agent': user_agent },
    };
  } else {
    if (_options.headers) {
      if (!_options.headers['User-Agent'] && !_options.headers['user-agent']) {
        Object.assign(_options.headers, { 'User-Agent': user_agent });
      }
    } else {
      Object.assign(_options, { headers: { 'User-Agent': user_agent } });
    }
  }
  return await app.curl(url, _options);
};
