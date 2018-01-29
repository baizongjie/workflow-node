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
    }, 2)
})

router.get('/show', (req, res, next) => {
    let mult = redisClinet.multi();
    mult.set('key1','1');
    redisClinet.set('key1','2');
    mult.set('key2','3');
    mult.exec((err,result) => {
        mult.discard();
        res.end(JSON.stringify({result:'ok'}));
    })
})
module.exports = router;