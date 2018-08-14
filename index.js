const fs = require('fs');

const SmartHome = require('./src');

fs.readFile(process.argv[2], 'utf8', function (err, data) {
  const sh = new SmartHome(JSON.parse(data));

  console.log(JSON.stringify(sh.getSchedule(), null, '  '));
});
