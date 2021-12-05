'use strict';

const sdkInfo = require('../acorle-sdk/package.json');

/**
 * @authors iEdon (m [at] iedon.net)
 * @date    2018/11/05 14:06
 * @version V0.0.1
 */

/*
    iEdon UniPlex Project
    高校校园数据服务 2.0
        配置文件
*/

module.exports = appInfo => {
  const config = exports = {};

  config.clientId = 'dev';
  config.clientSecret = 'ffffffffffffffffffffffffffffffff';
  config.serviceWeight = 1;
  config.centerServer = 'https://api.xxxxx.xxx';
  config.baseUrl = 'http://172.23.91.xxx:15000';

  config.cluster = {
    listen: {
      port: 15000,
      hostname: '0.0.0.0',
      // path: '/var/run/egg.sock',
    },
  };

  config.logger = {
    dir: './logs',
    appLogName: `${appInfo.name}.log`,
    coreLogName: 'egg-web.log',
    agentLogName: 'egg-agent.log',
    errorLogName: `${appInfo.name}-error.log`,
  };

  // 定时任务会产生大量自定义日志，这些日志无关紧要，关闭还可以提高性能
  config.customLogger = {
    scheduleLogger: {
      consoleLevel: 'NONE',
      level: 'NONE',
      file: 'egg-web.log',
    },
  };

  // 配置前置代理模式(true 代表本服务端正在被前端服务器作反向代理，false 代表本服务端直接提供服务)
  // 注意，开启此模式后，应用就默认自己处于反向代理之后，会支持通过解析约定的请求头来获取用户真实的 IP，协议和域名。如果你的服务未部署在反向代理之后，请不要开启此配置，以防被恶意用户伪造请求 IP 等信息。
  // 微服务模式下此选项需要为 false，因为微服务会改写来源信息。
  config.proxy = false;

  // 开启 proxy 配置后，应用会解析 X-Forwarded-For 请求头来获取客户端的真实 IP。如果你的前置代理通过其他的请求头来传递该信息，可以通过 config.ipHeaders 来配置，这个配置项支持配置多个头（逗号分开）。
  config.ipHeaders = 'X-Real-Ip, X-Forwarded-For';

  // X-Forwarded-For 等传递 IP 的头，通用的格式是：X-Forwarded-For: client, proxy1, proxy2
  // 我们可以拿第一个作为请求的真实 IP，但是如果有恶意用户在请求中传递了 X-Forwarded-For 参数来伪造其在反向代理之后，就会导致 X-Forwarded-For 拿到的值不准确了，可以被用来伪造请求 IP 地址，突破应用层的一些 IP 限制。
  // X-Forwarded-For: fake, client, proxy1, proxy2
  // 为了避免此问题，我们可以通过 config.maxProxyCount 来配置前置的反向代理数量，这样在获取请求真实 IP 地址时，就会忽略掉用户多传递的伪造 IP 地址了。例如我们将应用部署在一个统一的接入层之后（例如阿里云 SLB），我们可以将此参数配置为 1，这样用户就无法通过 X-Forwarded-For 请求头来伪造 IP 地址了。
  config.maxProxyCount = 1;

  // 开启 proxy 配置后，应用会解析 X-Forwarded-Proto 请求头来获取客户端的真实访问协议。如果你的前置代理通过其他的请求头来传递该信息，可以通过 config.protocolHeaders 来配置，这个配置项支持配置多个头（逗号分开）。
  config.protocolHeaders = 'X-Real-Proto, X-Forwarded-Proto';

  // 开启 proxy 配置后，应用仍然还是直接读取 host 来获取请求的域名，绝大部分反向代理并不会修改这个值。但是也许有些反向代理会通过 X-Forwarded-Host 来传递客户端的真实访问域名，可以通过在 config.hostHeaders 中配置，这个配置项支持配置多个头（逗号分开）。
  config.hostHeaders = 'X-Forwarded-Host';

  // 原本是给 cookie 使用的加密 key，因为这是 API 服务器，所以给 JWT 用
  config.keys = '00000000000000000000000000000000';

  // 用于对用户教务密码等敏感信息进行AES对称加密所用到的信息
  config.encrypt = {
    iv: 'idnfffffffffffff', // 16 字节(符)，初始化向量，即128位IV
    key: 'idnfffffffffffffffffffffffffffff', // 32 字节(符)，加解密用到的密钥，即256位AES加密
  };

  // JWT 设置
  config.tokenExpires = 60 * 10 * 1000; // Token 过期时间 (1天 = 60 * 60 * 24 * 1 * 1000 ) (Unix Timestamp ms)
  config.jwt = {
    secret: config.keys, // 利用 cofing.keys 作为 JWT 生成密钥参数
    enable: true,
    match: '/jwt', // 可选
  };

  // 密码存储加盐轮数(越高越慢，越安全，默认10)
  config.saltTimes = 10;

  // 配置必要的中间件。（当使用微服务模式时，微服务中间件必须在第一个。系统使用中间件来对客户端做 TOKEN 授权验证，不存在API的响应）
  config.middleware = [ 'acorleWrapper', 'microService', 'notFoundHandler', 'verifyToken' ];

  // 应用程序信息，不用填写，会使用主数据库里的值来填充这里的值
  config.VAR_APP_INFO = {
    package: appInfo.name,
    name: null,
    version: null,
    copyright: null,
    sdkName: sdkInfo.name,
    sdkVersion: sdkInfo.version,
  };

  config.onerror = {
    all(err, ctx) {
      /*
        // 在此处定义针对所有响应类型的错误处理方法
        // 注意，定义了 config.all 之后，其他错误处理方法不会再生效
        ctx.helper.error(ctx, 1000);
        ctx.response.type = 'json'; // 强制指定返回结果为 JSON，因为这是 API Server。框架 onerror 默认的类型是 html
        ctx.body = JSON.stringify(ctx.body); // 特殊情况特殊对待。这里这么做是因为在 onerror 回调中，直接使用了KOA的发送。参数必须是字符串。所以这里要将JSON对象转化为字符串。
      */
      ctx.response.type = 'json';
      ctx.body = JSON.stringify({
        code: 1000,
        message: 'server error',
        data: '',
      });
    },
  };

  // 用户组参数，不用填写，会使用主数据库里的值来填充这里的值
  config.VAR_ACCOUNT_GID = {
    GENERAL: null, // 普通用户的用户组ID(GID)
    OAUTH: {
      WX: null, // 微信小程序
      QQ: null, // QQ小程序
    }, // OAuth 用户的用户组ID(GID)
  };

  // MYSQL 主服务器(帐号服务器)
  config.VAR_MAIN_MYSQL_SERVER = {
    host: '127.0.0.1',
    port: '3306',
    user: 'root',
    password: 'Str0ngPaSsW0rD',
    database: 'uniplex',
    charset: 'utf8mb4',
  };

  // 数据库性能设置
  config.VAR_DATABASE_SETTINGS = {

    // 队列大小，超过队列容量直接返回错误。官方默认0(无限制)
    queueLimit: 0,
    // 超过连接池连接数量是否放入队列等待，如果假，则立即返回错误。官方默认真。
    waitForConnections: true,
    // 单次最大可以创建的连接数量。官方默认10
    connectionLimit: 10,
    // 单位毫秒。获得连接超时时间(队列排队时间) 官方默认10000 (ms)。
    acquireTimeout: 10000,
  };

  // 将性能设置应用到主数据库服务器中（将数据库性能设置抽出来再 assign 到 VAR_MAIN_MYSQL_SERVER 的原因是院校数据库也将沿用上述设置）
  Object.assign(config.VAR_MAIN_MYSQL_SERVER, config.VAR_DATABASE_SETTINGS);

  // 爬虫超时设置
  config.httpclient = {

    // 是否开启本地DNS缓存，开启后：
    // 1. 所有的DNS查询都会默认优先使用缓存，即使DNS查询错误也不影响应用
    // 2. 对同一个域名，在dnsCacheLookupInterval的间隔内（默认 10000ms 即 10s）只会查询一次
    enableDNSCache: true,
    // 对同一个域名进行DNS查询的最小间隔时间(ms)
    dnsCacheLookupInterval: 360 * 1000,
    // DNS同时缓存的最大域名数量
    dnsCacheMaxLength: 1000,

    request: {
      // timeout: Number|Array，设置请求超时时间，默认是[5000, 5000]（创建连接超时5s，接收响应超时5秒，两个参数都相等时，可以简写为timeout: 5000）
      timeout: [ 5000, 15000 ],
    },

    httpAgent: {
      // 默认开启http keepAlive
      // keepAlive: true,
      // 空闲的KeepAlive socket最长可以存活的时间
      // freeSocketKeepAliveTimeout: 4000,
      // 当socket超时没活动，会被处理掉
      // timeout: 30000,
      // 允许创建的最大socket数
      // maxSockets: Number.MAX_SAFE_INTEGER,
      // 最大空闲socket数
      // maxFreeSockets: 256,
    },

    httpsAgent: { /* 配置同httpAgent，不过是针对Https */ },
  };

  // 允许的域名清单，并关闭CSRF安全设置(因为这是API服务器)
  config.security = {
    csrf: {
      enable: false,
    },
    origin: '*',
    domainWhiteList: [ ],
  };

  // egg-cor 插件设置
  config.cors = {
    allowMethods: 'GET, POST',
  };

  // 请求体解析器的设置，当在微服务模式下时，一定要关闭，反之则必须开启
  config.bodyParser = {
    enable: false,
    encoding: 'utf8',
    formLimit: '100kb',
    jsonLimit: '100kb',
    strict: true,
    // @see https://github.com/hapijs/qs/blob/master/lib/parse.js#L8 for more options
    queryString: {
      arrayLimit: 100,
      depth: 5,
      parameterLimit: 1000,
    },
    enableTypes: [ 'json' ],
  };

  return config;
};
