// Adapted from an Angular.js implementation by Michael McClennen
var taxaBrowser = (function(){
  var section_list = [];
  return {
    "init": function() {
      // Handler for the taxa search box
      $("#taxaSearch").submit(function() {
        taxaBrowser.goToTaxon();
        return false;
      });
    },

    "goToTaxon": function(name) {
      // If no params supplied, use whatever is in the input box
    // TODO: this should check both the simple and extended taxa search boxes
      if (!name) {
        var name = $("#taxonInput").val();
      }
      // If there is a taxon to search for...
      if (name.length > 0) {
        // Ask the API for the taxon oid
        d3.json(paleo_nav.baseUrl + '/data1.1/taxa/list.json?name=' + name, function(err, data) {
          if (err) {
            alert("Error retrieving from list.json - ", err);
          } else {
            if ( data.records.length > 0 ) {
              paleo_nav.untoggleTaxa();
              
              // Update the selected taxon in the taxa browser
              d3.select(".taxonTitle")
                .html(data.records[0].nam + " (" + taxaBrowser.rankMap(data.records[0].rnk) + ")" + "<i class='icon icon-plus-sign-alt'></i>")
                .attr("id", function() { return data.records[0].nam });

              $(".taxonTitle").off("click");
              $(".taxonTitle").click(function(d) {
                d.preventDefault();
                navMap.filterByTaxon(d.target.id, true);
              });
              // Get the rest of the details
              taxaBrowser.getTaxonDetails(data.records[0]);

              // Reset search box
              $("#taxonInput").val("");
              $("#taxaInput").val("");
              
            } else {
              // TODO: Don't use a damn alert!
                return alert("No taxa with this name found");
            }
          }
        });
      }
    },

    "getTaxonDetails": function(taxon) {
      // Ask the API for the details of the selected taxon
      d3.json(paleo_nav.baseUrl + '/data1.1/taxa/single.json?id=' + taxon.oid + '&show=attr,nav,size', function(err, data ) {
        if (err) {
          // This should never be true, unless something goes horrifically wrong
          return alert("Error retrieving from single.json - ", err);
        } else if (data.records.length > 0) {
          // Update the selected taxon's att...?
          d3.select(".taxonAttr").html(data.records[0].att);

          // Compute the parents and children of the selected taxon
          taxaBrowser.computeParentList(data.records[0]);
          taxaBrowser.computeChildList(data.records[0]);
        } else {
          // This should also never happen
          return alert("No taxon details found - browser");
        }
      });
    },

    "computeParentList": function(taxon) {
      var parent_list = [],
          last_oid = 0;
      
      if (taxon.kgt && taxon.kgn && taxon.kgn != taxon.gid) {
        taxon.kgt.rnk = 'kingdom';
        parent_list.push(taxon.kgt);
        last_oid = taxon.kgn;
      }
      
      if (taxon.phl && taxon.phn && taxon.phn != taxon.gid) {
        taxon.pht.rnk = 'phylum';
        parent_list.push(taxon.pht);
        last_oid = taxon.phn;
      }
      
      if (taxon.cll && taxon.cln && taxon.cln != taxon.gid) {
        taxon.clt.rnk = 'class';
        parent_list.push(taxon.clt);
        last_oid = taxon.cln;
      }
      
      if (taxon.odl && taxon.odn && taxon.odn != taxon.gid) {
        taxon.odt.rnk = 'order';
        parent_list.push(taxon.odt);
        last_oid = taxon.odn;
      }
      
      if (taxon.fml && taxon.fmn && taxon.fmn != taxon.gid) {
        taxon.fmt.rnk = 'family';
        parent_list.push(taxon.fmt);
        last_oid = taxon.fmn;
      }
      
      if (taxon.prt && taxon.par != last_oid) {
        parent_list.push(taxon.prt);
      }

      var tbody = d3.select("#focalTaxonParents");

      // Remove any existing focal taxon parents
      tbody.selectAll("tr").remove();

      // Bind the parents to an HTML table
      tbody.selectAll(".rows")
        .data(parent_list)
      .enter().append("tr").append("td")
        .append("a")
        .attr("id", function(d) { return d.nam; })
        .attr("href", "#")
        .html(function(d) {
          return d.nam + " (" + d.rnk + ")";
         })
        .attr("class", function(d, i) {
          // If the current data point being bound is the last one...
          if (i === parent_list.length - 1) {
            // If extint, add that class
            if (d.ext === 0) {
              return "immediateParent extinct parents";
            } else {
              return "immediateParent parents";
            }
          // If the current data point isn't the last one and it's extinct
          } else if (d.ext === 0) {
            return "extinct parents";
          // Otherwise, assume it's a normal parent
          } else {
            return "parents";
          }
        });

      // Reattach interaction listeners to newly added elements
      taxaBrowser.reattachHandlers(taxon);
    },

    "computeChildList": function(taxon) {
      section_list = [];
        
      if (taxon.chl && taxon.rnk > 5 && (taxon.chl.length === 0 || !taxon.gns || taxon.chl.length != taxon.gnc)) {
          section_list.push({ section: "immediate subtaxa", size: taxon.chl.length, rank: "immediate", 
            offset: 0, order: 'size.desc', taxa: taxon.chl });
      }
      
      if (taxon.phs) {
          section_list.push({ section: "phyla", size: taxon.phc, rank: 20, 
            offset: 0, max: 10, order: 'size.desc', taxa: taxon.phs });
      }
      
      if (taxon.cls) {
          section_list.push({ section: "classes", size: taxon.clc, rank: 17, 
            offset: 0, max: 10, order: 'size.desc', taxa: taxon.cls });
      }
      
      if (taxon.ods) {
          section_list.push({ section: "orders", size: taxon.odc, rank: 13, 
            offset: 0, max: 10, order: 'size.desc', taxa: taxon.ods });
      }
      
      if (taxon.fms) {
          section_list.push({ section: "families", size: taxon.fmc, rank: 9, 
            offset: 0, max: 10, order: 'size.desc', taxa: taxon.fms });
      }
      
      if (taxon.gns) {
          section_list.push({ section: "genera", size: taxon.gnc, rank: 5, 
            offset: 0, max: 10, order: 'size.desc', taxa: taxon.gns });
      }
      
      if (taxon.sgs && taxon.sgs.length > 0) {
          section_list.push({ section: "subgenera", size: taxon.gnc, rank: 4, 
            offset: 0, max: 10, order: 'size.desc', taxa: taxon.sgs });
      }
      
      if (taxon.sps && taxon.sps.length > 0) {
          section_list.push({ section: "species", size: taxon.sps.length, rank: 3, 
            offset: 0, max: 10, order: 'size.desc', taxa: taxon.sps });
      }
      
      if (taxon.sss && taxon.sss.length > 0) {
          section_list.push({ section: "subspecies", size: taxon.sss.length, rank: 2, 
            offset: 0, max: 10, order: 'size.desc', taxa: taxon.sss });
      }

      var tbody = d3.select("#focal_taxon_children");

      // Remove any existing children
      tbody.selectAll("tr").remove();

      tbody.selectAll(".rows")
        .data(section_list)
      .enter().append("tr").append("td")
        .append("a")
          // id = rank is used for getting all children when clicked
          .attr("id", function(d) { return "t" + d.rank; })
          .attr("class", "children")
          .attr("href", "#")
          .html(function(d) { return d.size + " " + d.section});

      // Reattach interaction listeners to newly added elements
      taxaBrowser.reattachHandlers(taxon);
    },
    
    // Function that retrieves all immediate subtaxa of a given taxon
    "getSubtaxa": function(taxon, rank, offset, limit) {
      var lim_str = '';
        
      if (typeof offset === "number") {
          lim_str += '&offset=' + offset;
      }
      
      if (typeof limit === "number") {
          lim_str += '&limit=' + limit;
      }
      
      if (rank > 0) {
          // Ask the API for all immediate subtaxa
          var url = paleo_nav.baseUrl + '/data1.1/taxa/list.json?id=' + taxon.oid + lim_str + '&show=size&rel=all_children&rank=' + rank;

          d3.json(url, function(err, data) {
            if (data.records.length > 0) {

              d3.select("#subtaxa").selectAll("li").remove();
              d3.select("#subtaxa").selectAll("br").remove();

              function compare(a,b) {
                if (a.siz > b.siz)
                   return -1;
                if (a.siz < b.siz)
                  return 1;
                return 0;
              }

              data.records.sort(compare);

              data.records.forEach(function(d) {
                var taxaClass = (d.ext === 0) ? "extinct childTaxa" : "childTaxa";

                $("#subtaxa").append("<li><a href='#' class='" + taxaClass + "' id='" + d.nam + "'>" + d.nam + " (" + d.siz + ") " + "</a></li>");
              });
              $("#subtaxa").append("<br>");


              // Clean up
              /*d3.select("#subtaxaModalTable").selectAll("tr").remove();

              var records = d3.select("#subtaxaModalTable").selectAll(".records")
                .data(data.records);

              records.enter().append("tr").append("td")
                .append("a")
                .attr("id", function(d) { return d.nam })
                .attr("class", function(d) {
                  if (d.ext == 0) {
                    return "extinct childTaxa";
                  } else {
                    return "childTaxa";
                  }
                })
                .attr("href", "#")
                .html(function(d) {
                  return d.nam + " (" + taxaBrowser.rankMap(d.rnk) + ")";
                });*/

              // Reattach interaction listeners to newly added elements
              taxaBrowser.reattachHandlers(taxon);

              // Open up the modal that shows all subtaxa
              $("#subtaxaModal").modal();
            }     
          });
      }
    },

    // Helper function for finding the rank of a taxon
    "rankMap": function(num) {
      var rankMap = { 25: "unranked", 23: "kingdom", 22: "subkingdom",
      21: "superphylum", 20: "phylum", 19: "subphylum",
      18: "superclass", 17: "class", 16: "subclass", 15: "infraclass",
      14: "superorder", 13: "order", 12: "suborder", 11: "infraorder",
      10: "superfamily", 9: "family", 8: "subfamily",
      7: "tribe", 6: "subtribe", 5: "genus", 4: "subgenus",
      3: "species", 2: "subspecies" };

      return rankMap[num];
    },

    "reattachHandlers": function(taxon) {
      // Handler for direct parents of focal taxon
      $(".parents").off("click");
      $(".parents").click(function(d) {
        d.preventDefault();
        taxaBrowser.goToTaxon(d.target.id);
      });

      // Handler for taxa in children modal
      $(".childTaxa").off("click");
      $(".childTaxa").click(function(d) {
        d.preventDefault();
        $("#subtaxaModal").modal('hide');
        $("#taxaFilterInput").val('');
        taxaBrowser.goToTaxon(d.target.id);
      });

      // Handler for direct children of focal taxon
      $(".children").off("click");
      $(".children").click(function(d) {
        d.preventDefault();
        /* When clicked, get all subtaxa given the focal taxon and 
        the rank of the item clicked (i.e. was order, family, etc selected?)*/
        if (d.target.id.substr(1) != "immediate") {
          taxaBrowser.getSubtaxa(taxon, d.target.id.substr(1));
        } else {
          d3.select("#subtaxa").selectAll("li").remove();
          d3.select("#subtaxa").selectAll("br").remove();

          function compare(a,b) {
            if (a.siz > b.siz)
               return -1;
            if (a.siz < b.siz)
              return 1;
            return 0;
          }

          // Find object in section list where rank = 'immediate'
          var index = navMap.getIndex(section_list, "immediate", "rank");
          section_list[index].taxa.sort(compare);

          section_list[index].taxa.forEach(function(d) {
            var taxaClass = (d.ext === 0) ? "extinct childTaxa" : "childTaxa";

            $("#subtaxa").append("<li><a href='#' class='" + taxaClass + "' id='" + d.nam + "'>" + d.nam + " (" + d.siz + ") " + "</a></li>");
          });
          $("#subtaxa").append("<br>");

          taxaBrowser.reattachHandlers(taxon);

          // Open up the modal that shows all subtaxa
          $("#subtaxaModal").modal();
        }
        
      });

    },

    "filter": function(param) {
        var value = $(param).val();

        value = value.charAt(0).toUpperCase() + value.slice(1);
        
        $('#subtaxa > li:not(:contains(' + value + '))').hide(); 
        $('#subtaxa > li:contains(' + value + ')').show();
      }
  }
})();