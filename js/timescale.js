
// http://stackoverflow.com/questions/14167863/how-can-i-bring-a-circle-to-the-front-with-d3
// Necessary for highlighting
d3.selection.prototype.moveToFront = function() {
  return this.each(function(){
    this.parentNode.appendChild(this);
  });
};

d3.selection.prototype.dblTap = function(callback) {
  var last = 0;
  return this.each(function() {
    d3.select(this).on("touchstart", function(e) {
        if ((d3.event.timeStamp - last) < 2000) {
          return callback(e);
        }
        last = d3.event.timeStamp;
    });
  });
}


var timeScale = {
  "init": function(div) {

    var w = 960,
        h = 130,
        x = d3.scale.linear().range([0, w - 5]),
        y = d3.scale.linear().range([0, h]),
        newX = 0.01;

    var drag = d3.behavior.drag()
      .origin(function() { 
        var t = d3.select(".timeScale g");
        return {x: -newX, y: 0};
      })
      .on("dragstart", function() {
        dragStart = [d3.event.sourceEvent.pageX, d3.event.sourceEvent.pageY];
        transformStart = d3.transform(d3.select(".timeScale").select("g").attr("transform")).translate;

        d3.event.sourceEvent.stopPropagation();
      })
      .on("drag", function() {
        var currentDrag = [d3.event.sourceEvent.pageX, d3.event.sourceEvent.pageY];
        newX = (dragStart[0] - currentDrag[0]);

        d3.select(".timeScale").select("g")
          .attr("transform", function() {
            return "translate(" + [ parseInt(transformStart[0] + -newX), 0 ] + ")scale(" + parseInt(d3.select(".timeScale").style("width"))/961 + ")";
          });
      });

    // Add class timeScale to whatever div was supplied
    d3.select("#" + div).attr("class", "timeScale");

    // Create the SVG for the chart
    var time = d3.select("#" + div).append("svg:svg")
        .attr("width", w)
        .attr("height", h)
        .append("g");

    var scale = time.append("g")
      .attr("id", "tickBar")
      .attr("transform", "translate(0,125)");

    // Load the time scale data
   // d3.json("http://x/data1.1/intervals/list.json?order=older&max_ma=4000", function(error, result) {
    d3.json("js/intervals.json", function(error, result) {
      var data = { oid: 0, col: "#000000", nam: "Geologic Time", children: [] };
          interval_hash = { 0: data };
      for(var i=0; i < result.records.length; i++) {
        var r = result.records[i];
        r.children = [];
        r.pid = r.pid || 0;
        r.abr = r.abr || r.nam.charAt(0);
        r.mid = parseInt((r.eag + r.lag) / 2),
        r.total = r.eag - r.lag;
        interval_hash[r.oid] = r;
        interval_hash[r.pid].children.push(r);
      }
        // Create a new d3 partition layout
      var partition = d3.layout.partition()
          .sort(function(d) { d3.ascending(d); })
          .value(function(d) { return d.total; });

      var last = 0;
      
      var rectGroup = time.append("g")
        .attr("id", "rectGroup");
      // Create the rectangles
      rectGroup.selectAll("rect")
          .data(partition.nodes(data))
        .enter().append("svg:rect")
          .attr("x", function(d) { return x(d.x); })
          .attr("y", function(d) { return y(d.y); })
          .attr("width", function(d) { return x(d.dx); })
          .attr("height", function(d) { return y(d.dy); })
          .attr("fill", function(d) { return d.col || "#000000"; })
          .attr("id", function(d) { return "t" + d.oid; })
          .style("opacity", 0.83)
          .call(drag)
          .on("click", function(d) {
            if (d3.event.defaultPrevented) return;
            timeScale.mapFilter(d);
          })
          .on("dblclick", function(d) {
            if (d3.event.defaultPrevented) return;
            timeScale.goTo(d);
          })
          .dblTap(function(d) {
            console.log("working?");
            setTimeout(timeScale.goTo(d), 500);
          });

      var scaleBar = scale.selectAll("rect")
          .data(partition.nodes(data));

      var hash = scaleBar.enter().append("g")
        .attr("class", function(d) {return "tickGroup s" + d.lvl})
        .attr("transform", function(d) { return "translate(" + x(d.x) + ", 0)"});

      hash.append("line")
        .attr("x1", 0)
        .attr("y1", 7.5)
        .attr("x2", 0)
        .attr("y2", 12)
        .style("stroke-width", "0.05em");

      hash.append("text")
        .attr("x", 0)
        .attr("y", 20)
        .style("text-anchor", function(d) { return (d.eag == 0.0117) ? "end" : "middle"; })
        .style("font-size", "0.85em")
        .style("fill", "#777")
        .text(function(d) {return d.eag});

      // Create a tick for year 0
      var now = scale.append("g")
        .data([{x:1, y:0}])
        .attr("class", "tickGroup s1 s2 s3 s4 s5")
        .attr("transform","translate(955, 0)");

      now.append("line")
        .attr("x1", 0)
        .attr("y1", 7.5)
        .attr("x2", 0)
        .attr("y2", 12)
        .style("stroke-width", "0.05em");

      now.append("text")
        .attr("x", 0)
        .attr("y", 20)
        .attr("id", "now")
        .style("text-anchor", "end")
        .style("font-size", "0.85em")
        .style("fill", "#777")
        .text("0");

      var textGroup = time.append("g")
        .attr("id", "textGroup");

      // Add the full labels
      textGroup.selectAll("fullName")
          .data(partition.nodes(data))
        .enter().append("svg:text")
          .text(function(d) { return d.nam; })
          .attr("x", 1)
          .attr("y", function(d) { return y(d.y) + 15;})
          .attr("width", function() { return this.getComputedTextLength(); })
          .attr("height", function(d) { return y(d.dy); })
          .attr("class", function(d) { return "fullName level" + d.lvl; })
          .attr("id", function(d) { return "l" + d.oid; })
          .attr("x", function(d) { return timeScale.labelX(d); })
          .call(drag)
          .on("click", function(d) {
            if (d3.event.defaultPrevented) return;
            timeScale.mapFilter(d);
          })
          .on("dblclick", function(d) {
            if (d3.event.defaultPrevented) return;
            timeScale.goTo(d);
          })
          .dblTap(function(d) {
            console.log("working?");
            setTimeout(timeScale.goTo(d), 500);
          });

      // Add the abbreviations
      textGroup.selectAll("abbrevs")
          .data(partition.nodes(data))
        .enter().append("svg:text")
          .attr("x", 1)
          .attr("y", function(d) { return y(d.y) + 15; })
          .attr("width", 30)
          .attr("height", function(d) { return y(d.dy); })
          .text(function(d) { return d.abr || d.nam.charAt(0); })
          .attr("class", function(d) { return "abbr level" + d.lvl; })
          .attr("id", function(d) { return "a" + d.oid; })
          .attr("x", function(d) { return timeScale.labelAbbrX(d); })
          .on("click", function(d) {
            if (d3.event.defaultPrevented) return;
            timeScale.mapFilter(d);
          })
          .on("dblclick", function(d) {
            if (d3.event.defaultPrevented) return;
            timeScale.goTo(d);
          })
          .dblTap(function(d) {
            console.log("working?");
            setTimeout(timeScale.goTo(d), 500);
          });


      // Position the labels for the first time
      timeScale.goTo(interval_hash[0]);

      // Remove the Geologic time abbreviation
      d3.select(".abbr.levelundefined").remove();

      // Open to Phanerozoic 
      timeScale.goTo(interval_hash[751]);

    }); // End PaleoDB json callback

    //attach window resize listener to the window
    //d3.select(window).on("resize", timeScale.resize);
    // Moved to navMap.js

    // Size time scale to window
    timeScale.resize();

  }, // End time.init() 

  "labelLevels": function(d) {
      // Center whichever interval was clicked
      d3.select("#l" + d.oid).attr("x", 430);

      // Position all the parent labels in the middle of the scale
      if (typeof d.parent !== 'undefined') {
        var depth = d.depth,
            loc = "d.parent";
        for (var i=0; i<depth;i++) {
          var parent = eval(loc).nam;
          d3.selectAll('.abbr').filter(function(d) {
            return d.nam === parent;
          }).attr("x", 430);
          d3.selectAll('.fullName').filter(function(d) {
            return d.nam === parent;
          }).attr("x", 430);
          loc += ".parent";
        }
        d3.selectAll('.abbr').filter(function(d) {
          return d.nam === parent;
        }).attr("x", 430);
        d3.selectAll('.fullName').filter(function(d) {
          return d.nam === parent;
        }).attr("x", 430);
      }
  }, // End time.labelLevels

  "labelAbbrX": function(d) {
    var rectWidth = parseFloat(d3.select("#t" + d.oid).attr("width")),
        rectX = parseFloat(d3.select("#t" + d.oid).attr("x")),
        labelWidth = d3.select("#a" + d.oid).node().getComputedTextLength();
    if (rectWidth - 8 < labelWidth) {
       d3.select("#a" + d.oid).style("display", "none");
    }
    return rectX + (rectWidth - labelWidth) / 2;
  },

  "labelX": function(d) {
    var rectWidth = parseFloat(d3.select("#t" + d.oid).attr("width")),
        rectX = parseFloat(d3.select("#t" + d.oid).attr("x")),
        labelWidth = d3.select("#l" + d.oid).node().getComputedTextLength();
    if (rectWidth - 8 < labelWidth) {
       d3.select("#l" + d.oid).style("display", "none");
    } else {
      d3.select("#a" + d.oid).style("display", "none");
    }

    return rectX + (rectWidth - labelWidth) / 2;
  },

  "labelY": function(d) {
    var rectHeight = parseFloat(d3.select("#t" + d.oid).attr("height")), 
        rectY = parseFloat(d3.select("#t" + d.oid).attr("y")),
        labelHeight = d3.select("#l" + d.oid).node().getBBox().height,
        scale = parseInt(d3.select(".timeScale").style("width"))/961;

    return (rectY * 0.8) + ((rectHeight - labelHeight) / 2) + 8;
  },

  "labelAbbrY": function(d) {
    var rectHeight = parseFloat(d3.select("#t" + d.oid).attr("height")), 
        rectY = parseFloat(d3.select("#t" + d.oid).attr("y")),
        labelHeight = d3.select("#l" + d.oid).node().getBBox().height,
        scale = parseInt(d3.select(".timeScale").style("width"))/961;

    return (rectY * 0.8) + (rectHeight - labelHeight) / 2;
  },

  "mapFilter": function(d) {
    // if box is checked...
    var timeFilterCheck = document.getElementById('viewByTimeBox').checked,
        reconstructCheck = document.getElementById('reconstructBox').checked;

    if (timeFilterCheck) {
      filters.selectedInterval = d.nam;
      filters.exist.selectedInterval = true;
      navMap.updateFilterList("selectedInterval");
      if (reconstructCheck) {
        var requestYear = parseInt((d.eag + d.lag) / 2);
        if (d.depth < 3) {
          return alert("Please select a period or finer interval");
        } else if (requestYear > 600) {
          return alert("Please select an interval younger than 250 MA");
        } else {
          navMap.refresh("reset");
          reconstructMap.rotate(d);
        }
      } else {
        navMap.refresh("reset");
      }
    }
  },

  "goTo": function(d) {
    if (typeof d == "string") {
      var d = d3.selectAll('rect').filter(function(e) {
        return e.nam === d;
      });
      d = d[0][0].__data__;
    } else if (d.children.length < 1) {
      var d = d.parent;
    } else {
      var d = d;
    }

    // Adjust the bottom scale
    var depth = (d.depth != 'undefined') ? parseInt(d.depth) + 1 : 1;
    d3.selectAll(".scale").style("display", "none");
    d3.selectAll(".tickGroup").style("display", "none");
    d3.selectAll(".s" + depth).style("display", "block");

    // Reset panning  
    d3.select(".timeScale g")
    .attr("transform", function() {
      return "scale(" + parseInt(d3.select(".timeScale").style("width"))/961 + ")";
    });

    // var n keeps track of the transition
    var n = 0,
        x = d3.scale.linear().range([5, 955]);

    x.domain([d.x, d.x + d.dx]);

    // "Hide" the labels during the transition
    // Cannot calculate the correct position if display:none is used
    d3.selectAll(".fullName")
      .style("fill", "rgba(0,0,0,0)")
      .style("display", "block");
    d3.selectAll(".abbr")
      .style("fill", "rgba(0,0,0,0)")
      .style("display", "block");

    d3.selectAll(".tickGroup").transition()
      .duration(750)
      .attr("transform", function(d) {
        d3.select(this).selectAll("text").style("text-anchor", "middle");
        if (x(d.x) == 5) {
          d3.select(this).select("text")
            .style("text-anchor", "start");
        } else if (x(d.x) == 955) {
          d3.select(this).select("text")
            .style("text-anchor", "end");
        }
        return "translate(" + x(d.x) + ", 0)"; 
      });

    // When complete, calls labelTrans() 
    d3.selectAll("rect").transition()
      .duration(750)
      .each(function(){ ++n; })
      .attr("x", function(d) { return x(d.x); })
      .attr("width", function(d) { return x(d.x + d.dx) - x(d.x); })
      .each("end", function() { if (!--n) { timeScale.labelTrans(d); }});

  },

  "labelTrans": function(d) {
    // var n keeps track of the transition
    var n = 0,
        x = d3.scale.linear().range([0, 955]),
        y = d3.scale.linear().range([0, 120]);

    x.domain([d.x, d.x + d.dx]);

    // Move the full names
    d3.selectAll(".fullName").transition()
      .duration(10)
      .each(function(){ ++n; })
      .attr("x", function(d) { return timeScale.labelX(d); })
      //.attr("y", function(d) { return timeScale.labelY(d); })
      .attr("height", function(d) { return y(d.y + d.dy) - y(d.y); })
      .each("end", function() { if (!--n) { timeScale.labelLevels(d); }});

    // Move the abbreviations
    d3.selectAll(".abbr").transition()
      .duration(300)
      .each(function(){ ++n; })
      .attr("x", function(d) { return timeScale.labelAbbrX(d); })
      //.attr("y", function(d) { return timeScale.labelAbbrY(d); })
      .attr("height", function(d) { return y(d.y + d.dy) - y(d.y); })
      .each("end", function() { 
        if (!--n) {
          timeScale.labelLevels(d);
          d3.select("#l0").style("fill", "#fff");
        } else {
          d3.selectAll(".fullName").style("fill", "#333");
          d3.selectAll(".abbr").style("fill", "#333");
        }
      });
  },

  "highlight": function(d) {
    d3.selectAll("rect").style("stroke", "#fff");
    if (d.cxi) {
      var id = d.cxi;
      d3.selectAll("rect#t" + d.cxi).style("stroke", "#000").moveToFront();
      d3.selectAll("#l" + d.cxi).moveToFront();
    } else if (typeof d == "string") {
      var id = d3.selectAll('rect').filter(function(e) {
        return e.nam === d;
      }).attr("id");
      id = id.replace("t", "");
    } else {
      var id = d3.select(d).attr("id");
      id = id.replace("p", "");
    }
    d3.selectAll("rect#t" + id).style("stroke", "#000").moveToFront();
    d3.selectAll("#l" + id).moveToFront();
    d3.selectAll(".abbr").moveToFront();
  },

  "unhighlight": function() {
    d3.selectAll("rect").style("stroke", "#fff");
  },

  "resize": function() {
    d3.select(".timeScale g")
      .attr("transform", function() {
        return "scale(" + parseInt(d3.select(".timeScale").style("width"))/961 + ")";
      });

    d3.select(".timeScale svg")
      .style("width", function() {
        return d3.select(".timeScale").style("width");
       })
      .style("height", function() {
        return parseInt(d3.select(".timeScale").style("width")) * 0.25 + "px";
      });
  }
}