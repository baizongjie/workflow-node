const timeUtil = require('../util/TimeUtil');

class ProcessBo {
  constructor(flowName, flowCode, flowVersion){
    this.flowName = flowName;
    this.flowCode = flowCode;
    this.flowVersion = flowVersion;
    this.createTime = timeUtil.getNowTimeString();
    this.status = '00';  // 新建
  }
}

module.exports = ProcessBo;