/* Script for fixing bad coastlines */

var http = require('http'),
    fs = require('fs');
    exec = require('child_process').exec;

function checkTempjson() {
  fs.exists('../../../build/js/tempjson', function(exists) { 
    if(exists) {
      checkPlates();
    } else {
      fs.mkdir('../../../build/js/tempjson', function(e) {
        checkPlates();
      });
    }
  });
}

function checkPlates() {
  fs.exists('../../../build/js/plates', function(exists) { 
    if(exists) {
      getJSON();
    } else {
      fs.mkdir('../../../build/js/plates', function(e) {
        getJSON();
      });
    }
  });
}

function getIndex(data, term, property) {
  for(var i=0, len=data.length; i<len; i++) {
    if (data[i][property] === term) return i;
  }
  return -1;
}

var i = 0;

// Problematic intervals
var intervals = [{"name":"Selandian", "mid": 60}, {"name":"Maastrichtian", "mid": 69},{"name":"Albian", "mid": 106}, {"name":"Early Cretaceous", "mid": 122},{"name":"Middle Triassic", "mid":242},{"name":"Olenekian", "mid": 249},{"name":"Early Triassic", "mid":249}, {"name":"Artinskian", "mid":284}, {"name":"Sakmarian", "mid":292}, {"name":"Gzhelian", "mid":301}, {"name":"Mississippian", "mid":341}, {"name":"Visean", "mid":338}, {"name":"Tournaisian", "mid":352}, {"name":"Early Devonian", "mid":406}, {"name":"Pragian", "mid":409}, {"name":"Floian", "mid":473}, {"name":"Early Ordovician", "mid":477}, {"name": "Jiangshanian", "mid":491}, {"name":"Paibian", "mid":495}, {"name":"Furongian", "mid": 491}, {"name":"Guzhangian", "mid":498}, {"name":"Stage 2", "mid":525}];

function getJSON(interval) {
  if (interval) {
    var url = 'http://gplates.gps.caltech.edu:8080/reconstruct_polygons/?&time=' + intervals[i].mid + '&data_type=coastlines';

    // Make the GET request
    http.get(url, function(res) {
        var body = '';
        res.on('data', function(chunk) {
            body += chunk;
        });

        res.on('end', function() {
            var plateResponse= JSON.parse(body),
                filename = intervals[i].name.split(' ').join('_');

            saveFile(plateResponse, filename);
        });
    });
  } else {
    console.log("Done!");
  }
}

function removeSmall(data, filename) {
  var toRemove = [];

  for(var z=0; z<data.features.length; z++) {
    if(data.features[z].geometry.coordinates[0].length < 10) {
      toRemove.push(data.features[z].properties.FEATURE_ID);
    }

    if (z = data.features.length) {
      removeBad()
    }
  }

  for (var j=0; j<toRemove.length; j++) {
    var index = getIndex(plateResponse.features.properties, toRemove[j], "FEATURE_ID");
    plateResponse.features.splice(index, 1);
  }
}

function saveFile(data, filename) {
  // Save result to a temp file
  fs.writeFile("../../../build/js/tempjson/" + filename + ".json", JSON.stringify(data), function(err) {
      if(err) {
          console.log(err);
      } else {
          // Convert to Topojson, simplifying and prerving the attributes NAME and PLATE_ID
          exec('topojson -o ../../../build/js/plates/' + filename +'.json -p NAME,PLATE_ID --no-stitch-poles -- ../../../build/js/tempjson/' + filename + '.json', function(err, result) {
            if (err) {
              console.log(err);
            } else {
              // Delete the original GeoJSON
              fs.unlink('../../../build/js/tempjson/' + filename + '.json');
              console.log("Year " , intervals[i].name, " was converted to TopoJSON");
              
              getJSON(intervals.shift());
            }
          });
      }
  }); 
} 

getJSON(intervals.shift());