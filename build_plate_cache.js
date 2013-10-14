/* Script for getting all 200 years of coastlines from the 
Caltech GPlates service. To run, you must have Node.js 
and TopoJSON installed. See http://nodejs.com to download the
Node installer, and then install topojson with 
'sudo npm -g topojson'. Also, you much create the folders
'tempjson' and 'plates' in the directory of this file and then
invoke it with 'node get_coastlines.js'. */

var http = require('http'),
    fs = require('fs');
    exec = require('child_process').exec;

// Keep track of the year
var i = 0;

getJSON();

function getJSON() {
  var url = 'http://gplates.gps.caltech.edu:8080/reconstruct_polygons/?&time=' + i + '&data_type=coastlines';

  // Make the GET request
  http.get(url, function(res) {
      var body = '';
      res.on('data', function(chunk) {
          body += chunk;
      });

      res.on('end', function() {
          var plateResponse= JSON.parse(body)
          // console.log("Got response for year ", i);
          // Save result to a temp file
          fs.writeFile("tempjson/plates" + i + ".json", JSON.stringify(plateResponse), function(err) {
              if(err) {
                  console.log(err);
              } else {
                  //console.log("The file for year ", i, "was saved");
                  // Convert to Topojson, simplifying and prerving the attributes NAME and PLATE_ID
                  exec('topojson -o plates/plate' + i +'.json -p NAME,PLATE_ID -s 7e-9 -- tempjson/plates' + i + '.json', function(err, result) {
                    if (err) {
                      console.log(err);
                    } else {
                      // Delete the original GeoJSON
                      fs.unlink('tempjson/plates' + i + '.json');
                      console.log("Year " , i, " was converted to TopoJSON");
                      i += 1;
                      if (i < 601) {
                        getJSON();
                      } else {
                        console.log("Done");
                      }
                    }
                  });
              }
          }); 
      });
  }).on('error', function(err) {
        console.log(err);
  });
} // End getJSON()