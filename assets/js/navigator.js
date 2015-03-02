var paleo_nav = (function() {
  /* Server to be used for all data service requests;
     If developing locally default to paleobiodb.org, otherwise use localhost */  
  var baseUrl = (window.location.hostname === "localhost") ? "https://paleobiodb.org" : "";

  return {
    "init": function() {

      // Initialize each of the major application components
      var timeScaleSize;
      if (window.innerWidth > 1800) {
        timeScaleSize = 60;
      } else if (window.innerWidth > 1500) {
        timeScaleSize = 75;
      } else if (window.innerWidth > 1000) {
        timeScaleSize =  95;
      } else {
        timeScaleSize = 110;
      }
      timeScale.init("time", timeScaleSize, function() {
        navMap.init(function(){
          navMap.resizeSvgMap();
          navMap.resize();
          navMap.refresh("reset");
        });
        reconstructMap.init();
        taxaBrowser.init();
      });
        

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

      // Handler for the rotation/reconstruct UI button
      var rotateButton = $(".rotate").hammer();

      rotateButton.on("tap", function(event) {
        event.preventDefault();

        // If toggled, untoggle
        if (reconstructMap.visible) {
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
        event.stopPropagation();
        var display = d3.select("#taxaBrowser").style("display");
        if (display == "block") {
          paleo_nav.closeTaxaBrowser();
          d3.select(".taxa").style("color", "#000");
        } else {
          paleo_nav.openTaxaBrowser();
          d3.select(".taxa").style("color", "#ff992c");
        }
      });

      // Controls the "hide" and "show" taxa browser links
      var mobileTaxaBrowserLink = $("#taxaBrowserNavbar").hammer();
      mobileTaxaBrowserLink.on("tap", function(event) {
        event.preventDefault();
        $(".navbar-collapse").collapse("hide");
        var display = d3.select("#taxaBrowser").style("display");
        if (display === "block") {
          paleo_nav.closeTaxaBrowser();
        } else {
          paleo_nav.openTaxaBrowser();
        }
        $
      });

      var taxaBrowserToggleButton = $(".taxaBrowserToggle").hammer();

      taxaBrowserToggleButton.on("tap", function(event) {
        event.preventDefault();
        event.stopPropagation();
        var display = d3.select("#taxaBrowser").style("display");
        if (display === "block") {
          paleo_nav.closeTaxaBrowser();
        } else {
          paleo_nav.openTaxaBrowser();
        }
      });

      var taxaTemplate = Mustache.compile('<p>{{nam}}{{#msp}}<small class="misspelling">  missp.</small>{{/msp}}      <small class="taxaRank">{{rank}}</small></p>');

      var taxaAutocomplete = $("#taxonInput").typeahead({
        name: 'taxaBrowser',
        remote: {
          url: baseUrl + '/data1.1/taxa/auto.json?name=%QUERY&limit=10',
          filter: function(data) {
            data.records.forEach(function(d) {
              d.rank = taxaBrowser.rankMap(d.rnk);
            });
            return data.records;
          }
        },
        valueKey: 'nam',
        minLength:3,
        limit: 10,
        template: taxaTemplate
      });

      taxaAutocomplete.on("typeahead:selected", function(event, data) {
        taxaBrowser.goToTaxon(data.nam);
      });

      // If the user hits enter instead of selecting a taxon from the dropdown menu
      $('input#taxonInput').keypress(function(e) {
        if (e.which === 13) {
          var selectedValue = $('input#taxonInput').data().ttView.dropdownView.getFirstSuggestion();
          taxaBrowser.goToTaxon(selectedValue.datum.nam);

          document.activeElement.blur();
          $("input#taxonInput").blur();
          $("input#taxonInput").typeahead("setQuery", "");
        }
      });

      var universalAutocomplete = $("#universalAutocompleteInput").typeahead([
        {
          name: 'time',
          prefetch: {
            url: baseUrl + '/larkin/time_scale'
          },
          valueKey: 'name',
          header: '<h4 class="autocompleteTitle">Time Intervals</h4>',
          limt: 5
        },
        {
          name: 'contribs',
          prefetch: {
            url: baseUrl + '/data1.1/people/list.json?name=%',
            filter: function(data) {
              return data.records;
            }
          },
          valueKey: 'nam',
          header: '<h4 class="autocompleteTitle">Authorizers</h4>',
          limit: 5
        },
        {
          name: 'taxa',
          remote: {
            url: baseUrl + '/data1.1/taxa/auto.json?name=%QUERY&limit=10',
            filter: function(data) {
              data.records.forEach(function(d) {
                d.rank = taxaBrowser.rankMap(d.rnk);
              });
              return data.records;
            }
          },
          valueKey: 'nam',
          minLength:3,
          limit: 10,
          header: '<h4 class="autocompleteTitle">Taxa</h4>',
          template: taxaTemplate
        },
        {
          name: 'strat',
          minLength: 3,
          limit: 10,
          header: '<h4 class="autocompleteTitle">Stratigraphy</h4>',
          remote: {
            url: baseUrl + '/larkin/stratigraphy_autocomplete?name=%QUERY'
          },
          valueKey: 'display_name'
        }
      ]);

      universalAutocomplete.on('typeahead:selected', function(evt, data, dataset) {
        $(".navbar-collapse").collapse("hide");
        switch (dataset) {
          case 'contribs':
            navMap.filterByPerson(data);
            document.activeElement.blur();
            break;
          case 'time': 
            timeScale.goTo(data.name);
            navMap.filterByTime(data.name);
            navMap.refresh("reset");
            break;
          case 'taxa':
            navMap.filterByTaxon(data.nam);
            break;
          case 'strat':
            navMap.filterByStratigraphy(data);
          default:
            console.log("default");
            break;

          $(".navbar-collapse").css("height", "auto");
          $(".navbar-collapse").css("max-height", "340px");
        }

        document.activeElement.blur();
        $("#universalAutocompleteInput").blur();
        $("#universalAutocompleteInput").typeahead("setQuery", "");
      });

      $("#universalAutocompleteInput").on("focus", function() {
        if (window.innerWidth < 700) {
          $(".navbar-collapse").css("height", window.innerHeight - 50 + "px");
          $(".navbar-collapse").css("max-height", window.innerHeight - 50 + "px");
          $(".tt-dropdown-menu").css("width", $("#universalAutocompleteInput").width() + "px");
        }
      });

      $("#universalAutocompleteInput").on("blur", function() {
        window.scrollTo(0,0);
        if (window.innerWidth < 700) {
          $(".navbar-collapse").css("height", "auto");
          $(".navbar-collapse").css("max-height", "340px");
        }
      });

      $("#universalSearchButton").click(function(event) {
        event.preventDefault();
        return;
      });

      $('input#universalAutocompleteInput').keypress(function (e) {
        if (e.which === 13) {
          var selectedValue = $('input#universalAutocompleteInput').data().ttView.dropdownView.getFirstSuggestion();

          switch (selectedValue.dataset) {
            case 'contribs':
              navMap.filterByPerson(selectedValue.datum);
              document.activeElement.blur();
              break;
            case 'time': 
              timeScale.goTo(selectedValue.datum.nam);
              navMap.filterByTime(selectedValue.datum.nam);
              navMap.refresh("reset");
              break;
            case 'taxa':
              navMap.filterByTaxon(selectedValue.datum.nam);
              break;
            case 'strat':
              navMap.filterByStratigraphy(selectedValue.datum);
              break;
            default:
              console.log("Default");
              break;
          }

          document.activeElement.blur();
          $("#universalAutocompleteInput").blur();
          $("#universalAutocompleteInput").typeahead("setQuery", "");
          $(".navbar-collapse").collapse("hide");

        }
      });

      //attach window resize listener to the window
      d3.select(window).on("resize", function() {
        timeScale.resize();
        navMap.resize();
        reconstructMap.resize();
      });
      
      $("#binModal").on("hide.bs.modal", function() {
        $("#collectionLoading").hide();
        $("#collectionCount").show();
        $(".show-more-collections").data("offset", 0);
        $(".show-more-collections").data("shown-collections", 0);
        $(".show-more-collections").data("total-collections", 0);
      });

      $("#saveBox").on('shown.bs.modal', function() {
        diversityPlot.resize();
      });
      // Fired when the "save" modal is opened
      $("#saveBox").on('show.bs.modal', function() {
        if ($("#urlTab").hasClass("active")) {
          var request = $.ajax({
            url: baseUrl + "/larkin/app-state",
            async: false,
            type: "POST",
            data: {
              state: navMap.getUrl()
            },
            ContentType: "application/x-www-form-urlencoded",
            dataType: "json"
          });

          request.success(function(result) {
            $("#url").val("http://paleobiodb.org/navigator/#/" + result.id);
            // For some reason this won't work without a small timeout
            setTimeout(function() {
              $("#url").focus();
              $("#url").select();
            }, 100);
          });
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

        $("#filterList").append("<li>Map extent - <small>([" + sw.lat.toFixed(0) + ", " + sw.lng.toFixed(0) + "], [" + ne.lat.toFixed(0) + ", " + ne.lng.toFixed(0) + "])</small></li>");

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
                  navMap.filters.taxa.forEach(function(d) {
                    $("#filterList").append("<li>Taxon - " + d.name + "</li>");
                  });
                  break;
              }
              count += 1;
            }
          }
        }

        //var diversityURL = navMap.parseURL(baseUrl + "/data1.2/occs/diversity.json?lngmin=" + sw.lng.toFixed(1) + "&lngmax=" + ne.lng.toFixed(1) + "&latmin=" + sw.lat.toFixed(1)  + "&latmax=" + ne.lat.toFixed(1) + "&count=genera&reso=stage");
        //diversityPlot.plot(diversityURL);

        var url = baseUrl + '/data1.1/occs/list.json' + '?lngmin=' + sw.lng + '&lngmax=' + ne.lng + '&latmin=' + sw.lat + '&latmax=' + ne.lat + '&limit=0&count';
        url = navMap.parseURL(url);

        d3.json(url, function(err, results) {
          var size = results.records_found * 0.67;
          if (size < 1024) {
            size = size.toFixed(0) + "KB";
          } else if (size < 1024000) {
            size = (size/1024).toFixed(0) + "MB";
          } else {
            size = (size/1024000).toFixed(0) + "GB";
          }
          d3.select("#occsLabel")
            .html("Occurrences <small><i>(About " + size + ")</i></small>");
        });

      });

      // Fired when the "save" modal is closed
      $("#saveBox").on('hide.bs.modal', function() {
        $("#filterList").html('');
        d3.select("#occsLabel").html("Occurrences ");

        $("#appUrl").val("");
        $("#apiUrl").val("");
        d3.select("#downloadCount")
            .style("display", "none");

        // Remove the old diversity curve
        d3.select("#diversity").select("svg").remove();
      });

      $("#getAppUrl").on("click", function() {
        var request = $.ajax({
          url: baseUrl + "/larkin/app-state",
          async: false,
          type: "POST",
          data: {
            state: navMap.getUrl()
          },
          ContentType: "application/x-www-form-urlencoded",
          dataType: "json"
        });

        request.success(function(result) {
          $("#appUrl").val("http://paleobiodb.org/navigator/#/" + result.id);
          // For some reason this won't work without a small timeout
          setTimeout(function() {
            $("#appUrl").focus();
            $("#appUrl").select();
          }, 100);
        });
      });

      $("#getApiUrl").on("click", function() {
        var url = navMap.getApiUrl();

        $("#apiUrl").val(url);
        // For some reason this won't work without a small timeout
        setTimeout(function() {
          $("#apiUrl").focus();
          $("#apiUrl").select();
        }, 100);

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
        paleo_nav.closeReconstructMap();
        var state = {
          "authFilter": {
            "id": "",
            "name": ""
          },
          "center": [30.3539163, 113.24707],
          "currentReconstruction": "",
          "reconstruct": "none",
          "taxaFilter": [{
            "id": 19100,
            "nam": "Trilobita"
          }],
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
        paleo_nav.closeReconstructMap();
        var state = {
          "authFilter": {
            "id": "",
            "name": ""
          },
          "center": [40.5305, -109.5117],
          "currentReconstruction": "",
          "reconstruct": "none",
          "taxaFilter": [{
            "id": 19968,
            "nam": "Dinosauria"
          }],
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

      $("#plantae").on("click", function(event) {
        event.preventDefault();
        var state = {
          "authFilter": {
            "id": "",
            "name": ""
          },
          "center": "",
          "currentReconstruction": {
            "nam": "Permian", 
            "col": "#F04028",
            "mid": 275,
            "oid": 17,
            "taxon": "Plantae", 
            "person": ""
          },
          "taxaFilter": [],
          "reconstruct": "block",
          "taxaFilter": [{
            "id": 151418,
            "nam": "Plantae"
          }],
          "timeFilter": {
            "nam": "Permian",
            "oid": 17,
            "mid": 275
          },
          "timeScale": "Permian",
          "zoom":""
        };
        navMap.restoreState(state);
        $("#helpModal").modal('hide');
      });
      
    },

    "prelaunch": function() {

      var location = window.location,
          state = location.hash.substr(2);

      if (state.length > 1) {
        navMap.restoreState();
      } else {
        paleo_nav.launch();
      }
    },

    "launch": function() {
      d3.select("#graphicRow").style("visibility", "visible");
      d3.select("#waiting").style("display", "none");
      navMap.resizeSvgMap();
      setTimeout(navMap.resize, 500);

      if (!localStorage.pbdb) {
        if (window.innerWidth > 700) {
          $("#helpModal").modal("show");
          localStorage.pbdb = true;
        }
      }
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
      paleo_nav.untoggleTaxa();
      paleo_nav.untoggleUser();
      paleo_nav.closeTaxaBrowser();

      reconstructMap.visible = true;

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

      $(".zoom-in").hammer()
        .off("tap")
        .css("color", "#ccc");

      $(".zoom-out").hammer()
        .off("tap")
        .css("color", "#ccc");

      if (navMap.filters.exist.selectedInterval) {
        reconstructMap.rotate(navMap.filters.selectedInterval);
      } else {
          if (interval.nam === reconstructMap.currentReconstruction.name && navMap.filters.personFilter.name === reconstructMap.currentReconstruction.person && navMap.filters.stratigraphy.name === reconstructMap.currentReconstruction.stratigraphy) {

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
              return;
            }
          }
        } else if (reconstructMap.currentReconstruction.name.length < 1) {
          alert("Please click a time interval below to build a reconstruction map");
        } else {
          alert("Please click a time interval below to build a reconstruction map");
        }
      }
      
    },

    "closeReconstructMap": function() {
      navMap.refresh("reset");

      reconstructMap.visible = false;


      d3.select("#reconstructMap").style("display","none");
      timeScale.unhighlight();

      $(".zoom-in").hammer()
        .on("tap", function(event) {
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