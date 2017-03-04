var diversityPlot = (function() {
  var margin = {top: 20, right: 20, bottom: 80, left: 80},
      padding = {top: 0, right: 0, bottom: 0, left: 80},
      width = 960,
      height = 800 - margin.top - margin.bottom,
      currentRequest;

  // Fetch diversity data from PBDB
  function getDiversityData(url) {
    // Abort any pending requests
    if(typeof(diversityPlot.currentRequest) != 'undefined') {
      if (Object.keys(diversityPlot.currentRequest).length > 0) {
        diversityPlot.currentRequest.abort();
        diversityPlot.currentRequest = {};
      }
    }

    diversityPlot.currentRequest = d3.json(url, function(error, data) {
      if (error) {
        alert("Error retrieving diversity data");
        console.log(error);
      } else {
        getTimescale(data.records.map(function(d) {
          d.total = d.dsb;
          return d;
        }));
      }
    });
  }

  // Get appropriate timescale
  function getTimescale(data) {
    // Figure out how much timescale we need
    var maxAge = data[data.length - 1].eag,
        minAge = data[0].lag;

    var eras = [
      {"nam": "Neoproterozoic", "lag": 541, "eag": 1000},
      {"nam": "Paleozoic", "lag": 252.17, "eag": 541},
      {"nam": "Mesozoic", "lag": 66, "eag": 252.17},
      {"nam": "Cenozoic", "lag": 0, "eag": 66}
    ];

    var requestedMaxAge, requestedMinAge;
    for (var i = 0; i < eras.length; i++) {
      // Get early era
      if (maxAge >= eras[i].lag && maxAge <= eras[i].eag) {
        requestedMaxAge = eras[i].eag;
      }
      // Get late era
      if (minAge >= eras[i].lag && minAge <= eras[i].eag) {
        requestedMinAge = eras[i].lag;
      }
    }

    // Request timescale data
    $.ajax(paleo_nav.dataUrl + "/data1.2/intervals/list.json?scale=1&order=age.desc&max_ma=" + requestedMaxAge + "&min_ma=" + requestedMinAge )
      .fail(function(error) {
        console.log(error);
      })
      .done(function(timeData) {
        // Filter for eras and periods
        var timescale = timeData.records.filter(function(d) {
          if (d.lvl === 2 || d.lvl === 3) {
            d.totalTime = d.eag - d.lag;
            return d;
          }
        });
        // Draw the chart
        draw(data, timescale);
      });
  } // End getTimescale

  function draw(data, timescale) {
    // Remove any old ones...
    d3.select("#diversity").select("svg").remove();

    // Filter out the periods and eras for drawing purposes
    var periods = timescale.filter(function(d) {
      if (d.lvl === 3) {
        return d;
      }
    });

    var eras = timescale.filter(function(d) {
      if (d.lvl === 2) {
        return d;
      }
    });

    // Define a scale for the x axis
    var x = d3.scale.linear()
      .domain([d3.max(eras, function(d) { return d.eag; }), d3.min(eras, function(d) { return d.lag; }) - 1])
      .range([0, width - margin.left - margin.right]);

    // Define a scale for the y axis
    var y = d3.scale.linear()
      .domain([0, d3.max(data, function(d) { return d.total; })])
      .range([height - margin.top - margin.bottom, 0]);

    // Create an x axis
    var xAxis = d3.svg.axis()
      .scale(x)
      .orient("bottom")
      .ticks(5);

    // Create a Y axis
    var yAxis = d3.svg.axis()
      .scale(y)
      .orient("left")
      .ticks(5);

    // Define a scale for scaling the periods
    var periodX = d3.scale.linear()
      .domain([0, d3.sum(timescale, function(d) { if (d.lvl === 2) { return d.totalTime; } })])
      .range([0, width - margin.left - margin.right]);

    // Define a scale for positioning the periods
    var periodPos = d3.scale.linear()
      .domain([d3.max(timescale, function(d) { return d.eag }), d3.min(timescale, function(d) { return d.lag })])
      .range([0, width - margin.left - margin.right]);

    // Draw the SVG to hold everything
    var svg = d3.select("#diversity").append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("id", "diversityGraph")
      .append("g")
      .attr("id", "diversityGraphGroup")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
      .style("font-family", "Helvetica,sans-serif")
      .style("fill", "#333")
      .style("font-weight","100")
      .style("font-size","0.8em");

    // Draw a group to hold the timescale
    var scale = d3.select("#diversityGraph").select("g")
      .append("g")
      .attr("id", "timeScale")
      .attr("transform", "translate(" + padding.left + "," + (height  - margin.top - margin.bottom + 3) + ")");

    // Draw the periods
    scale.selectAll(".periods")
      .data(periods)
      .enter().append("rect")
      .attr("height", "40")
      .attr("width", function(d) { return periodX(d.totalTime); })
      .attr("x", function(d) { return periodPos(d.eag) })
      .attr("id", function(d) { return "r" + d.oid })
      .style("fill", function(d) { return d.col })
      .style("opacity", 0.83)
      .append("svg:title")
      .text(function(d) { return d.nam });

    // Draw period abbreviations
    scale.selectAll(".periodNames")
      .data(periods)
      .enter().append("text")
      .attr("x", function(d) { return (periodPos(d.eag) + periodPos(d.lag))/2 })
      .attr("y", "30")
      .attr("id", function(d) { return "l" + d.oid })
      .attr("class", "timeLabel abbreviation")
      .style("font-size","2.4em")
      .text(function(d) { return d.abr });

    // Draw the full period names
    scale.selectAll(".periodNames")
      .data(periods)
      .enter().append("text")
      .attr("x", function(d) { return (periodPos(d.eag) + periodPos(d.lag))/2 })
      .attr("y", "30")
      .attr("class", "timeLabel dFullName")
      .style("font-size","2.4em")
      // .attr("style", "font-size:2.4em;font-weight: 100;color:black;")
      .attr("id", function(d) { return "l" + d.oid })
      .text(function(d) { return d.nam });

    // Draw the era(s)
    scale.selectAll(".eras")
      .data(eras)
      .enter().append("rect")
      .attr("height", "40")
      .attr("width", function(d) { return periodX(d.totalTime); })
      .attr("x", function(d) { return periodPos(d.eag) })
      .attr("y", "40")
      .attr("id", function(d) { return "r" + d.oid })
      .style("fill", function(d) { return d.col })
      .style("opacity", 0.83)
      .append("svg:title")
      .text(function(d) { return d.nam });

    // Draw the full era names
    scale.selectAll(".eraNames")
      .data(eras)
      .enter().append("text")
      .attr("x", function(d) { return (periodPos(d.eag) + periodPos(d.lag))/2 })
      .attr("y", "70")
      .attr("class", "timeLabel dFullName")
      .style("font-size","2.4em")
      .attr("id", function(d) { return "l" + d.oid })
      .text(function(d) { return d.nam; });

    // Append the x axis ticks and numbers
    svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(" + padding.left + "," + (height - margin.top - margin.bottom + 85) + ")")
      .style("font-size","3em")
      .style("fill","#777")
      .call(xAxis)
      .select("path")
      .style("display","none");

    // Append the y axis
    var label = svg.append("g")
      .attr("class", "y axis")
      .attr("transform", "translate(" + padding.left + ",0)")
      .style("fill","none")
      .style("font-size","3em")
      .style("letter-spacing","normal")
      .call(yAxis);

    label.append("text")
      .attr("transform", "rotate(-90)")
      .attr("dy", "1em")
      .style("fill","#777")
      .style("text-anchor", "end")
      .style("font-size", "0.8em")
      .style("font-weight", 400)
      .text($("[name=taxonLevel]").val() + " sampled in " + $("[name=timeLevel]").val());

    label.append("text")
      .attr("transform", "rotate(-90)")
      .attr("dy", "3em")
      .style("text-anchor", "end")
      .style("font-size", "0.6em")
      .style("font-weight", 300)
      .style("font-style", "italics")
      .style("fill","#777")
      .text("(approximate)");

    label.selectAll(".tick")
      .style("letter-spacing","8px")
      .style("fill","#777");

    // Draw zee line
    var line = d3.svg.line()
      .interpolate("linear")
      .x(function(d) { return periodPos(d.eag) })
      .y(function(d) { return y(d.total); });

    svg.append("path")
      .datum(data)
      .attr("class", "line diversityLine")
      .attr("style", "fill: none; stroke: #777; stroke-width: 4px;")
      .attr("d", line)
      .attr("transform", "translate(" + padding.left + ",0)");

    positionLabels();

    $("#diversityWait").css("display", "none");
  }

  function positionLabels(stop) {
    var labels = d3.selectAll(".dFullName");

    // Show all the labels so we can properly compute widths
    d3.selectAll(".dFullName").style("display","block");
    d3.selectAll(".abbreviation").style("display","block");

    for (var i = 0; i < labels[0].length; i++) {
      var id = d3.select(labels[0][i]).data()[0].oid,
          rectWidth = parseFloat(d3.select("rect#r" + id).attr("width")),
          rectX = parseFloat(d3.select("rect#r" + id).attr("x"))

      var labelWidth;
      try {
        labelWidth = d3.select(".dFullName#l" + id).node().getComputedTextLength();
      } catch(err) {
        labelWidth = 25;
      }

      // If the full label doesn't fit...
      if (rectWidth - 8 < labelWidth) {
        // Hide the full label
        d3.select(".dFullName#l" + id).style("display", "none");

        // Then check if the abbreviated label will fit
        var abbreviationWidth;
        try {
          abbreviationWidth = d3.select(".abbreviation#l" + id).node().getComputedTextLength();
        } catch(err) {
          abbreviationWidth = 10;
        }

        if (rectWidth - 8 < abbreviationWidth) {
          d3.select(".abbreviation#l" + id).style("display", "none");
        } else {
          d3.select(".abbreviation#l" + id)
            .style("display", "block")
            .attr("x", rectX + ((rectWidth - abbreviationWidth)/ 2));
        }

      } else {
        // Otherwise, hide the abbreviation and position the full label
        d3.select(".abbreviation#l" + id).style("display", "none");
        d3.select(".dFullName#l" + id).attr("x", rectX + ((rectWidth - labelWidth)/ 2));
      }
    }

    if (!stop) {
      setTimeout(resize, 100);
    }

  }

  function resize() {
    $(".statsContent").height("auto");
    var containerHeight = $(".diversityContainer").height() - 50,
        containerWidth = $(".diversityContainer").width() ;

    if (containerHeight > containerWidth) {
      var scale = containerWidth / width;

      if ((scale * height) > containerHeight) {
        scale = containerHeight / height;
      }
    } else {
      // width > height
      var scale = containerHeight / height;
      if ((scale * width) > containerWidth) {
        scale = containerWidth / width;
      }
    }

    d3.select("#diversityGraphGroup")
      .attr("transform", "scale(" + scale + ")translate(" + margin.left + "," + margin.right + ")");

    var computedWidth = d3.select("#diversityGraphGroup").node().getBBox().width;
    d3.select("#diversityGraph")
      .attr("height", containerHeight + margin.bottom)
      .attr("width",computedWidth * scale + margin.left + 20);

    positionLabels(true);
  }

  d3.select(window).on("resize", positionLabels);

  function updateQuickdiv() {
    var taxonLevel = $("[name=taxonLevel]").val();
    var timeLevel = $("[name=timeLevel]").val();
    var url=paleo_nav.dataUrl;

    var bounds = map.getBounds(),
      sw = bounds._southWest,
      ne = bounds._northEast;
    if (parseInt(d3.select("#map").style("height")) < 1) {
      sw.lng = -180,
      ne.lng = 180,
      sw.lat = -90,
      ne.lat = 90;
    }

    url += "/data1.2/occs/quickdiv.json?";
    url = navMap.parseURL(url);
    url += "&lngmin=" + sw.lng.toFixed(1) + "&lngmax=" + ne.lng.toFixed(1) + "&latmin=" + sw.lat.toFixed(1)  + "&latmax=" + ne.lat.toFixed(1);
    url += "&count="+taxonLevel+"&time_reso="+timeLevel;
    getDiversityData(url);
  }

  function saveImg() {
    var html = d3.select("#diversityGraph")
          .attr("version", 1.1)
          .attr("xmlns", "http://www.w3.org/2000/svg")
          .node().parentNode.innerHTML;

    var imgsrc = 'data:image/svg+xml;base64,'+ btoa(html);
    var img = '<img src="'+imgsrc+'">'; 
    d3.select("#svgdataurl").html(img);

    getCanvasSize();

    var canvas = document.querySelector("canvas"),
      context = canvas.getContext("2d");

    var image = new Image;
    image.src = imgsrc;
    image.onload = function() {
      context.drawImage(image, 0, 0);

      var canvasdata = canvas.toDataURL("image/png");

      var pngimg = '<img src="'+canvasdata+'">'; 
        d3.select("#pngdataurl").html(pngimg);

      var a = document.createElement("a");
      a.download = "diversity-curve.png";
      a.href = canvasdata;
      a.id = "downloadLink";
      document.getElementsByTagName("body")[0].appendChild(a);
      a.click();
      }
    };

  function getCanvasSize() {
    var svg = d3.select("#diversityGraph");
    var height = svg.attr("height");
    var width = svg.attr("width");
    d3.select("canvas").attr("height",height).attr("width",width);
  } 

  return {
    "plot": getDiversityData,
    "resize": resize,
    "currentRequest": currentRequest,
    "updateQuickdiv": updateQuickdiv,
    "saveImg": saveImg,
    "getCanvasSize": getCanvasSize
  }

})();
