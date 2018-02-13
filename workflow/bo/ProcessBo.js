const timeUtil = require('../../util/TimeUtil');
const ProcessStatus = require('../enum/ProcessStatus');

class ProcessBo {
  constructor(flowName, flowCode, flowVersion, parentTask = null){
    this.flowName = flowName;
    this.flowCode = flowCode;
    this.flowVersion = flowVersion;
    this.createTime = timeUtil.getNowTimeString();
    parentTask && (this.parentTask = parentTask);
    this.status = ProcessStatus.PROCESS_RUNNING;
  }
}

module.exports = ProcessBo;