const timeUtil = require('../util/TimeUtil');

class ProcessBo {
  constructor(flowName, flowCode, flowVersion){
    this.flowName = flowName;
    this.flowCode = flowCode;
    this.flowVersion = flowVersion;
    this.createTime = timeUtil.getNowTimeString();
  }
}

module.exports = ProcessBo;