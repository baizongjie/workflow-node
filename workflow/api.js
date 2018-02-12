const redisClinet = require('../dao/RedisClient');
const flowTemplates = require('./init');
const TaskBo = require('../bo/TaskBo');
const ProcessBo = require('../bo/ProcessBo');
const log = require('../logger').getLogger('workfow_api');
const uuid = require('node-uuid');
const timeUtil = require('../util/TimeUtil');

/**
 * 创建任务
 */
async function createTask({ title, url, userList, prevTaskId, processInfo: {
    processId, ...processInfo
}, ...taskInfo }) {
    if (userList && userList instanceof Array && userList.length > 0) {
        log.info(`创建任务:${taskInfo.nodeInfo.nodeCode}`);
        let taskId = uuid.v4();
        let taskBo = new TaskBo(title, url, taskId, processId);
        // 生成一个Redis内唯一的任务ID
        let newIdFunc = async () => {
            let result = await redisClinet.setnxSync(`task:${taskId}`, taskBo);
            while (!result) {
                taskId = uuid.v4();
                newIdFunc();
            }
        }
        await newIdFunc();
        log.info(`生成任务实例，ID:${taskId}`);
        // 设置事务
        let multi = redisClinet.multi();

        multi.set(`taskInfo:${taskId}`, JSON.stringify(taskInfo));
        multi.sadd(`taskUser:${taskId}`, userList);
        multi.set(`taskStatus:${taskId}`, JSON.stringify({
            status: '00' //待办
        }));
        multi.lpush(`taskFlow:${taskId}`, JSON.stringify({
            time: timeUtil.getNowTimeString(),
            action: `new to ${userList}`
        }));
        userList.forEach(userId => {
            multi.zadd(`u_todo:${userId}`, new Date().getTime(), taskId);
        });
        if (prevTaskId && await redisClinet.existsAsync(`task:${prevTaskId}`)) {
            multi.sadd(`task_next:${prevTaskId}`, taskId);
        }
        let processInfo = await redisClinet.getAsync(`process:${processId}`);
        multi.set(`process:${processId}`, JSON.stringify({
            ...(processInfo ? processInfo : {}),
            ...processInfo
        }));
        multi.lpush(`process_task:${processId}`, taskId);
        let result = await redisClinet.runMultiAysnc(multi);
        log.info(`初始化任务相关信息完毕，ID:${taskId}`);
        return taskId;
    } else {
        return new ErrorBo('TASK0001', '无有效用户列表');
    }
}

/**
 * 检查任务是否存在以及用户是否合法
 * @param {*} taskId 
 * @param {*} user 
 */
async function checkUserAndTask(taskId, user) {
    if (!user) {
        return false;
    }
    return await checkTaskExist(taskId);
}

/**
 * 检查任务是否存在
 * 
 * @param {*} taskId 
 */
async function checkTaskExist(taskId) {
    return await redisClinet.existsAsync(`task:${taskId}`);
}

const api = {
    initProcess: async (creater, flowCode, flowVersion = 'latest') => {
        const flowTemplate = flowTemplates[`${flowCode}@${flowVersion}`];
        //检查参数合法性
        if (flowTemplate) {
            log.info(`流程初始化:${flowCode}@${flowTemplate.version}`)
            //初始化流程
            let processId = uuid.v4();
            let processBo = new ProcessBo(flowTemplate.flowName, flowTemplate.flowCode, flowTemplate.version);
            let newIdFunc = async () => {
                let result = await redisClinet.setnxSync(`process:${processId}`, processBo);
                while (!result) {
                    processId = uuid.v4();
                    newIdFunc();
                }
            }
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
                    nextCode: processNode.next
                }
            });
            //创建者自动领取任务
            await api.receiveTask(taskId, creater);
            log.info(`流程初始化完毕:${flowCode}@${flowTemplate.version}`)
            return {processId, taskId};
        } else {
            log.error(`流程模板不存在:${flowCode}@${flowVersion}`)
            return false;
        }
    },

    receiveTask: async (taskId, user) => {
        log.info(`用户${user}尝试领取任务，ID:${taskId}`);
        let result = await checkTaskExist(taskId);
        if(!result){
            log.error(`任务不存在，ID:${taskId}`);
            return false;
        }
        let { status, userId } = await redisClinet.getAsync(`taskStatus:${taskId}`);
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
            multi.set(`taskStatus:${taskId}`, JSON.stringify({
                status: '01', //领取
                userId: user
            }));
            multi.lpush(`taskFlow:${taskId}`, JSON.stringify({
                time: timeUtil.getNowTimeString(),
                action: `draw by ${user}`
            }));
            let result = await redisClinet.runMultiAysnc(multi);
            log.info(`领取任务完毕`);
            return true;
        } 
    },

    commitTask: (taskId, user, nextNodeCode, nextUserList) => {
        log.info(`用户${user}尝试提交任务，ID:${taskId}`);
    }
};

module.exports = api;