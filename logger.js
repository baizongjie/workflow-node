const log4js = require('log4js');
log4js.configure({
  appenders: {
    console: {
      type: 'console'
    },
    file: {
      type: 'file',
      filename: `${__dirname}/logs/app.log`,
      maxLogSize: 1024,
      backups: 3
    }
  },
  categories: {
    default: { appenders: ['console', 'file'], level: 'debug' }
  }
});

module.exports = {
  /** 获取日志对象 */
  getLogger: name => log4js.getLogger(name)
};