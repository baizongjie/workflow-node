const redisClinet = require('../dao/RedisClient');

const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');

/**
 * 新增任务 JSON
 * title： 任务标题
 * url： 任务URL
 * userList[string]: 用户列表
 */
router.post('/addTask', (req,res,next) => {
  let { title, url, userList } = req.body;
  console.log(title);
  res.end(JSON.stringify({a:'bbbbbbbbbb'}));
  next();
})

module.exports = router;