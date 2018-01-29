const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const demo = require('./routers/demo');
const addTask = require('./routers/addTask');
const updateTask = require('./routers/updateTask');
const queryTask = require('./routers/queryTask');

app.use(bodyParser.json());
// 设置请求头
// application/json  接口返回json数据
// charset=utf-8 解决json数据中中文乱码
app.use("*", function(request, response, next) {
    response.writeHead(200, { "Content-Type": "application/json;charset=utf-8" });
    next();
});

app.get('/',(req,rsp)=>{
    rsp.end('hello world!');
})
app.use('/', demo);
app.use('/api/v1/', addTask);
app.use('/api/v1/', updateTask);
app.use('/api/v1/', queryTask);

app.listen(3000, function() { 
    console.log('Express is listening to http://localhost:3000'); 
});