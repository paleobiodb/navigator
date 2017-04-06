var reconstructMap = (function() {
  /* reconstruction is used to inform other components that a map is being reconstructed, and 
         currentReconstruction is used to record the most recent reconstruction */
  var reconstructing = false,
      currentReconstruction = {"name":"", "taxa": [], "person": ""},
      rotatedPoints;

  var height = 500,
      width = 960;

  var projection = d3.geo.hammer()
    .scale(165)
    .translate([width / 2, height / 2])
    .rotate([1e-6, 0])
    .precision(.3);
   
  var path = d3.geo.path()
    .projection(projection);

  return {
    "init": function() {

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

      $("#mapSwitch").on("click", function(event) {
        event.preventDefault();
        paleo_nav.closeReconstructMap();
      });

      d3.json("build/js/plates/Holocene.json", function(er, topoPlates) {
        // Add the rotated plates to the map
        var group = d3.select("#reconstructGroup")
          .append("g")
          .attr("id", "reconstructContent");

        group.selectAll(".plateLines")
          .data(topojson.feature(topoPlates, topoPlates.objects["Holocene"]).features)
        .enter().append("path")
          .attr("class", "plates")
          .attr("d", path);

        // Load the coastlines
        d3.json("build/js/coastlines/Holocene.json", function(er, coastlines) {
          group.selectAll(".coastlines")
            .data(topojson.feature(coastlines, coastlines.objects["Holocene"]).features)
          .enter().append("path")
            .attr("class", "coastlines")
            .attr("d", path);
        });
      });
    
    },
    "rotate": function(interval) {
      // If nothing has changed since the last reconstruct, do nothing
      var name = (interval.nam) ? interval.nam : interval.name;
      if (name === reconstructMap.currentReconstruction.name && navMap.filters.personFilter.name === reconstructMap.currentReconstruction.person && navMap.filters.stratigraphy.name === reconstructMap.currentReconstruction.stratigraphy) {

        var taxaChange = 0;

        if (navMap.filters.taxa.length === reconstructMap.currentReconstruction.taxa.length) {
          navMap.filters.taxa.forEach(function(d) {
            var found = false;
            reconstructMap.currentReconstruction.taxa.forEach(function(j) {
              if (d.name === j.name) {
                found = true;
              }
            });
            if (!found) {
              taxaChange += 1;
            }
          });
          // If no taxa have changed, don't refresh
          if (taxaChange === 0) {
            // Make sure the time interval filter remove button is hidden
            d3.select("#selectedInterval")
              .select("button")
                .style("display", "none");
            return;
          }
        }
      }

      //navMap.filterByTime(name);

      reconstructing = true;
      reconstructMap.reset();

      paleo_nav.showLoading();

      // Listener for whether or not a previous bounding box should be shown
      //if (window.navMap && parseInt(d3.select("#map").style("height")) > 0) {
        //reconstructMap.addBBox(interval.mid);
      //} 

      // Update UI components with the current reconstruction info
      d3.select('#interval').text(name);
      d3.select("#rotationInterval").html(name);

      d3.select('#age').text("(" + interval.mid + " Ma)");
      d3.select("#rotationYear").html(interval.mid + " Ma");

      // Depending on the age of the reconstruction use different references
      if (interval.mid < 201) {
        d3.select("#rotationReference").html("<p>Seton, M., R.D. Müller, S. Zahirovic, C. Gaina, T.H. Torsvik, G. Shephard, A. Talsma, M. Gurnis, M. Turner, S. Maus, M. Chandler. 2012. Global continental and ocean basin reconstructions since 200 Ma. <i>Earth-Science Reviews </i>113:212-270.</p>");
      } else {
        d3.select("#rotationReference").html("<p>Wright, N. S. Zahirovic, R.D. Müller, M. Seton. 2013. Towards community-driven paleogeographic reconstructions: intergrating open-access paleogeographic and paleobiology data with plate tectonics. <i>Biogeosciences </i>10:1529-1541.</p>");
      }

      // Hide the time interval filter remove button
      d3.select("#selectedInterval")
        .select("button")
          .style("display", "none");
          
      var svg = d3.select("#reconstructGroup")
          .append("g")
          .attr("id", "reconstructContent");

      var filename = name.split(' ').join('_');

      // Load the unrotated level2 bins associated with the selected interval
      d3.json("build/js/collections/" + filename + ".json", function(error, response) {

        // Load the rotated plates
        d3.json("build/js/plates/" + filename + ".json", function(er, plates) {

          // Add the rotated plates to the map
          svg.selectAll(".plateLines")
            .data(topojson.feature(plates, plates.objects[filename]).features)
          .enter().append("path")
            .attr("class", "plates")
            .attr("d", path);

          timeScale.highlight(name);

          // Load the coastlines
          d3.json("build/js/coastlines/" + filename + ".json", function(er, coastlines) {
            svg.selectAll(".coastlines")
              .data(topojson.feature(coastlines, coastlines.objects[filename]).features)
            .enter().append("path")
              .attr("class", "coastlines")
              .attr("d", path);
          });

          // Switch to reconstruct map now
          if(parseInt(d3.select("#map").style("height")) > 1) {
            d3.select("#map").style("display", "none");
          }

          d3.select("#svgMap").style("display", "none");

          d3.select("#reconstructMap").style("display", "block");
          
          // Make sure the reconstruct map is properly sized for the window
          reconstructMap.resize();

          // Hide the info window
          d3.select(".info")
            .html('')
            .style("display", "none");

          // Load the rotated intervals
          d3.json("build/js/rotatedIntervals/" + filename + ".json", function(err, result) {
          //TODO: Double check that the key is unpredictable...using filename might work
            var keys = Object.keys(result.objects),
                key = keys[0];
            
            rotatedPoints = topojson.feature(result, result.objects[key]);

            /* If there is a taxon or contributor filter applied to the map, ask the API
               for all the level2 bins with those filters applied. */
            if (navMap.filters.exist.taxon || navMap.filters.exist.personFilter || navMap.filters.exist.stratigraphy) {
              var url = paleo_nav.dataUrl + paleo_nav.dataService + '/colls/summary.json?lngmin=-180&lngmax=180&latmin=-90&latmax=90&level=3&limit=99999';

              url = navMap.parseURL(url); 

              d3.json(url, function(wrong, right) {
                var pbdbData = right.records;
                /* Instead of having to ask GPlates to rotate a ton of points, we'll simply
                   compare our filtered, non-rotated dataset with our unfiltered, rotated
                   dataset */
                var matches = [];
                pbdbData.forEach(function(d) {
                  rotatedPoints.features.forEach(function(e) {
                    if (d.oid === parseInt(e.properties.NAME)) {
                      matches.push(e);
                    }
                  });
                });

                matches.forEach(function(d) {
                  for (var i=0;i<response.records.length;i++) {
                    if (parseInt(d.properties.NAME) == response.records[i].oid) {
                      d.properties.nco = response.records[i].nco;
                      d.properties.noc = response.records[i].noc;
                      d.properties.oid = response.records[i].oid;
                    }
                  }
                });

                // Now that we know which bins to display, add them to the map
                reconstructMap.addToMap(matches, interval);
                navMap.summarize(right);
              });
            } else {
              /* If there is only a time filter applied, simply match the rotated points to the
                 unrotated points so that they have useful data bound to them */
              rotatedPoints.features.forEach(function(d) {
                for (var i=0;i<response.records.length;i++) {
                  if (parseInt(d.properties.NAME) == response.records[i].oid) {
                    d.properties.nco = response.records[i].nco;
                    d.properties.noc = response.records[i].noc;
                    d.properties.oid = response.records[i].oid;
                  }
                }
              });

              // Now that the data is bound, add them to the reconstruction map
              reconstructMap.addToMap(rotatedPoints.features, interval);
              navMap.summarize(response);
            }
          }); // End plate callback
        }); // End rotated points callback
      
      }); // end nonrotated point callback
    },

    "addToMap": function(data, interval) {
      var svg = d3.select("#reconstructContent");

      var scale = d3.scale.linear()
        .domain([1, 4240])
        .range([4, 15]);

      var zoom = 2;

      // Bind the data
      svg.selectAll("circle")
        .data(data)
      .enter().append("circle")
        .attr("class", "collection")
        .style("fill", function() {
          return (interval.col) ? interval.col : interval.color;
        })
        .attr("r", function(d) { return scale(d.properties.nco)*0.7;})
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
            .html("<strong>" + d.properties.nco + " collections</strong><br>" + d.properties.noc + " occurrences")
            .style("display", "block");
        })
        .on("click", function(d) {
          d3.select(".info")
            .html("<strong>" + d.properties.nco + " collections</strong><br>" + d.properties.noc + " occurrences")
            .style("display", "block");
          navMap.openBinModal(d);
        })
        .on("mouseout", function(d) {
          d3.select(".info")
            .html("")
            .style("display", "none");
        });

      // Remove reconstructing listener and loading GIF
      reconstructing = false;
      paleo_nav.hideLoading();

      // Update currentReconstruction
      reconstructMap.currentReconstruction = {"name": (interval.nam) ? interval.nam : interval.name, "color":interval.col, "mid": interval.mid, "id": interval.oid, "taxa": [], "person": "", "stratigraphy": ""};

      if (navMap.filters.exist.taxon) {
        navMap.filters.taxa.forEach(function(d) {
          reconstructMap.currentReconstruction.taxa.push({ "name": d.name });
        });
      }
      if (navMap.filters.exist.personFilter) {
        reconstructMap.currentReconstruction.person = navMap.filters.personFilter.name;
      }
      if (navMap.filters.exist.stratigraphy) {
        reconstructMap.currentReconstruction.stratigraphy = navMap.filters.stratigraphy.name;
      }

    },

    // Used for added a bounding box to the reconstruction map to show previous map extent
    "addBBox": function(year) {
      // Remove the old one
      d3.selectAll(".rotatedBBox").remove();

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

      // Have GPlates rotate the four corners of the bounding box
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

          // Add it to the reconstruction map whenever it's ready
          svg.selectAll(".bbox")
            .data(bbox.features)
            .enter().append("path")
            .attr("class", "rotatedBBox")
            .attr("fill", "none")
            .attr("stroke", "#ccc")
            .attr("stroke-dasharray", "5,5")
            .attr("stroke-width", 2)
            .attr("opacity", 1)
            .attr("d", path);
        });
    },

    "resize": function() {
      var width = parseInt(d3.select("#graphics").style("width"));

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
          var height = ((window.innerHeight * 0.70) - 70);

          if (width > (box.width + 50)) {
            return "scale(" + window.innerHeight/800 + ")translate(" + ((width - box.width)/2) + ",0)";
          } else {
            var svgHeight = ((window.innerHeight * 0.70) - 70),
                mapHeight = (width/970 ) * 500,
                translate = (((svgHeight - mapHeight)/2) > 0) ? (svgHeight - mapHeight)/2 : 0;

            return "scale(" + width/970 + ")translate(0," + translate + ")";
          }
        });

      d3.select("#reconstructMap").select("svg")
        .style("height", function(d) {
          if (d3.select(".timeScale").style("visibility") === "hidden") {
            return (window.innerHeight - 70) + "px";
          } else {
            var timeHeight = ($("#time").height() > 15) ? $("#time").height() : window.innerHeight / 5.6;
            return (window.innerHeight - timeHeight - 70) + "px";
          }
        })
        .style("width", function(d) {
          return width - 15 + "px";
        });

      d3.select("#reconstructMapRefContainer")
        .style("height", function() {
          return d3.select("#svgMap").style("height");
        });

    },

    "reset": function() {
      // Completely reset the reconstruction map
      d3.select("#reconstructContent").remove();
      d3.select("#interval").html("");
      d3.select("#age").html("");
    },

    "currentReconstruction": currentReconstruction,
    "reconstructing": reconstructing,
    "visible": false
  }
})();