//anonymous funcion
(function(){
	//array of csv fields
var attrArray = ["LessThan9","SomeHighSchool","HighSchoolGrad","SomeCollege","Associates","Bachelors","GradorProfDegree"];
//array of csv fields formatted for titles and dropdown options
var chartTitleArray = ["less than 9th grade", "some high school", "high school diploma","some college","Associate's degree","Bachelor's degree","Grad degree/PhD"];
var expressed = attrArray[0];
var chartTitleExpressed = chartTitleArray[0];
var chartWidth = window.innerWidth *0.54,
		chartHeight = 473,
		leftPadding = 50,
		rightPadding = 2,
		topBottomPadding = 5,
		chartInnerWidth = chartWidth - leftPadding - rightPadding,
		chartInnerHeight = chartHeight - topBottomPadding * 2,
		translate = "translate(" + leftPadding + ","+ topBottomPadding +")";
//create a scale to size bar proportionally to fram and for axis
var yScale = d3.scaleLinear()
					.range([chartInnerHeight, 0])
					.domain([0, 50]);
//begin script when window loads
window.onload = drawMap();

//MAIN FUNCTION
async function drawMap(){
	//set up header div and title
	var title = d3.select("body").append("div")
								.attr("class", "title")
								.html("Educational Attainment in Michigan");
	//map frame dimensions
	 var width = window.innerWidth * 0.4,
	 	height = 460;
	//create new svg container for the map
	var map = d3.select("body")
		.append("svg")
		.attr("class", "map")
		.attr("width", width)
		.attr("height", height);
	//create Albers equal area conic projection centered on Michigan
	var projection = d3.geoAlbers()
		.center([-87.5, 44.8])
		.rotate([-2, 0])
		.parallels([-40, 40])
		.scale(4000)
		.translate([width / 2, height / 2]);
		//create path
	var path = d3.geoPath().projection(projection);
	//use Promise.all to parallelize asynchronous data loading
	//var promises = [];
	// promises.push(d3.csv("data/registeredVoters.csv")); //load attributes from csv
	// promises.push(d3.json("data/counties.topojson")); //load background spatial data
  //
	// Promise.all(promises).then(callback);
  d3.queue()
    .defer(d3.csv,"data/registeredVoters.csv")
    .defer(d3.json,"data/counties.topojson")
    .await(callback);
	//callback function
	function callback(error, voters, counties){
		//establish data sources from promises array
		// var voters = data[0];
		// var counties = data[1];
		//call graticule generator
		setGraticule(map,path);
		//translate counties TopoJSON
		miCounties = topojson.feature(counties, counties.objects.collection).features;
		//use turf library to draw geometry in clockwise to correct data display issues
		miCounties.forEach(function(feature){
			feature.geometry = turf.rewind(feature.geometry, {reverse:true});
		})
		//join csv data to geojson enumeration units
		miCounties = joinData(miCounties,voters);
		//create color scale for enumeration units
		var colorScale = makeColorScale(voters);
		//add enumeration units to the map
		setEnumerationUnits(miCounties,map,path,colorScale);
		//create dropdown
		createDropdown(voters);
		//create chart
		setChart(voters,colorScale);
		//create bottom div and sources
		setDataSources();
	};
};
function makeColorScale(csvData){
	//create color scale array
	var colorClasses = [
		"#eff3ff",
		"#bdd7e7",
		"#6baed6",
		"#3182bd",
		"#08519c"
	];
	var color = d3.scaleQuantile()//designate quantile scale generator
								.range(colorClasses);
	//build array of all currently expressed values for input domain
	var domainArray = [];
	//join loop
	for (var i=0; i<csvData.length; i++){
		var val = parseFloat(csvData[i][expressed]);
		domainArray.push(val);
	};
	//pass array of expressed values as domain
	color.domain(domainArray);
	console.log("domain array: ",domainArray);
	return color; //return the color scale generator
};
function choropleth(d, colorScale){
	//get data value
	var value = parseFloat(d[expressed]);
	//if value exists, assign it a color; otherwise assign gray
	if (typeof value == 'number' && !isNaN(value)) {
		return colorScale(value);
	} else {
		return "#ccc";
	};
};
function joinData(miCounties, voters){
	//loop through csv to assign each csv values to json county
	for (var i=0; i<voters.length; i++) {
		var csvCounty = voters[i]; //the current region
		var csvKey = csvCounty.county; //csv county field
		//loop through json regions to find right regions
		for (var a=0; a<miCounties.length; a++) {
			var geojsonProps = miCounties[a].properties;//the current region geojson properties
			var geojsonKey = geojsonProps.NAME;//the geojson primary key
		//	console.log(geojsonProps, geojsonKey);
			///where NAME codes match, attach csv to json object
			if (geojsonKey == csvKey) {
				//assign key/value pairs
				attrArray.forEach(function(attr){
					var val = parseFloat(csvCounty[attr]); //get csv attribute value
					geojsonProps[attr] = val; //assign attribute and value to geojson props
				});
			};
		};
	};
	console.log(miCounties);
	return miCounties;
};
function setEnumerationUnits(miCounties,map,path,colorScale){
	// var tooltip = d3.select("body")
	// 	.append("div")
	// 	.attr("class","tooltip")
	// 	.style("position", "absolute")
	// 	.style("z-index", "10")
	// 	.style("visibility","hidden")
	// 	.text("testing");

	var counties = map.selectAll(".counties")
		.data(miCounties)
		.enter()
		.append("path")
		.attr("class", function(d){
				return "counties " + d.properties.NAME;
		})
		.attr("d", path)
		.style("fill", function(d) {
			return choropleth(d.properties, colorScale)
		})
		// .text((d) => d.properties.NAME)
		// .text(function(d){ return d; })
		// .on("mouseover", function(d){
		// 	tooltip.text;
		// 	return tooltip.style("visibility", "visible");})
		// .on("mousemove", function(){ return tooltip.style("top","80px").style("left","400px");})
		// .on("mouseout", function(){ return tooltip.style("visibility", "hidden");});
		.on("mouseover", function(d){
			highlight(d.properties)
		})
		.on("mouseout", function(d){
			dehighlight(d.properties);
		})
		.on("mousemove", moveLabel);
		var desc = counties.append("desc")
			.text('{"stroke": "#000", "stroke-width": "0.5px"}');
	// 	.on("mouseover", function (d,i) {
	// 	d3.select(this).transition()
	// 			.duration('50')
	// 			.attr('opacity', '.85');
	// 	})
	// 	.on("mouseout", function(d,i) {
	// 	d3.select(this).transition()
	// 			.duration("50")
	// 			.attr('opacity', '1');
	// });
};
function setGraticule(map,path){
	var graticule = d3.geoGraticule()
	 .step([2, 2]); //place graticule lines every 2 degrees of longitude and latitude
	//create graticule background
	var gratBackground = map.append("path")
	 .datum(graticule.outline()) //bind graticule background
	 .attr("class", "gratBackground") //assign class for styling
	 .attr("d", path); //project graticule
 //create graticule lines
 var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
	 .data(graticule.lines()) //bind graticule lines to each element to be created
		 .enter() //create an element for each datum
	 .append("path") //append each element to the svg as a path element
	 .attr("class", "gratLines") //assign class for styling
	 .attr("d", path); //project graticule lines
};
function setChart(csvData, colorScale){
	// var tooltip = d3.tip()
	// 	.append("div")
	// 	.attr("class","tooltip")
	// 	.style("position", "absolute")
	// 	.style("z-index", "10")
	// 	.style("visibility","hidden")
	// 	.html("a simple tooltip");
	//create second svg element to hold the bar chart
	var chart = d3.select("body")
						.append("svg")
						.attr("width",chartWidth)
						.attr("height",chartHeight)
						.attr("class","chart");
	//create chart background fill
	var chartBackground = chart.append("rect")
						.attr("class", "chartBackground")
						.attr("width", chartInnerWidth)
						.attr("height", chartInnerHeight)
						.attr("transform", translate);
	//set bars for each county
	var bars = chart.selectAll(".bar")
						.data(csvData)
						.enter()
						.append("rect")
						.sort(function(a,b){
							return b[expressed]-a[expressed]
						})
						.attr("class", function(d){
							return "bar " + d.county;
						})
						.attr("width", chartInnerWidth/csvData.length -1)
						// .on("mouseover", function(d){tooltip.text(d.properties.name);return tooltip.style("visibility", "visible");})
						// .on("mousemove", function(){ return tooltip.style("top","80px").style("left","400px");})
						// .on("mouseout", function(){ return tooltip.style("visibility", "hidden");});
						.on("mouseover", highlight)
						.on("mouseout", dehighlight)
						.on("mousemove", moveLabel)
						.on("mouseover", function (d,i){
							d3.select(this).transition()
								.duration('50')
								.attr('opacity', '.85');
						})
						.on("mouseout", function(d,i) {
							d3.select(this).transition()
								.duration('50')
								.attr('opacity', '1');
						});
            var desc = bars.append("desc")
                    .text('{"stroke": "none", "stroke-width": "0px"}');
						// .on("mouseenter", onMouseEnter(this))
						// .on("mouseleave", onMouseLeave);

		//create chart title
		var chartTitle = chart.append("text")
						.attr("x",400)
						.attr("y",40)
						.attr("class","chartTitle")
						.text("Percentage of " + expressed + " in each county");
		//create vertical axis generator
		var yAxis = d3.axisLeft()
						.scale(yScale)
						//.orient("left");
		//place axis
		var axis = chart.append("g")
						.attr("class", "axis")
						.attr("transform", translate)
						.call(yAxis);
		//create frame for chart border
		var chartFrame = chart.append("rect")
						.attr("class","chartFrame")
						.attr("width", chartInnerWidth)
						.attr("height",chartInnerHeight)
						.attr("transform", translate);
		//create an average line
		// var xLine = 0;
		// var yLine = 7;
		// var avgLine = chart.append("line")
		// 	.attr("class","avgLine")
		// 	.attr("x1",50)
		// 	.attr("y1", 800)
		// 	.attr("x2",rightPadding)
		// 	.attr("y2",400);

	//reset bar positions, heights, and colors
	updateChart(bars, csvData.length, colorScale);
};
function createDropdown(csvData){
	//add select element
	var dropdown = d3.select("body")
				.append("select")
				.attr("class", "dropdown")
				.on("change", function(){
					changeAttribute(this.value, csvData)
				});
	//add initial option
	var titleOption = dropdown.append("option")
				.attr("class", "titleOption")
				.attr("disabled", "true")
				.text("Select Attribute");
	//add attribute name options
	var attrOptions = dropdown.selectAll("attrOptions")
				.data(attrArray)
				.enter()
				.append("option")
				.attr("value", function(d){ return d })
				.text(function(d){ return chartTitleArray[attrArray.indexOf(d)] });
};
//dropdown change listener handler
function changeAttribute(attribute, csvData){
	//change the expressed attribute
	expressed = attribute;
	//recreate the color scale
	var colorScale = makeColorScale(csvData);
	//recolor enumeration units
	var regions = d3.selectAll(".counties")
			.transition()
			.duration(1000)
			.style("fill", function(d){
				return choropleth(d.properties, colorScale)
			});
	//re-sort, resize, and recolor bars
	var bars = d3.selectAll(".bar")
		//resort bars
		.sort(function(a,b){
			return b[expressed] - a[expressed];
		})
		.transition()//add animation
		.delay(function(d,i){
			return i * 20
		})
		.duration(500);

		updateChart(bars,csvData.length, colorScale);
};
function updateChart(bars, n, colorScale){
	//position bars
	bars.attr("x", function(d,i){
				return i * (chartInnerWidth / n) + leftPadding;
			})
			.attr("height", function(d, i){
				return 463 - yScale(parseFloat(d[expressed]));
			})
			.attr("y", function(d, i){
				return yScale(parseFloat(d[expressed])) + topBottomPadding;
			})
			.style("fill", function(d){
				return choropleth(d, colorScale);
			});
	//updated chart title
	var chartTitle = d3.select(".chartTitle")
			.text("Percentage of those with "+ chartTitleArray[attrArray.indexOf(expressed)]);
};
//not working
function onMouseEnter(d){
	tooltip.style("opacity", 1)
	var metricValue = d.expressed;
	tooltip.select(".county")
		.text("testing!")
};
//not working
function onMouseLeave() {
	tooltip.style("opacity", 0)
}
//not working
function highlight(props){ //add interactivity
	// var selected = d3.selectAll("." + d.name).append("text")
	// 	.text(function() {
	// 		return [d];
	// 	})

	//change stroke
	var selected = d3.selectAll("." + props.NAME)
				.style("stroke","#ad3e3e")
				.style("stroke-width","2");
	setLabel(props);
};
//not working
function dehighlight(props){
	var selected = d3.selectAll("."+ props.NAME)
		.style("stroke", function(){
			return getStyle(this,"stroke")
		})
		.style("stroke-width", function(){
			return getStyle(this, "stroke-width")
		});
	function getStyle(element, styleName){
		var styleText = d3.select(element)
			.select("desc")
			.text();
		var styleObject = JSON.parse(styleText);

		return styleObject[styleName];
	};
	d3.select(".infolabel")
		.remove();
};
//not working
function setLabel(props){
	//label content
  var formatted = (props[expressed]).toFixed(1);
  var titleFormatted = chartTitleArray[attrArray.indexOf(expressed)];
  //console.log(props[expressed]);
	var labelAttribute = "<h1>" + formatted + "%</h1><b>" + titleFormatted + "</b>";

	//create label div
	var infolabel = d3.select("body")
		.append("div")
		.attr("class", "infolabel")
		.attr("id", props.NAME + "_label")
		.html(labelAttribute);
	var countyName = infolabel.append("div")
		.attr("class","labelname")
		.html(props.NAME + " County")
};
//not working
function moveLabel(){
	//get width of label
	var labelWidth = d3.select(".infolabel")
		.node();
		// .getBoundingClientRect()
		// .width;
	//use coords of mousemove event to set label coords
	var x1 = d3.event.clientX + 10,
			y1 = d3.event.clientY - 75,
			x2 = d3.event.clientX - labelWidth -10,
			y2 = d3.event.clientY +25;

	//horizontal label coord testing for overflow
	var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;
	//vertical label coordinate, testing for overflow
	var y = d3.event.clientY < 75 ? y2 : y1;

	d3.select(".infolabel")
		.style("left", x + "px")
		.style("top", y + "px");
};
//set bottom div and data sources
function setDataSources(){
	var dataSources = d3.select("body")
			.append("div")
			.attr("class","dataSources")
			.text("Data sources: County Shapefiles: State of Michigan Open Data Portal, Educational Attainment: ACS 2018 5-Year Estimates, United States Census. Created by Cassandra Verras, November 2020.")
};
})(); //run anonymous function
