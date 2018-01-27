class TaskBo {
  constructor(title, url, taskId, processId){
    this.title = title;
    this.url = url;
    this.taskId = taskId;
    this.processId = processId;
  }
}

module.exports = TaskBo;