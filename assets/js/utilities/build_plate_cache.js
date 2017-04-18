/* Script for getting the reconstructed coastlines for all
time intervals in the international geologic time scale */

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

// Keeps track of the year
var i = 0;

var intervals = [{"name":"Phanerozoic","mid":270},{"name":"Paleozoic","mid":396},{"name":"Mesozoic","mid":159},{"name":"Cenozoic","mid":33},{"name":"Cambrian","mid":513},{"name":"Ordovician","mid":464},{"name":"Silurian","mid":431},{"name":"Devonian","mid":389},{"name":"Carboniferous","mid":328},{"name":"Permian","mid":275},{"name":"Triassic","mid":226},{"name":"Jurassic","mid":173},{"name":"Cretaceous","mid":105},{"name":"Paleogene","mid":44},{"name":"Neogene","mid":12},{"name":"Quaternary","mid":1},{"name":"Terreneuvian","mid":531},{"name":"Series 2","mid":515},{"name":"Series 3","mid":503},{"name":"Furongian","mid":491},{"name":"Early Ordovician","mid":477},{"name":"Middle Ordovician","mid":464},{"name":"Late Ordovician","mid":450},{"name":"Llandovery","mid":438},{"name":"Wenlock","mid":430},{"name":"Ludlow","mid":425},{"name":"Pridoli","mid":421},{"name":"Early Devonian","mid":406},{"name":"Middle Devonian","mid":388},{"name":"Late Devonian","mid":370},{"name":"Mississippian","mid":341},{"name":"Pennsylvanian","mid":311},{"name":"Cisuralian","mid":285},{"name":"Guadalupian","mid":266},{"name":"Lopingian","mid":256},{"name":"Early Triassic","mid":249},{"name":"Middle Triassic","mid":242},{"name":"Late Triassic","mid":219},{"name":"Early Jurassic","mid":187},{"name":"Middle Jurassic","mid":168},{"name":"Late Jurassic","mid":154},{"name":"Early Cretaceous","mid":122},{"name":"Late Cretaceous","mid":83},{"name":"Paleocene","mid":61},{"name":"Eocene","mid":44},{"name":"Oligocene","mid":28},{"name":"Miocene","mid":14},{"name":"Pliocene","mid":3},{"name":"Pleistocene","mid":1},{"name":"Holocene","mid":0},{"name":"Fortunian","mid":535},{"name":"Stage 2","mid":525},{"name":"Stage 3","mid":517},{"name":"Stage 4","mid":511},{"name":"Stage 5","mid":506},{"name":"Drumian","mid":502},{"name":"Guzhangian","mid":498},{"name":"Paibian","mid":495},{"name":"Jiangshanian","mid":491},{"name":"Stage 10","mid":487},{"name":"Tremadocian","mid":481},{"name":"Floian","mid":473},{"name":"Dapingian","mid":468},{"name":"Darriwilian","mid":462},{"name":"Sandbian","mid":455},{"name":"Katian","mid":449},{"name":"Hirnantian","mid":444},{"name":"Rhuddanian","mid":442},{"name":"Aeronian","mid":439},{"name":"Telychian","mid":435},{"name":"Sheinwoodian","mid":431},{"name":"Homerian","mid":428},{"name":"Gorstian","mid":426},{"name":"Ludfordian","mid":424},{"name":"Pridoli","mid":421},{"name":"Lochkovian","mid":415},{"name":"Pragian","mid":409},{"name":"Emsian","mid":400},{"name":"Eifelian","mid":390},{"name":"Givetian","mid":385},{"name":"Frasnian","mid":377},{"name":"Famennian","mid":365},{"name":"Tournaisian","mid":352},{"name":"Visean","mid":338},{"name":"Serpukhovian","mid":327},{"name":"Bashkirian","mid":319},{"name":"Moscovian","mid":311},{"name":"Kasimovian","mid":305},{"name":"Gzhelian","mid":301},{"name":"Asselian","mid":297},{"name":"Sakmarian","mid":292},{"name":"Artinskian","mid":284},{"name":"Kungurian","mid":275},{"name":"Roadian","mid":270},{"name":"Wordian","mid":266},{"name":"Capitanian","mid":262},{"name":"Wuchiapingian","mid":257},{"name":"Changhsingian","mid":253},{"name":"Induan","mid":251},{"name":"Olenekian","mid":249},{"name":"Anisian","mid":244},{"name":"Ladinian","mid":239},{"name":"Carnian","mid":232},{"name":"Norian","mid":218},{"name":"Rhaetian","mid":204},{"name":"Hettangian","mid":200},{"name":"Sinemurian","mid":195},{"name":"Pliensbachian","mid":186},{"name":"Toarcian","mid":178},{"name":"Aalenian","mid":172},{"name":"Bajocian","mid":169},{"name":"Bathonian","mid":167},{"name":"Callovian","mid":164},{"name":"Oxfordian","mid":160},{"name":"Kimmeridgian","mid":154},{"name":"Tithonian","mid":148},{"name":"Berriasian","mid":142},{"name":"Valanginian","mid":136},{"name":"Hauterivian","mid":131},{"name":"Barremian","mid":127},{"name":"Aptian","mid":119},{"name":"Albian","mid":106},{"name":"Cenomanian","mid":97},{"name":"Turonian","mid":91},{"name":"Coniacian","mid":88},{"name":"Santonian","mid":84},{"name":"Campanian","mid":77},{"name":"Maastrichtian","mid":69},{"name":"Danian","mid":63},{"name":"Selandian","mid":60},{"name":"Thanetian","mid":57},{"name":"Ypresian","mid":51},{"name":"Lutetian","mid":44},{"name":"Bartonian","mid":39},{"name":"Priabonian","mid":35},{"name":"Rupelian","mid":31},{"name":"Chattian","mid":25},{"name":"Aquitanian","mid":21},{"name":"Burdigalian","mid":18},{"name":"Langhian","mid":14},{"name":"Serravallian","mid":12},{"name":"Tortonian","mid":9},{"name":"Messinian","mid":6},{"name":"Zanclean","mid":4},{"name":"Piacenzian","mid":3},{"name":"Gelasian","mid":2},{"name":"Calabrian","mid":1},{"name":"Middle Pleistocene","mid":0},{"name":"Late Pleistocene","mid":0},{"name":"Holocene","mid":0}];

function getJSON() {
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

          // Save result to a temp file
          fs.writeFile("../../../build/js/tempjson/" + filename + ".json", JSON.stringify(plateResponse), function(err) {
              if(err) {
                  console.log(err);
              } else {
                  // Convert to Topojson, simplifying and prerving the attributes NAME and PLATE_ID
                  exec('topojson -o ../../../build/js/plates/' + filename +'.json -p NAME,PLATE_ID -- ../../../build/js/tempjson/' + filename + '.json', function(err, result) {
                    if (err) {
                      console.log(err);
                    } else {
                      // Delete the original GeoJSON
                      fs.unlink('../../../build/js/tempjson/' + filename + '.json');
                      console.log("Year " , intervals[i].name, " was converted to TopoJSON");
                      i += 1;

                      // Change this number for the last plate year
                      if (i < intervals.length) {
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

// Start Script
checkTempjson();