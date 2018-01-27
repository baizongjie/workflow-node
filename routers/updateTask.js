const redisClinet = require('../dao/RedisClient');
const uuid = require('node-uuid');  
const express = require('express');
const router = express.Router();
const ErrorBo = require('../bo/ErrorBo');
const TaskBo = require('../bo/TaskBo');


function throwError(response, errorCode, errorMessage){
  response.end(JSON.stringify(new ErrorBo(errorCode,errorMessage)));
}

/**
 * 领取任务 
 * taskId: 流程ID
 * user: 领取用户Id
 */
router.post('/drawTask', (req,res,next) => {
  const { taskId, user } = req.body;
  if(!user){
    throwError(res,'TASK0004','未传输用户信息');
    return;
  }
  redisClinet.exists(`task:${taskId}`, success => {
    if(!success){
      throwError(res,'TASK0002','任务不存在');
    }else{
      //同时领取时有并发风险
      redisClinet.get(`taskStatus:${taskId}`, ({status}) => {
        if(status !== '00'){
          throwError(res,'TASK0003','任务无法被领取');
        }else{
          redisClinet.smembers(`taskUser:${taskId}`, userList => {
            if(userList.indexOf(user) == -1){
              throwError(res,'TASK0005','任务不属于该用户');
            }
            userList.forEach(tmpUser => {
              if(tmpUser !== user){
                redisClinet.zrem(`u:${tmpUser}`,taskId);
              }
            });
            redisClinet.set(`taskStatus:${taskId}`, {
              status: '01',
              userId: user
            })
            res.end(JSON.stringify({success:true}));
          });
        }

      })

    }
  })
  
})

module.exports = router;