const timeUtil = require('../util/TimeUtil');

class TaskBo {
  constructor(title, url, taskId, processId, prevTaskId = null){
    this.title = title;
    this.url = url;
    this.taskId = taskId;
    prevTaskId && (this.prevTaskId = prevTaskId);
    this.processId = processId;
    this.createTime = timeUtil.getNowTimeString();
  }
}

module.exports = TaskBo;