const redisClinet = require('../dao/RedisClient');
const uuid = require('node-uuid');
const express = require('express');
const router = express.Router();
const ErrorBo = require('../bo/ErrorBo');
const TaskBo = require('../bo/TaskBo');


function throwError(response, errorCode, errorMessage) {
  response.end(JSON.stringify(new ErrorBo(errorCode, errorMessage)));
}
/**
 * 检查任务是否存在以及用户是否合法
 * @param {*} response 
 * @param {*} taskId 
 * @param {*} user 
 * @param {*} checkOkHandler 
 */
function checkTaskAndUser(response, taskId, user, checkOkHandler) {
  if (!user) {
    throwError(response, 'TASK0004', '未传输用户信息');
    return;
  }
  redisClinet.exists(`task:${taskId}`, success => {
    if (!success) {
      throwError(response, 'TASK0002', '任务不存在');
    } else {
      checkOkHandler()
    }
  });
}


/**
 * 领取任务 
 * taskId: 流程ID
 * user: 领取用户Id
 */
router.post('/drawTask', (req, res, next) => {
  const { taskId, user } = req.body;
  checkTaskAndUser(res, taskId, user, () => {
    //同时领取时有并发风险
    redisClinet.get(`taskStatus:${taskId}`, ({ status }) => {
      if (status !== '00') {
        throwError(res, 'TASK0003', '任务无法被领取');
      } else {
        redisClinet.smembers(`taskUser:${taskId}`, userList => {
          if (userList.indexOf(user) == -1) {
            throwError(res, 'TASK0005', '任务不属于该用户');
          }
          userList.forEach(tmpUser => {
            if (tmpUser !== user) {
              redisClinet.zrem(`u:${tmpUser}`, taskId);
            }
          });
          redisClinet.set(`taskStatus:${taskId}`, {
            status: '01',
            userId: user
          })
          res.end(JSON.stringify({ success: true }));
        });
      }
    })
  });
})

/**
 * 释放任务 
 * taskId: 流程ID
 * user: 领取用户Id
 */
router.post('/undrawTask', (req, res, next) => {
  const { taskId, user } = req.body;
  checkTaskAndUser(res, taskId, user, () => {
    redisClinet.get(`taskStatus:${taskId}`, ({ status, userId }) => {
      if(status !== '01' || userId !== user){
        throwError(res, 'TASK0005', '任务不属于该用户');
      }else{
        redisClinet.smembers(`taskUser:${taskId}`, userList => {
          userList.forEach(tmpUser => {
            if (tmpUser !== user) {
              redisClinet.zadd(`u:${tmpUser}`,new Date().getTime(),taskId);
            }
          });
          redisClinet.set(`taskStatus:${taskId}`, {
            status: '00'
          })
          res.end(JSON.stringify({ success: true }));
        });
      }
    });
  });
});





module.exports = router;