const redisClinet = require('../dao/RedisClient');

const express = require('express');
const router = express.Router();
// 初始数据
var data = {
    status: '100', 
    msg: '操作成功',
    data: {
        userId: '123456',
        userName: 'hgdqstudio',
        blog: 'http://hgdqstudio.online'
    }
};
// get请求
router.get('/index', function (req, res, next) {
    res.end('index');
});

router.get('/add', (req, res, next) => {
    redisClinet.set('hello', data);
    redisClinet.increase('inc' , value => {
        res.end(value + '');
        next();
    }, 2)

})
router.get('/show', (req, res, next) => {
    redisClinet.get('hello',  value => {
        res.end(JSON.stringify(value));
        next();
    })
})
module.exports = router;