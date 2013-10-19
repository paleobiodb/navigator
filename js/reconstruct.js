var reconstructMap = {
  "init": function() {
    var height = 500,
        width = 960;

    var projection = d3.geo.hammer()
      .scale(165)
      .translate([width / 2, height / 2])
      .precision(.1);
     
    var path = d3.geo.path()
      .projection(projection);

    var svg = d3.select("#reconstructMap")
      .append("svg")
      .attr("height", height)
      .attr("width", width)
      .append("g")
      .attr("id", "reconstructGroup");

    svg.append("defs").append("path")
      .datum({type: "Sphere"})
      .attr("id", "sphere")
      .attr("d", path);

    svg.append("use")
      .attr("class", "stroke")
      .attr("xlink:href", "#sphere");

    svg.append("use")
      .attr("class", "fill")
      .attr("xlink:href", "#sphere");

    reconstructing = false,
    currentReconstruction = '';

    //attach window resize listener to the window
    /*d3.select(window).on("resize", reconstructMap.resize);
    reconstructMap.resize();*/
    // Moved to navMap.js

    d3.select("#mapSwitch")
      .on("click", function() {
        d3.select("#map").style("display", "block");
        //d3.select(".filters").style("display", "block");
        //d3.select("#mapControls").style("display", "block");
        d3.select("#reconstructMap").style("display","none");
        timeScale.unhighlight();
        d3.select("#mapControlCover").style("display", "none");

        d3.selectAll(".ctrlButton")
          .style("color", "#000");

        if(parseInt(d3.select("#map").style("height")) < 1) {
          d3.select("#svgMap").style("display", "block");
        }
      });
  
  },
  "rotate": function(interval) {
    if (interval.nam == currentReconstruction) {
      return;
    }
    reconstructing = true;
    currentReconstruction = interval.nam;

    navMap.showLoading();
    if (window.navMap && parseInt(d3.select("#map").style("height")) > 0) {
      reconstructMap.addBBox(interval.mid);
    } 

    d3.select("#reconstructContent").remove();

    var scale = d3.scale.linear()
      .domain([1, 4140])
      .range([4, 30]);

    d3.select('#interval').text(interval.nam);
    d3.select("#rotationInterval").html(interval.nam);

    d3.select('#age').text("(" + interval.mid + " Ma)");
    d3.select("#rotationYear").html(interval.mid + " Ma");

    if (interval.mid < 201) {
      d3.select("#rotationReference").html("<p>Seton, M., R.D. Müller, S. Zahirovic, C. Gaina, T.H. Torsvik, G. Shephard, A. Talsma, M. Gurnis, M. Turner, S. Maus, M. Chandler. 2012. Global continental and ocean basin reconstructions since 200 Ma. <i>Earth-Science Reviews </i>113:212-270.</p>");
    } else {
      d3.select("#rotationReference").html("<p>Wright, N. S. Zahirovic, R.D. Müller, M. Seton. 2013. Towards community-driven paleogeographic reconstructions: intergrating open-access paleogeographic and paleobiology data with plate tectonics. <i>Biogeosciences </i>10:1529-1541.</p>");
    }
    var svg = d3.select("#reconstructGroup")
        .append("g")
        .attr("id", "reconstructContent");

    var filename = interval.nam.split(' ').join('_'),
        height = 500,
        width = 960,
        projection = d3.geo.hammer()
          .scale(165)
          .translate([width / 2, height / 2])
          .precision(.1);
     
    var path = d3.geo.path()
      .projection(projection);

    d3.json("collections/" + filename + ".json", function(error, response) {

      /*response.records.forEach(function(d) {
        d.LatLng = new L.LatLng(d.lat,d.lng)
      });*/

      // Add these too the other map immediately

      d3.json("plates/plate" + interval.mid + ".json", function(er, topoPlates) {
          var geojsonPlates = topojson.feature(topoPlates, topoPlates.objects["plates" + interval.mid]);

          timeScale.highlight(interval.nam);

          svg.selectAll(".plates")
            .data(geojsonPlates.features)
            .enter().append("path")
            .attr("class", "plates")
            .attr("d", path);

          // Switch to reconstruct map now

          if(parseInt(d3.select("#map").style("height")) > 1) {
            d3.select("#map").style("display", "none");
          }
          //d3.select("#mapControls").style("display", "none");
          d3.select(".filters").style("display", "none");
          //d3.select("#window").style("display", "none");
          d3.select("#svgMap").style("display", "none");
          d3.select("#mapControlCover").style("display", "block");
          d3.select("#reconstructMap").style("display", "block");
          d3.selectAll(".ctrlButton")
            .style("color", "#777");
          reconstructMap.resize();

          d3.select(".info")
            .html('')
            .style("display", "none");

        d3.json("rotatedIntervals/" + filename + ".json", function(err, result) {
          var keys = Object.keys(result.objects),
              key = keys[0];
              rotatedPoints = topojson.feature(result, result.objects[key]);

          rotatedPoints.features.forEach(function(d) {
            for (var i=0;i<response.records.length;i++) {
              if (parseInt(d.properties.NAME) == response.records[i].oid) {
                d.properties.nco = response.records[i].nco;
                d.properties.noc = response.records[i].noc;
                d.properties.oid = response.records[i].oid;
              }
            }
          });

          svg.selectAll(".points")
            .data(rotatedPoints.features)
          .enter().append("circle")
            .attr("class", "collection")
            .style("fill", interval.col)
            .attr("r", function(d) { return scale(d.properties.nco); })
            .attr("cx", function(d) {
              var coords = projection(d.geometry.coordinates);
              return coords[0];
            })
            .attr("cy", function(d) {
              var coords = projection(d.geometry.coordinates);
              return coords[1];
            })
            .on("mouseover", function(d) {
              d3.select(".info")
                .html("Bin ID: " + d.properties.oid + "<br>Number of collections: " + d.properties.nco + "<br>Number of occurrences: " + d.properties.noc)
                .style("display", "block");
            })
            .on("click", function(d) {
              d3.select(".info")
                .html("Bin ID: " + d.properties.oid + "<br>Number of collections: " + d.properties.nco + "<br>Number of occurrences: " + d.properties.noc)
                .style("display", "block");
              navMap.openBinModal(d);
            })
            .on("mouseout", function(d) {
              d3.select(".info")
                .html("")
                .style("display", "none");
            });
          reconstructing = false;
          navMap.hideLoading();
        }); // End plate callback
      }); // End rotated points callback
    }); // end nonrotated point callback
  },
  "addBBox": function(year) {
    var bounds = map.getBounds(),
        sw = bounds._southWest,
        se = bounds.getSouthEast(),
        ne = bounds._northEast,
        nw = bounds.getNorthWest(),
        zoom = map.getZoom();

     // Make sure bad requests aren't made
    sw.lng = (sw.lng < -180) ? -180 : sw.lng;
    sw.lat = (sw.lat < -90) ? -90 : sw.lat;
    ne.lng = (ne.lng > 180) ? 180 : ne.lng;
    ne.lat = (ne.lat > 90) ? 90 : ne.lat;

    var box = [{"oid":"a", "lat": sw.lat, "lng": sw.lng},{"oid":"b", "lat": nw.lat, "lng": nw.lng},{"oid":"c", "lat": ne.lat, "lng": ne.lng},{"oid":"d", "lat": se.lat, "lng": se.lng}];

    box = navMap.buildWKT(box);

    var gPlatesReqData = '&time=' + year + '&points="' + encodeURI(box) + '"&output=geojson';

    d3.xhr('http://gplates.gps.caltech.edu:8080/recon_points/')
      .header("Content-type", "application/x-www-form-urlencoded")
      .post(gPlatesReqData, function(err, result) {
        if (err) {
          console.log("Gplates error - ", err);
          return alert("GPlates could not complete the request");
        }
        var gPlatesResponse = JSON.parse(result.response);

        var rotatedPoints = gPlatesResponse;

       /* var keys = Object.keys(gPlatesResponse.objects),
            key = keys[0];
            rotatedPoints = topojson.feature(gPlatesResponse, gPlatesResponse.objects[key]);*/

        function compare(a,b) {
          if (a.properties.NAME < b.properties.NAME)
             return -1;
          if (a.properties.NAME > b.properties.NAME)
            return 1;
          return 0;
        }
        rotatedPoints.features.sort(compare);

        var bbox = {"type":"FeatureCollection", "features": [{"geometry":{"type":"Polygon", "coordinates": [[rotatedPoints.features[0].geometry.coordinates, rotatedPoints.features[1].geometry.coordinates, rotatedPoints.features[2].geometry.coordinates, rotatedPoints.features[3].geometry.coordinates, rotatedPoints.features[3].geometry.coordinates]]}, "type": "Feature", "properties": {}}]};

        var svg = d3.select("#reconstructContent");

        var height = 500,
            width = 960;

        var projection = d3.geo.hammer()
            .scale(165)
            .translate([width / 2, height / 2])
            .precision(.1);
         
        var path = d3.geo.path()
            .projection(projection);

        svg.selectAll(".bbox")
          .data(bbox.features)
          .enter().append("path")
          .attr("fill", "none")
          .attr("stroke", "#ccc")
          .attr("stroke-dasharray", "5,5")
          .attr("stroke-width", 2)
          .attr("opacity", 1)
          .attr("d", path);
      });
  },
  "resize": function() {
    var g = d3.select("#reconstructMap").select("svg");

    d3.select("#reconstructGroup")
      .attr("transform", function() {
        /* Firefox hack via https://github.com/wout/svg.js/commit/ce1eb91fac1edc923b317caa83a3a4ab10e7c020 */
        var box;
        try {
          box = g.node().getBBox()
        } catch(err) {
          box = {
            x: g.node().clientLeft,
            y: g.node().clientTop,
            width: g.node().clientWidth,
            height: g.node().clientHeight
          }
        }
        if ((window.innerWidth - box.width) / 2 > 20) {
          return "scale(" + window.innerHeight/700 + ")translate(" + (window.innerWidth - box.width) / 2 + ",0)";
        } else {
          var svgHeight = window.innerHeight * 0.7,
              mapHeight = (window.innerWidth/960 ) * 500;
          return "scale(" + window.innerWidth/960 + ")translate(0," + (svgHeight - mapHeight) + ")";
        }
      });

    d3.select("#reconstructMap").select("svg")
      .style("height", function(d) {
        return window.innerHeight * 0.70 + "px";
      })
      .style("width", function(d) {
        return window.innerWidth + "px";
      });


    d3.select("#reconstructMapRefContainer")
      .style("height", function() {
        return parseInt(d3.select("#reconstructMap").style("height")) - 1 + "px";
      });

    //timeScale.sizeChange();
  }
}
reconstructMap.init();
