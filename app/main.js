$(document).on('ready', function() {
LEAPSCALE = 0.6;
SWIPE_THRESH = 100;
CELL_WIDTH = 300;
ROTATE_RATE = 2;

var NUM_BATTERIES = 4;
var LIT_INDICATORS = ["FRK"];
var moduleManager = new ModuleManager();

var cursor = new Cursor();
var fingerCursors = [new Cursor(), new Cursor(), new Cursor(), new Cursor(), new Cursor()];

var bombState = 0; // TODO: abstract this to a backbone object 
var activeButton = null;
var activeKnob = null;
var activeWire = null;

var setUpFingerCursors = function() {
	fingerCursors[0].setColor('red');
	fingerCursors[1].setColor('orange');
	fingerCursors[2].setColor('green');
	fingerCursors[3].setColor('blue');
	fingerCursors[4].setColor('purple');
}

var createTable = function(rows, cols) {
	var t = document.createElement("table");
	for (var r = 0; r < rows; r++) {
		rowEle = document.createElement("tr");
		for (var c = 0; c < cols; c++) {
			colEle = document.createElement("td");
			rowEle.appendChild(colEle);
		}
		t.appendChild(rowEle);
	}
	return t;
}

var findIntersectingModule = function(screenPosition) {
	tableOrigin = $("table").offset();
	rows = $("table tr").length;
	cols = $("table tr td").length;

	for (var r = 0; r < rows; r++) {
		rowEle = document.createElement("tr");
		for (var c = 0; c < cols; c++) {

			if (screenPosition[0] > tableOrigin.left + CELL_WIDTH*c
				&& screenPosition[0] < tableOrigin.left + CELL_WIDTH*(c+1)
				&& screenPosition[1] > tableOrigin.top + CELL_WIDTH*r
				&& screenPosition[1] < tableOrigin.top + CELL_WIDTH*(r+1)) {
				return [r, c];
			}
		}
	}
}

var makeTableFromRC = function(r, c) {
	return "tr:nth-child(" + String(r+1) + ") td:nth-child(" + String(c+1) + ")";
}
var setIntersectingModule = function(r, c) {
	$("table tr td").removeClass("active-module");
	$("table " + makeTableFromRC(r, c)).addClass("active-module");
}

var stopIntersectingModule = function() {
	$("table tr td").removeClass("active-module");
}

var addButtonModule = function(parentSelector, r, c, situation) {
	var side = "front";

	if (parentSelector == "#bomb-back") {
		side = "back"
	}

	var buttonModel = new ButtonModule({side: side, row: r, column: c}, {situation: situation, numBatteries: NUM_BATTERIES, litIndicators: LIT_INDICATORS});
	moduleManager.add(buttonModel);
	var buttonView = new ButtonView({model: buttonModel});
	$(parentSelector + " " + makeTableFromRC(r, c)).append(buttonView.el.outerHTML);
}

// TODO: don't hardcode this
var intersectButton = function(intersectingModule, screenPosition) {
	r = intersectingModule[0];
	c = intersectingModule[1];
	origin = $("table " + makeTableFromRC(r , c) + " button").offset();
	if (origin) {
		if (screenPosition[0] > origin.left
			&& screenPosition[0] < origin.left + 150
			&& screenPosition[1] > origin.top 
			&& screenPosition[1] < origin.top + 150) {
			$("table " + makeTableFromRC(r,c) + " button").addClass("hover-btn");
			activeButton = intersectingModule;
			activeKnob = null;
			activeWire = null;
			resetWires();
		} else {
			 $("table " + makeTableFromRC(r,c) + " button").removeClass("hover-btn");
			 activeButton = null;
		}		
	}
}

var clickButton = function() { 
	var done = null;
	r = activeButton[0];
	c = activeButton[1];
	var side = "front";

	if (bombState == 1) {
		side = "back";
	}

	var buttonModel = moduleManager.getModuleAt(side, r, c);
	done = (buttonModel.get("passed") == true || buttonModel.get("passed") == true);

	if (done) {
		return ;
	}

	buttonModel.onButtonPress();

	$("table " + makeTableFromRC(r,c) + " button").addClass("active-btn");
	window.setTimeout(function() {
		$("table " + makeTableFromRC(r,c) + " button").removeClass("active-btn");
		passed = buttonModel.passOrFail(NUM_BATTERIES, LIT_INDICATORS, 500);
	}, 500);

	var buttonColor = buttonModel.get("buttonColor");
	var passed = (buttonModel.get("passed") == true);
	$("table " + makeTableFromRC(r,c) + " button").removeClass(buttonColor);

	if (passed) {
		$("table " + makeTableFromRC(r,c) + " button").addClass("pink");
	} else {
		$("table " + makeTableFromRC(r,c) + " button").addClass("purple");
	}
}

var addKnobModule = function(parentSelector, r, c) {
	d = document.createElement("div");
	k = document.createElement("img");
	k.src = "./images/knob.jpg";
	k.className = "knob-img";
	d.appendChild(k);
	$(parentSelector + " " + makeTableFromRC(r, c)).append(d);
}


// TODO: don't hardcode this
var intersectKnob = function(intersectingModule, screenPosition) {
	r = intersectingModule[0];
	c = intersectingModule[1];
	origin = $("table " + makeTableFromRC(r , c) + " img").offset();
	if (origin) {
		if (screenPosition[0] > origin.left
			&& screenPosition[0] < origin.left + 200
			&& screenPosition[1] > origin.top 
			&& screenPosition[1] < origin.top + 200) {
			$("table " + makeTableFromRC(r,c)).addClass("hover-knob");
			activeKnob = intersectingModule;
			activeButton = null;
			activeWire = null;
			resetWires();
		} else {
			 $("table " + makeTableFromRC(r,c)).removeClass("hover-knob");
			 activeKnob = null;
		}		
	}
}

var rotateKnob = function() {
	r = activeKnob[0];
	c = activeKnob[1];
	//http://stackoverflow.com/questions/8270612/get-element-moz-transformrotate-value-in-jquery
	matrix = $("table " + makeTableFromRC(r,c) + " img").css("transform");
	if(typeof matrix === 'string' && matrix !== 'none') {
        var values = matrix.split('(')[1].split(')')[0].split(',');
        var a = values[0];
        var b = values[1];
        var rotation = Math.round(Math.atan2(b, a) * (180/Math.PI));
    } else { var rotation = 0; }
	rotation += ROTATE_RATE;
	rotation = $("table " + makeTableFromRC(r,c) + " img").css({"transform": 'rotate(' + rotation+ 'deg)'} );	
}

var createWireID = function(r, c, numWire) {
	return "wire-"+String(r)+"-"+String(c)+"-"+String(numWire);
}

// TODO: abstract this out to game state.
var addWireModule = function(parentSelector, r, c, numWires) {
	var wm = document.createElement("div");
	wm.className = "wire-container";
	for (var i=0; i < numWires; i++) {
		var w = document.createElement("div");
		w.className = "wire";
		w.id = createWireID(r, c, i);
		w.style.left = String(30 + (CELL_WIDTH-100)/(numWires-1)*i) + "px";
		wm.appendChild(w);
	}
	$(parentSelector + " " + makeTableFromRC(r, c)).append(wm);
	$(parentSelector + " " + makeTableFromRC(r, c) + " .wire-container").data("numWires", numWires);
}

var WIRE_MARGIN = 10;
// TODO: don't hardcode this
var intersectWire = function(intersectingModule, screenPosition) {
	r = intersectingModule[0];
	c = intersectingModule[1];
	numWires = $("table " + makeTableFromRC(r , c) + " .wire-container").data("numWires");
	if (numWires) {
		for (var i=0; i < numWires; i++) {
			var origin = $("#" + createWireID(r, c, i)).offset();
			if (origin && !$("#" + createWireID(r, c, i)).data("cut")) {
				if (screenPosition[0] > origin.left - WIRE_MARGIN
				&& screenPosition[0] < origin.left + $("#" + createWireID(r, c, i)).width() + WIRE_MARGIN
				&& screenPosition[1] > origin.top - WIRE_MARGIN
				&& screenPosition[1] < origin.top + $("#" + createWireID(r, c, i)).height() + WIRE_MARGIN) {
					$("#" + createWireID(r, c, i)).addClass("hover-wire");
					if (!activeWire || activeWire[0] != r || activeWire[1] != c || activeWire[2] != i) {
						activeWire = [r, c, i];
						activeButton = null;
						activeKnob = null;
						cutting = false;
					}
					return;
				} else {
					$("#" + createWireID(r, c, i)).removeClass("hover-wire");
					$("#" + createWireID(r, c, i)).removeClass("indicate-wire");
				}
			}
		}
		activeWire = null;
	}
}

var resetWires = function() {
	$(".wire").removeClass("hover-wire");
	$(".wire").removeClass("indicate-wire");
}

var indicateCut = function() {
	$("#" + createWireID(activeWire[0], activeWire[1], activeWire[2])).removeClass("hover-wire");	
	$("#" + createWireID(activeWire[0], activeWire[1], activeWire[2])).addClass("indicate-wire");
}

var cancelCut = function() {
	$("#" + createWireID(activeWire[0], activeWire[1], activeWire[2])).removeClass("hover-wire");	
	$("#" + createWireID(activeWire[0], activeWire[1], activeWire[2])).removeClass("indicate-wire");	
}

var cutWire = function() {
	$("#" + createWireID(activeWire[0], activeWire[1], activeWire[2])).removeClass("indicate-wire");	
	$("#" + createWireID(activeWire[0], activeWire[1], activeWire[2])).addClass("cut-wire");
	$("#" + createWireID(activeWire[0], activeWire[1], activeWire[2])).data("cut", true);	
}

/*var clickButton = function() { 
	r = activeButton[0];
	c = activeButton[1];
	$("table " + makeTableFromRC(r,c) + " button").addClass("active-btn");
	window.setTimeout(function() {
		$("table " + makeTableFromRC(r,c) + " button").removeClass("active-btn");
	}, 500);
}*/

var setUpUI = function() {
	// set up cursor
	var c = document.createElement("canvas");
	c.id = "cursor-canvas";
	c.width = window.innerWidth*0.97;
	c.height = window.innerHeight*0.97;
	c.style.position = 'absolute';
	document.body.appendChild(c);

	var ctx = c.getContext('2d');
	cursor.on("change:screenPosition", function(model, position) {
		ctx.clearRect(0,0,c.width,c.height);
		ctx.fillStyle = cursor.color;
		ctx.beginPath();
		ctx.arc(position[0], position[1], 10, 0, 2*Math.PI);
		ctx.fill();
	});

	// set up layout
	//front 
	var d = document.createElement("div");
	d.className = "bomb-side";
	d.id = "bomb-front";
	var t = document.createElement("h1");
	t.innerHTML = "FRONT";
	d.appendChild(t);
	grid = createTable(2, 3);
	grid.className = "module-container";
	d.append(grid);

	//back 
	var d2 = document.createElement("div");
	d2.className = "bomb-side";
	d2.id = "bomb-back";
	var t2 = document.createElement("h1");
	t2.innerHTML = "BACK";
	d2.appendChild(t2);	
	grid2 = createTable(2, 3);
	grid2.className = "module-container";
	d2.append(grid2);

	document.body.append(d);
	document.body.append(d2);

	// add modules to layout
	addButtonModule('#bomb-front', 1, 1, 6);
	addButtonModule('#bomb-back', 1, 2, 4);
	addKnobModule('#bomb-back', 0, 1);
	addWireModule("#bomb-front", 0, 0, 4);
	addWireModule("#bomb-back", 1, 1, 3);

	// hide the back
	$("#bomb-back").hide();

	setUpFingerCursors();
}

setUpUI();

var swiping = false;
var ERROR_TEXT = "ERROROROROR";
// TODO : put this in a helpers 
var vec3Dist = function(vec1, vec2) {
	if (!vec1 || !vec2) {
		return ERROR_TEXT;
	}
	var a = vec1[0]-vec2[0];
	a *= a;
	var b = vec1[1]-vec2[1];
	b *= b;
	var c = vec2[2]-vec2[2];
	c *= c;
	return Math.sqrt(a + b + c);
}

var vec3Magnitude = function(vec) {
	return Math.sqrt(vec[0]*vec[0] + vec[1]*vec[1] + vec[2]*vec[2]);
}

var vec3AngleBetween = function(vec1, vec2) {
	if (!vec1 || !vec2) {
		return 0;
	}
	// dot product = a b cos theta
	var a = vec1[0]*vec2[0];
	var b = vec1[1]*vec2[1];
	var c = vec1[2]*vec2[2];
	var dotProduct = a+b+c;
	var cosTheta = dotProduct/(vec3Magnitude(vec1)*vec3Magnitude(vec2));
	return Math.acos(cosTheta);
}

var pointingFingers = [];
var startDist = null;
var cutting = false;
var cutReset = false;

Leap.loop({hand: function(hand) {
    var handPosition = hand.screenPosition();
    var cursorPosition = [handPosition[0], handPosition[1]+300];

    intersectingModule = findIntersectingModule(cursorPosition);
    if (intersectingModule) {
    	setIntersectingModule(intersectingModule[0], intersectingModule[1]);
    	intersectButton(intersectingModule, cursorPosition);
    	intersectKnob(intersectingModule, cursorPosition);
    	intersectWire(intersectingModule, cursorPosition);

    	// look for cutting
    	// palm position down
    	if ((activeWire) && (Math.abs(hand.roll()) <= 30*Math.PI/180)) {
    		if (cutting) {
    			var currentFingerDist = vec3Dist(hand.finger(pointingFingers[0].id).tipPosition, hand.finger(pointingFingers[1].id).tipPosition);
    			if (currentFingerDist == ERROR_TEXT) {
    				cutting = false;
    				cancelCut();
    			}
    			if ((currentFingerDist <= 30 || (startDist-currentFingerDist)>7)  && activeWire) {
    				console.log("cut");
    				cutting = false;
    				cutWire();
    				cutReset = true;
    				window.setTimeout(function() {
    					cutReset = false;
    				}, 500);
    			}

    		} else {
    			pointingFingers = [];
    			hand.fingers.forEach(function(finger) {
    				if (finger.extended) {
    					pointingFingers.push(finger);
    				}
	  	  		});
    			if (pointingFingers.length == 2 && !cutting && !cutReset) {
    				var currentFingerDist = vec3Dist(pointingFingers[0].tipPosition, pointingFingers[1].tipPosition);
    				if (currentFingerDist >= 32) {
    					startDist = currentFingerDist;
    					cutting = true;
    					indicateCut();
    					console.log("cutting");
    				}
    			} 
    		}
    	} 
    } else {
    	stopIntersectingModule();
    	activeButton = null;
    	activeKnob = null;
    	activeWire = null;
    	resetWires();
    }

    cursor.setScreenPosition(cursorPosition);
   
}, enableGestures: true}, function(frame) {
	if(frame.valid && frame.gestures.length > 0){
	    frame.gestures.forEach(function(gesture){
	        switch (gesture.type){
		        case "circle":
		        	if (activeKnob) {
		            	console.log("Circle Gesture");
		            	rotateKnob();		        		
		        	}
		            break;
		        case "keyTap":
		            //console.log("Key Tap Gesture");
		            if (activeButton) {
		            	console.log("tapping button");
		            	clickButton();
		            }
		            break;
		        case "screenTap":
		            console.log("Screen Tap Gesture");
		            if (activeButton) {
		            	console.log("tapping button");
		            	clickButton();
		            }
		            break;
		        case "swipe":
					//console.log("Swipe Gesture");

					origin = gesture.startPosition;
					pos = gesture.position;
					dist = vec3Dist(origin, pos);
					if (dist > SWIPE_THRESH && !swiping) {
						swiping = true;
						bombState = 1-bombState; //TODO: abstract this away
						if (bombState) {
							$("#bomb-back").show();
							$("#bomb-front").hide();
						} else {
							$("#bomb-back").hide();
							$("#bomb-front").show();
						}
						window.setTimeout(function() {
							swiping = false;
						}, 1000);
						console.log('Swiped!!!!')
					}
					break;
	        }
	    });

	    //	updateFingerLocations(frame);
  }
}).use('screenPosition', {scale: LEAPSCALE});

var updateFingerLocations = function(frame) {
	handsList = frame.hands;
	fingers = handsList[0].fingers;
	for (i=0; i<fingers.length; ++i) {
		fingertipLoc = fingers[i].tipPosition;
		currentFinger = fingerCursors[fingers[i].type];
		currentFinger.setScreenPosition([fingertipLoc[0], fingertipLoc[1]+300]);
	}
}

});