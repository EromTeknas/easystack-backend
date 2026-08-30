const Redis = require('ioredis');
const redis = new Redis();
redis.keys('*authorization*').then(keys => {
  if (keys.length > 0) {
    redis.del(keys).then(() => {
      console.log('Cleared authorization cache');
      process.exit(0);
    });
  } else {
    console.log('No cache found');
    process.exit(0);
  }
});
