var diversityPlot = (function() {
  var margin = {top: 20, right: 20, bottom: 80, left: 80},
      padding = {top: 0, right: 0, bottom: 0, left: 80},
      width = 960,
      height = 800 - margin.top - margin.bottom,
      currentRequest;

  // Fetch diversity data from PBDB
  function getDiversityData(url,full) {
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
        }),full);
      }
    });
  }

  // Get appropriate timescale
  function getTimescale(data,full) {
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
    $.ajax(paleo_nav.dataUrl + paleo_nav.dataService + "/intervals/list.json?scale=1&order=age.desc&max_ma=" + requestedMaxAge + "&min_ma=" + requestedMinAge )
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
        draw(data, timescale, full);
      });
  } // End getTimescale

  function draw(data, timescale, full) {
    var divname=(full)?"#advdiversity":"#diversity";
    // Remove any old ones...
    d3.select("#diversity","#advdiversity").select("svg").remove();

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

    // Calculate origination, extinction, and rangethrough diversity
    if (full) {
      data.map(function(d) {
        d.origination = -Math.log((d.xbt)/(d.xbt+d.xft))/(d.eag-d.lag);
      });
      data.map(function(d) {
        d.extinction = -Math.log((d.xbt)/(d.xbt+d.xbl))/(d.eag-d.lag);
      });
      data.map(function(d) {
        d.rangethroughYes = d.xft+d.xbl+d.xfl+d.xbt;
        d.rangethroughNo = d.xbl+d.xfl+d.xbt;
      });
      var sampled = $('[name="extant"]').is(":checked");
      var rangethrough = $('[name="extant"]').is(":checked");
      var origination = $('[name="extant"]').is(":checked");
      var extinction = $('[name="extant"]').is(":checked");
    };

    // Define a scale for the x axis
    var x = d3.scale.linear()
      .domain([d3.max(eras, function(d) { return d.eag; }), d3.min(eras, function(d) { return d.lag; }) - 1])
      .range([0, width - margin.left - margin.right]);

    // Define a scale for the y axis
    if(full) {
      var y = d3.scale.linear()
        .domain([0, d3.max(data, function(d) { return d.rangethroughYes; })])
        .range([height - margin.top - margin.bottom, 0]);
      var y2 = d3.scale.linear()  
        .domain([-1,1])
        .range([height - margin.top - margin.bottom, 0]);
    } else {
      var y = d3.scale.linear()
        .domain([0, d3.max(data, function(d) { return d.total; })])
        .range([height - margin.top - margin.bottom, 0]);
    }

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

    if (full) {
      var yAxis2 = d3.svg.axis()
        .scale(y2)
        .orient("right")
        .tickValues([-1,0,1])
        .tickFormat(Math.abs);      
    }

    // Define a scale for scaling the periods
    var periodX = d3.scale.linear()
      .domain([0, d3.sum(timescale, function(d) { if (d.lvl === 2) { return d.totalTime; } })])
      .range([0, width - margin.left - margin.right]);

    // Define a scale for positioning the periods
    var periodPos = d3.scale.linear()
      .domain([d3.max(timescale, function(d) { return d.eag }), d3.min(timescale, function(d) { return d.lag })])
      .range([0, width - margin.left - margin.right]);

    // Draw the SVG to hold everything
    var svg = d3.select(divname).append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("id", full?"advdiversityGraph":"diversityGraph")
      .append("g")
      .attr("id", full?"advdiversityGraphGroup":"diversityGraphGroup")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
      .style("font-family", "Helvetica,sans-serif")
      .style("fill", "#333")
      .style("font-weight","100")
      .style("font-size","0.8em");

    // Draw a group to hold the timescale
    var scale = d3.select(divname + "Graph").select("g")
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
      .attr("id", function(d) { return "r" + d.oid.replace("int:","") })
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
      .attr("id", function(d) { return "l" + d.oid.replace("int:","") })
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
      .attr("id", function(d) { return "l" + d.oid.replace("int:","") })
      .text(function(d) { return d.nam });

    // Draw the era(s)
    scale.selectAll(".eras")
      .data(eras)
      .enter().append("rect")
      .attr("height", "40")
      .attr("width", function(d) { return periodX(d.totalTime); })
      .attr("x", function(d) { return periodPos(d.eag) })
      .attr("y", "40")
      .attr("id", function(d) { return "r" + d.oid.replace("int:","") })
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
      .attr("id", function(d) { return "l" + d.oid.replace("int:","") })
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

    if(full){ //append the second y-axis
      var label2 = svg.append("g")
        .attr("class", "y axis")
        .attr("transform", "translate(" + (width - 20) + ",0)")
        .style("fill","none")
        .style("font-size","3em")
        .style("letter-spacing","normal")
        .call(yAxis2);

      label2.append("text")
        .attr("transform", "rotate(90)translate(" + (height * 0.28) + ",-35)")
        .attr("dy", "1em")
        .style("fill","green")
        .style("text-anchor", "end")
        .style("font-size", "0.6em")
        .style("font-weight", 400)
        .text("origination");

      label2.append("text")
        .attr("transform", "rotate(90)translate(" + (height * 0.70) + ",-35)")
        .attr("dy", "1em")
        .style("fill","red")
        .style("text-anchor", "end")
        .style("font-size", "0.6em")
        .style("font-weight", 400)
        .text("extinction");

      label2.append("text")
        .attr("transform", "rotate(90)translate(" + (height * 0.65) + ",-80)")
        .attr("dy", "1em")
        .style("fill","#777")
        .style("text-anchor", "end")
        .style("font-size", "0.8em")
        .style("font-weight", 400)
        .text("rates per " + $("[name=taxonLevel]").val() + " per Myr");

      label2.selectAll(".tick")
        .style("letter-spacing","8px")
        .style("fill","#777");
    }

    // Draw zee line
    var line = d3.svg.line()
      .interpolate("linear")
      .x(function(d) { return periodPos(d.eag) })
      .y(function(d) { return y(d.total); });

      svg.append("path")
        .datum(data)
        .attr("class", "line diversityLine sampledLine")
        .attr("style", "fill: none; stroke: #777; stroke-width: 4px;")
        .attr("d", line)
        .attr("transform", "translate(" + padding.left + ",0)");

    if(full){
      toggleLine('sampledLine');

      var lineRangethroughYes = d3.svg.line()
        .interpolate("linear")
        .x(function(d) { return periodPos(d.eag); })
        .y(function(d) { return y(d.rangethroughYes); });
      
        svg.append("path")
          .attr("class", "line diversityLine rangethroughLineYes")
          .attr("style", "fill: none; stroke: black; stroke-width: 4px; stroke-dasharray: 4,2; display:none;")
          .attr("d", lineRangethroughYes(data))
          .attr("transform", "translate(" + padding.left + ",0)");

      var lineRangethroughNo = d3.svg.line()
        .interpolate("linear")
        .x(function(d) { return periodPos(d.eag); })
        .y(function(d) { return y(d.rangethroughNo); });
      
        svg.append("path")
          .attr("class", "line diversityLine rangethroughLineNo")
          .attr("style", "fill: none; stroke: black; stroke-width: 4px; stroke-dasharray: 4,2; display:none;")
          .attr("d", lineRangethroughNo(data))
          .attr("transform", "translate(" + padding.left + ",0)");

        toggleLine('rangethroughLine');

      var lineOrigination = d3.svg.line()
        .interpolate("linear")
        .defined(function(d) { return !isNaN(d.origination)&isFinite(d.origination); })
        .x(function(d) { return periodPos(d.eag); })
        .y(function(d) { return y2(d.origination); });

        svg.append("path")
          .datum(data)
          .attr("class", "line diversityLine originationLine")
          .attr("style", "fill: none; stroke: green; stroke-width: 2px; display:none;")
          .attr("d", lineOrigination(data))
          .attr("transform", "translate(" + padding.left + ",0)");

        toggleLine('originationLine');


      var lineExtinction = d3.svg.line()
        .interpolate("linear")
        .defined(function(d) { return !isNaN(d.extinction)&isFinite(d.extinction); })
        .x(function(d) { return periodPos(d.eag) })
        .y(function(d) { return y2(-d.extinction); });

        svg.append("path")
          .datum(data)
          .attr("class", "line diversityLine extinctionLine")
          .attr("style", "fill: none; stroke: red; stroke-width: 2px; display:none;")
          .attr("d", lineExtinction(data))
          .attr("transform", "translate(" + padding.left + ",0)");

          toggleLine('extinctionLine');
    }

    positionLabels(false,full);

    $("#diversityWait").css("display", "none");
    $("#advdiversityWait").css("display", "none");
    
  }

  function positionLabels(stop,full) {
    var modalName = full?"advdiversityGraphGroup":"diversityGraphGroup";

    var labels = d3.selectAll(".dFullName");

    // Show all the labels so we can properly compute widths
    d3.selectAll(".dFullName").style("display","block");
    d3.selectAll(".abbreviation").style("display","block");

    for (var i = 0; i < labels[0].length; i++) {
      var id = d3.select(labels[0][i]).data()[0].oid.replace("int:",""),
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
      setTimeout(resize(full), 100);
    }

  }

  function resize(full) {
    var modalPrefix = full?"adv":"";

    $("." + modalPrefix + "statsContent").height("auto");
    var containerHeight = $("." + modalPrefix + "diversityContainer").height() - 50,
        containerWidth = $("." + modalPrefix + "diversityContainer").width() ;

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

    if (full) {
      d3.select("#" + modalPrefix + "diversityGraphGroup")
      .attr("transform", "scale(" + scale + ")translate(" + (margin.left - 80) + "," + margin.right + ")");
    } else {
      d3.select("#" + modalPrefix + "diversityGraphGroup")
      .attr("transform", "scale(" + scale + ")translate(" + margin.left + "," + margin.right + ")");
    }

    var computedWidth = d3.select("#" + modalPrefix + "diversityGraphGroup").node().getBBox().width;
    d3.select("#" + modalPrefix + "diversityGraph")
      .attr("height", containerHeight + margin.bottom)
      .attr("width", computedWidth * scale + margin.left + 20);

    positionLabels(true);
  }

  d3.select(window).on("resize", positionLabels);


  function toggleLine(lineName){
    var checked = $('[name=' + lineName + ']').is(":checked");
    if (lineName === "rangethroughLine") {
      var singletons = $('[name="singletons"]').is(":checked");
      var lineNameFull = singletons?['rangethroughLineYes','rangethroughLineNo']:['rangethroughLineNo','rangethroughLineYes'];
      $('.' + lineNameFull[0]).css("display" , checked ? '' : 'none');
      $('.' + lineNameFull[1]).css("display" , 'none');
    } else {
      $('.' + lineName).css("display" , checked ? '' : 'none');
    }
  }

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

    url += paleo_nav.dataService + "/occs/quickdiv.json?";
    url = navMap.parseURL(url);
    url += "&lngmin=" + sw.lng.toFixed(1) + "&lngmax=" + ne.lng.toFixed(1) + "&latmin=" + sw.lat.toFixed(1)  + "&latmax=" + ne.lat.toFixed(1);
    url += "&count="+taxonLevel+"&time_reso="+timeLevel;
    getDiversityData(url);
  }

  // function updateFulldiv() {
  //   var taxonLevel = $("[name=taxonLevel]").val();
  //   var timeLevel = $("[name=timeLevel]").val();
  //   var extant = $('[name="extant"]').is(":checked");
  //   var url=paleo_nav.dataUrl;

  //   var bounds = map.getBounds(),
  //     sw = bounds._southWest,
  //     ne = bounds._northEast;
  //   if (parseInt(d3.select("#map").style("height")) < 1) {
  //     sw.lng = -180,
  //     ne.lng = 180,
  //     sw.lat = -90,
  //     ne.lat = 90;
  //   }

  //   url +=  paleo_nav.dataService + "/occs/diversity.json?";
  //   url = navMap.parseURL(url);
  //   url += "&lngmin=" + sw.lng.toFixed(1) + "&lngmax=" + ne.lng.toFixed(1) + "&latmin=" + sw.lat.toFixed(1)  + "&latmax=" + ne.lat.toFixed(1);
  //   url += "&count=" + taxonLevel + "&time_reso=" + timeLevel + "&recent=" + extant;
  //   getDiversityData(url);
  // }

  function saveImg(full) {
    var html = d3.select(full?"#advdiversityGraph":"#diversityGraph")
          .attr("version", 1.1)
          .attr("xmlns", "http://www.w3.org/2000/svg")
          .node().parentNode.innerHTML;

    var imgsrc = 'data:image/svg+xml;base64,'+ btoa(html);
    var img = '<img src="'+imgsrc+'">'; 
    d3.select(full?"#advsvgdataurl":"#svgdataurl").html(img);

    getCanvasSize(full);

    var canvas = document.querySelector("canvas"),
      context = canvas.getContext("2d");

    var image = new Image;
    image.src = imgsrc;
    image.onload = function() {
      context.drawImage(image, 0, 0);

      var canvasdata = canvas.toDataURL("image/png");

      var pngimg = '<img src="'+canvasdata+'">'; 
      d3.select((full)?"#advpngdataurl":"#pngdataurl").html(pngimg);

      var a = document.createElement("a");
      a.download = "diversity-curve.png";
      a.href = canvasdata;
      a.id = "downloadLink";
      document.getElementsByTagName("body")[0].appendChild(a);
      a.click();
    }
  };

  function getCanvasSize(full) {
    var svg = d3.select(full?"#advdiversityGraph":"#diversityGraph");
    var height = svg.attr("height");
    var width = svg.attr("width");
    d3.select("canvas").attr("height",height).attr("width",width);
  } 

  return {
    "plot": getDiversityData,
    "resize": resize,
    "currentRequest": currentRequest,
    "updateQuickdiv": updateQuickdiv,
    // "updateFulldiv": updateFulldiv,
    "saveImg": saveImg,
    "getCanvasSize": getCanvasSize,
    "toggleLine": toggleLine
  }

})();
