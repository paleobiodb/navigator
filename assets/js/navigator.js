var paleo_nav = (function() {
  /* Server to be used for all data service requests;
     Leave blank if application is on the same server */  
  var baseUrl = "http://paleobiodb.org";

  return {
    "init": function() {

      // Initialize each of the major application components
      timeScale.init("time");
      navMap.init();
      reconstructMap.init();
      taxaBrowser.init();

      // Handler for the zoom-in button
      var zoomInButton = $(".zoom-in").hammer();

      zoomInButton.on("tap", function(event) {
        event.preventDefault();
        if (parseInt(d3.select("#map").style("height")) < 1) {

          d3.select("#svgMap").style("display", "none");
          d3.select("#map").style("height", function() {
            return ((window.innerHeight * 0.70) - 70) + "px";
          });
          map.setView([7,0], 3, {animate:false});
          navMap.refresh("reset");
          map.invalidateSize();
        } else {
          map.zoomIn();
        }
      });

      // Handler for the zoom-out button
      var zoomOutButton = $(".zoom-out").hammer();
      zoomOutButton.on("tap", function(event) {
        event.preventDefault();
        map.zoomOut();
      });

      // Handler for the time filter UI button
      var timeButton = $(".time").hammer();

      timeButton.on("tap", function(event) {
        event.preventDefault();
        var checked = document.getElementById("viewByTimeBox").checked;
        if (checked == true) {
          document.getElementById("viewByTimeBox").checked = false;
          d3.select(".time")
            .style("color", "#000");

          d3.select(".info")
            .html("")
            .style("display", "none");

          if (document.getElementById("reconstructBox").checked) {
            document.getElementById("reconstructBox").checked = false;
            d3.select(".rotate")
              .style("color", "#000");
          }

        } else {
          document.getElementById("viewByTimeBox").checked = true;
          d3.select(".time")
            .style("color", "#ff992c");

          d3.select(".info")
            .html("Click a time interval to filter map")
            .style("display", "block");
        }
      });

      // Handler for the rotation/reconstruct UI button
      var rotateButton = $(".rotate").hammer();

      rotateButton.on("tap", function(event) {
        event.preventDefault();
        var rotateChecked = document.getElementById("reconstructBox").checked;
        // If toggled, untoggle
        if (rotateChecked == true) {
          paleo_nav.closeReconstructMap();

        // If not toggled, toggle
        } else {
          paleo_nav.toggleReconstructMap();
        }
      });
      
      // Handler for the taxa filter UI button
      var taxaButton = $(".taxa").hammer();

      taxaButton.on("tap", function(event) {
        event.preventDefault();
        var visible = d3.select(".taxaToggler").style("display");
        if (visible == "block") {
          paleo_nav.untoggleTaxa();
        } else {
          var browserVisible = d3.select("#taxaBrowser").style("display");
          if (browserVisible == "block") {
            paleo_nav.closeTaxaBrowser();
            paleo_nav.untoggleTaxa();
          } else {
            paleo_nav.untoggleUser();

            d3.select(".taxaToggler").style("display", "block");
            d3.select(".taxa").style("color", "#ff992c");
          }
        }
      });

      // Controls the "hide" and "show" taxa browser links
      var taxaBrowserToggleButton = $(".taxaBrowserToggle").hammer();

      taxaBrowserToggleButton.on("tap", function(event) {
        event.preventDefault();
        var display = d3.select("#taxaBrowser").style("display");
        if (display == "block") {
          paleo_nav.closeTaxaBrowser();
        } else {
          paleo_nav.openTaxaBrowser();
        }
      });

      // Handler for the contributor filter UI button 
      var userFilterButton = $(".userFilter").hammer();

      userFilterButton.on("tap", function(event) {
        event.preventDefault();
        var visible = d3.select(".userToggler").style("display");
          if (visible == "block") {
            paleo_nav.untoggleUser();
          } else {
            paleo_nav.untoggleTaxa();

            d3.select(".userToggler").style("display", "block");
            d3.select(".userFilter")
                .style("color", "#ff992c");
          }
      });

      // Init contributor autocomplete search with Twitter Typeahead
      var typeahead = $("#personInput").typeahead({
        name: 'contribs',
        prefetch: {
          url: baseUrl + '/data1.1/people/list.json?name=%',
          filter: function(data) {
            return data.records;
          }
        },
        valueKey: 'nam',
        limit: 8
      });

      typeahead.on('typeahead:selected', function(evt, data) {
        navMap.filterByPerson(data);
        document.activeElement.blur();
        $("#personInput").blur();
      });

      $("#personInput").on("blur", function() {window.scrollTo(0,0)});

      var taxaTemplate = Mustache.compile('<p>{{name}}      <small class="taxaRank">{{rank}}</small></p>');

      var taxaTypeahead = $("#taxaInput").typeahead({
        name: 'taxa',
        remote: 'assets/php/autocomplete.php?query=%QUERY',
        valueKey: 'name',
        minLength:3,
        limit: 10,
        template: taxaTemplate,
      });

      taxaTypeahead.on('typeahead:selected', function(evt, data) {
        navMap.filterByTaxon(data.name);
        document.activeElement.blur();
        $("#taxaInput").blur();
      });

      $("#taxaInput").on("blur", function() {window.scrollTo(0,0)});

      //attach window resize listener to the window
      d3.select(window).on("resize", function() {
        timeScale.resize();
        navMap.resize();
        reconstructMap.resize();
      });

      // Fired when the "save" modal is opened
      $("#saveBox").on('show.bs.modal', function() {
        var count = 0;
        for (var key in navMap.filters.exist) {
          if (navMap.filters.exist.hasOwnProperty(key)) {
            if (navMap.filters.exist[key] == true) {
              switch(key) {
                case "selectedInterval":
                  $("#filterList").append("<li>Interval - " + navMap.filters.selectedInterval.nam + "</li>");
                  break;
                case "personFilter":
                  $("#filterList").append("<li>Contributor - " + navMap.filters.personFilter.name + "</li>");
                  break;
                case "taxon":
                  $("#filterList").append("<li>Taxon - " + navMap.filters.taxon.nam + "</li>");
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

        var url = baseUrl + '/data1.1/colls/list.json' + '?lngmin=' + sw.lng + '&lngmax=' + ne.lng + '&latmin=' + sw.lat + '&latmax=' + ne.lat + '&limit=0&count';
        url = navMap.parseURL(url);

        d3.json(url, function(err, results) {
          d3.select("#downloadCount").html(results.records_found + " collections found");
        });

      });

      // Fired when the "save" modal is closed
      $("#saveBox").on('hide.bs.modal', function() {
        $("#filterList").html('');
        $("#downloadCount").html("");
        $('#loc').prop('checked', false);
        $('#ref').prop('checked', false);
        $('#t').prop('checked', false);
      });

      // Handler for the simple taxa search box
      $("#taxaForm").submit(function() {
        navMap.filterByTaxon();
        return false;
      });

      $(".helpModalClose").on("click", function() {
        $("#helpModal").modal('hide');
      });

      $("#goToApp").on("click", function() {
        $("#helpModal").modal('hide');
      });

      // Handlers for the example map states
      $("#trilobita").on("click", function(event) {
        event.preventDefault();
        var state = {
          "authFilter": {
            "id": "",
            "name": ""
          },
          "center": [30.3539163, 113.24707],
          "currentReconstruction": "",
          "reconstruct": "none",
          "taxonFilter": {
            "id": 19100,
            "nam": "Trilobita"
          },
          "timeFilter": {
            "nam": "Cambrian",
            "oid": 22,
            "mid": 513
          },
          "timeScale": "Cambrian",
          "zoom":5
        };
        navMap.restoreState(state);
        $("#helpModal").modal('hide');
      });

      $("#dinosauria").on("click", function(event) {
        event.preventDefault();
        var state = {
          "authFilter": {
            "id": "",
            "name": ""
          },
          "center": [40.5305, -109.5117],
          "currentReconstruction": "",
          "reconstruct": "none",
          "taxonFilter": {
            "id": 19968,
            "nam": "Dinosauria"
          },
          "timeFilter": {
            "nam": "Jurassic",
            "oid": 15,
            "mid": 173
          },
          "timeScale": "Jurassic",
          "zoom":5
        };
        navMap.restoreState(state);
        $("#helpModal").modal('hide');
      });

      $("#aves").on("click", function(event) {
        event.preventDefault();
        var state = {
          "authFilter": {
            "id": "",
            "name": ""
          },
          "center": [51.46085, 3.72436],
          "currentReconstruction": "",
          "reconstruct": "none",
          "taxonFilter": {
            "id": 98802,
            "nam": "Aves"
          },
          "timeFilter": {
            "nam": "Cenozoic",
            "oid": 1,
            "mid": 33
          },
          "timeScale": "Cenozoic",
          "zoom":7
        };
        navMap.restoreState(state);
        $("#helpModal").modal('hide');
      });
      
    },

    "showLoading": function() {
      d3.select("#loading").style("display", "block");
    },

    "hideLoading": function() {
      d3.select("#loading").style("display", "none");
    },

    "untoggleTaxa": function() {
      d3.select(".taxaToggler").style("display", "none");
      d3.select(".taxa").style("color", "");
    },

    "untoggleUser": function() {
      d3.select(".userToggler").style("display", "none");
      d3.select(".userFilter").style("color", "");
    },

    "openTaxaBrowser": function() {
      d3.select("#graphics").attr("class", "col-sm-9");
      d3.select("#taxaBrowser").style("display", "block");
      d3.select("#taxaBrowserToggle").html('<i class="icon-double-angle-left" style="margin-right:5px;"></i>Collapse taxa browser');
      d3.select(".taxaToggler").style("display", "none");
      timeScale.resize();
      reconstructMap.resize();
      navMap.resize();
    },

    "closeTaxaBrowser": function() {
      d3.select("#graphics").attr("class", "col-sm-12");
      d3.select("#taxaBrowser").style("display", "none");
      d3.select("#taxaBrowserToggle").html('Expand taxa browser<i class="icon-double-angle-right" style="margin-left:5px;"></i>');
      d3.select(".taxa").style("color", "#000");
      timeScale.resize();
      reconstructMap.resize();
      navMap.resize();
      navMap.resize();
    },

    "toggleReconstructMap": function() {
      var timeChecked = document.getElementById("viewByTimeBox").checked;
      
      if (timeChecked == false) {
        document.getElementById("viewByTimeBox").checked = true;

      }
      paleo_nav.untoggleTaxa();
      paleo_nav.untoggleUser();
      paleo_nav.closeTaxaBrowser();

      document.getElementById("reconstructBox").checked = true;

      d3.select(".rotate")
        .style("box-shadow", "inset 3px 0 0 #ff992c")
        .style("color", "#ff992c");

      d3.select(".info")
        .html("Click a time interval to reconstruct collections and plates")
        .style("display", "block");

      if (parseInt(d3.select("#map").style("height")) > 1) {
        d3.select("#map").style("display", "none");
      }

      d3.select("#svgMap").style("display", "none");
      d3.select("#reconstructMap").style("display","block");

      reconstructMap.resize();

      //d3.select("#mapControlCover").style("display", "block");

      $(".zoom-in").hammer()
        .off("tap")
        .css("color", "#ccc");

      $(".zoom-out").hammer()
        .off("tap")
        .css("color", "#ccc");

      $(".save").on("click", function() { return false; });
      $(".icon-save").css("color", "#ccc");

      if (navMap.filters.exist.selectedInterval) {
        reconstructMap.rotate(navMap.filters.selectedInterval);
      } else {
        if (interval.nam == reconstructMap.currentReconstruction.nam && navMap.filters.taxon.name == reconstructMap.currentReconstruction.taxon && navMap.filters.personFilter.name == reconstructMap.currentReconstruction.person) {
          return;
        } else if (reconstructMap.currentReconstruction.nam.length < 1) {
          reconstructMap.reset();
          alert("Please click a time interval below to build a reconstruction map");
        } else {
          reconstructMap.reset();
          alert("Please click a time interval below to build a reconstruction map");
        }
      }
      
    },

    "closeReconstructMap": function() {
      navMap.refresh("reset");

      document.getElementById("reconstructBox").checked = false;
      document.getElementById("viewByTimeBox").checked = false;

      d3.select("#reconstructMap").style("display","none");
      timeScale.unhighlight();
      //d3.select("#mapControlCover").style("display", "none");

      $(".zoom-in").hammer()
        .on("tap", function(event) {
          event.preventDefault();
          if (parseInt(d3.select("#map").style("height")) < 1) {
            console.log('here');
            d3.select("#svgMap").style("display", "none");
            d3.select("#map").style("height", function() {
              return ((window.innerHeight * 0.70) - 70) + "px";
            });
            map.setView([7,0], 3, {animate:false});
            navMap.refresh("reset");
            map.invalidateSize();
          } else {
            map.zoomIn();
          }
        })
        .css("color", "#000");

      // Handler for the zoom-out button
      $(".zoom-out").hammer()
        .on("tap", function(event) {
          event.preventDefault();
          map.zoomOut();
        })
        .css("color", "#000");

      $(".save").off("click");
      $(".icon-save").css("color", "#000");

      // Show the time interval filter remove button
      d3.select("#selectedInterval")
        .select("button")
          .style("display", "block");

      d3.select(".info")
        .html("")
        .style("display", "none");

      d3.select(".rotate")
        .style("box-shadow", "")
        .style("color", "#000");

      d3.select(".time")
        .style("color", "#000");

      if(parseInt(d3.select("#map").style("height")) < 1) {
        d3.select("#svgMap").style("display", "block");
      } else {
        d3.select("#map").style("display", "block");
      }
      navMap.resize();
      map.invalidateSize();
    },

    "baseUrl": baseUrl

  }

})();


$(document).ready(function(){
  paleo_nav.init();
});