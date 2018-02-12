const api = require('./api');

api.initProcess('bai_zj','demoFlow');

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