const api = require('./api');

async function normal(reqId) {
  console.log('************************************')
  console.log('新建流程')
  console.log('************************************')
  let { processId, taskId } = await api(reqId).initProcess('bai_zj','demoFlow');
  console.log('************************************')
  console.log('创建者提交')
  console.log('************************************')
  let nextTaskIds = await api(reqId).commitTask(taskId,'bai_zj',['songzhengxuan','wangy_1121'],'node_2');
  console.log('************************************')
  console.log('领取任务')
  console.log('************************************')
  await api(reqId).receiveTask(nextTaskIds[0],'songzhengxuan');
  console.log('************************************')
  console.log('提交至多任务节点')
  console.log('************************************')
  let nextTaskIds2 = await api(reqId).commitTask(nextTaskIds[0],'songzhengxuan',['bai_zj','wangy_1121','guoy'],'node_3');
  console.log('************************************')
  console.log('第一人领取并处理任务')
  console.log('************************************')
  await api(reqId).receiveTask(nextTaskIds2[0],'bai_zj');
  await api(reqId).commitTask(nextTaskIds2[0],'bai_zj',['bai_zj','wangy_1121','guoy'],'node_4');
  console.log('************************************')
  console.log('第二人领取并处理任务')
  console.log('************************************')
  await api(reqId).receiveTask(nextTaskIds2[1],'wangy_1121');
  await api(reqId).commitTask(nextTaskIds2[1],'wangy_1121',['bai_zj','wangy_1121','guoy'],'node_4');
  console.log('************************************')
  console.log('最后一人领取并处理任务')
  console.log('************************************')
  await api(reqId).receiveTask(nextTaskIds2[2],'guoy');
  await api(reqId).commitTask(nextTaskIds2[2],'guoy',['bai_zj','wangy_1121','guoy'],'node_4');
}

async function subFlowTest(reqId) {
  // console.log('************************************')
  // console.log('新建流程')
  // console.log('************************************')
  // let { processId, taskId } = await api(reqId).initProcess('bai_zj','demoFlow');
  // console.log('************************************')
  // console.log('创建子流程')
  // console.log('************************************')
  // await api(reqId).initSubProcess(taskId, ['wangy_1121','songzhengxuan'], 'subFlow');

  console.log('************************************')
  console.log('关闭子流程')
  console.log('************************************')
  await api(reqId).finishProcess('fc8f287e-e017-4a32-ba26-b7f1ee4e872a');

}


subFlowTest('12345');
// func('54321');

// var sleep =  time =>
//   new Promise( (resolve, reject) => {
//     setTimeout(function () {
//       // 返回 ‘ok’
//       resolve('ok');
//     }, time);
//   });

// var start = async function () {
//   console.log('hello');
//   let result = await sleep(3000);
//   console.log(result); // 收到 ‘ok’
// };

// start();