// Via http://stackoverflow.com/questions/14167863/how-can-i-bring-a-circle-to-the-front-with-d3
// Necessary for highlighting time intervals properly
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

var timeScale = (function() {

  var data = { id: 0, color: "#000000", name: "Geologic Time", children: [] },
      interval_hash = { 0: data },
      currentInterval,
      dragStart, transformStart;

  /* Distinguish between clicks and doubleclicks via 
     https://gist.github.com/tmcw/4067674 */

  function clickcancel() {
    var event = d3.dispatch('click', 'dblclick');
    function cc(selection) {
        var down,
            tolerance = 5,
            last,
            wait = null;
        // euclidean distance
        function dist(a, b) {
            return Math.sqrt(Math.pow(a[0] - b[0], 2), Math.pow(a[1] - b[1], 2));
        }

        selection.on('mousedown', function(d) {
            down = d3.mouse(document.body);
            last = +new Date();
        });
        selection.on('mouseup', function(d) {
            if (dist(down, d3.mouse(document.body)) > tolerance) {
                return;
            } else {
                if (wait) {
                    window.clearTimeout(wait);
                    wait = null;
                    event.dblclick(d3.event);
                } else {
                    wait = window.setTimeout((function(e) {
                        return function() {
                            event.click(e);
                            wait = null;
                        };
                    })(d3.event), 300);
                }
            }
        });
    };
    return d3.rebind(cc, event, 'on');
  }

  function init(div, height, callbackFunc) {
    var width = 960,
        x = d3.scale.linear().range([0, width - 5]),
        y = d3.scale.linear().range([0, height]),
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
        .attr("width", width)
        .attr("height", height)
        .append("g");

    var scale = time.append("g")
      .attr("id", "tickBar")
      .attr("transform", "translate(0," + (height + 15) + ")");

    // Load the time scale data
    d3.json(paleo_nav.dataUrl + paleo_nav.dataService + "/intervals/list.json?scale=1&order=age.desc&max_ma=4000", function(error, result) {
      for(var i = 0; i < result.records.length; i++) {
        var r = {
          "id": result.records[i].oid.replace("int:",""),
          "pid": result.records[i].pid?result.records[i].pid.replace("int:",""):0,
          "level": result.records[i].lvl,
          "color": result.records[i].col,
          "name": result.records[i].nam,
          "abbr": result.records[i].abr || result.records[i].nam.charAt(0),
          "early_age": result.records[i].eag,
          "late_age": result.records[i].lag,
          "mid": parseInt((result.records[i].eag + result.records[i].lag) / 2),
          "total": result.records[i].eag - result.records[i].lag,
          "children": []
        };
        interval_hash[r.id] = r;
        interval_hash[r.pid].children.push(r);
      }

      // Create a new d3 partition layout
      var partition = d3.layout.partition()
          .sort(function(d) { d3.ascending(d); })
          .value(function(d) { return d.total; });

      var ccRect = clickcancel();

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
          .attr("fill", function(d) { return d.color || "#000000"; })
          .attr("id", function(d) { return "t" + d.id; })
          .style("opacity", 0.83)
          .call(drag)
          .call(ccRect)
          .dblTap(function(d) {
            setTimeout(goTo(d), 500);
          })
        .append("svg:title")
          .text(function(d) { return d.name; });
        ccRect.on("dblclick", function(d) {
          goTo(d.target.__data__);
        });
        ccRect.on("click", function(d) {
          mapFilter(d.target.__data__);
        });

      // Scale bar for the bottom of the graph
      var scaleBar = scale.selectAll("rect")
          .data(partition.nodes(data));

      var hash = scaleBar.enter().append("g")
        .attr("class", function(d) {
          return "tickGroup s" + ((typeof(d.level) === "undefined") ? 0 : d.level);
        })
        .attr("transform", function(d) { return "translate(" + x(d.x) + ", -20)"});

      hash.append("line")
        .attr("x1", 0)
        .attr("y1", 7.5)
        .attr("x2", 0)
        .attr("y2", 12)
        .style("stroke-width", "0.05em");

      hash.append("text")
        .attr("x", 0)
        .attr("y", function() { return (height/6 * 0.55 + 12) * 1.05 })
        .style("text-anchor", function(d) { return (d.early_age === 0.0117) ? "end" : "middle"; })
        .style("font-size", function() { return height/6 * 0.55 })
        .style("fill", "#777")
        .text(function(d) {return d.early_age});

      // Create a tick for year 0
      var now = scale.append("g")
        .data([{x:1, y:0}])
        .attr("class", "tickGroup s1 s2 s3 s4 s5")
        .attr("transform","translate(955, -20)");

      now.append("line")
        .attr("x1", 0)
        .attr("y1", 7.5)
        .attr("x2", 0)
        .attr("y2", 12)
        .style("stroke-width", "0.05em");

      now.append("text")
        .attr("x", 0)
        .attr("y", function() { return (height/6 * 0.55 + 12) * 1.05 })
        .attr("id", "now")
        .style("text-anchor", "end")
        .style("font-size", function() { return height/6 * 0.55 })
        .style("fill", "#777")
        .text("0");

      var textGroup = time.append("g")
        .attr("id", "textGroup");

      var fontSizeHash = {
        "0": 0.61,
        "1": 0.89,
        "2": 0.72,
        "3": 0.61,
        "4": 0.55,
        "5": 0.55
      };

      var ccFull = clickcancel();
      // Add the full labels
      textGroup.selectAll("fullName")
          .data(partition.nodes(data))
        .enter().append("svg:text")
          .text(function(d) { return d.name; })
          .attr("x", 1)
          .attr("y", function(d) { return y(d.y) + (height * 0.127);})
          .attr("width", function() { return this.getComputedTextLength(); })
          .attr("height", function(d) { return y(d.dy); })
          .attr("class", function(d) { return "fullName level" + ((typeof(d.level) === "undefined") ? 0 : d.level); })
          .attr("id", function(d) { return "l" + d.id; })
          .attr("x", function(d) { return labelX(d); })
          .style("font-size", function(d) { return ((typeof(d.level) === "undefined") ? height/6 * fontSizeHash[0]  + "px" : height/6 * fontSizeHash[d.level]  + "px")})
          .call(drag)
          .call(ccFull)
          .dblTap(function(d) {
            setTimeout(goTo(d), 500);
          })
        .append("svg:title")
          .text(function(d) { return d.name; });

        ccFull.on("dblclick", function(d) {
          goTo(d.target.__data__);
        });
        ccFull.on("click", function(d) {
          mapFilter(d.target.__data__);
        });

      var ccAbbr = clickcancel();

      // Add the abbreviations
      textGroup.selectAll("abbrevs")
          .data(partition.nodes(data))
        .enter().append("svg:text")
          .attr("x", 1)
          .attr("y", function(d) { return y(d.y) + (height * 0.127);})
          .attr("width", 30)
          .attr("height", function(d) { return y(d.dy); })
          .text(function(d) { return d.abbr || d.name.charAt(0); })
          .attr("class", function(d) { return "abbr level" + ((typeof(d.level) === "undefined") ? 0 : d.level); })
          .attr("id", function(d) { return "a" + d.id; })
          .attr("x", function(d) { return labelAbbrX(d); })
          .style("font-size", function(d) { return ((typeof(d.level) === "undefined") ? height/6 * fontSizeHash[0]  + "px" : height/6 * fontSizeHash[d.level]  + "px")})
          .call(ccAbbr)
          .dblTap(function(d) {
            setTimeout(goTo(d), 500);
          })
        .append("svg:title")
          .text(function(d) { return d.name; });
          
        ccAbbr.on("dblclick", function(d) {
          goTo(d.target.__data__);
        });
        ccAbbr.on("click", function(d) {
          mapFilter(d.target.__data__);
        });

      // Start everything else
      callbackFunc();

      // Position the labels for the first time
      goTo(interval_hash[0]);

      // Remove the Geologic time abbreviation
      d3.select(".abbr.levelundefined").remove();

      // Open to Phanerozoic 
      goTo(interval_hash[751]);


    }); // End PaleoDB json callback

    // Size time scale to window
    resize();
  }

  function labelLevels(d) {
    // Center whichever interval was clicked
    d3.select("#l" + d.id).attr("x", 430);

    // Position all the parent labels in the middle of the scale
    if (typeof d.parent !== 'undefined') {
      var depth = d.depth,
          loc = "d.parent";
      for (var i = 0; i < depth; i++) {
        var parent = eval(loc).name;
        d3.selectAll('.abbr').filter(function(d) {
          return d.name === parent;
        }).attr("x", 430);
        d3.selectAll('.fullName').filter(function(d) {
          return d.name === parent;
        }).attr("x", 430);
        loc += ".parent";
      }
      d3.selectAll('.abbr').filter(function(d) {
        return d.name === parent;
      }).attr("x", 430);
      d3.selectAll('.fullName').filter(function(d) {
        return d.name === parent;
      }).attr("x", 430);

      if (d3.select("#graphicRow").style("visibility") === "hidden") {
        paleo_nav.prelaunch();
      }
    }
  }

  function labelAbbrX(d) {
    var rectWidth = parseFloat(d3.select("rect#t" + d.id).attr("width")),
        rectX = parseFloat(d3.select("rect#t" + d.id).attr("x"));

    var labelWidth;
    try {
      labelWidth = d3.select("#a" + d.id).node().getComputedTextLength();
    } catch(err) {
      labelWidth = 11;
    }

    if (rectWidth - 8 < labelWidth) {
       d3.select("#a" + d.id).style("display", "none");
    }
    return rectX + (rectWidth - labelWidth) / 2;
  }

  function labelX(d) {
    var rectWidth = parseFloat(d3.select("rect#t" + d.id).attr("width")),
        rectX = parseFloat(d3.select("rect#t" + d.id).attr("x"));

    var labelWidth;
    try {
      labelWidth = d3.select("#l" + d.id).node().getComputedTextLength();
    } catch(err) {
      labelWidth = 25;
    }

    if (rectWidth - 8 < labelWidth) {
       d3.select("#l" + d.id).style("display", "none");
    } else {
      d3.select("#a" + d.id).style("display", "none");
    }
    
    return rectX + (rectWidth - labelWidth) / 2;
  }

  function labelY(d) {
    var rectHeight = parseFloat(d3.select("rect#t" + d.id).attr("height")), 
        rectY = parseFloat(d3.select("rect#t" + d.id).attr("y")),
        labelHeight = d3.select("#l" + d.id).node().getBBox().height,
        scale = parseInt(d3.select(".timeScale").style("width"))/961;

    return (rectY * 0.8) + ((rectHeight - labelHeight) / 2) + 8;
  }

  function labelAbbrY(d) {
    var rectHeight = parseFloat(d3.select("rect#t" + d.id).attr("height")), 
        rectY = parseFloat(d3.select("rect#t" + d.id).attr("y")),
        labelHeight = d3.select("#l" + d.id).node().getBBox().height,
        scale = parseInt(d3.select(".timeScale").style("width"))/961;

    return (rectY * 0.8) + (rectHeight - labelHeight) / 2;
  }

  function mapFilter(d) {
    // If the interval clicked on is already the selected filter, ignore
    if (d.id === navMap.filters.selectedInterval.oid) {
      return;
    }

    highlight(d.name);
    // Update the map filter info
    navMap.filters.selectedInterval.nam = d.name;
    navMap.filters.selectedInterval.mid = d.mid;
    navMap.filters.selectedInterval.col = d.color;
    navMap.filters.selectedInterval.oid = d.id;
    navMap.filters.exist.selectedInterval = true;

    navMap.updateFilterList("selectedInterval");

    if (reconstructMap.visible) {
      var requestYear = parseInt((d.early_age + d.late_age) / 2);
      if (d.depth < 3) {
        return alert("Please select a period or finer interval");
      } else if (requestYear > 550) {
        return alert("Please select an interval younger than 600 MA");
      } else {
        navMap.refresh("reset");
        reconstructMap.rotate(d);
      }
    } else {
      navMap.refresh("reset");
    }
  }

  // Zooms the graph to a given time interval
  function goTo(d, first) {
    if (typeof d === "string") {
      var d = d3.selectAll('rect').filter(function(e) {
        return e.name === d;
      });
      d = d[0][0].__data__;
    } else if (d.children) {
      if (d.children.length < 1) {
        var d = d.parent;
      }
    } else {
      var d = d;
    }

    // Stores the currently focused time interval for state restoration purposes
    timeScale.currentInterval = d;

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
        return "translate(" + x(d.x) + ", -20)"; 
      });

    // When complete, calls labelTrans() 
    d3.selectAll("rect").transition()
      .duration(750)
      .each(function(){ ++n; })
      .attr("x", function(d) { return x(d.x); })
      .attr("width", function(d) { return x(d.x + d.dx) - x(d.x); })
      .each("end", function() { if (!--n) { labelTrans(d); }});
  }

  function labelTrans(d) {
    // var n keeps track of the transition
    var n = 0,
        x = d3.scale.linear().range([0, 955]),
        y = d3.scale.linear().range([0, 120]);

    x.domain([d.x, d.x + d.dx]);

    // Move the full names
    d3.selectAll(".fullName").transition()
      .duration(10)
      .each(function(){ ++n; })
      .attr("x", function(d) { return labelX(d); })
      .attr("height", function(d) { return y(d.y + d.dy) - y(d.y); })
      .each("end", function() { if (!--n) { labelLevels(d); }});

    // Move the abbreviations
    d3.selectAll(".abbr").transition()
      .duration(300)
      .each(function(){ ++n; })
      .attr("x", function(d) { return labelAbbrX(d); })
      .attr("height", function(d) { return y(d.y + d.dy) - y(d.y); })
      .each("end", function() { 
        if (!--n) {
          labelLevels(d);
          d3.select("#l0").style("fill", "#fff");
        } else {
          d3.selectAll(".fullName").style("fill", "#333");
          d3.selectAll(".abbr").style("fill", "#333");
        }
      });
    resize();
  }

  // Highlight a given time interval
  function highlight(d) {
    // Check if many intervals are being highlighted. If many, don't reset;
    unhighlight();
    if (d.cxi) {
      var id = d.cxi;
      d3.selectAll("rect#t" + d.cxi).style("stroke", "#000").moveToFront();
      d3.selectAll("#l" + d.cxi).moveToFront();
    } else if (typeof d == "string") {
      var id = d3.selectAll('rect').filter(function(e) {
        return e.name === d;
      }).attr("id");
      id = id.replace("t", "");
    } else {
      var id = d3.select(d).attr("id");
      id = id.replace("p", "");
    }

    d3.selectAll("rect#t" + id).style("stroke", "#000").moveToFront();
    d3.selectAll("#l" + id).moveToFront();
    d3.selectAll(".abbr").moveToFront();
  }

  // Unhighlight a time interval by resetting the stroke of all rectangles
  function unhighlight(d) {
    d3.selectAll("rect").style("stroke", "#fff");
  }

  function resize() {
    d3.select(".timeScale g")
      .attr("transform", function() {
        var width = parseInt(d3.select("#graphics").style("width"));
        return "scale(" + width/961 + ")";
      });

    var g = d3.select(".timeScale").select("svg");
    
    // Firefox hack for figuring out the correct size and positioning
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
    d3.select(".timeScale svg")
      .style("width", function() {
        return (parseInt(d3.select("#graphics").style("width")) - 1) + "px";
       });
    d3.select(".timeScale svg")
      .style("height", function() {
        return (box.height + 5) + "px";
      });
  }

  return {

    "init": init,  
    "goTo": goTo,
    "highlight": highlight,
    "unhighlight": unhighlight,
    "resize": resize,
    "interval_hash": interval_hash,
    "currentInterval": currentInterval

  }
})();
