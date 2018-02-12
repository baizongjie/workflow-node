const timeUtil = require('../util/TimeUtil');

class TaskBo {
  constructor(title, url, taskId, processId){
    this.title = title;
    this.url = url;
    this.taskId = taskId;
    this.processId = processId;
    this.createTime = timeUtil.getNowTimeString();
  }
}

module.exports = TaskBo;