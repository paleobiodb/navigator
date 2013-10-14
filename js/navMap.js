// Global variables
var map, stamen, stamenLabels, g, exlude,
  prevsw = {"lng": 0, "lat": 0},
  prevne = {"lng": 0, "lat": 0},
  prevzoom = 3,
  filters = {"selectedInterval": "", "personFilter": {"id":"", "name": ""}, "taxon": {"id": "", "name": ""}, "exist": {"selectedInterval" : false, "personFilter": false, "taxon": false}};

var navMap = {
  "init": function() {

    timeScale.init("time");

    // Init the leaflet map
    map = new L.Map('map', {
      center: new L.LatLng(7, 0),
      zoom: 2,
      maxZoom:10,
      minZoom: 2,
      zoomControl: false
    });

    var attrib = 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';

    stamen = new L.TileLayer('http://{s}.tile.stamen.com/toner-background/{z}/{x}/{y}.png', {attribution: attrib}).addTo(map);

    stamenLabels = new L.TileLayer('http://{s}.tile.stamen.com/toner/{z}/{x}/{y}.png', {attribution: attrib});

    map.on("moveend", function() {
      d3.select("#window").style("display", "none");
      d3.select("#windowCollapse").style("display", "none");
      d3.select(".info").style("display", "none");

      var zoom = map.getZoom();
      if (zoom < 3) {
        mapHeight = d3.select("#map").style("height");
        d3.select("#map").style("height", 0);
        d3.select("#svgMap").style("display", "block");
        d3.selectAll("path").attr("d", path);
      }
      navMap.refresh();
    });

    d3.select("#map").style("height", 0);

    // Get map ready for an SVG layer
    map._initPathRoot();

    // Add the SVG to hold markers to the map
    d3.select("#map").select("svg")
      .append("g")
      .attr("id", "binHolder");

    function changeMaps(mouse) {
      var coords = mouse,
        projected = mercator.invert(coords);

      d3.select("#svgMap").style("display", "none");
      d3.select("#map").style("height", function() {
        return window.innerHeight * 0.60 + "px";
      });
      map.invalidateSize();

      map.setView([parseInt(projected[1]), parseInt(projected[0])], 3, {animate:false});
    }

    var width = 960,
        height = 500;
    
    var projection = d3.geo.hammer()
      .scale(165)
      .translate([width / 2, height / 2])
      .precision(.1);

    var mercator = d3.geo.mercator()
      .scale(165)
      .precision(.1)
      .translate([width / 2, height / 2]);

    var path = d3.geo.path()
      .projection(projection);

    var zoom = d3.behavior.zoom()
      .on("zoom",function() {
        if (d3.event.sourceEvent.wheelDelta > 0) {
          changeMaps(d3.mouse(this));
        }
      });

    var hammer = d3.select("#svgMap").append("svg")
      .attr("width", width)
      .attr("height", height)
      .call(zoom)
      .on("click", function() {
        changeMaps(d3.mouse(this));
      })
      .append("g");

    hammer.append("defs").append("path")
      .datum({type: "Sphere"})
      .attr("id", "sphere")
      .attr("d", path);

    hammer.append("use")
      .attr("class", "fill")
      .attr("xlink:href", "#sphere");

    d3.json("js/countries_1e5.json", function(error, data) {
      hammer.append("path")
        .datum(topojson.feature(data, data.objects.countries))
        .attr("class", "countries")
        .attr("d", path);
    });
   
    // Attach handlers for zoom-in and zoom-out buttons
    d3.select(".zoom-in").on("click", function() {
      if (parseInt(d3.select("#map").style("height")) < 1) {
        d3.event.stopPropagation();
        d3.select("#svgMap").style("display", "none");
        d3.select("#map").style("height", mapHeight);
        map.invalidateSize();
        map.setView([7,0], 3, {animate:false});
      } else {
        map.zoomIn();
      }
    });
    d3.select(".zoom-out")
      .on("click",function() {
        map.zoomOut();
      });

    d3.select(".time")
      .on("click", function() {
        var checked = document.getElementById("viewByTimeBox").checked;
        if (checked == true) {
          document.getElementById("viewByTimeBox").checked = false;
          d3.select(".time").style("background-color", "");
        } else {
          document.getElementById("viewByTimeBox").checked = true;
          d3.select(".time").style("background-color", "#ccc");
          filters.selectedInterval = '';
        }
      });

    d3.select(".rotate")
      .on("click", function() {
        var rotateChecked = document.getElementById("reconstructBox").checked,
            timeChecked = document.getElementById("viewByTimeBox").checked;
        if (rotateChecked == true) {
          document.getElementById("reconstructBox").checked = false;
          d3.select(".rotate").style("background-color", "");
        } else {
          if (timeChecked == false) {
            document.getElementById("viewByTimeBox").checked = true;
            d3.select(".time").style("background-color", "#ccc");
          }
          document.getElementById("reconstructBox").checked = true;
          d3.select(".rotate").style("background-color", "#ccc");
        }
      });

    d3.select(".userFilter")
      .on("click", function() {
        var visible = d3.select(".userToggler").style("display");
        if (visible == "block") {
          d3.select(".userToggler").style("display", "none");
        } else {
          d3.select(".userToggler").style("display", "block");
        }
      });

    d3.select("#windowCollapse")
      .on("click", function() {
        d3.select("#window").style("display", "none");
        d3.select("#windowCollapse").style("display", "none");
      });

    var typeahead = $("#personInput").typeahead({
      name: 'contribs',
      prefetch: {
        url: 'http://testpaleodb.geology.wisc.edu/data1.1/people/list.json?name=%',
        //url: 'contribs.json',
        filter: function(data) {
          return data.records;
        }
      },
      valueKey: 'nam',
      limit: 8
    });

    typeahead.on('typeahead:selected', function(evt, data) {
      navMap.filterByPerson(data);
    });

    //attach window resize listener to the window
    d3.select(window).on("resize", navMap.resize);

    navMap.refresh("reset");
    setTimeout(navMap.resize, 100);
    setTimeout(navMap.resize, 100);
  },
  "selectBaseMap": function(zoom) {
    if (zoom < 5) {
      if (map.hasLayer(stamenLabels)) {
        map.removeLayer(stamenLabels);
        map.addLayer(stamen);
      }
    } else if (zoom > 4 && zoom < 8) {
      if (map.hasLayer(stamenLabels)) {
        map.removeLayer(stamenLabels);
        map.addLayer(stamen);
      }
    } else {
      if (map.hasLayer(stamenLabels)) {
        map.removeLayer(stamen);
      } else {
        map.addLayer(stamenLabels);
        map.removeLayer(stamen);
      }
    }
  },
  "refresh": function(reset) {
    var filtered = navMap.checkFilters();
    // Check which map is displayed - if hammer, skip the rest
    if (parseInt(d3.select("#map").style("height")) < 1) {
      var url = 'http://testpaleodb.geology.wisc.edu/data1.1/colls/summary.json?lngmin=-180&lngmax=180&latmin=-90&latmax=90&limit=999999';
      if (filtered) {
        if (filters.exist.selectedInterval == true && !filters.exist.personFilter && !filters.exist.taxon) {
          url = "collections/" + filters.selectedInterval.split(' ').join('_') + ".json";
        } else {
          url += "&level=2";
          url = navMap.parseURL(url);
        }
      } else {
        url += "&level=1";
        url = navMap.parseURL(url);
      }

      d3.json(url, function(error, data) { 
        navMap.refreshHammer(data);
      });
      return;
    }

    var bounds = map.getBounds(),
      sw = bounds._southWest,
      ne = bounds._northEast,
      zoom = map.getZoom();

    if(!reset) {
      // Check if new points are needed from the server
      if (prevne.lat > ne.lat && prevne.lng > ne.lng && prevsw.lat < sw.lat && prevsw.lng < sw.lng) {
        if (prevzoom < 4 && zoom > 3) {
          // refresh
        } else if (prevzoom < 7 && zoom > 6) {
          //refresh
        } else {
          var points = d3.selectAll(".bins");
          if (zoom > 6) {
            var clusters = d3.selectAll(".clusters");
            return navMap.redrawPoints(points, clusters);
          } else {
            return navMap.redrawPoints(points);
          }
        }
      }
    }
    prevsw = sw;
    prevne = ne;
    prevzoom = zoom;

    // Make sure bad requests aren't made
    sw.lng = (sw.lng < -180) ? -180 : sw.lng;
    sw.lat = (sw.lat < -90) ? -90 : sw.lat;
    ne.lng = (ne.lng > 180) ? 180 : ne.lng;
    ne.lat = (ne.lat > 90) ? 90 : ne.lat;

    // See if labels should be applied or not
    navMap.selectBaseMap(zoom);

    // Remove old points
    d3.selectAll(".bins").remove();
    d3.selectAll(".clusters").remove();

    // Redefine to check if we are crossing the date line
    bounds = map.getBounds();

    // Depending on the zoom level, call a different service from PaleoDB, feed it a bounding box, and pass it to function getData
    if (zoom < 4 && filtered == false) {
      var url = 'http://testpaleodb.geology.wisc.edu/data1.1/colls/summary.json?lngmin=' + sw.lng + '&lngmax=' + ne.lng + '&latmin=' + sw.lat + '&latmax=' + ne.lat + '&level=1&limit=999999';

      if (bounds._southWest.lng < -180 || bounds._northEast.lng > 180) {
        navMap.refreshDateline(1);
      }

      d3.json(navMap.parseURL(url), function(error, data) {
        data.records.forEach(function(d) {
          d.LatLng = new L.LatLng(d.lat,d.lng)
        });
        navMap.drawBins(data, 1, zoom);
      });
    } else if (zoom > 3 && zoom < 7 || zoom < 4 && filtered == true) {
      // TODO: like above, if only filtering by time load from static
      var url = 'http://testpaleodb.geology.wisc.edu/data1.1/colls/summary.json?lngmin=' + sw.lng + '&lngmax=' + ne.lng + '&latmin=' + sw.lat + '&latmax=' + ne.lat + '&level=2&limit=99999';

      if (bounds._southWest.lng < -180 || bounds._northEast.lng > 180) {
        navMap.refreshDateline(2);
      }
      d3.json(navMap.parseURL(url), function(error, data) {
        data.records.forEach(function(d) {
          d.LatLng = new L.LatLng(d.lat,d.lng)
        });
        navMap.drawBins(data, 2, zoom);
      });
    } else {
      var url = 'http://testpaleodb.geology.wisc.edu/data1.1/colls/list.json?lngmin=' + sw.lng + '&lngmax=' + ne.lng + '&latmin=' + sw.lat + '&latmax=' + ne.lat + '&limit=99999999';

      if (sw.lng < -180 || ne.lng > 180) {
        navMap.refreshDateline(3);
      }

      navMap.drawCollections(navMap.parseURL(url), 3, zoom);
    }
  },
  // Adjust the positioning of the SVG elements relative to the map frame
  "redrawPoints": function(points, clusterPoints) {
    var zoom = map.getZoom();
    if (zoom < 4) {
      var scale = d3.scale.linear()
        .domain([1, 4140])
        .range([4, 30]);
    } else if (zoom > 3 && zoom < 7 ) {
      var scale = d3.scale.log()
        .domain([1, 400])
        .range([4,30]);
    } else {
      var scale = d3.scale.linear()
        .domain([1, 50])
        .range([12, 30]);
    }
    points.attr("cx",function(d) { return map.latLngToLayerPoint(d.LatLng).x});
    points.attr("cy",function(d) { return map.latLngToLayerPoint(d.LatLng).y});
    if (clusterPoints) {
      clusterPoints.attr("cx",function(d) { return map.latLngToLayerPoint(d.LatLng).x});
      clusterPoints.attr("cy",function(d) { return map.latLngToLayerPoint(d.LatLng).y});
      clusterPoints.attr("r", function(d) { return scale(d.members.length); })
      points.attr("r", 12);
    } else {
      points.attr("r", function(d) { return scale(d.nco)*navMap.multiplier(zoom); });
    }
  },
  "refreshHammer": function(data) {
    d3.selectAll(".bins").remove();

    var scale = d3.scale.linear()
      .domain([1, 4240])
      .range([4, 15]);

    var width = 960,
        height = 500;

    var projection = d3.geo.hammer()
      .scale(165)
      .translate([width / 2, height / 2])
      .precision(.1);

    var path = d3.geo.path()
      .projection(projection);

    var hammer = d3.select("#svgMap").select("svg").select("g"),
        zoom = 2;

    hammer.selectAll(".circle")
      .data(data.records)
      .enter().append("circle")
      .attr("class", "bins")
      .style("fill", function(d) { return (interval_hash[d.cxi]) ? interval_hash[d.cxi].col : "#000"; })
      .attr("id", function(d) { return "p" + d.cxi; })
      .attr("r", function(d) { return scale(d.nco)*navMap.multiplier(zoom); })
      .attr("cx", function(d) {
        var coords = projection([d.lng, d.lat]);
        return coords[0];
      })
      .attr("cy", function(d) {
        var coords = projection([d.lng, d.lat]);
        return coords[1];
      })
      .on("mouseover", function(d) {
        d3.select(".info")
          .html("Number of collections: " + d.nco + "<br>Number of occurrences: " + d.noc)
          .style("display", "block");
        timeScale.highlight(this);
      })
      .on("click", function(d) {
        d3.select(".info")
          .html("Number of collections: " + d.nco + "<br>Number of occurrences: " + d.noc)
          .style("display", "block");
        timeScale.highlight(this);
      })
      .on("mouseout", function(d) {
        d3.select(".info")
          .html("")
          .style("display", "none");
        timeScale.unhighlight()
      });

  },
  "drawBins": function(data, level, zoom) {
    var g = d3.select("#binHolder");
    // Add the bins to the map
    var points = g.selectAll(".circle")
      .data(data.records)
      .enter().append("circle")
      .attr("class", "bins")
      .style("fill", function(d) { return (interval_hash[d.cxi]) ? interval_hash[d.cxi].col : "#000"; })
      .attr("id", function(d) { return "p" + d.cxi; })
      .on("mouseover", function(d) {
        d3.select(".info")
          .html("Number of collections: " + d.nco + "<br>Number of occurrences: " + d.noc)
          .style("display", "block");
        timeScale.highlight(this);
      })
      .on("click", function(d) {
        d3.select(".info")
          .html("Number of collections: " + d.nco + "<br>Number of occurrences: " + d.noc)
          .style("display", "block");
        timeScale.highlight(this);
      })
      .on("mouseout", function(d) {
        d3.select(".info")
          .html("")
          .style("display", "none");
        timeScale.unhighlight()
      })
      .on("dblclick", function(d) {
        if (level == 1) {
          map.setView(d.LatLng, 6);
        } else if (level == 2) {
          map.setView(d.LatLng, 8);
        }
      });

    // Update the SVG positioning
    navMap.redrawPoints(points);
  },
  "drawCollections": function(source, level, zoom) {
    d3.selectAll(".bins").remove();
    d3.selectAll(".clusters").remove();

    var g = d3.select("#binHolder");

    // Make an AJAX request to PaleoDB
    d3.json(source, function(error, data) {
      // Many collections share the same coordinates, making it necessary to create clusters of like coordinates
      var clusters = [];
      // For each collection, check it's coordinates against all others and see if any matches exist
      for (var i=0; i<data.records.length; i++) {
        for (var j=0; j<data.records.length; j++) {
          // If another collection has the same lat/lng and a different OID, create a new cluster
          // SIDENOTE: this could be extended for binning by specifying a tolerance instead of an exact match of coordinates
          if (data.records[i].lat == data.records[j].lat && data.records[i].lng == data.records[j].lng && data.records[i].oid != data.records[j].oid) {
            var newCluster = {"lat":data.records[i].lat, "lng":data.records[i].lng, "members": []},
                exists = 0;
            // Make sure a cluster with those coordinates doesn't already exist
            for (var z=0; z<clusters.length;z++) {
              if (newCluster.lat == clusters[z].lat && newCluster.lng == clusters[z].lng) {
                exists += 1;
              }
            }
            // If a cluster doesn't already exist with those coordinates, add the cluster to the cluster array
            if (exists < 1) {
              clusters.push(newCluster);
              break;
            // Otherwise, ignore it
            } else {
              break;
            }
          }
        }
      }
      // Loop through all the collections and place them into the proper cluster, if applicable
      // Collections placed into a cluster are kept track of using toRemove. They are not removed from
      // data.records immediately because the length of data.records is being used to count the loop
      // Also keep track of rock formations
      var toRemove = [];
      for (var i=0; i<clusters.length; i++) {
        for (var j=0; j<data.records.length; j++) {
          if (clusters[i].lat == data.records[j].lat && clusters[i].lng == data.records[j].lng) {
            clusters[i].members.push(data.records[j]);
            toRemove.push(data.records[j].oid);
          }
        }
      }
      // Remove all clustered collections from data.records
      for (var i=0; i<toRemove.length; i++) {
        var index = navMap.arrayObjectIndexOf(data.records, toRemove[i], "oid");
        data.records.splice(index, 1);
      }
      
      // Create a Leaflet Lat/lng for all non-clustered collections
      data.records.forEach(function(d) {
        d.LatLng = new L.LatLng(d.lat,d.lng)
      });
      // Create a Leaflet Lat/lng for all clusters
      clusters.forEach(function(d) {
        d.LatLng = new L.LatLng(d.lat,d.lng);
        //var clusterBottoms = [],
        //  clusterTops = [],
        var totalOccurrences = [];

        d.members.forEach(function(e) {
          //clusterBottoms.push(e.eag);
          //clusterTops.push(e.lag);
          totalOccurrences.push(e.noc);
        });
        //d.ageTop = d3.min(clusterTops);
        //d.ageBottom = d3.max(clusterBottoms);
        // TODO: fix this to something more accurate
        /* Annecdotal evidence suggests all collections that share a lat/lng should be from the 
          same interval, but I doubt that it's always true */
        d.cxi = d.members[0].cxi;
        d.noc = d3.sum(totalOccurrences);
      });

      var clusters = g.selectAll(".clusters")
        .data(clusters)
        .enter().append("circle")
        .attr("class", "clusters")
        .attr("id", function(d) { return "p" + d.members[0].cxi; })
        .style("fill", function(d) { return interval_hash[d.cxi].col; })
        .on("mouseover", function(d) {
          d3.select(".info")
            .html("<strong>" + d.members.length + " collections</strong><br>" + d.noc + " occurrences")
            .style("display", "block");
          timeScale.highlight(this);
        })
        .on("mouseout", function(d) {
         /* d3.select(".info")
            .html("")
            .style("display", "none");*/
          timeScale.unhighlight();
        })
        .on("click", function(d) {
          d3.select("#clusterTable")
            .html("");

          d3.select("#window")
            .style("display", "block");

          d3.select("#windowCollapse")
            .style("display", "block");

          d3.select(".info")
            .html(d.members.length + " collections<br>" + interval_hash[d.cxi].nam + "<br>" + d.noc + " occurrences")
            .style("display", "block");

          d3.select("#clusterTable")
            .append("tbody")
            .selectAll("tr")
            .data(d.members)
           .enter().append("tr")
            .html(function(e) { return "<td>" + e.nam + "</td>"})
            .on("mouseover", function(e) {
              d3.select(".info")
                .html("<strong>" + e.nam + "</strong><br>" + e.noc + " occurrences")
                .style("display", "block");
              timeScale.highlight(e);
            })
            .on("mouseout", function(e) {
              timeScale.unhighlight();
            })
            .on("click", function(e) {
              d3.select(".info")
                .html("<strong>" + e.nam + "</strong><br>" + e.noc + " occurrences")
                .style("display", "block");
              navMap.openCollectionModal(e);
              timeScale.highlight(e);
            });
        });

      var points = g.selectAll(".circle")
        .data(data.records)
        .enter().append("circle")
        .attr("id", function(d) { return "p" + d.cxi })
        .attr("class", "bins")
        .style("fill", function(d) { return (interval_hash[d.cxi]) ? interval_hash[d.cxi].col : "#000"; })
        .on("mouseover", function(d) {
          d3.select(".info")
            .html("<strong>" + d.nam + "</strong><br>" + d.noc + " occurrences")
            .style("display", "block");
          timeScale.highlight(this);
        })
        .on("click", function(d) {
          d3.select(".info")
            .html("<strong>" + d.nam + "</strong><br>" + d.noc + " occurrences")
            .style("display", "block");
          timeScale.highlight(this);
          navMap.openCollectionModal(d);
        })
        .on("mouseout", function(d) {
          /*d3.select(".info")
            .html("")
            .style("display", "none");*/
          timeScale.unhighlight();
        });

      navMap.redrawPoints(points, clusters);
    });
  },
  "openCollectionModal": function(d) {
    d3.json("http://testpaleodb.geology.wisc.edu/data1.1/colls/single.json?id=" + d.oid + "&show=ref", function(err, data) {
      var collection = data.records[0];
      d3.select("#collectionName").html(collection.nam);
      d3.select("#collectionID").html(collection.oid);
      d3.select("#collectionOccurrences").html(collection.noc);
      var formation = (collection.fmm) ? collection.fmm : "Unknown";
      d3.select("#collectionFormation").html(formation);
      d3.select("#collectionInterval").html(interval_hash[collection.cxi].nam);
      d3.select("#collectionLocation").html(collection.lat + ", " + collection.lng);
      d3.select("#collectionReference").html(collection.ref);

      $("#collectionBox").modal();
    });
  },
  "refreshDateline": function(lvl) {
    var bounds = map.getBounds(),
        sw = bounds._southWest,
        ne = bounds._northEast,
        zoom = map.getZoom(),
        west;

    sw.lng = (sw.lng < -180) ? sw.lng + 360 : sw.lng;
    sw.lat = (sw.lat < -90) ? -90 : sw.lat;
    ne.lng = (ne.lng > 180) ? ne.lng - 360 : ne.lng;
    ne.lat = (ne.lat > 90) ? 90 : ne.lat;

    bounds = map.getBounds();
    if (bounds._southWest.lng < -180) {
      west = true;
      ne.lng = 180;
    }
    if (bounds._northEast.lng > 180) {
      west = false;
      sw.lng = -180;
    }

    switch(lvl) {
      case 1: 
        var url = 'http://testpaleodb.geology.wisc.edu/data1.1/colls/summary.json?lngmin=' + sw.lng + '&lngmax=' + ne.lng + '&latmin=' + sw.lat + '&latmax=' + ne.lat + '&level=1&limit=999999';
        url = navMap.parseURL(url);
        d3.json(url, function(error, response) {
          response.records.forEach(function(d) {
            if (west) {
              d.LatLng = new L.LatLng(d.lat,d.lng - 360);
            } else {
              d.LatLng = new L.LatLng(d.lat,d.lng + 360);
            }
          });
          navMap.drawBins(response, 1, zoom);
        });
        break;
      case 2:
        var url = 'http://testpaleodb.geology.wisc.edu/data1.1/colls/summary.json?lngmin=' + sw.lng + '&lngmax=' + ne.lng + '&latmin=' + sw.lat + '&latmax=' + ne.lat + '&level=2&limit=99999';
        url = navMap.parseURL(url);
        d3.json(url, function(error, response) {
          response.records.forEach(function(d) {
            if (west) {
              d.LatLng = new L.LatLng(d.lat,d.lng - 360);
            } else {
              d.LatLng = new L.LatLng(d.lat,d.lng + 360);
            }
          });
          navMap.drawBins(response, 2, zoom);
        });
        break;
      case 3:
        var url = 'http://testpaleodb.geology.wisc.edu/data1.1/colls/list.json?lngmin=' + sw.lng + '&lngmax='
         + ne.lng + '&latmin=' + sw.lat + '&latmax=' + ne.lat + '&limit=99999999';
         url = navMap.parseURL(url);
        //TODO add query and call appropriate function
        break;
    }
  },
  "buildWKT": function(data) {
    var requestString = "";
    for(var i=0; i<data.length; i++) {
      requestString += "POINT(" + data[i].lat + " " + data[i].lng + " " + data[i].oid + "),"
    }
    requestString = requestString.slice(0, -1);
    requestString = encodeURI(requestString);
    return requestString;
  },
  "parseURL": function(url) {
    var count = 0;
    for (key in filters.exist) {
      if (filters.exist.hasOwnProperty(key)) {
        if (filters.exist[key] == true) {
          switch(key) {
            case "selectedInterval":
              url += '&interval=' + filters.selectedInterval;
              break;
            case "personFilter":
              url += '&person_no=' + filters.personFilter.id;
              break;
            case "taxon":
              url += '&base_id=' + filters.taxon.id;
              break;
          }
          count += 1;
        }
      }
    }
    if (count > 0) {
      d3.select(".filters").style("display", "block");
    } else {
      d3.select(".filters").style("display", "none");
    }
    return url;
  },
  "checkFilters": function() {
    var count = 0;
    for (key in filters.exist) {
      if (filters.exist.hasOwnProperty(key)) {
        if (filters.exist[key] == true) {
          count += 1;
        }
      }
    }
    if (count > 0) {
      d3.select(".filters").style("display", "block");
      return true;
    } else {
      d3.select(".filters").style("display", "none");
      return false;
    }
  },
  "arrayObjectIndexOf": function(myArray, searchTerm, property) {
    for(var i=0, len=myArray.length; i<len; i++) {
      if (myArray[i][property] === searchTerm) return i;
    }
    return -1;
  },
  // Adjust the size of the markers depending on zoom level
  "multiplier": function(zoom) {
    switch(zoom) {
      case 2:
        return 0.75;
        break; 
      case 3:
        return 1;
        break;
      case 4:
        return 0.5;
        break;
      case 5:
        return 0.8;
        break;
      case 6:
        return 1;
        break;
      case 7:
        return 1.5;
        break;
      default:
        return 1;
        break;
    }
  },
  "resize": function() {
    if (parseInt(d3.select("#map").style("height")) > 1) { 
      d3.select("#map")
        .style("height", function(d) {
          return window.innerHeight * 0.60 + "px";
        });
      map.invalidateSize();
    }
    
    d3.select("#svgMap").select("svg")
      .select("g")
      .attr("transform", "scale(" + window.innerHeight/850 + ")");

    var g = d3.select("#svgMap").select("svg");

    d3.select("#svgMap").select("svg")
      .select("g")
      .attr("transform", function() {
        if ((window.innerWidth - g.node().getBBox().width) / 2 > 20) {
          return "scale(" + window.innerHeight/850 + ")translate(" + (window.innerWidth - g.node().getBBox().width) / 2 + ",0)";
        } else {
          var svgHeight = window.innerHeight * 0.60,
              mapHeight = (window.innerWidth/960 ) * 500;
          return "scale(" + window.innerWidth/960 + ")translate(0," + (svgHeight - mapHeight) + ")";
        }
      });

    d3.select("#svgMap").select("svg")
      .style("height", function(d) {
        return window.innerHeight * 0.60 + "px";
      })
      .style("width", function(d) {
        return window.innerWidth + "px";
      });


    d3.select("#infoContainer")
      .style("height", function() {
        return window.innerHeight * 0.60 + "px";
      });

    d3.select("#window")
      .style("height", function(d) {
        return parseInt(d3.select("#mapContainer").style("height")) - 20 + "px";
      });

    timeScale.sizeChange();
  },
  "refreshFilterHandlers": function() {
    d3.selectAll(".removeFilter").on("click", function() {
      var parent = d3.select(this).node().parentNode;
      parent = d3.select(parent);
      parent.style("display", "none").html("");
      var type = parent.attr("id");
      filters.exist[type] = false;
      navMap.refresh("reset");
    });
  },
  "updateFilterList": function(type) {
    switch(type){
      case "selectedInterval":
        d3.select("#selectedInterval")
          .style("display", "inline-block")
          .html(filters.selectedInterval + '<button type="button" class="close removeFilter" aria-hidden="true">&times;</button>');
        break;
      case "personFilter":
        d3.select("#personFilter")
          .style("display", "inline-block")
          .html(filters.personFilter.name + '<button type="button" class="close removeFilter" aria-hidden="true">&times;</button>');
        break;
      case "taxon":
        d3.select("#taxon")
          .style("display", "inline-block")
          .html(filters.taxon.name + '<button type="button" class="close removeFilter" aria-hidden="true">&times;</button>');
       // url += '&base_id=' + filters.taxon.oid;
        break;
    }
    navMap.refreshFilterHandlers();
  },
  "filterByTaxon": function(taxon) {
    if (taxon) {
      filters.exist.taxon = true;
      filters.taxon.id = taxon.oid;
      filters.taxon.name = taxon.nam;
      navMap.updateFilterList("taxon");
      d3.select(".userToggler").style("display", "none");
      navMap.refresh("reset");
    }
  },
  "filterByPerson": function(person) {
    if (person) {
      filters.exist.personFilter = true;
      filters.personFilter.id = person.oid;
      filters.personFilter.name = (person.name) ? person.name : person.nam;
      navMap.updateFilterList("personFilter");
      d3.select(".userToggler").style("display", "none");
      navMap.refresh("reset");
    }
  },
  "downloadView": function() {
    var bounds = map.getBounds(),
        sw = bounds._southWest,
        ne = bounds._northEast;

    if (parseInt(d3.select("#map").style("height")) < 1) {
      sw.lng = -180,
      ne.lng = 180,
      sw.lat = -90,
      ne.lat = 90;
    }

    var url = 'http://testpaleodb.geology.wisc.edu/data1.1/colls/list.';

    if ($("#tsv:checked").length > 0) {
      url += "txt";
    } else {
      url += "csv";
    }
    url += '?lngmin=' + sw.lng + '&lngmax=' + ne.lng + '&latmin=' + sw.lat + '&latmax=' + ne.lat + '&limit=99999999';
    url = navMap.parseURL(url);

    var options = [];
    if ($("#loc:checked").length > 0) {
      options.push("loc");
    }
    if ($("#ref:checked").length > 0) {
      options.push("ref");
    }
    if ($("#t:checked").length > 0) {
      options.push("time");
    }
    if (options.length > 0) {
      url += "&show=";
      options.forEach(function(d) {
        url += d + ",";
      });
    }
    url = url.substring(0, url.length - 1);
    console.log(url);
   // window.open(url);
  }
}
navMap.init();

$("#saveBox").on('show.bs.modal', function() {
  var count = 0;
  for (key in filters.exist) {
    if (filters.exist.hasOwnProperty(key)) {
      if (filters.exist[key] == true) {
        switch(key) {
          case "selectedInterval":
            $("#filterList").append("<li>Interval - " + filters.selectedInterval + "</li>");
            break;
          case "personFilter":
            $("#filterList").append("<li>Contributor - " + filters.personFilter.name + "</li>");
            break;
          case "taxon":
            $("#filterList").append("<li>Taxon - " + filters.taxon.nam + "</li>");
            break;
        }
        count += 1;
      }
    }
  }
  if (count < 1) {
    $("#filterList").append("None selected");
  }
  var bounds = map.getBounds(),
      sw = bounds._southWest,
      ne = bounds._northEast;

  if (parseInt(d3.select("#map").style("height")) < 1) {
    sw.lng = -180,
    ne.lng = 180,
    sw.lat = -90,
    ne.lat = 90;
  }

  var url = 'http://testpaleodb.geology.wisc.edu/data1.1/colls/list.json' + '?lngmin=' + sw.lng + '&lngmax=' + ne.lng + '&latmin=' + sw.lat + '&latmax=' + ne.lat + '&limit=0&count';
  url = navMap.parseURL(url);

  d3.json(url, function(err, results) {
    d3.select("#downloadCount").html(results.records_found + " collections found");
  });

});
$("#saveBox").on('hide.bs.modal', function() {
  $("#filterList").html('');
  $("#downloadCount").html("");
  $('#loc').prop('checked', false);
  $('#ref').prop('checked', false);
  $('#t').prop('checked', false);
});