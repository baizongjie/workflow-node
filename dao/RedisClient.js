// redis 链接
const redis = require('redis');
const client = redis.createClient('6379', '127.0.0.1');

// redis 链接错误
client.on("error", function (error) {
  console.log(error);
});

function getValueString(value) {
  if (typeof value == 'object') {
    return JSON.stringify(value);
  } else {
    return value;
  }
}

module.exports = {
  set: (key, value) => {
    client.set(key, getValueString(value));
  },
  setnx: (key, value, callback) => {
    client.setnx(key,
      typeof value == 'object' ? JSON.stringify(value) : value,
      (err, res) => {
        if (res === 1) {
          callback(true);
        } else {
          callback(false);
        }
      })
  },
  sadd: (key, ...value) => {
    client.sadd(key, ...value);
  },
  smembers: (key, callback) => {
    client.smembers(key, (err, res) => {
      callback(res);
    })
  },
  sismember: (setName, key, callback) => {
    client.sismember(setName, key, (err, res) => {
      if (res === 1) {
        callback(true);
      } else {
        callback(false);
      }
    })
  },
  lpush: (key, value) => {
    client.lpush(key, getValueString(value));
  },
  lpop: key => {
    client.lpop(key);
  },
  lrange: (key, leftIndex, rightIndex, callback) => {
    client.lrange(key, leftIndex, rightIndex, (err, res) => {
      callback(res.map(item => {
        if (typeof item == 'string') {
          try{
            return JSON.parse(item);
          }catch(err){
            return item;
          }
        } else {
          return item;
        } 
      }))
    });
  },
  zadd: (key, score, value) => {
    client.zadd(key, score, value);
  },
  zrem: (setName, key) => {
    client.zrem(setName, key);
  },
  zrange: (setName, leftIndex, rightIndex, callback) => {
    client.zrange(setName, leftIndex, rightIndex, (err, res) => {
      callback(res);
    })
  },
  zrevrange: (setName, leftIndex, rightIndex, callback) => {
    client.zrevrange(setName, leftIndex, rightIndex, (err, res) => {
      callback(res);
    })
  },
  get: (key, callback) => client.get(key, (err, res) => {
    if (typeof res == 'string') {
      callback(JSON.parse(res));
    } else {
      callback(res);
    }
  }),
  mget: (keys, callback) => client.mget(keys, (err, res) => {
    if(!res){
      callback([]);
    }else{
      callback(res.map(item => {
        return typeof item == 'string' ? JSON.parse(item) : item;
      }));
    }
  }),
  exists: (key, callback) => client.exists(key, (err, res) => {
    if (res === 1) {
      callback(true);
    } else {
      callback(false);
    }
  }),
  increase: (key, callback, step) => {
    if (step && (typeof step == 'number')) {
      client.incrby(key, step, (err, res) => {
        callback(res);
      });
    } else {
      client.incr(key, (err, res) => {
        callback(res);
      })
    }
  },
  multi: () => {
    return client.multi();
  }
}