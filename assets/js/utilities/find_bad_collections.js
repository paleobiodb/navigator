var http = require('http'),
    fs = require('fs');
    exec = require('child_process').exec,
    querystring = require('querystring');

function getJSON() {
  var url = 'http://paleobiodb.org/data1.1/colls/list.json?lngmin=-180&lngmax=180&latmin=-90&latmax=90&limit=999999999999&show=time'
  // Make the GET request
  http.get(url, function(res) {
      var body = '';
      res.on('data', function(chunk) {
          body += chunk;
      });

      res.on('end', function() {
          var response= JSON.parse(body);
          console.log("Loaded " + response.records.length + " collections");
          var problems = [];
          for (var j=0; j<response.records.length; j++) {
            if (response.records[j].cxi == 751 || response.records[j].cxi == 1 || response.records[j].cxi == 2 || response.records[j].cxi == 3) {
              problems.push(response.records[j]);
            }
            if (j == (response.records.length -1)) {
              fs.writeFile("problems.json", JSON.stringify(problems), function(err) {
                if (err) { console.log(err) } else {
                  console.log("I have " + problems.length + " problems");
                }
              });
            }
          }
      });
  }).on('error', function(err) {
        console.log(err);
  });
} // End getJSON()
getJSON();