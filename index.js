const express = require('express');
const bodyParser = require('body-parser');
const log = require('./logger').getLogger('main');

const demo = require('./routers/demo');
const addTask = require('./routers/addTask');
const updateTask = require('./routers/updateTask');
const queryTask = require('./routers/queryTask');

const app = express();
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress
  );
}
//打印请求日志
app.use((req, res, next) => {
  log.info(`[${getClientIp(req)}] ${req.method} ${req.url}`);
  next();
});

app.use(bodyParser.json());
// 设置请求头
// application/json  接口返回json数据
// charset=utf-8 解决json数据中中文乱码
app.use('*', function(request, response, next) {
  response.writeHead(200, { 'Content-Type': 'application/json;charset=utf-8' });
  next();
});

app.get('/', (req, rsp) => {
  rsp.end('hello world!');
});
app.use('/', demo);
app.use('/api/v1/', addTask, updateTask, queryTask);

//错误处理
app.use((err, req, res, next) => {
  log.error(err.stack);
  res.status(500).end(JSON.stringify({ error: err.stack }));
  next();
});

//处理404
app.use((req, res, next) => {
  log.error('404 error');
  res.status(404).end(JSON.stringify({ error: '404 错误!' }));
});

app.listen(3000, function() {
  console.log('Express is listening to http://localhost:3000');
});
