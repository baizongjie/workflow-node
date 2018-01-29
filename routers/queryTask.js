const redisClinet = require('../dao/RedisClient');
const uuid = require('node-uuid');  
const express = require('express');
const router = express.Router();
const ErrorBo = require('../bo/ErrorBo');
const TaskBo = require('../bo/TaskBo');
const moment = require('moment')

function throwError(response, errorCode, errorMessage) {
  response.end(JSON.stringify(new ErrorBo(errorCode, errorMessage)));
}

/**
 * 查询用户待办任务
 * userId: 用户ID
 * page: 页数
 * pageSize: 每页条数
 */
router.post('/getTodoTaskList', (req,res,next) => {
  let { userId, page, pageSize } = req.body;
  let leftIndex = (page - 1) * pageSize;
  let rightIndex = pageSize * page - 1 ;

  redisClinet.zrange(`u_todo:${userId}`, leftIndex, rightIndex, taskIds => {
    redisClinet.mget(taskIds.map(taskId => {
      return `task:${taskId}`;
    }), result => {
      console.log(result);
      res.end(JSON.stringify(result));
    })
  })
});

/**
 * 查询用户已办任务
 * userId: 用户ID
 * page: 页数
 * pageSize: 每页条数
 */
router.post('/getDoneTaskList', (req,res,next) => {
  let { userId, page, pageSize } = req.body;
  let leftIndex = (page - 1) * pageSize;
  let rightIndex = pageSize * page - 1 ;

  redisClinet.zrange(`u_done:${userId}`, leftIndex, rightIndex, taskIds => {
    redisClinet.mget(taskIds.map(taskId => {
      return `task:${taskId}`;
    }), result => {
      console.log(result);
      res.end(JSON.stringify(result));
    })
  })
});

/**
 * 查询任务信息
 * taskID
 */
router.post('/getTaskInfo', (req,res,next) => {
  let { taskId } = req.body;
  redisClinet.get(`task:${taskId}`, taskInfo => {
    if(!taskInfo){
      throwError(res,"",`任务不存在:${taskId}`);
    }else{
      redisClinet.mget([`taskInfo:${taskId}`,`taskStatus:${taskId}`],result => {
        console.log(result);
        result.map(item => {
          taskInfo = {...taskInfo, ...item};
        })
        res.end(JSON.stringify(taskInfo));
      })

    }
  })
});

module.exports = router;