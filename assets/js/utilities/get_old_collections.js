/* Gets second level bins for global view old than Phanerozoic */

var http = require('http'),
    fs = require('fs');
    exec = require('child_process').exec;

var i = 0;

getIntervals();

function getIntervals() {
  var url = 'http://paleobiodb.org/data1.1/intervals/list.json?scale=1&order=older&max_ma=4000';

  intervals = [];

  http.get(url, function(res) {
      var body = '';
      res.on('data', function(chunk) {
          body += chunk;
      });

      res.on('end', function() {
          var response = JSON.parse(body);
          
          var count = 0;
          response.records.forEach(function(d) {
            var tempInt = {"name": d.nam, "oid": d.oid, "mid": parseInt((d.lag + d.eag)/2)};
            if (tempInt.mid > 600) {
              intervals.push(tempInt);
            }
            count += 1;
          });

          if (count = response.records.length) {
            getJSON();
          }
          
      });
  });
}

function getJSON() {
  var url = 'http://paleobiodb.org/data1.1/colls/summary.json?lngmin=-180&lngmax=180&latmin=-90&latmax=90&level=2&limit=999999&interval=' + intervals[i].name + '&show=time';

  // Make the GET request
  http.get(url, function(res) {
      var body = '';
      res.on('data', function(chunk) {
          body += chunk;
      });

      res.on('end', function() {
          var response= JSON.parse(body),
              filename = intervals[i].name.split(' ').join('_');
              
          console.log("Got PaleoDB response for ", intervals[i].name);

          // Save result to a temp file
          fs.writeFile("../../../build/js/collections/" + filename + ".json", JSON.stringify(response), function(err) {
              if(err) {
                  console.log(err);
              } else {
                  console.log("The file for year ", intervals[i].name, "was saved");

                  i += 1;
                  if (i < intervals.length) {
                    getJSON();
                  } else {
                    console.log("Done!");
                  }
              }
          }); 
      });
  }).on('error', function(err) {
        console.log(err);
  });
} // End getJSON()