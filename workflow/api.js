const redisClinet = require('../dao/RedisClient');
const flowTemplates = require('./init');
const log = require('../logger').getLogger('workfow_api');
const uuid = require('node-uuid');  


const api = {
    initProcess: (creater, flowCode, flowVersion='latest') => {
        const flowTemplate = flowTemplates[`${flowCode}@${flowVersion}`];
        //检查参数合法性
        if(flowTemplate){
            log.info(`流程初始化:${flowCode}@${flowTemplate.version}`)
            //初始化流程

            // let tmpProcessId = uuid.v4();
            redisClinet.setnxSync('key','value').then(result => {
                log.info(result);
            });
            redisClinet.setnx('key', 'value', result => {
                log.info(result);
            });
            // let newIdFunc = function(){
            //     redisClinet.setnxSync()

            //     redisClinet.setnx(`task:${tmpTaskId}`,taskBo, success => {
            //       if(success){
                    
            //       }else{
            //         console.log('失败，重试');
            //         tmpTaskId = uuid.v4();
            //         newIdFunc();
            //       }
            //     })
            //   };
            //   newIdFunc();
            //初始化任务并领取

            return true;
        }else{
            log.error(`流程模板不存在:${flowCode}@${flowVersion}`)
            return false;
        }

    }    
};

module.exports = api;