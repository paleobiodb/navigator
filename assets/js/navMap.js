// Global variables
// TODO: rework so that this isn't global
var map;

var navMap = (function() {

  var stamen, stamenLabels,
    prevsw = {"lng": 0, "lat": 0},
    prevne = {"lng": 0, "lat": 0},
    prevzoom = 3,
    currentRequest,
    totalOccurrences;

  var filters = { "selectedInterval":
                  { "nam": "",
                    "mid": "",
                    "oid": ""
                  },
                  "personFilter": {
                    "id":"",
                    "name": ""
                  },
                  "taxa": [ ],
                  "stratigraphy": {
                    "name": "",
                    "rank": ""
                  },
                  "exist": {
                    "selectedInterval" : false,
                    "personFilter": false,
                    "taxon": false,
                    "stratigraphy": false
                  }
                };

  // Variables used thoughout
  var width = 960,
      height = 500;

  var projection = d3.geo.hammer()
    .scale(165)
    .translate([width / 2, height / 2])
    .rotate([1e-6, 0])
    .precision(.1);

  var path = d3.geo.path()
    .projection(projection);

  // Load the partials once
  var binModalPartial,
      collectionModalPartial,
      occurrencePartial,
      stackedCollectionPartial;

  /* via http://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript */
  function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

// TODO: rework this so that only necesarry functions are returned
  return {
    "init": function(callback) {
      // Init the leaflet map
      map = new L.Map('map', {
        center: new L.LatLng(7, 0),
        zoom: 2,
        maxZoom:11,
        minZoom: 2,
        zoomControl: false,
        inertiaDeceleration: 6000,
        inertiaMaxSpeed: 1000,
        zoomAnimationThreshold: 1
      });

      var attrib = 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';

      stamen = new L.TileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner-background/{z}/{x}/{y}.png', {attribution: attrib}).addTo(map);

      stamenLabels = new L.TileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}.png', {attribution: attrib});

      function mapSelection(zoom) {
      // If viewing the projected map...
        var newBounds = map.getBounds();
        if (Math.abs(newBounds._northEast.lng) + Math.abs(newBounds._southWest.lng) > 360) {
          var changeMaps = true;
        }
        if (zoom < 3 || zoom > 3 && changeMaps || prevzoom === 4 && zoom === 3 && changeMaps) {
          if (window.innerWidth > 700) {
            prevzoom = 2;
            d3.select("#map").style("height", 0);
            d3.select("#svgMap").style("display", "block");
            //setTimeout(navMap.resizeSvgMap, 400);
          }
        }

        navMap.refresh();
      }
      // Called every time the map is panned, zoomed, or resized
      map.on("moveend", function(event) {
        // event.hard = true when map is adjusted programatically
        // Don't fire if adjusted programatically
        if (event.hard || parseInt(d3.select("#map").style("height")) < 2) {
          return;
        } else {
          mapSelection(map.getZoom());

          paleo_nav.getPrevalence();
        }
      });

      map.on("zoomend", function() {
        d3.select(".leaflet-zoom-hide").style("visibility", "hidden");
        // See if labels should be applied or not
        navMap.selectBaseMap(map.getZoom());

        mapSelection(map.getZoom());
      });

      // Get map ready for an SVG layer
      map._initPathRoot();

      // Add the SVG to hold markers to the map
      d3.select("#map").select("svg")
        .append("g")
        .attr("class", "leaflet-zoom-hide")
        .attr("id", "binHolder");

      // Hide the map after initialized
      /* Setting "display" = "none" doesn't allow us to operate on
         the map when it is invisible, so hiding/showing the leaflet
         map is done by changing its height */
      d3.select("#map").style("height", 0);

      // Set up the projected map
      var zoom = d3.behavior.zoom()
        .on("zoom",function() {
          if (d3.event.sourceEvent.wheelDelta > 0) {
            navMap.changeMaps(d3.mouse(this));
          } else if (d3.event.sourceEvent.type === "touchmove") {
            navMap.changeMaps([d3.event.sourceEvent.pageX, d3.event.sourceEvent.pageY]);
          }
        });

      var hammer = d3.select("#svgMap").append("svg")
        .attr("width", width)
        .attr("height", height)
        .call(zoom)
        .on("click", function() {
          navMap.changeMaps(d3.mouse(this));
        })
        .append("g");

      hammer.append("defs").append("path")
        .datum({type: "Sphere"})
        .attr("id", "sphere")
        .attr("d", path);

      hammer.append("use")
        .attr("class", "fill")
        .attr("xlink:href", "#sphere");

      d3.json("build/js/countries_1e5.json", function(error, data) {
        hammer.append("path")
          .datum(topojson.feature(data, data.objects.countries))
          .attr("class", "countries")
          .attr("d", path);

      //TODO: Yeaaaah...
        reconstructMap.resize();
        timeScale.resize();
        setTimeout(navMap.resize, 1000);

        callback();
      });

      // Lazily load all the partials once
      d3.text("build/partials/binModal.html", function(error, template) {
        binModalPartial = template;
      });

      d3.text("build/partials/collectionModal.html", function(error, template) {
        collectionModalPartial = template;
      });

      d3.text("build/partials/occurrences.html", function(error, template) {
        occurrencePartial = template;
      });

      d3.text("build/partials/stackedCollectionModal.html", function(error, template) {
        stackedCollectionPartial = template;
      });


    },

    "changeMaps": function(mouse) {
      paleo_nav.getPrevalence();

      var timeHeight = ($("#time").height() > 15) ? $("#time").height() : window.innerHeight / 5.6,
          translate = [window.innerWidth / 2, (window.innerHeight - timeHeight - 70) / 2];

      var mercator = d3.geo.mercator()
        .scale(165)
        .precision(.1)
        .translate(translate);

      var coords = mouse,
        projected = mercator.invert(coords);

      d3.select("#svgMap").style("display", "none");
      d3.select("#map").style("height", function() {
        if (d3.select(".timeScale").style("visibility") === "hidden") {
          return (window.innerHeight - 70) + "px";
        } else {
          var timeHeight = ($("#time").height() > 15) ? $("#time").height() : window.innerHeight / 5.6;
          return (window.innerHeight - timeHeight - 56) + "px";
        }
      });

      map.setView([parseInt(projected[1]), parseInt(projected[0])], 3, {animate:false});

      var newBounds = map.getBounds();
      if (Math.abs(newBounds._northEast.lng) + Math.abs(newBounds._southWest.lng) > 360) {
        map.setZoom(4, {animate: false});
      }

      navMap.refresh("reset");
      map.invalidateSize();
    },

    // Given a [lat,lng] and a zoom level, adjust the map
    "goTo": function(coords, zoom) {
      // If viewing Hammer, ignore
      if (zoom < 3) {
        return;
      } else {
        d3.select("#svgMap").style("display", "none");
        d3.select("#map").style("height", function() {
          return window.innerHeight * 0.70 + "px";
        });

        map._resetView(coords, zoom);
      }
    },


    "selectBaseMap": function(zoom) {
      if (zoom < 5) {
        if (map.hasLayer(stamenLabels)) {
          map.removeLayer(stamenLabels);
          map.addLayer(stamen);
        }
      } else if (zoom > 4 && zoom < 7) {
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
      paleo_nav.showLoading();

      if ((prevzoom - map.getZoom()) != 0) {
        d3.select(".leaflet-zoom-hide").style("visibility", "hidden");
      }

      var filtered = navMap.checkFilters();

      // Check which map is displayed - if hammer, skip the rest
      if (parseInt(d3.select("#map").style("height")) < 1) {

        // Abort any pending requests
        if(typeof(currentRequest) != 'undefined') {
          if (Object.keys(currentRequest).length > 0) {
            currentRequest.abort();
            currentRequest = {};
          }
        }

        var url = paleo_nav.dataUrl + paleo_nav.dataService + '/colls/summary.json?lngmin=-180&lngmax=180&latmin=-90&latmax=90&limit=all&show=time';

        // If filters are applied to the map
        if (filtered) {
          // If only a tim filter is applied...
          if (filters.exist.selectedInterval === true && !filters.exist.personFilter && !filters.exist.taxon && !filters.exist.stratigraphy) {
            url += "&level=3";
            url = navMap.parseURL(url);

            if (typeof(timeScale.interval_hash[filters.selectedInterval.oid]) != "undefined") {
              // .. and if the level2 data for the selected interval hasn't been loaded...
              if (typeof(timeScale.interval_hash[filters.selectedInterval.oid].data) === "undefined") {
                // ...load it...
                currentRequest = d3.json(url, function(error, data) {
                  if (error) {
                    return paleo_nav.hideLoading();
                  }
                  // ...and hold on to it
                  timeScale.interval_hash[filters.selectedInterval.oid].data = data;
                  return navMap.refreshHammer(data);
                });
              // If the level2 data for the selected interval has already been loaded, use that
              } else {
                return navMap.refreshHammer(timeScale.interval_hash[filters.selectedInterval.oid].data);
              }
            }

          } else {
            url += "&level=2";
            url = navMap.parseURL(url);
          }
        // If there are no filters
        } else {
          url += "&level=1";
          url = navMap.parseURL(url);
        }

        currentRequest = d3.json(url, function(error, data) {
          if (error) {
            return paleo_nav.hideLoading();
          }
          navMap.refreshHammer(data);
        });

        return;
      }

      var bounds = map.getBounds(),
        sw = bounds._southWest,
        ne = bounds._northEast,
        zoom = map.getZoom();

      sw.lat = sw.lat.toFixed(4);
      sw.lng = sw.lng.toFixed(4);
      ne.lat = ne.lat.toFixed(4);
      ne.lng = ne.lng.toFixed(4);

      if(!reset) {
        // Check if new points are needed from the server
        // If the new bounding box is a subset of the old one...
        if (prevne.lat > ne.lat && prevne.lng > ne.lng && prevsw.lat < sw.lat && prevsw.lng < sw.lng) {
          // Was there a change in the type of points needed?
          if (prevzoom < 3 && zoom > 2) {
            // refresh
          } else if (prevzoom < 5 && zoom > 4) {
            //refresh
          } else if (prevzoom < 7 && zoom > 6) {
            //refresh
          } else if (prevzoom === zoom) {
            prevzoom = zoom;
            paleo_nav.hideLoading();
            return;
          } else {
            var points = d3.selectAll(".bins");
            if (zoom > 6) {
              var clusters = d3.selectAll(".clusters");
              prevzoom = zoom;
              return navMap.redrawPoints(points, clusters);
            } else {
              prevzoom = zoom;
              return navMap.redrawPoints(points);
            }
          }
        } else if (prevzoom > 2 && zoom < 7) {
          if (filtered) {
            if (filters.exist.selectedInterval === true && !filters.exist.personFilter && !filters.exist.taxon && !filters.exist.stratigraphy) {
              if (d3.select("#binHolder").selectAll("circle")[0].length < 1) {
                // refresh
              } else if (prevzoom < 7 && zoom > 6 || prevzoom > 6 && zoom < 7) {
                //refresh
              } else {
                var points = d3.selectAll(".bins");
                if (zoom > 6) {
                  var clusters = d3.selectAll(".clusters");
                  prevzoom = zoom;
                  return navMap.redrawPoints(points, clusters);
                } else {
                  prevzoom = zoom;
                  return navMap.redrawPoints(points);
                }
              }
            }
          }
        }
      }

      prevsw = sw;
      prevne = ne;
      prevzoom = zoom;
      // Make sure bad requests aren't made
      sw.lat = (sw.lat < -90) ? -90 : sw.lat;
      ne.lat = (ne.lat > 90) ? 90 : ne.lat;

      // Abort any pending requests
      if(typeof(currentRequest) != 'undefined') {
        if (Object.keys(currentRequest).length > 0) {
          currentRequest.abort();
          currentRequest = {};
        }
      }

      // Depending on the zoom level, call a different service from PaleoDB, feed it a bounding box, and pass it to the proper point parsing function
      if (zoom < 5 && filtered === false) {
        var url = paleo_nav.dataUrl + paleo_nav.dataService + '/colls/summary.json?lngmin=' + sw.lng + '&lngmax=' + ne.lng + '&latmin=' + sw.lat + '&latmax=' + ne.lat + '&level=2&limit=all&show=time';

        currentRequest = d3.json(navMap.parseURL(url), function(error, data) {
          if (error) {
            return paleo_nav.hideLoading();
          }
          navMap.drawBins(data, 1, zoom);
        });

      } else if (zoom > 4 && zoom < 7 || zoom < 5 && filtered === true) {

        // If filtered only by a time interval...
        if (filters.exist.selectedInterval === true && !filters.exist.personFilter && !filters.exist.taxon && !filters.exist.stratigraphy) {
          var url = paleo_nav.dataUrl + paleo_nav.dataService + '/colls/summary.json?lngmin=-180&lngmax=180&latmin=-90&latmax=90&limit=all&show=time&level=3';
          url = navMap.parseURL(url);

          if (typeof(timeScale.interval_hash[filters.selectedInterval.oid]) != "undefined") {
            // .. and if the level2 data for the selected interval hasn't been loaded...
            if (typeof(timeScale.interval_hash[filters.selectedInterval.oid].data) === "undefined") {
              // ...load it...
              currentRequest = d3.json(url, function(error, data) {
                if (error) {
                  return paleo_nav.hideLoading();
                }
                // ...and hold on to it
                timeScale.interval_hash[filters.selectedInterval.oid].data = data;
                return navMap.drawBins(data, 2, zoom);
              });
            // If the level2 data for the selected interval has already been loaded, use that
            } else {
              return navMap.drawBins(timeScale.interval_hash[filters.selectedInterval.oid].data, 2, zoom);
            }
          }
        // If not filtered only by a time interval, refresh normally
        } else {
          var url = paleo_nav.dataUrl + paleo_nav.dataService + '/colls/summary.json?lngmin=' + sw.lng + '&lngmax=' + ne.lng + '&latmin=' + sw.lat + '&latmax=' + ne.lat + '&level=3&limit=all&show=time';

          currentRequest = d3.json(navMap.parseURL(url), function(error, data) {
            if (error) {
              return paleo_nav.hideLoading();
            }
            navMap.drawBins(data, 2, zoom);
          });
        }

      } else {
        var url = paleo_nav.dataUrl + paleo_nav.dataService + '/colls/list.json?lngmin=' + sw.lng + '&lngmax=' + ne.lng + '&latmin=' + sw.lat + '&latmax=' + ne.lat + '&limit=all&show=ref,time,strat,geo,lith,entname,prot&markrefs';

        currentRequest = d3.json(navMap.parseURL(url), function(error, data) {
          if (error) {
            return paleo_nav.hideLoading();
          }
          navMap.drawCollections(data, 3, zoom);
        });

      }
    },

    // Adjust the positioning of the SVG elements relative to the map frame
    "redrawPoints": function(points, clusters) {
      d3.select(".leaflet-zoom-hide").style("visibility", "hidden");

      var zoom = map.getZoom();
      if (zoom < 5) {
        if (navMap.checkFilters()) {
          // Scale for level 3 or filtered + clusters
          var scale = d3.scale.log()
            .domain([1, 400])
            .range([4,30]);
          } else {
            // Scale for level 2
            var scale = d3.scale.linear()
            .domain([1, 3140])
            .range([4, 30]);
          }
      } else if (zoom > 4 && zoom < 7 ) {
        // Scale for level 3
        var scale = d3.scale.log()
          .domain([1, 400])
          .range([4,30]);
      } else {
        // Scale for collections
        var scale = d3.scale.linear()
          .domain([1, 50])
          .range([12, 30]);
      }
      points.attr("cx",function(d) { return map.latLngToLayerPoint([d.lat,d.lng]).x});
      points.attr("cy",function(d) { return map.latLngToLayerPoint([d.lat,d.lng]).y});
      if (clusters) {
        clusters.attr("cx",function(d) { return map.latLngToLayerPoint([d.lat,d.lng]).x});
        clusters.attr("cy",function(d) { return map.latLngToLayerPoint([d.lat,d.lng]).y});
        clusters.attr("r", function(d) { return scale(d.members.length); })
        points.attr("r", 12);
      } else {
        if (d3.select("#binHolder").selectAll(".bins")[0].length < 30) {
          points.attr("r", 8);
        } else {
          points.attr("r", function(d) { return scale(d.nco)*navMap.multiplier(zoom) < 4 ? 4 : scale(d.nco)*navMap.multiplier(zoom); });
        }
      }

      paleo_nav.hideLoading();

      d3.select(".leaflet-zoom-hide").style("visibility", "visible");
    },

    "refreshHammer": function(data) {
      navMap.summarize(data);

      var scale = d3.scale.linear()
        .domain([1, 4240])
        .range([4, 15]);

      var hammer = d3.select("#svgMap").select("svg").select("g"),
          zoom = 2;

      var bins = hammer.selectAll("circle")
        .data(data.records);

      bins.enter().append("circle")
        .attr("id", function(d) { return "p" + d.cxi; })
        .attr("class", "binsHammer")
        .on("mouseout", function() {
          navMap.setInfoSummary();
          timeScale.unhighlight()
        });

      bins
        .style("fill", function(d) { return (timeScale.interval_hash[d.cxi]) ? timeScale.interval_hash[d.cxi].color : "#000"; })
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
            .html("<strong>" + d.nco + " collections</strong><br>" + d.noc + " occurrences")
            .style("display", "block");
          timeScale.highlight(this);
        })
        .on("click", function(d) {
          navMap.changeMaps(d3.mouse(this));
        });

      bins.exit().remove();

      if (!reconstructMap.reconstructing) {
        paleo_nav.hideLoading();
      }

    },

    "drawBins": function(data, level, zoom) {
      navMap.summarize(data);

      d3.selectAll(".clusters").remove();

      var g = d3.select("#binHolder");

      // Add the bins to the map
      var points = g.selectAll(".bins")
        .data(data.records);

      points
        .attr("id", function(d) { return "p" + d.cxi; })
        .style("fill", function(d) { return (timeScale.interval_hash[d.cxi]) ? timeScale.interval_hash[d.cxi].color : "#000"; })
        .on("mouseover", function(d) {
          d3.select(".info")
            .html("<strong>" + d.nco + " collections</strong><br>" + d.noc + " occurrences")
            .style("display", "block");
          timeScale.highlight(this);
        })
        .on("click", function(d) {
          if (level === 2) {
            d3.select(".info")
              .html("<strong>" + d.nco + " collections</strong><br>" + d.noc + " occurrences")
              .style("display", "block");
            timeScale.highlight(this);
            navMap.openBinModal(d);
          } else if (level === 1) {
            map.setView([d.lat, d.lng], 5);
          }
        });

      points.enter().append("circle")
        .attr("class", "bins")
        .attr("id", function(d) { return "p" + d.cxi; })
        .style("fill", function(d) { return (timeScale.interval_hash[d.cxi]) ? timeScale.interval_hash[d.cxi].color : "#000"; })
        .on("mouseover", function(d) {
          d3.select(".info")
            .html("<strong>" + d.nco + " collections</strong><br>" + d.noc + " occurrences")
            .style("display", "block");
          timeScale.highlight(this);
        })
        .on("click", function(d) {
          if (level === 2) {
            d3.select(".info")
              .html("<strong>" + d.nco + " collections</strong><br>" + d.noc + " occurrences")
              .style("display", "block");
            timeScale.highlight(this);
            navMap.openBinModal(d);
          } else if (level === 1) {
            map.setView([d.lat, d.lng], 5);
          }
        })
        .on("mouseout", function() {
          navMap.setInfoSummary();
          timeScale.unhighlight();
        });

      points.exit().remove();

      // Update the SVG positioning
      navMap.redrawPoints(points);
    },

    "drawCollections": function(data, level, zoom) {
      navMap.summarize(data);

      var g = d3.select("#binHolder");

      // Many collections share the same coordinates, making it necessary to create clusters of like coordinates
      var clusters = [];
      // For each collection, check it's coordinates against all others and see if any matches exist
      for (var i=0; i<data.records.length; i++) {
        for (var j=0; j<data.records.length; j++) {
          // If another collection has the same lat/lng and a different OID, create a new cluster
          // SIDENOTE: this could be extended for binning by specifying a tolerance instead of an exact match of coordinates
          if (data.records[i].lat === data.records[j].lat && data.records[i].lng === data.records[j].lng && data.records[i].oid != data.records[j].oid) {
            var newCluster = {"lat":data.records[i].lat, "lng":data.records[i].lng, "members": []},
                exists = 0;
            // Make sure a cluster with those coordinates doesn't already exist
            for (var z=0; z<clusters.length;z++) {
              if (newCluster.lat === clusters[z].lat && newCluster.lng === clusters[z].lng) {
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
          if (clusters[i].lat === data.records[j].lat && clusters[i].lng === data.records[j].lng) {
            clusters[i].members.push(data.records[j]);
            toRemove.push(data.records[j].oid);
          }
        }
      }
      // Remove all clustered collections from data.records
      for (var i=0; i<toRemove.length; i++) {
        var index = navMap.getIndex(data.records, toRemove[i], "oid");
        data.records.splice(index, 1);
      }

      // Create a Leaflet Lat/lng for all clusters
      clusters.forEach(function(d) {
        var totalOccurrences = [];

        d.members.forEach(function(e) {
          totalOccurrences.push(e.noc);
        });
        //d.ageTop = d3.min(clusterTops);
        //d.ageBottom = d3.max(clusterBottoms);
        // TODO: fix this to something more accurate
        /* Annecdotal evidence suggests all collections that share a lat/lng should be from the
          same interval, but I doubt that it's always true */
        d.cxi = d.members[0].cxi;
        d.noc = d3.sum(totalOccurrences);
        d.nam = d.members.length + " Collections";
      });

      var clusters = g.selectAll(".clusters")
        .data(clusters);

      clusters
        .attr("id", function(d) { return "p" + d.members[0].cxi; })
        .style("fill", function(d) { return timeScale.interval_hash[d.cxi].color; })
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
          navMap.openStackedCollectionModal(d);
        })
        .on("mouseout", function(d) {
          navMap.setInfoSummary();
          timeScale.unhighlight();
        });

      clusters.enter().append("circle")
        .attr("class", "clusters")
        .attr("id", function(d) { return "p" + d.members[0].cxi; })
        .style("fill", function(d) { return (timeScale.interval_hash[d.members[0].cxi]) ? timeScale.interval_hash[d.members[0].cxi].color : "#000"; })
        .on("mouseover", function(d) {
          d3.select(".info")
            .html("<strong>" + d.members.length + " collections</strong><br>" + d.noc + " occurrences")
            .style("display", "block");
          timeScale.highlight(this);
        })
        .on("mouseout", function(d) {
          navMap.setInfoSummary();
          timeScale.unhighlight();
        })
        .on("click", function(d) {
          d3.select(".info")
            .html("<strong>" + d.nam + "</strong><br>" + d.noc + " occurrences")
            .style("display", "block");
          timeScale.highlight(this);
          navMap.openStackedCollectionModal(d);
        });

      clusters.exit().remove();

      var points = g.selectAll(".bins")
        .data(data.records);

      var existingPoints = points
        .attr("id", function(d) { return "p" + d.cxi })
        .style("fill", function(d) { return (timeScale.interval_hash[d.cxi]) ? timeScale.interval_hash[d.cxi].color : "#000"; })
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
          navMap.setInfoSummary();
          timeScale.unhighlight();
        });

      points.enter().append("circle")
        .attr("id", function(d) { return "p" + d.cxi })
        .attr("class", "bins")
        .style("fill", function(d) { return (timeScale.interval_hash[d.cxi]) ? timeScale.interval_hash[d.cxi].color : "#000"; })
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
          navMap.setInfoSummary();
          timeScale.unhighlight();
        });

      points.exit().remove();

      navMap.redrawPoints(points, clusters);

    },

    "getOffsetCollections": function(cluster, offset) {
      d3.json(paleo_nav.dataUrl + paleo_nav.dataService + "/colls/list.json?clust_id=" + cluster + "&show=ref,loc,time,strat,geo,lith,entname,prot&markrefs&limit=20&offset=" +offset, function(err, data) {
        if (err) {
          return paleo_nav.hideLoading();
        }
        data.records.forEach(function(d) {
          d.intervals = (d.oli) ? d.oei + " - " + d.oli : d.oei;
          d.strat = (d.sfm || d.sgr || d.smb) ? true : false;
          d.lat = Math.round(d.lat * 10000) / 10000;
          d.lng = Math.round(d.lng * 10000) / 10000;
          d.oid = d.oid.replace(":","");          
        });

        var output = Mustache.render(stackedCollectionPartial, {"members": data.records });

        $("#collectionCount").html("Showing " + offset + " of " + data.records_found + " collections");
        $("#collectionAccordion").append(output);
        $(".show-more-collections").data()["shown-collections"] = offset;
        if (offset >= $(".show-more-collections").data("total-collections")) {
          $(".show-more-collections").hide();
        }

        $(".occurrenceTab").on("show.bs.tab", function(d) {
          var id = d.target.id;
          id = id.replace("occToggle", "");

          var url = navMap.parseURL(paleo_nav.dataUrl + paleo_nav.dataService + "/occs/list.json?coll_id=" + id + "&show=phylo,ident");

          d3.json(url, function(err, data) {
            if (err) {
              return paleo_nav.hideLoading();
            }
            if (data.records.length > 0) {
              var taxonHierarchy = navMap.buildTaxonHierarchy(data);

              var output = Mustache.render(occurrencePartial, taxonHierarchy);
              $("#occurrences" + id).html(output);

              $(".filterByOccurrence").click(function(event) {
                event.preventDefault();
                navMap.filterByTaxon($(this).attr("data-name"));
                $("#collectionModal").modal("hide");
              });

            } else {
              var output = Mustache.render(occurrencePartial, {"error": "No occurrences found for this collection"});
              $("#occurrences" + id).html(output);
            }
          });
        });
        $("#collectionLoading").hide();
      });
    },

    "openBinModal": function(d, collections, occurrences, interval) {
      $("#loading").show();
      var id = (d.properties) ? d.properties.oid : d.oid,
          url = paleo_nav.dataUrl + paleo_nav.dataService + "/colls/list.json?clust_id=" + id;
          console.log(id); 

      url = navMap.parseURL(url);
      url += "&show=ref,loc,time,strat,geo,lith,entname,prot&markrefs&limit=20&rowcount";

      d3.json(url, function(err, data) {
        if (err) {
          return paleo_nav.hideLoading();
        }
        data.records.forEach(function(d) {
          d.intervals = (d.oli) ? d.oei + " - " + d.oli : d.oei;
          d.strat = (d.sfm || d.sgr || d.smb) ? true : false;
          d.lat = Math.round(d.lat * 10000) / 10000;
          d.lng = Math.round(d.lng * 10000) / 10000;
          d.oid = d.oid.replace(":","");
        });

        var output = Mustache.render(stackedCollectionPartial, {"members": data.records });

        d3.select("#collectionCount").html("Showing " + data.records.length + " of " + data.records_found + " collections");
        d3.select("#collectionAccordion").html(output);

        $(".show-more-collections")
          .data("total-collections", data.records_found)
          .data("shown-collections", data.records_returned);

        $(".collectionCollapse").on("show.bs.collapse", function(d) {
          var id = d.target.id;
          id = id.replace("collapse", "");
          /* Placeholder for data service fix
            var url = paleo_nav.dataUrl + paleo_nav.dataService + "/colls/single.json?id=" + id + "&show=ref,time,strat,geo,lith,entname,prot&markrefs";
            url = navMap.parseURL(url);
            d3.json(url, function(err, data) {
          */
          d3.json(paleo_nav.dataUrl + paleo_nav.dataService + "/colls/single.json?id=" + id + "&show=ref,time,strat,geo,lith,entname,prot&markrefs", function(err, data) {
            if (err) {
              return paleo_nav.hideLoading();
            }
            $("#ref" + id).html(data.records[0].ref);
          });
        });

        $(".occurrenceTab").on("show.bs.tab", function(d) {
          var id = d.target.id;
          id = id.replace("occToggle", "");

          var url = navMap.parseURL(paleo_nav.dataUrl + paleo_nav.dataService + "/occs/list.json?coll_id=" + id + "&show=phylo,ident");

          d3.json(url, function(err, data) {
            if (err) {
              return paleo_nav.hideLoading();
            }
            if (data.records.length > 0) {
              var taxonHierarchy = navMap.buildTaxonHierarchy(data);

              var output = Mustache.render(occurrencePartial, taxonHierarchy);
              $("#occurrences" + id).html(output);

              $(".filterByOccurrence").click(function(event) {
                event.preventDefault();
                navMap.filterByTaxon($(this).attr("data-name"));
                $("#collectionModal").modal("hide");
              });

            } else {
              var output = Mustache.render(occurrencePartial, {"error": "No occurrences found for this collection"});
              $("#occurrences" + id).html(output);
            }
          });
        });

        // Handle showing/hiding "show more collections"
        if (data.records_found <= data.records_returned) {
          $(".show-more-collections").hide();
          $("#collectionCount").hide();
        } else {
          $(".show-more-collections")
            .show()
            .off("click")
            .on("click", function() {
              $("#collectionLoading").show();
              $(".show-more-collections").data()["offset"] += 20
              navMap.getOffsetCollections(id, $(".show-more-collections").data()["offset"]);
            });
        }

        $("#binModal").modal();
        $("#loading").hide();
      });
    },

    "buildTaxonHierarchy": function(data) {
      var occurrenceTree = {"phyla": []};

      data.records.forEach(function(d) {
        // Some preproccessing
        d.rank = (d.mra) ? taxaBrowser.rankMap(d.mra) : (d.rank) ?  taxaBrowser.rankMap(d.rnk) : "Unknown";
        d.itallics = (d.rnk < 6) ? "itallics" : "";
        d.old_name = (d.tna.split(" ")[0] != d.idt) ? d.tna : "";
        d.url = (d.rank === "species") ? (d.idt + " " + d.ids) : (d.tid > 0) ? d.idt : "";

        // If it has a genus name...
        if (d.idt) {
          // If it's a species...
          if (d.rank === "species") {
            var genusRes = (d.rst) ? d.rst + " " : "",
                speciesRes = (d.rss) ? " " + d.rss + " " : " ";
            d.genusRes = genusRes;
            //d.display_name1 = d.idt + " " + d.ids;
            // d.display_name2 = "";
            d.display_name1 = d.mna;
            d.display_name2 = (d.mna != (d.idt + " " + d.ids)) ? ("(" + d.tna + ")") : "";
            d.display_name3 = "";
          } else {
            var genusRes = (d.rst) ? d.rst + " " : "",
                speciesRes = (d.rss) ? " " + d.rss + " " : "";
            d.genusRes = genusRes;
            d.display_name1 = d.idt;
            d.display_name2 = speciesRes;
            d.display_name3 = d.ids;
          }
        } else {
          d.display_name1 = d.tna;
          d.display_name2 = "";
        }

        // Find unique phyla
        var phyla = [];
        for (var i = 0; i < occurrenceTree.phyla.length; i++) {
          phyla.push(occurrenceTree.phyla[i].phylum);
        }

        if (phyla.indexOf(d.phl) < 0) {
          var newPhylum = {"phylum": d.phl, "classes": []};
          occurrenceTree.phyla.push(newPhylum);
        }

        // Find unique phylum/class combinations
        var phyla_classes = [];
        for (var i = 0; i < occurrenceTree.phyla.length; i++) {
          for (var j = 0; j < occurrenceTree.phyla[i].classes.length; j++) {
            phyla_classes.push(occurrenceTree.phyla[i].phylum + "-" + occurrenceTree.phyla[i].classes[j].nameClass);
          }
        }

        if (phyla_classes.indexOf(d.phl + "-" + d.cll) < 0) {
          var newClass = {"nameClass": d.cll, "families": []},
              phylumIndex = navMap.getIndex(occurrenceTree.phyla, d.phl, "phylum");
          occurrenceTree.phyla[phylumIndex]["classes"].push(newClass);
        }

        // Find unique phylum/class/family combinations
        var phyla_class_family = [];
        for (var i = 0; i < occurrenceTree.phyla.length; i++) {
          for (var j = 0; j < occurrenceTree.phyla[i].classes.length; j++) {
            for (var k = 0; k < occurrenceTree.phyla[i].classes[j].families.length; k++) {
              phyla_class_family.push(occurrenceTree.phyla[i].phylum + "-" + occurrenceTree.phyla[i].classes[j].nameClass + "-" + occurrenceTree.phyla[i].classes[j].families[k].family);
            }
          }
        }

        if (phyla_class_family.indexOf(d.phl + "-" + d.cll + "-" + d.fml) < 0) {
          var newFamily = {"family": d.fml, "genera": []},
              phylumIndex = navMap.getIndex(occurrenceTree.phyla, d.phl, "phylum"),
              classIndex = navMap.getIndex(occurrenceTree.phyla[phylumIndex].classes, d.cll, "nameClass");
          occurrenceTree.phyla[phylumIndex].classes[classIndex]["families"].push(newFamily);
        }

        // Place genera into the right phylum/class/family
        var phylumIndex = navMap.getIndex(occurrenceTree.phyla, d.phl, "phylum"),
            classIndex = navMap.getIndex(occurrenceTree.phyla[phylumIndex].classes, d.cll, "nameClass"),
            familyIndex = navMap.getIndex(occurrenceTree.phyla[phylumIndex].classes[classIndex].families, d.fml, "family");
        occurrenceTree.phyla[phylumIndex].classes[classIndex].families[familyIndex].genera.push(d);
      });

      for (var i = 0; i < occurrenceTree.phyla.length; i++) {
        var undefinedClassIndex;
        for (var j = 0; j < occurrenceTree.phyla[i].classes.length; j++) {
          var undefinedFamilyIndex;
          for (var k = 0; k < occurrenceTree.phyla[i].classes[j].families.length; k++) {
            if (typeof(occurrenceTree.phyla[i].classes[j].families[k].family) === "undefined") {
              undefinedFamilyIndex = k;
              occurrenceTree.phyla[i].classes[j].families[k].family = "Miscellaneous " + (typeof(occurrenceTree.phyla[i].classes[j].nameClass) === "undefined") ? "Miscellaneous unranked taxa" : occurrenceTree.phyla[i].classes[j].nameClass;
              occurrenceTree.phyla[i].classes[j].families[k].noFamily = true;
            }
          }

          if (typeof(undefinedFamilyIndex) != "undefined") {
            occurrenceTree.phyla[i].classes[j].families.push(occurrenceTree.phyla[i].classes[j].families.splice(undefinedFamilyIndex, 1)[0]);
          }

          if (typeof(occurrenceTree.phyla[i].classes[j].nameClass) === "undefined") {
            undefinedFamilyIndex = j;
            occurrenceTree.phyla[i].classes[j].nameClass = "Miscellaneous " + (typeof(occurrenceTree.phyla[i].phylum) === "undefined") ? "Miscellaneous unranked taxa" : occurrenceTree.phyla[i].phylum;
            occurrenceTree.phyla[i].classes[j].noClass = true;
          }
        }

        if (typeof(undefinedClassIndex) != "undefined") {
          occurrenceTree.phyla[i].classes.push(occurrenceTree.phyla[i].classes.splice(undefinedClassIndex, 1)[0]);
        }

        if (typeof(occurrenceTree.phyla[i].phylum) === "undefined") {
          occurrenceTree.phyla[i].phylum = "Unranked taxa";
          occurrenceTree.phyla[i].unranked = true;
        }
      }

      return occurrenceTree;
    },

    "openCollectionModal": function(d) {
      $("#loading").show();
    /*
      Placeholder for once the data service allows filters on colls/single.json
      var url = paleo_nav.dataUrl + paleo_nav.dataService + "/colls/single.json?id=" + d.oid + "&show=ref,time,strat,geo,lith,entname,prot&markrefs";
      url = navMap.parseURL(url);
      d3.json(url, function(err, data) {
    */
      d3.json(paleo_nav.dataUrl + paleo_nav.dataService + "/colls/single.json?id=" + d.oid + "&show=ref,time,strat,geo,lith,entname,prot&markrefs", function(err, data) {
        if (err) {
          return paleo_nav.hideLoading();
        }
        data.records.forEach(function(d) {
          d.intervals = (d.oli) ? d.oei + " - " + d.oli : d.oei;
          d.strat = (d.sfm || d.sgr || d.smb) ? true : false;
          d.lat = Math.round(d.lat * 10000) / 10000;
          d.lng = Math.round(d.lng * 10000) / 10000;
          d.oid = d.oid.replace("col:","");
        });

        var output = Mustache.render(collectionModalPartial, data);
        $("#collectionName").html(data.records[0].nam);
        $("#collectionModalBody").html(output);

        switch (data.records[0].ptd) {
          case "NPS":
            $(".nationalParks").css("display", "block");
            $(".general, .federalLands").css("display", "none");
            break;
          case "FED":
            $(".federalLands").css("display", "block");
            $(".general, .nationalParks").css("display", "none");
            break;
          default:
            $(".general").css("display", "block");
            $(".nationalParks, .federalLands").css("display", "none");
            break;
        }

        $(".filterByStrat").click(function(event) {
          event.preventDefault();
          navMap.filterByStratigraphy({"name": $(this).attr("data-name"), "type": $(this).attr("data-rank")});
          $("#collectionBox").modal("hide");
        });

        $("#collectionBox").modal();

        $(".occurrenceTab").on("show.bs.tab", function(d) {
          var id = d.target.id;
          id = id.replace("occToggle", "");

          var url = navMap.parseURL(paleo_nav.dataUrl + paleo_nav.dataService + "/occs/list.json?coll_id=" + id + "&show=phylo,ident");

          d3.json(url, function(err, data) {
            if (err) {
              return paleo_nav.hideLoading();
            }
            if (data.records.length > 0) {
              var taxonHierarchy = navMap.buildTaxonHierarchy(data);

              var output = Mustache.render(occurrencePartial, taxonHierarchy);
              $("#occurrences" + id).html(output);

              $(".filterByOccurrence").click(function(event) {
                event.preventDefault();
                navMap.filterByTaxon($(this).attr("data-name"));
                $("#collectionBox").modal("hide");
              });

            } else {
              var output = Mustache.render(occurrencePartial, {"error": "No occurrences found for this collection"});
              $("#occurrences" + id).html(output);
            }
          });
        });
        $("#loading").hide();
      });
    },

    "openStackedCollectionModal": function(data) {
      // Grab the land type of the first collection, as they should all be identical
      var landType = data.members[0].ptd;

      data.members.forEach(function(d) {
        d.intervals = (d.oli) ? d.oei + " - " + d.oli : d.oei;
        d.strat = (d.sfm || d.sgr || d.smb) ? true : false;
        d.lat = Math.round(d.lat * 10000) / 10000;
        d.lng = Math.round(d.lng * 10000) / 10000;
      });

      var output = Mustache.render(stackedCollectionPartial, data);

      d3.select("#binID").html("Fossil Collections at [" + (Math.round(data.lat * 10000) / 10000) + ", " + (Math.round(data.lng * 10000) / 10000) + "]");
      d3.select("#accordion").html(output);

      $(".collectionCollapse").on("show.bs.collapse", function(d) {
        var id = d.target.id;
        id = id.replace("collapse", "");
      /* Placeholder for data service fix
        var url = paleo_nav.dataUrl + paleo_nav.dataService + "/colls/single.json?id=" + id + "&show=ref,time,strat,geo,lith,entname,prot&markrefs";
        url = navMap.parseURL(url);
        d3.json(url, function(err, data) {
      */
        d3.json(paleo_nav.dataUrl + paleo_nav.dataService + "/colls/single.json?id=" + id + "&show=ref,time,strat,geo,lith,entname,prot&markrefs", function(err, data) {
          if (err) {
            return paleo_nav.hideLoading();
          }
          $("#ref" + id).html(data.records[0].ref);
        });
      });

      $(".occurrenceTab").on("show.bs.tab", function(d) {
          var id = d.target.id;
          id = id.replace("occToggle", "");

          var url = navMap.parseURL(paleo_nav.dataUrl + paleo_nav.dataService + "/occs/list.json?coll_id=" + id + "&show=phylo,ident");

          d3.json(url, function(err, data) {
            if (err) {
              return paleo_nav.hideLoading();
            }
            if (data.records.length > 0) {
              var taxonHierarchy = navMap.buildTaxonHierarchy(data);

              var output = Mustache.render(occurrencePartial, taxonHierarchy);
              $("#occurrences" + id).html(output);

              $(".filterByOccurrence").click(function(event) {
                event.preventDefault();
                navMap.filterByTaxon($(this).attr("data-name"));
                $("#collectionModal").modal("hide");
              });

            } else {
              var output = Mustache.render(occurrencePartial, {"error": "No occurrences found for this collection"});
              $("#occurrences" + id).html(output);
            }
          });
        });

      switch (landType) {
        case "NPS":
          $(".nationalParks").css("display", "block");
          $(".general, .federalLands").css("display", "none");
          break;
        case "FED":
          $(".federalLands").css("display", "block");
          $(".general, .nationalParks").css("display", "none");
          break;
        default:
          $(".general").css("display", "block");
          $(".nationalParks, .federalLands").css("display", "none");
          break;
      }

      $(".filterByStrat").click(function(event) {
        event.preventDefault();
        navMap.filterByStratigraphy({"name": $(this).attr("data-name"), "type": $(this).attr("data-rank")});
        $("#collectionModal").modal("hide");
      });

      $("#collectionModal").modal();

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
      for (var key in filters.exist) {
        if (filters.exist.hasOwnProperty(key)) {
          if (filters.exist[key] === true) {
            switch(key) {
              case "selectedInterval":
                url += '&interval_id=' + filters.selectedInterval.oid;
                break;
              case "personFilter":
                url += '&touched_by=' + filters.personFilter.id;
                break;
              case "taxon":
                url += '&base_id=';
                filters.taxa.forEach(function(d) {
                  url += d.id + ",";
                });
                // remove last comma
                url = url.slice(0, -1);
                break;
              case "stratigraphy":
                if (filters.stratigraphy.rank === "Fm") {
                  url += '&formation=' + filters.stratigraphy.name;
                } else if (filters.stratigraphy.rank === "Gp") {
                  url += '&stratgroup=' + filters.stratigraphy.name;
                } else if (filters.stratigraphy.rank === "Mbr") {
                  url += '&member=' + filters.stratigraphy.name;
                } else {
                  // ?
                }
            }
            count += 1;
          }
        }
      }
      if (count > 0 && d3.select("#reconstructMap").style("display") === "none") {
        d3.select(".filters").style("display", "block");
      }

      return url;
    },

    // Check if any filters are applied to the map
    "checkFilters": function() {
      var count = 0;
      for (var key in filters.exist) {
        if (filters.exist.hasOwnProperty(key)) {
          if (filters.exist[key] === true) {
            count += 1;
          }
        }
      }
      if (count > 0) {
        d3.select(".filters").style("display", "block");
        d3.select("#filterTitle").html("Filters");
        return true;
      } else {
        d3.select(".filters").style("display", "none");
        d3.select("#filterTitle").html("No filters selected");
        return false;
      }
    },

    "getIndex": function(data, term, property) {
      for(var i=0, len=data.length; i<len; i++) {
        if (data[i][property] === term) return i;
      }
      return -1;
    },

    // Adjust the size of the markers depending on zoom level
    "multiplier": function(zoom) {
      switch(zoom) {
        case 2:
          if (navMap.checkFilters()) {
            return 0.8
          } else {
            return 0.70;
          }
          break;
        case 3:
          if (navMap.checkFilters()) {
            return 0.2;
          } else {
            return 1;
          }
          break;
        case 4:
          if (navMap.checkFilters()) {
            return 0.48;
          } else {
            return 2;
          }
          break;
        case 5:
          if (navMap.checkFilters()) {
            return 0.68;
          }
          return 0.6;
          break;
        case 6:
          if (navMap.checkFilters()) {
            return 0.88;
          } else {
            return 0.8;
          }
          break;
        case 7:
          return 1.5;
          break;
        default:
          return 1;
          break;
      }
    },

    "resizeSvgMap": function() {
      var width = parseInt(d3.select("#graphics").style("width"));

      var g = d3.select("#svgMap").select("svg");

      d3.select("#svgMap").select("svg")
        .select("g")
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

          if (width > (box.width + 70)) {
            return "scale(" + window.innerHeight/680 + ")translate(" + ((width - box.width)/3) + ",0)";
          } else {
            var svgHeight = ((window.innerHeight * 0.70) - 70),
                mapHeight = (width/970 ) * 500,
                translate = (((svgHeight - mapHeight)/2) > 0) ? (svgHeight - mapHeight)/2 : 40;

            return "scale(" + width/970 + ")translate(0," + translate + ")";
          }

        });

      d3.select("#svgMap").select("svg")
        .style("height", function(d) {
          if (d3.select(".timeScale").style("visibility") === "hidden") {
            return (window.innerHeight - 60) + "px";
          } else {
            var timeHeight = ($("#time").height() > 15) ? $("#time").height() : window.innerHeight / 5.6;
            return (window.innerHeight - timeHeight - 60) + "px";
          }
        })
        .style("width", function(d) {
          return width - 15 + "px";
        });
    },

    "resize": function() {
      if (window.innerWidth < 700) {
        d3.select("#svgMap").style("display", "none");
        d3.select("#map").style("height", function() {
          return (window.innerHeight - 55) + "px";
        });
        map.invalidateSize();
        $("#downloadDataTab").removeClass("active");
        $("#downloadData").removeClass("active");
        $("#urlTab").addClass("active");
        $("#getURL").addClass("active");
      } else if (parseInt(d3.select("#map").style("height")) > 1) {
        d3.select("#map")
          .style("height", function(d) {
            if (d3.select(".timeScale").style("visibility") === "hidden") {
              return (window.innerHeight - 70) + "px";
            } else {
              var timeHeight = ($("#time").height() > 15) ? $("#time").height() : window.innerHeight / 5.6;
              return (window.innerHeight - timeHeight - 54) + "px";
            }
          });
        map.invalidateSize();
      } else {
        navMap.resizeSvgMap();
      }

      d3.select("#infoContainer")
        .style("bottom", function() {
          if (window.innerWidth < 468) {
            return "91px";
          } else {
            var height = parseInt(d3.select("#time").select("svg").style("height"));
            return (height + 15) + "px";
          }
        });

      d3.select(".prevalence-summary, .prevalence-row")
        .style("height", function() {
          var height = window.innerHeight - parseInt(d3.select("#time").select("svg").style("height")) - 121;
          return (height) + "px";

        });

      if (window.innerHeight > 600) {
        d3.select(".filters")
          .style("left", 0)
          .style("top", "inherit")
          .style("bottom", function() {
            var height = parseInt(d3.select("#time").select("svg").style("height"));
            return (height + 4) + "px";
          });
      } else {
        d3.select(".filters")
          .style("left", "49px")
          .style("top", 0)
          .style("bottom", "inherit")
      }


      d3.selectAll(".helpModalTimescaleLabel")
        .style("top", function() {
          var timeHeight = ($("#time").height() > 15) ? $("#time").height() : window.innerHeight / 5.6;
          return (window.innerHeight - timeHeight - 78) + "px";
        });

      $(".universalSearchForm > div > .twitter-typeahead > .tt-dropdown-menu").width($(".universalSearchForm > div > .twitter-typeahead").width() - 21);
    },

    "refreshFilterHandlers": function() {

      d3.selectAll(".removeFilter").on("click", function() {
        var parent = d3.select(this).node().parentNode;
        parent = d3.select(parent);
        var type = parent.attr("id"),
            id = parseInt(parent.attr("data-id"));

        switch(type) {
          case "selectedInterval":
            parent.style("display", "none").html("");
            filters.exist["selectedInterval"] = false;
            d3.select(".time").style("box-shadow", "");
            timeScale.unhighlight();
            var keys = Object.keys(filters[type]);
            for (var i=0; i < keys.length; i++) {
              filters[type][keys[i]] = "";
            }
            break;

          case "personFilter":
            parent.style("display", "none").html("");
            filters.exist["personFilter"] = false;
            d3.select(".userFilter").style("box-shadow", "");
            var keys = Object.keys(filters[type]);
            for (var i=0; i < keys.length; i++) {
              filters[type][keys[i]] = "";
            }
            break;

          case "taxon":
            parent.remove();
            navMap.removeTaxonFilters([id]);
            break;

          case "stratFilter":
            parent.style("display", "none").html("");
            filters.exist["stratigraphy"] = false;
            var keys = Object.keys(filters.stratigraphy);
            for (var i=0; i < keys.length; i++) {
              filters.stratigraphy[keys[i]] = "";
            }
            break;
        }

        paleo_nav.getPrevalence();

        if (d3.select("#reconstructMap").style("display") === "block") {
          reconstructMap.rotate(filters.selectedInterval);
        } else {
          navMap.refresh("reset");
        }

      });
    },

    "updateFilterList": function(type, id) {
      paleo_nav.getPrevalence();
      switch(type) {
        case "selectedInterval":
          d3.select("#selectedInterval")
            .style("display", "block")
            .html(filters.selectedInterval.nam + '<button type="button" class="close removeFilter" aria-hidden="true">&times;</button>');
          d3.select(".time").style("box-shadow", "inset 3px 0 0 #ff992c");
          navMap.refreshFilterHandlers();
          break;
        case "personFilter":
          d3.select("#personFilter")
            .style("display", "block")
            .html(filters.personFilter.name + '<button type="button" class="close removeFilter" aria-hidden="true">&times;</button>');
          d3.select(".userFilter").style("box-shadow", "inset 3px 0 0 #ff992c");
          navMap.refreshFilterHandlers();
          break;
        case "taxon":
          var index;
          // Find the index of the taxon being added
          filters.taxa.forEach(function(d, i) {
            if (d.id === id) {
              index = i;
            }
          });

          d3.select(".filters")
            .append("div")
            .attr("id", "taxon")
            .attr("class", "filter")
            .attr("data-id", id)
            .style("display", "block")
            .html(filters.taxa[index].name + '<button type="button" class="close removeFilter" aria-hidden="true">&times;</button>');

          d3.select(".taxa").style("box-shadow", "inset 3px 0 0 #ff992c");
          navMap.refreshFilterHandlers();
          break;
        case "stratigraphy":
          d3.select("#stratFilter")
            .style("display", "block")
            .html(filters.stratigraphy.name + '<button type="button" class="close removeFilter" aria-hidden="true">&times;</button>');
          navMap.refreshFilterHandlers();
          break;
      }

      if (window.innerHeight > 600) {
        d3.select(".filters")
          .style("left", 0)
          .style("top", "inherit")
          .style("bottom", function() {
            var height = parseInt(d3.select("#time").select("svg").style("height"));
            return (height + 4) + "px";
          });
      } else {
        d3.select(".filters")
          .style("left", "49px")
          .style("top", 0)
          .style("bottom", "inherit")
      }
    },

    "filterByTime": function(time) {
      // accepts a named time interval
      var d = d3.selectAll('rect').filter(function(e) {
        return e.name === time;
      });
      d = d[0][0].__data__;
      filters.selectedInterval.nam = d.name;
      filters.selectedInterval.mid = d.mid;
      filters.selectedInterval.col = d.color;
      filters.selectedInterval.oid = d.id;
      filters.exist.selectedInterval = true;
      navMap.updateFilterList("selectedInterval");
    },


    "removeTaxonFilters": function(ids) {
        // Remove the filters from the interface
        d3.selectAll(".filters > .filter").each(function(d) {
          var id = parseInt(d3.select(this).attr("data-id"));
          if (ids.indexOf(id) > -1) {
            d3.select(this).remove();
          }
        });

        // Remove them from the application data
        navMap.filters.taxa = navMap.filters.taxa.filter(function(d) {
          if (ids.indexOf(d.id) < 0) {
              return d;
          }
        });

        // Check if there are any others left
        if (navMap.filters.taxa.length < 1) {
          navMap.filters.exist["taxon"] = false;
        }

        d3.select(".taxa").style("box-shadow", "");
    },


    "filterByTaxon": function(name, preventRefresh, isPhylo) {
      if (!name) {
        var name = $("#taxonInput").val();
      }

      d3.json(paleo_nav.dataUrl + paleo_nav.dataService + '/taxa/list.json?name=' + name + '&show=seq', function(err, data) {
        if (err) {
          alert("Error retrieving from list.json - ", err);
          return paleo_nav.hideLoading();
        } else {
          if ( data.records.length > 0 ) {
            // The target taxon is the only one...
            var taxon = {
              "id": parseInt(data.records[0].oid.replace("txn:", "")),
              "name": data.records[0].nam,
              "lsq": data.records[0].lsq,
              "rsq": data.records[0].rsq
            };

            // Check if we have already applied this taxon filter
            for (var i = 0; i < navMap.filters.taxa.length; i++) {
              if (navMap.filters.taxa[i].id === taxon.name) {
                // If so, ignore the request to add another taxon filter
                return;
              }
            }

            var toRemove = [];
            for (var i = 0; i < navMap.filters.taxa.length; i++) {
              // Check if we are filtering by a child of an existing filter
              if (taxon.lsq >= navMap.filters.taxa[i].lsq && taxon.rsq <= navMap.filters.taxa[i].rsq) {
                toRemove.push(navMap.filters.taxa[i].id);
              }
              // Check if we are filtering by a parent of an existing filter
              if (taxon.lsq <= navMap.filters.taxa[i].lsq && taxon.rsq >= navMap.filters.taxa[i].rsq) {
                toRemove.push(navMap.filters.taxa[i].id);
              }
            }
            navMap.removeTaxonFilters(toRemove);

            // Update the taxon browser unless it's explicitly blocked
            if (!preventRefresh) {
              taxaBrowser.goToTaxon(name);
            }

            // Add map filter for this taxon
            navMap.filters.taxa.push(taxon);
            navMap.filters.exist.taxon = true;
            navMap.updateFilterList("taxon", taxon.id);

            // Refresh either the reconstruction map or the regular one
            if (d3.select("#reconstructMap").style("display") === "block") {
              reconstructMap.rotate(navMap.filters.selectedInterval);
            } else {
              navMap.refresh("reset");
            }
          } else {
            alert("No taxa with this name found");
          }
        }
      });
    },

    "filterByPerson": function(person, norefresh) {
      if (person) {
        // Update map filters
        filters.exist.personFilter = true;
        filters.personFilter.id = (person.oid) ? person.oid : person.id;
        filters.personFilter.name = (person.name) ? person.name : person.nam;
        navMap.updateFilterList("personFilter");

        // Refresh either the reconstruction map or the regular one
        if (d3.select("#reconstructMap").style("display") === "block") {
          reconstructMap.rotate(filters.selectedInterval);
        } else {
          navMap.refresh("reset");
        }
      }
    },

    "filterByStratigraphy": function(rock) {
      // rock is = {"name": "stratName", "type": "Fm, Gr, or Mb", "display_name": "Awesome Gr"}
      if (rock) {
        filters.exist.stratigraphy = true;
        filters.stratigraphy.name = rock.nam;
        filters.stratigraphy.rank = (rock.type) ? rock.type : rock.rank;
        navMap.updateFilterList("stratigraphy");
        navMap.refresh("reset");
      }
    },

    "download": function() {
      if ($("#occs:checked").length > 0) {
        navMap.downloadOccs();
      } else if ($("#refs:checked").length > 0) {
        navMap.downloadRefs();
      } else if ($("#diver:checked").length > 0){
        navMap.downloadDiversity();
      } else {
        navMap.downloadFullDiversity();
      } 
    },

    "downloadRefs": function() {
      var bounds = map.getBounds(),
          sw = bounds._southWest,
          ne = bounds._northEast,
          url = paleo_nav.dataUrl + paleo_nav.dataService + '/occs/refs.';

      if ($("#tsv:checked").length > 0) {
        url += "txt";
      } else if ($("#csv:checked").length > 0) {
        url += "csv";
      } else if ($("#json:checked").length > 0) {
        url += "json";
      } else {
        url += "ris";
      }

      if (d3.select("#reconstructMap").style("display") === "block" || d3.select("#svgMap").style("display") === "block") {
        url += "?limit=all";
      } else {
        sw.lat = sw.lat.toFixed(4);
        sw.lng = sw.lng.toFixed(4);
        ne.lat = ne.lat.toFixed(4);
        ne.lng = ne.lng.toFixed(4);
        url += '?lngmin=' + sw.lng + '&lngmax=' + ne.lng + '&latmin=' + sw.lat + '&latmax=' + ne.lat + '&limit=all';
      }

      url = navMap.parseURL(url);

      url += "&show=comments,ent,entname,crmod&showsource";

      window.open(url);
    },

    "downloadOccs": function() {
      var bounds = map.getBounds(),
          sw = bounds._southWest,
          ne = bounds._northEast,
          url = paleo_nav.dataUrl + paleo_nav.dataService + '/occs/list.';

      if ($("#tsv:checked").length > 0) {
        url += "txt";
      } else if ($("#csv:checked").length > 0) {
        url += "csv";
      } else if ($("#json:checked").length > 0) {
        url += "json";
      } else {
        return alert("RIS format not available for occurrences. Please select a different format.");
      }

      if (d3.select("#reconstructMap").style("display") === "block" || d3.select("#svgMap").style("display") === "block") {
        url += "?limit=all";
      } else {
        sw.lat = sw.lat.toFixed(4);
        sw.lng = sw.lng.toFixed(4);
        ne.lat = ne.lat.toFixed(4);
        ne.lng = ne.lng.toFixed(4);
        url += '?lngmin=' + sw.lng + '&lngmax=' + ne.lng + '&latmin=' + sw.lat + '&latmax=' + ne.lat + '&limit=all';
      }

      url = navMap.parseURL(url);

      url += "&show=coords,attr,loc,prot,time,strat,stratext,lith,lithext,geo,rem,ent,entname,crmod,paleoloc&showsource";

      window.open(url);
    },

    "downloadDiversity": function() {
      var bounds = map.getBounds(),
          sw = bounds._southWest,
          ne = bounds._northEast,
          url = paleo_nav.dataUrl + paleo_nav.dataService + '/occs/quickdiv.';

      if ($("#tsv:checked").length > 0) {
        url += "txt";
      } else if ($("#csv:checked").length > 0) {
        url += "csv";
      } else if ($("#json:checked").length > 0) {
        url += "json";
      } else {
        return alert("RIS format not available for occurrences. Please select a different format.");
      }

      if (d3.select("#reconstructMap").style("display") === "block" || d3.select("#svgMap").style("display") === "block") {
        url += '?lngmin=-180&lngmax=180&latmin=-90&latmax=90';
      } else {
        sw.lat = sw.lat.toFixed(4);
        sw.lng = sw.lng.toFixed(4);
        ne.lat = ne.lat.toFixed(4);
        ne.lng = ne.lng.toFixed(4);
        url += '?lngmin=' + sw.lng + '&lngmax=' + ne.lng + '&latmin=' + sw.lat + '&latmax=' + ne.lat;
      }

      url = navMap.parseURL(url);

      url += "&count=" + $('[name="taxonLevel"]').val() + "&reso=" + $('[name="timeLevel"]').val() ;

      window.open(url);
    },

    "downloadFullDiversity": function() {
      var bounds = map.getBounds(),
          sw = bounds._southWest,
          ne = bounds._northEast,
          url = paleo_nav.dataUrl + paleo_nav.dataService + '/occs/diversity.';

      if ($("#tsv:checked").length > 0) {
        url += "txt";
      } else if ($("#csv:checked").length > 0) {
        url += "csv";
      } else if ($("#json:checked").length > 0) {
        url += "json";
      } else {
        return alert("RIS format not available for occurrences. Please select a different format.");
      }

      if (d3.select("#reconstructMap").style("display") === "block" || d3.select("#svgMap").style("display") === "block") {
        url += '?lngmin=-180&lngmax=180&latmin=-90&latmax=90';
      } else {
        sw.lat = sw.lat.toFixed(4);
        sw.lng = sw.lng.toFixed(4);
        ne.lat = ne.lat.toFixed(4);
        ne.lng = ne.lng.toFixed(4);
        url += '?lngmin=' + sw.lng + '&lngmax=' + ne.lng + '&latmin=' + sw.lat + '&latmax=' + ne.lat;
      }

      url = navMap.parseURL(url);

      url += "&count=" + $('[name="taxonLevel"]').val() + "&reso=" + $('[name="timeLevel"]').val() + "&recent=" + $('[name="extant"]').is(":checked");

      window.open(url);
    },

    "getApiUrl": function() {
      var bounds = map.getBounds(),
          sw = bounds._southWest,
          ne = bounds._northEast,
          url = paleo_nav.dataUrl + paleo_nav.dataService + '/occs/list.json';

      if (d3.select("#reconstructMap").style("display") === "block" || d3.select("#svgMap").style("display") === "block") {
        url += "?limit=all";
      } else {
        sw.lat = sw.lat.toFixed(4);
        sw.lng = sw.lng.toFixed(4);
        ne.lat = ne.lat.toFixed(4);
        ne.lng = ne.lng.toFixed(4);
        url += '?lngmin=' + sw.lng + '&lngmax=' + ne.lng + '&latmin=' + sw.lat + '&latmax=' + ne.lat + '&limit=all';
      }

      url = navMap.parseURL(url);

      url += "&show=coords,attr,loc,prot,time,strat,stratext,lith,lithext,geo,rem,ent,entname,crmod&showsource";

      return url;
    },

    "restoreState": function(state) {
    /*TODO: should probably change this check to something like
      Array.isArray(state) to check if it's an array, and
      Object.keys(state).length > 0 for an object.

      Right now it doesn't matter...just checking if something was passed,
      but eventually an array will indicate a preserved URL state, whereas
      an object will indicate another type of preserved state, i.e. something
      like the example map states
    */
    /*
      TODO: Clean this up! Lots of redundant code
    */
      if (typeof state === "object") {
        var params = state;
        if (params.zoom && params.zoom > 2) {
          navMap.goTo(params.center, params.zoom);
        }
        if (params.timeScale && params.timeScale != "Phanerozoic") {
          timeScale.goTo(params.timeScale);
        }

        if (params.taxaFilter.length > 0) {
          params.taxaFilter.forEach(function(d) {
            navMap.filterByTaxon((d.name) ? d.name : d.nam);
          });
        }

        if (typeof(params.stratFilter) === "object" ) {
          if (params.stratFilter.name != "") {
            navMap.filterByStratigraphy(params.stratFilter);
          }
        }
        if (typeof(params.timeFilter) === "object") {
          if (params.timeFilter.nam != "") {
            navMap.filterByTime(params.timeFilter.nam);
          }
        }
        if (params.authFilter.id > 0) {
          navMap.filterByPerson(params.authFilter);
        }
        if (params.reconstruct === "block") {
          reconstructMap.rotate(params.currentReconstruction);
          paleo_nav.toggleReconstructMap();
          navMap.checkFilters();
        }

        navMap.resize();
        window.scrollTo(0,0);
      } else {
        // Retrieve state from URL
        var location = window.location,
            state = location.hash.substr(2);

        // If there is a preserved state hash
        if (state.length > 1) {
          d3.json(paleo_nav.stateUrl + "/larkin/app-state?id=" + state, function(error, result) {
            if (error) {
              return paleo_nav.launch();
            }
            var params = result[0].data;

            params.zoom = parseInt(params.zoom);
            params.center[0] = parseFloat(params.center[0]);
            params.center[1] = parseFloat(params.center[1]);
            if (params.taxaFilter) {
              if (params.taxaFilter.length > 0) {
                params.taxaFilter.forEach(function(d) {
                  d.id = parseInt(d.id);
                });
              }
            }

            params.timeFilter.mid = parseInt(params.timeFilter.mid);
            params.timeFilter.oid = parseInt(params.timeFilter.oid);

            params.currentReconstruction.mid = parseInt(params.currentReconstruction.mid);
            params.currentReconstruction.id = parseInt(params.currentReconstruction.id);

            params.authFilter.id = parseInt(params.authFilter.id);

            if (params.zoom && params.zoom > 2) {
              navMap.goTo(params.center, params.zoom);
            }
            if (params.taxaFilter) {
              if (params.taxaFilter.length > 0) {
                params.taxaFilter.forEach(function(d) {
                  navMap.filterByTaxon(d.name);
                });
              }
            }
            if (typeof(params.stratFilter) === "object" ) {
              if (params.stratFilter.name != "") {
                navMap.filterByStratigraphy(params.stratFilter);
              }
            }
            if (typeof(params.timeFilter) === "object") {
              if (params.timeFilter.nam != "") {
                navMap.filterByTime(params.timeFilter.nam);
                navMap.refresh("redraw");
              }
            }
            if (params.authFilter.id > 0) {
              navMap.filterByPerson(params.authFilter);
            }
            if (params.reconstruct === "block") {
              reconstructMap.rotate(params.currentReconstruction);
              paleo_nav.toggleReconstructMap();
              navMap.checkFilters();
            }
            if (params.timeScale != "Phanerozoic") {
              timeScale.goTo(params.timeScale);
            }

            paleo_nav.launch();
          });
        }
      }
    },

    "getUrl": function() {
      //placeholder for generating a unique a unique hash
      var center = map.getCenter(),
          zoom = map.getZoom(),
          reconstruct = d3.select("#reconstructMap").style("display");

      var params = {"timeScale": timeScale.currentInterval.name, "taxaFilter": [], "timeFilter": filters.selectedInterval, "stratFilter": {"name": filters.stratigraphy.name, "rank": filters.stratigraphy.rank}, "authFilter": filters.personFilter, "zoom": zoom, "center": [center.lat, center.lng], "reconstruct": reconstruct, "currentReconstruction": reconstructMap.currentReconstruction};

      if(filters.taxa.length > 0) {
        filters.taxa.forEach(function(d) {
          params.taxaFilter.push(d);
        });
      }

      return params;
    },

    "summarize" : function(data) {
      if (data.records.length > 0) {
        if (data.records[0].typ === "col") {
          navMap.totalCollections = numberWithCommas(data.records.length);
        } else {
          navMap.totalCollections = numberWithCommas(d3.sum(data.records, function(d) { return d.nco }));
        }
        navMap.totalOccurrences = numberWithCommas(d3.sum(data.records, function(d) { return d.noc }));
      } else {
        navMap.totalCollections = 0;
        navMap.totalOccurrences = 0;
      }

      navMap.setInfoSummary();
    },

    "setInfoSummary" : function() {
      d3.select(".info")
        .style("display", "block")
        .html("<strong>" + navMap.totalCollections + " total collections</strong><br>" + navMap.totalOccurrences + " total occurrences");
    },

    "filters": filters,
    "totalOccurrences": totalOccurrences
  }
})();
