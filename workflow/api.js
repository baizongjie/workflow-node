const redisClinet = require('../dao/RedisClient');
const flowTemplates = require('./init');
const TaskBo = require('../bo/TaskBo');
const ProcessBo = require('./bo/ProcessBo');
const uuid = require('node-uuid');
const timeUtil = require('../util/TimeUtil');
const ProcessStatus = require('./enum/ProcessStatus');

module.exports = requestId => {
  const log = require('../logger').getLogger(`workfow_api_${requestId}`);
  /**
   * 创建任务
   */
  async function createTask({
    title,
    url,
    userList,
    prevTaskId,
    processInfo: { processId, ...processInfo },
    ...taskInfo
  }) {
    if (userList && userList instanceof Array && userList.length > 0) {
      let taskNodeCode = taskInfo.nodeInfo.nodeCode;
      log.info(`创建任务:${taskNodeCode}`);
      let taskId = uuid.v4();
      let taskBo = new TaskBo(title, url, taskId, processId, prevTaskId);
      // 生成一个Redis内唯一的任务ID
      let newIdFunc = async () => {
        let result = await redisClinet.setnxSync(`task:${taskId}`, taskBo);
        while (!result) {
          taskId = uuid.v4();
          newIdFunc();
        }
      };
      await newIdFunc();
      log.info(`生成任务实例，ID:${taskId}`);
      // 设置事务
      let multi = redisClinet.multi();

      multi.set(`taskInfo:${taskId}`, JSON.stringify(taskInfo));
      multi.sadd(`taskUser:${taskId}`, userList);
      multi.set(
        `taskStatus:${taskId}`,
        JSON.stringify({
          status: '00' //待办
        })
      );
      multi.lpush(
        `taskLifecycle:${taskId}`,
        JSON.stringify({
          time: timeUtil.getNowTimeString(),
          action: `new to ${userList}`
        })
      );
      userList.forEach(userId => {
        multi.zadd(`u_todo:${userId}`, new Date().getTime(), taskId);
      });
      if (prevTaskId && (await redisClinet.existsAsync(`task:${prevTaskId}`))) {
        multi.sadd(`task_next:${prevTaskId}`, taskId);
      }
      let baseProcessInfo = await redisClinet.getAsync(
        `process:${processId}`
      );
      multi.set(
        `process:${processId}`,
        JSON.stringify({
          ...(baseProcessInfo ? baseProcessInfo : {}),
          ...processInfo,
          currentNode: taskNodeCode
        })
      );
      multi.lpush(`process_task:${processId}`, taskId);
      let result = await redisClinet.runMultiAysnc(multi);
      log.info(`初始化任务相关信息完毕，ID:${taskId}`);
      return taskId;
    } else {
      return new ErrorBo('TASK0001', '无有效用户列表');
    }
  }

  /**
   * 检查用户是否领取任务
   *
   * @param {*} taskId
   * @param {*} user
   */
  async function checkUserReceivedTask(taskId, user) {
    let { status, userId } = await redisClinet.getAsync(`taskStatus:${taskId}`);
    if (status !== '01' || userId !== user) {
      return false;
    } else {
      return true;
    }
  }

  /**
   * 检查任务是否存在
   *
   * @param {*} taskId
   */
  async function checkTaskExist(taskId) {
    return await redisClinet.existsAsync(`task:${taskId}`);
  }

    /**
   * 检查流程是否存在
   *
   * @param {*} processId
   */
  async function checkProcessExist(processId) {
    return await redisClinet.existsAsync(`process:${processId}`);
  }

  const api = {
    initProcess: async (creater, flowCode, flowVersion = 'latest', parentTask = null) => {
      const flowTemplate = flowTemplates[`${flowCode}@${flowVersion}`];
      //检查参数合法性
      if (flowTemplate) {
        log.info(`流程初始化:${flowCode}@${flowTemplate.version}`);
        //初始化流程
        let processId = uuid.v4();
        let processBo = new ProcessBo(
          flowTemplate.flowName,
          flowTemplate.flowCode,
          flowTemplate.version,
          parentTask
        );
        let newIdFunc = async () => {
          let result = await redisClinet.setnxSync(
            `process:${processId}`,
            processBo
          );
          while (!result) {
            processId = uuid.v4();
            newIdFunc();
          }
        };
        await newIdFunc();
        log.info(`生成流程实例，ID:${processId}`);
        //初始化任务
        let processNode = flowTemplate.firstNode();
        let taskId = await createTask({
          title: processNode.nodeName,
          url: processNode.nodeUrl,
          userList: [creater],
          prevTaskId: null,
          processInfo: {
            processId: processId,
            flowName: flowTemplate.flowName,
            flowCode: flowTemplate.flowCode,
            version: flowTemplate.version,
          },
          nodeInfo: {
            nodeName: processNode.nodeName,
            nodeCode: processNode.nodeCode,
            nodeType: processNode.nodeType,
            nextCode: processNode.next
          }
        });
        //创建者自动领取任务
        await api.receiveTask(taskId, creater);
        log.info(`流程初始化完毕:${flowCode}@${flowTemplate.version}`);
        return { processId, taskId };
      } else {
        log.error(`流程模板不存在:${flowCode}@${flowVersion}`);
        return false;
      }
    },
    /**
     * 创建子流程
     */
    initSubProcess: async (taskId, processStarters, flowCode, flowVersion = 'latest') => {
      log.info(`任务${taskId}尝试创建子流程${flowCode}@${flowVersion}`);
      //创建子流程前置条件要求 主任务必须处于已领取状态，生成后任务锁定，不允许撤销领取，但可以继续提交
      let { status } = await redisClinet.getAsync(`taskStatus:${taskId}`);
      if(status !== '01'){
        log.error(`任务不处于领取状态，不能创建子流程，ID:${taskId}`);
        return false;
      }
      // 创建子流程
      let subProcessList = [];
      let subProcessTaskList = [];
      for(let starter of processStarters){
        let processInfo = await api.initProcess(starter,flowCode,flowVersion,taskId);
        subProcessList.push(processInfo.processId);
        subProcessTaskList.push(processInfo.taskId);
      }

      //锁定任务状态并关联子流程
      redisClinet.get(`taskStatus:${taskId}`, result => {
        redisClinet.set(
          `taskStatus:${taskId}`,{
            ...result,
            status: '09',  //中断
            subProcess: subProcessList
          }
        );
      })
      redisClinet.lpush(
        `taskLifecycle:${taskId}`,
        {
          time: timeUtil.getNowTimeString(),
          action: `initSubProcess`
        }
      );
      log.info(`任务${taskId}尝试子流程创建完毕，新生成任务(${subProcessTaskList})`);
      return {subProcessList, subProcessTaskList}
    },

    finishProcess: async processId => {
      log.info(`准备关闭流程，ID:${processId}`);
      // 检查流程信息
      if(!await checkProcessExist(processId)){
        log.error(`流程不存在，ID:${processId}`);
        return false;
      }
      // 修改流程状态
      let baseProcessInfo = await redisClinet.getAsync(`process:${processId}`);
      if(baseProcessInfo.status === ProcessStatus.PROCESS_FINISH){
        log.info(`流程已处于关闭状态`);
        return true;
      }
      redisClinet.set(
        `process:${processId}`,{
          ...baseProcessInfo,
          status: ProcessStatus.PROCESS_FINISH      
        }
      );
      // 检查是否有父任务
      let { parentTask } = baseProcessInfo;
      if(parentTask){
        log.info(`检查到流程有关联父任务节点，准备检查相关兄弟流程状态`);

        let parentTaskStatus = await redisClinet.getAsync(`taskStatus:${parentTask}`);
        let { subProcess } = parentTaskStatus;
        // 检查除自己外的其他流程状态
        for (subProcessId of subProcess){
          if(subProcessId !== processId){
            let { status } = await redisClinet.getAsync(`process:${subProcessId}`);
            if(status === ProcessStatus.PROCESS_RUNNING){
              log.info(`存在正在运行的兄弟流程，ID:${subProcessId}`);
              log.info(`本流程已成功关闭，ID:${processId}`);
              return true;
            }
          }
        }
        log.info(`所有相关兄弟流程状态均结束，调整父任务状态`);
        redisClinet.set(
          `taskStatus:${parentTask}`,{
            ...parentTaskStatus,
            status: '01'      
          }
        );
        redisClinet.lpush(
          `taskLifecycle:${parentTask}`,
          {
            time: timeUtil.getNowTimeString(),
            action: `finishAllSubProcess`
          }
        );
        log.info(`本流程已成功关闭,父任务状态也已调整，ID:${processId}`);
        return true;
      }
    },

    receiveTask: async (taskId, user) => {
      log.info(`用户${user}尝试领取任务，ID:${taskId}`);
      if (!await checkTaskExist(taskId)) {
        log.error(`任务不存在，ID:${taskId}`);
        return false;
      }
      let { status, userId } = await redisClinet.getAsync(
        `taskStatus:${taskId}`
      );
      if (status === '01' && userId === user) {
        log.info(`任务已被该用户领取，无需修改状态`);
        return true;
      } else if (status === '00') {
        let userList = await redisClinet.smembersAysnc(`taskUser:${taskId}`);
        if (userList.indexOf(user) == -1) {
          log.error(`任务不属于该用户, 用户范围：${userList}`);
          return false;
        }
        // 设置事务
        log.info(`准备领取任务`);
        let multi = redisClinet.multi();
        userList.forEach(tmpUser => {
          if (tmpUser !== user) {
            multi.zrem(`u_todo:${tmpUser}`, taskId);
          }
        });
        multi.set(
          `taskStatus:${taskId}`,
          JSON.stringify({
            status: '01', //领取
            userId: user
          })
        );
        multi.lpush(
          `taskLifecycle:${taskId}`,
          JSON.stringify({
            time: timeUtil.getNowTimeString(),
            action: `draw by ${user}`
          })
        );
        let result = await redisClinet.runMultiAysnc(multi);
        log.info(`领取任务完毕`);
        return true;
      }
    },

    commitTask: async (taskId, user, nextUserList, nextNodeCode = '_default') => {
      log.info(`用户${user}尝试提交任务，ID:${taskId}`);
      //检查用户可提交
      if (!await checkTaskExist(taskId)) {
        log.error(`任务不存在，ID:${taskId}`);
        return false;
      }
      if (!await checkUserReceivedTask(taskId, user)) {
        log.error(`用户未领取该任务，ID:${taskId}`);
        return false;
      }
      //检查任务下一节点符合要求
      let { nodeInfo: { nodeType, nextCode } } = await redisClinet.getAsync(
        `taskInfo:${taskId}`
      );
      if (
        nextNodeCode !== '_default' &&
        nextCode.indexOf(nextNodeCode) === -1
      ) {
        log.error(`找不到对应的下一节点信息，下一节点范围：${nextCode}`);
        return false;
      }
      let nextTaskNodeCode =
        nextNodeCode === '_default' ? nextCode[0] : nextNodeCode;
      if (
        nextTaskNodeCode !== 'end' &&
        (!nextUserList || nextUserList.length === 0)
      ) {
        log.error(`未提供下一节点（${nextTaskNodeCode}）的用户清单，无法提交`);
        return false;
      }
      log.info(`信息检查完毕，准备进入提交环节`);
      //执行提交
      let multi = redisClinet.multi();
      multi.set(
        `taskStatus:${taskId}`,
        JSON.stringify({
          status: '02', //完成
          userId: user
        })
      );
      multi.zrem(`u_todo:${user}`, taskId);
      multi.zadd(`u_done:${user}`, new Date().getTime(), taskId);
      multi.lpush(
        `taskLifecycle:${taskId}`,
        JSON.stringify({
          time: timeUtil.getNowTimeString(),
          action: `commit by ${user}`
        })
      );
      let result = await redisClinet.runMultiAysnc(multi);
      log.info(`任务提交完毕，准备生成下一环节任务`);
      let { prevTaskId, processId } = await redisClinet.getAsync(`task:${taskId}`);

      //同时生成下一步任务
      if (nextTaskNodeCode === 'end') {
        log.info(`下一节点为结束节点，无需生成任务，流程结束`);
        api.finishProcess(processId);
        // 需补充流程状态信息，并入库
        return true;
      }
      // 检查当前任务是否是多人任务，如果是多人任务需要等所有人都提交后才能进入下一环节
      if (nodeType === 'multi') {
        log.info(`当前节点为并行任务节点，即将检查兄弟任务状态是否全部完成`);
        taskIdList = await redisClinet.smembersAysnc(`task_next:${prevTaskId}`);
        for(let brotherTaskId of taskIdList){
          if(brotherTaskId !== taskId){
            let { status } = await redisClinet.getAsync(`taskStatus:${brotherTaskId}`);
            if (status !== '02') {
              log.info(`存在未完成的兄弟任务(${brotherTaskId})，终止生成下一环节任务`);
              return true;
            }
          }
        }
        log.info(`兄弟节点任务均已完成，继续准备下一环节任务`);
      }

      let { flowCode, flowVersion } = await redisClinet.getAsync(
        `process:${processId}`
      );
      let nextTaskId = [];
      let nextNodeTemplate =
        flowTemplates[`${flowCode}@${flowVersion}`][nextTaskNodeCode];
      switch (nextNodeTemplate.nodeType) {
        case 'normal': // 新建一般抢占式
          let tmpTaskId = await createTask({
            title: nextNodeTemplate.nodeName,
            url: nextNodeTemplate.nodeUrl,
            userList: nextUserList,
            prevTaskId: taskId,
            processInfo: {
              processId: processId
            },
            nodeInfo: {
              nodeName: nextNodeTemplate.nodeName,
              nodeCode: nextNodeTemplate.nodeCode,
              nodeType: nextNodeTemplate.nodeType,
              nextCode: nextNodeTemplate.next
            }
          });
          nextTaskId.push(tmpTaskId);
          break;
        case 'multi': // 新建多人任务
          for(let tmpUser of nextUserList){
            let tmpTaskId = await createTask({
              title: nextNodeTemplate.nodeName,
              url: nextNodeTemplate.nodeUrl,
              userList: [tmpUser],
              prevTaskId: taskId,
              processInfo: {
                processId: processId
              },
              nodeInfo: {
                nodeName: nextNodeTemplate.nodeName,
                nodeCode: nextNodeTemplate.nodeCode,
                nodeType: nextNodeTemplate.nodeType,
                nextCode: nextNodeTemplate.next
              }
            });
            nextTaskId.push(tmpTaskId);
          }
          break;
        case 'subFlow': // 创建子流程
          let [flowCode, flowVersion] = nextNodeTemplate.nodeUrl.split('@');
          for(let tmpUser of nextUserList){
            let tmpTaskId = await api.initProcess(tmpUser, flowCode, flowVersion);
            nextTaskId.push(tmpTaskId);
          }
        default:
          break;
      }
      log.info(`生成下一环节任务(${nextTaskId})，提交任务结束`);
      return nextTaskId;
    }
  };

  return api;
};

