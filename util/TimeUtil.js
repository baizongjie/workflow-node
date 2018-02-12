const moment = require('moment');

module.exports = {
  getNowTimeString : () => moment(new Date).format("YYYY-MM-DD HH:mm:ss.SSS")
}