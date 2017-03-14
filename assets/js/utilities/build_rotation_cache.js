var http = require('http'),
    fs = require('fs');
    exec = require('child_process').exec,
    querystring = require('querystring');

getIntervals();

function getIntervals() {
  // var url = paleo_nav.dataUrl + paleo_nav.dataService + '/intervals/list.json?scale=1&order=age.desc&max_ma=4000';
  var url = paleo_nav.dataUrl + '/data1.1/intervals/list.json?scale=1&order=older&max_ma=4000';

  intervals = [];
  http.get(url, function(res) {
      var body = '';
      res.on('data', function(chunk) {
          body += chunk;
      });

      res.on('end', function() {
          var response = JSON.parse(body);
          response.records.forEach(function(d) {
            var tempInt = {"name": d.nam, "oid": d.oid, "mid": parseInt((d.lag + d.eag)/2)};
            if (tempInt.mid < 601) {
              intervals.push(tempInt);
            }
          });

          checkCollections();
      });
  });
}

function checkCollections() {
  fs.exists('../../../build/js/collections', function(exists) { 
    if(exists) {
      checkRotated();
    } else {
      fs.mkdir('../../../build/js/collections', function(e) {
        checkRotated();
      });
    }
  });
}

function checkRotated() {
  fs.exists('../../../build/js/rotatedIntervals', function(exists) { 
    if(exists) {
      getJSON();
    } else {
      fs.mkdir('../../../build/js/rotatedIntervals', function(e) {
        getJSON();
      });
    }
  });
}

function buildWKT(data) {
  var requestString = "";
  for(var i=0; i<data.length; i++) {
    requestString += "POINT(" + data[i].lat + " " + data[i].lng + " " + data[i].oid + "),"
  }
  requestString = requestString.slice(0, -1);
  requestString = encodeURI(requestString);
  return requestString;
}

var i = 0;

function getJSON() {
  var url = paleo_nav.dataUrl + paleo_nav.dataService + '/colls/summary.json?lngmin=-180&lngmax=180&latmin=-90&latmax=90&level=3&limit=999999&interval_id=' + intervals[i].oid + '&show=time';

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

                  var post_data = querystring.stringify({
                    'time': intervals[i].mid,
                    'points': 'GEOMETRYCOLLECTION(' + buildWKT(response.records) + ')',
                    'output': 'topojson'
                  });

                  var post_options = {
                    host: 'gplates.gps.caltech.edu',
                    port: '8080',
                    path: '/recon_points_2/',
                    method: 'POST',
                    headers: {
                      'Content-type': 'application/x-www-form-urlencoded',
                      'Content-Length': post_data.length
                    }
                  };

                  var gplatesResp = '';
                  var post_req = http.request(post_options, function(res) {
                    res.setEncoding('utf8');
                    res.on('data', function (chunk) {
                      gplatesResp += chunk;
                    });
                    res.on('end', function() {
                      fs.writeFile('../../../build/js/rotatedIntervals/' + filename + ".json", gplatesResp, function(err) {
                        if(err) {
                          console.log(err);
                        } else {
                          console.log("Saved GPlates rotation for ", intervals[i].name);
                          i += 1;
                          if (i < intervals.length) {
                            getJSON();
                          } else {
                            console.log("Done!");
                          }
                        }
                      });
                    });
                  });
                  post_req.write(post_data);
                  post_req.end();
              }
          }); 
      });
  }).on('error', function(err) {
        console.log(err);
  });
} // End getJSON()