const redisClinet = require('../dao/RedisClient');
const uuid = require('node-uuid');  
const express = require('express');
const router = express.Router();
const ErrorBo = require('../bo/ErrorBo');
const TaskBo = require('../bo/TaskBo');
/**
 * 新增任务 
 * title： 任务标题
 * url： 任务URL
 * processId: 流程ID
 * userList[string]: 用户列表
 */
router.post('/addTask', (req,res,next) => {
  let { title, url, processId, userList } = req.body;
  if(userList && userList instanceof Array && userList.length > 0){
    let tmpTaskId = uuid.v4();
    console.log(tmpTaskId);
    //生成一个Redis内唯一的任务ID
    let newIdFunc = function(){
      redisClinet.setnx(`task:${tmpTaskId}`,'bbb',success => {
        if(success){
          let taskBo = new TaskBo(title, url, tmpTaskId, processId);
          redisClinet.set(`task:${tmpTaskId}`, taskBo);
          redisClinet.sadd(`taskUser:${tmpTaskId}`, userList);
          redisClinet.set(`taskStatus:${tmpTaskId}`, {
            status: '00' //待办
          });
          userList.forEach(userId => {
            redisClinet.zadd(`u:${userId}`,new Date().getTime(),tmpTaskId);
          });
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