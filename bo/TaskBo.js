const moment = require('moment');

class TaskBo {
  constructor(title, url, taskId, processId){
    this.title = title;
    this.url = url;
    this.taskId = taskId;
    this.processId = processId;
    this.createTime = moment(new Date).format("YYYY-MM-DD HH:mm:ss.SSS");
  }
}

module.exports = TaskBo;