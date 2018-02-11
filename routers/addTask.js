const redisClinet = require('../dao/RedisClient');
const uuid = require('node-uuid');  
const express = require('express');
const router = express.Router();
const ErrorBo = require('../bo/ErrorBo');
const TaskBo = require('../bo/TaskBo');
const moment = require('moment')
const workflowApi = require('../workflow/api');

function getNowTimeString(){
  return moment(new Date).format("YYYY-MM-DD HH:mm:ss");
}

/**
 * 新增任务 
 * title： 任务标题
 * url： 任务URL
 * processInfo: {流程信息
 *   processId: 流程ID
 *   其他属性
 * }
 * 其他属性
 * userList[string]: 用户列表
 */
router.post('/addTask', (req,res,next) => {
  let { title, url, userList, prevTaskId, processInfo:{
    processId, ...processInfo
  }, ...taskInfo } = req.body;
  if(userList && userList instanceof Array && userList.length > 0){
    let tmpTaskId = uuid.v4();
    console.log(tmpTaskId);
    let taskBo = new TaskBo(title, url, tmpTaskId, processId);
    //生成一个Redis内唯一的任务ID
    let newIdFunc = function(){
      redisClinet.setnx(`task:${tmpTaskId}`,taskBo, success => {
        if(success){
          redisClinet.set(`taskInfo:${tmpTaskId}`, taskInfo);
          redisClinet.sadd(`taskUser:${tmpTaskId}`, userList);
          redisClinet.set(`taskStatus:${tmpTaskId}`, {
            status: '00' //待办
          });
          redisClinet.lpush(`taskFlow:${tmpTaskId}`, {
            time: getNowTimeString(),
            action: `new to ${userList}`
          })
          userList.forEach(userId => {
            redisClinet.zadd(`u_todo:${userId}`,new Date().getTime(),tmpTaskId);
          });
          if(prevTaskId){
            redisClinet.exists(`task:${prevTaskId}`, success => {
              redisClinet.sadd(`task_next:${prevTaskId}`,tmpTaskId);
            })
          }
          if(processId){
            redisClinet.get(`process:${processId}`, content => {
              baseProcessInfo = content ? content : {};
              redisClinet.set(`process:${processId}`, {...baseProcessInfo, ...processInfo});
            })
            redisClinet.lpush(`process_task:${processId}`,tmpTaskId);
          }
          res.end(JSON.stringify({taskId:tmpTaskId}));
          next();
        }else{
          console.log('失败，重试');
          tmpTaskId = uuid.v4();
          newIdFunc();
        }
      })
    };
    newIdFunc();
  }else{
    res.end(JSON.stringify(new ErrorBo('TASK0001','无有效用户列表')));
  }
})

module.exports = router;