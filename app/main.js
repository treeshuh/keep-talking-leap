$(document).on('ready', function() {
var LEAPSCALE = 0.6;
var SWIPE_THRESH = 100;
var CELL_WIDTH = 300;
var ERROR_TEXT = "ERROROROROR";

var NUM_BATTERIES = 4;
var LIT_INDICATORS = ["frk"];
var SERIAL_NUMBER = 31415;
var moduleManager = new ModuleManager();
var bombModel = new BombModel();

var cursor = new Cursor();
var fingerCursors = [new Cursor(), new Cursor(), new Cursor(), new Cursor(), new Cursor()];
var swiping = false;
var pointingFingers = [];
var startDist = null;
var cutReset = false;

/* HELPERS */
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


var setUpFingerCursors = function() {
	fingerCursors[0].setColor('red');
	fingerCursors[1].setColor('orange');
	fingerCursors[2].setColor('green');
	fingerCursors[3].setColor('blue');
	fingerCursors[4].setColor('purple');
}

var updateFingerLocations = function(frame) {
	handsList = frame.hands;
	fingers = handsList[0].fingers;
	for (i=0; i<fingers.length; ++i) {
		fingertipLoc = fingers[i].tipPosition;
		currentFinger = fingerCursors[fingers[i].type];
		currentFinger.setScreenPosition([fingertipLoc[0], fingertipLoc[1]+300]);
	}
}


var findIntersectingModule = function(screenPosition) {
	var tableOrigin = $("#bomb-front").offset();
	
	if (bombModel.getSide() == 1) {
		var tableOrigin = $("#bomb-back").offset();
	}

	rows = $("table tr").length;
	cols = $("table tr td").length;
	
	for (var r = 0; r < rows; r++) {
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


/* UI SET UP */
var addWireModule = function(parentSelector, r, c, numWires, situation) {
	var side = 0;

	if (parentSelector == "#bomb-back") {
		side = 1;
	}

	var wiresModel = new WiresModule({side: side, row: r, column: c}, {numWires: numWires, situation: situation, serialNumber: SERIAL_NUMBER});
	moduleManager.add(wiresModel);
	var wiresView = new WiresView({model: wiresModel, cellWidth: CELL_WIDTH});
	$(parentSelector + " " + makeTableFromRC(r, c)).html(wiresView.el);
}

var addButtonModule = function(parentSelector, r, c, situation) {
	var side = 0;

	if (parentSelector == "#bomb-back") {
		side = 1;
	}

	var buttonModel = new ButtonModule({side: side, row: r, column: c}, {situation: situation, numBatteries: NUM_BATTERIES, litIndicators: LIT_INDICATORS});
	moduleManager.add(buttonModel);
	var buttonView = new ButtonView({model: buttonModel});
	$(parentSelector + " " + makeTableFromRC(r, c)).html(buttonView.el);
}

var addKnobModule = function(parentSelector, r, c, situation) {
	var side = 0;

	if (parentSelector == "#bomb-back") {
		side = 1;
	}

	var knobsModel = new KnobsModule({side: side, row: r, column: c}, {situation: situation});
	moduleManager.add(knobsModel);
	var knobsView = new KnobsView({model: knobsModel});
	$(parentSelector + " " + makeTableFromRC(r, c)).html(knobsView.el);
}

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
		ctx.fillStyle = cursor.get("color");
		ctx.beginPath();
		ctx.arc(position[0], position[1], 10, 0, 2*Math.PI);
		ctx.fill();
	});

	// set up layout
	var bombFrontView = new BombSideView({id: "bomb-front", idText: "FRONT", model: bombModel});
	var bombBackView = new BombSideView({id: "bomb-back", idText: "BACK", model: bombModel});
	document.body.append(bombFrontView.el);
	document.body.append(bombBackView.el);

	// add modules to layout
	addWireModule("#bomb-front", 0, 0, 4, 1);
	addWireModule("#bomb-back", 1, 1, 3, 2);
	addButtonModule('#bomb-front', 1, 1, 6);
	addButtonModule('#bomb-back', 1, 2, 4);
	addKnobModule('#bomb-back', 0, 1, 0);

	// Display the front of the bomb and hide the back
	bombFrontView.display();
	bombBackView.display();

	setUpFingerCursors();
}


/* MAIN */
setUpUI();

Leap.loop({hand: function(hand) {
    var handPosition = hand.screenPosition();
    var cursorPosition = [handPosition[0]-100, handPosition[1]+300];

    intersectingModule = findIntersectingModule(cursorPosition);

    if (intersectingModule) {
    	var side = bombModel.getSide();
    	var row = intersectingModule[0];
    	var column = intersectingModule[1];
    	moduleManager.startIntersectingModule(side, row, column, cursorPosition);

    	// look for cutting
    	// palm position down
    	var currentModule = moduleManager.getModuleAt(side, row, column);
    	var activeWire = null;

    	if (currentModule) {
    		activeWire = currentModule.get("activeWire");
    	}

    	var pointingFingers = [];
    	hand.fingers.forEach(function(finger) {
    		if (finger.extended) {
    			pointingFingers.push(finger);
    		}
	  	});

    	if (activeWire != null && (Math.abs(hand.roll()) <= 30*Math.PI/180)) {
    		if (!currentModule.get("cuttingWire")) {
    			if (pointingFingers.length == 2 && !cutReset) {
    				var currentFingerDist = vec3Dist(pointingFingers[0].tipPosition, pointingFingers[1].tipPosition);
    				currentModule.set({cuttingWire: true});
    				
    				if (currentFingerDist >= 32) {
    					startDist = currentFingerDist;
    				}
    			}
    		} else {
    			if (pointingFingers.length == 2) {
	    			var currentFingerDist = vec3Dist(hand.finger(pointingFingers[0].id).tipPosition, hand.finger(pointingFingers[1].id).tipPosition);

	    			if (currentFingerDist == ERROR_TEXT) {
	    				currentModule.set({cuttingWire: false});
	    				currentModule.onStopHoverOne(activeWire);
	    			}

	    			if ((startDist-currentFingerDist)>7) {
	    				currentModule.cutWire();
	    				cutReset = true;
	    				window.setTimeout(function() {
	    					cutReset = false;
	    				}, 500);
	    			}
	    		} else {
	    			currentModule.set({cuttingWire: false});
	    		}
    		}
    	}
    } else {
    	moduleManager.stopIntersectingModules();
    }

    cursor.setScreenPosition(cursorPosition);
}, enableGestures: true}, function(frame) {
	if(frame.valid && frame.gestures.length > 0){
	    frame.gestures.forEach(function(gesture){
	        switch (gesture.type){
		        case "circle":
	            	// https://developer.leapmotion.com/documentation/javascript/api/Leap.CircleGesture.html
	            	var clockwise = false;
					var pointableID = gesture.pointableIds[0];
					var direction = frame.pointable(pointableID).direction;
					var dotProduct = Leap.vec3.dot(direction, gesture.normal);

					if (dotProduct  >  0) {
						clockwise = true;
					}

	            	moduleManager.onCircle(clockwise);
		            break;
		        case "keyTap":
		            moduleManager.onKeyTap();
		            break;
		        case "screenTap":
		            moduleManager.onScreenTap();
		            break;
		        case "swipe":
		        	console.log("Swipe Gesture");
					origin = gesture.startPosition;
					pos = gesture.position;
					dist = vec3Dist(origin, pos);

					if (dist > SWIPE_THRESH && !swiping) {
						swiping = true;
						bombModel.changeSides();

						window.setTimeout(function() {
							swiping = false;
						}, 1000);
						console.log('Swiped!!!!')
					}

					break;
	        }
	    });

	    updateFingerLocations(frame);
  }
}).use('screenPosition', {scale: LEAPSCALE});

});