const redisClinet = require('../dao/RedisClient');
const uuid = require('node-uuid');
const express = require('express');
const moment = require('moment')
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
function checkUserAndTask(response, taskId, user, checkOkHandler) {
  if (!user) {
    throwError(response, 'TASK0004', '未传输用户信息');
    return;
  }
  checkTaskExist(response, taskId, checkOkHandler);
}

function checkTaskExist(response, taskId, checkOkHandler){
  redisClinet.exists(`task:${taskId}`, success => {
    if (!success) {
      throwError(response, 'TASK0002', '任务不存在');
    } else {
      checkOkHandler()
    }
  });
}

function checkUserDrawedTask(response, taskId, user, checkOkHandler) {
  redisClinet.get(`taskStatus:${taskId}`, ({ status, userId }) => {
    if (status !== '01' || userId !== user) {
      throwError(response, 'TASK0006', '用户未领取该任务');
    } else {
      checkOkHandler();
    }
  });
}

function getNowTimeString(){
  return moment(new Date).format("YYYY-MM-DD HH:mm:ss");
}

/**
 * 领取任务 
 * taskId: 任务ID
 * user: 领取用户Id
 */
router.post('/drawTask', (req, res, next) => {
  const { taskId, user } = req.body;
  checkUserAndTask(res, taskId, user, () => {
    //同时领取时有并发风险
    redisClinet.get(`taskStatus:${taskId}`, ({ status, userId }) => {
      if (status === '01' && userId === user) {
        res.end(JSON.stringify({ success: true }));
      } else if (status === '00') {
        redisClinet.smembers(`taskUser:${taskId}`, userList => {
          if (userList.indexOf(user) == -1) {
            throwError(res, 'TASK0005', '任务不属于该用户');
          }
          userList.forEach(tmpUser => {
            if (tmpUser !== user) {
              redisClinet.zrem(`u_todo:${tmpUser}`, taskId);
            }
          });
          redisClinet.set(`taskStatus:${taskId}`, {
            status: '01', //领取
            userId: user
          })
          redisClinet.lpush(`taskFlow:${taskId}`, {
            time: getNowTimeString(),
            action: `draw by ${user}`
          })
          res.end(JSON.stringify({ success: true }));
        });
      } else {
        throwError(res, 'TASK0003', '任务无法被领取');
      }
    })
  });
})

/**
 * 释放任务 
 * taskId: 任务ID
 * user: 领取用户Id
 */
router.post('/undrawTask', (req, res, next) => {
  const { taskId, user } = req.body;
  checkUserAndTask(res, taskId, user, () => {
    checkUserDrawedTask(res, taskId, user, () => {
      redisClinet.smembers(`taskUser:${taskId}`, userList => {
        userList.forEach(tmpUser => {
          if (tmpUser !== user) {
            redisClinet.zadd(`u_todo:${tmpUser}`, new Date().getTime(), taskId);
          }
        });
        redisClinet.set(`taskStatus:${taskId}`, {
          status: '00'
        })
        redisClinet.lpush(`taskFlow:${taskId}`, {
          time: getNowTimeString(),
          action: `undraw by ${user}`
        })
        res.end(JSON.stringify({ success: true }));
      });
    })
  });
});


/**
 * 提交任务 
 * taskId: 任务ID
 * user: 领取用户Id
 */
router.post('/commitTask', (req, res, next) => {
  const { taskId, user, comment } = req.body;
  checkUserAndTask(res, taskId, user, () => {
    checkUserDrawedTask(res, taskId, user, () => {

      redisClinet.set(`taskStatus:${taskId}`, {
        status: '02', //完成
        userId: user
      })
      redisClinet.zrem(`u_todo:${user}`, taskId);
      redisClinet.zadd(`u_done:${user}`, new Date().getTime(), taskId);
      redisClinet.lpush(`taskFlow:${taskId}`, {
        time: getNowTimeString(),
        action: `commit by ${user}`
      })
      redisClinet.get(`task:${taskId}`, taskInfo => {
        if(taskInfo.processId){
          redisClinet.lpush(`process_comment:${taskInfo.processId}`,{
            user,
            comment: comment ? comment : '',
            time: moment(new Date).format("YYYY-MM-DD HH:mm:ss")
          })
        }
      })
      res.end(JSON.stringify({ success: true }));
    });
  });
});

/**
 * 领取并提交任务 
 * taskId: 任务ID
 * user: 领取用户Id
 */
router.post('/drawAndCommitTask', (req, res, next) => {
  const { taskId, user, comment } = req.body;
  checkUserAndTask(res, taskId, user, () => {
    redisClinet.get(`taskStatus:${taskId}`, ({ status, userId }) => {
      if (status === '02' && userId === user) {
        res.end(JSON.stringify({ success: true }));
      } else if (status === '00' || (status === '01' && userId === user)) {
        redisClinet.smembers(`taskUser:${taskId}`, userList => {
          if (userList.indexOf(user) == -1) {
            throwError(res, 'TASK0005', '任务不属于该用户');
          }
          userList.forEach(tmpUser => {
            if (tmpUser !== user) {
              redisClinet.zrem(`u_todo:${tmpUser}`, taskId);
            }
          });
          redisClinet.set(`taskStatus:${taskId}`, {
            status: '02', //完成
            userId: user
          })
          redisClinet.zadd(`u_done:${user}`, new Date().getTime(), taskId);
          redisClinet.lpush(`taskFlow:${taskId}`, {
            time: getNowTimeString(),
            action: `draw&commit by ${user}`
          })
          redisClinet.get(`task:${taskId}`, taskInfo => {
            if(taskInfo.processId){
              redisClinet.lpush(`process_comment:${taskInfo.processId}`,{
                user,
                comment: comment ? comment : '',
                time: moment(new Date).format("YYYY-MM-DD HH:mm:ss")
              })
            }
          })
          res.end(JSON.stringify({ success: true }));
        });
      }else {
        throwError(res, 'TASK0003', '任务无法被完成');
      }
    })
  });
});

/**
 * 关闭任务 
 * taskId: 任务ID
 */
router.post('/closeTask', (req, res, next) => {
  const { taskId } = req.body;
  checkTaskExist(res, taskId, () => {
    redisClinet.get(`taskStatus:${taskId}`, ({ status, userId }) => {
      switch(status){
        case '03':
          res.end(JSON.stringify({ success: true }));
          break;
        case '02':
          throwError(res, '', '任务已完成，不可关闭');
          break;
        case '01':
          redisClinet.zrem(`u_todo:${userId}`, taskId);
          break;
        case '00':
          redisClinet.smembers(`taskUser:${taskId}`, userList => {
            userList.forEach(tmpUser => {
              redisClinet.zrem(`u_todo:${tmpUser}`, taskId);
            });
          });
          break;
      }
      redisClinet.set(`taskStatus:${taskId}`, {
        status: '03' //已取消
      })
      redisClinet.lpush(`taskFlow:${taskId}`, {
        time: getNowTimeString(),
        action: `close`
      });
      res.end(JSON.stringify({ success: true }));
    });
  })
});


/**
 * 保存任务信息 
 * taskId: 任务ID
 */
router.post('/saveTask', (req, res, next) => {
  const { taskId, processInfo:{
    processId, ...processInfo
  }, ...taskInfo } = req.body;
  checkTaskExist(response, taskId, () => {
    if(processId){
      redisClinet.get(`process:${processId}`, content => {
        baseProcessInfo = content ? content : {};
        redisClinet.set(`process:${processId}`, {...baseProcessInfo, ...processInfo});
      })
      redisClinet.lpush(`process_task:${processId}`,taskId);
    }
    redisClinet.get(`taskInfo:${taskId}`, content => {
      redisClinet.set(`taskInfo:${taskId}`, {...content, ...taskInfo});
    })
    redisClinet.lpush(`taskFlow:${taskId}`, {
      time: getNowTimeString(),
      action: `save`
    });
    res.end(JSON.stringify({ success: true }));
  });
});

/**
 * 撤回下步待办
 * taskId: 任务ID
 */
router.post('/rollbackNextProcessTask', (req, res, next) => {
  const { taskId } = req.body;
  checkTaskExist(res, taskId, () => {
    redisClinet.get(`taskStatus:${taskId}`, ({ status, userId }) => {
      if (status !== '02') {
        throwError(res, '', '任务尚未被完成');
      } else {
        redisClinet.get(`task:${taskId}`, taskInfo => {
          if(!taskInfo.processId){
            throwError(res, '', '任务无流程信息，无法撤回');
          }else{
            redisClinet.lrange(`process_task:${taskInfo.processId}`, 0, -1, taskIds => {
              let index = taskIds.indexOf(taskId);
              if(index !== 1){
                throwError(res, '', '找不到需要撤回的任务项');
              } else {
                let nextTaskId = taskIds[0];
                redisClinet.get(`taskStatus:${nextTaskId}`, ({ status }) => {
                  if (status !== '00'){
                    throwError(res, '', '任务状态不允许撤回');
                  } else {
                    let multi = redisClinet.multi();
                    redisClinet.smembers(`taskUser:${nextTaskId}`, userList => {
                      userList.forEach(tmpUser => {
                        multi.zrem(`u_todo:${tmpUser}`, nextTaskId);
                      });
                    });
                    multi.set(`taskStatus:${nextTaskId}`, JSON.stringify({
                      status: '03' //已取消
                    }));
                    multi.lpop(`process_task:${taskInfo.processId}`);
                    multi.lpop(`process_comment:${taskInfo.processId}`);
                    multi.lpush(`taskFlow:${nextTaskId}`, JSON.stringify({
                      time: getNowTimeString(),
                      action: `rollback&close by ${userId}`
                    }));
                    multi.zrem(`u_done:${userId}`, taskId);
                    multi.zadd(`u_todo:${userId}`, new Date().getTime(), taskId);
                    multi.set(`taskStatus:${taskId}`, JSON.stringify({
                      status: '01', //已领取
                      user: userId
                    }));
                    multi.lpush(`taskFlow:${taskId}`, JSON.stringify({
                      time: getNowTimeString(),
                      action: `rollback by ${userId}`
                    }));
                    multi.exec((err,result) => {
                      res.end(JSON.stringify({ success: true }));
                    })
                  }
                });
              }
            });
          }
        });
      }
    });
  })
});


module.exports = router;