$(document).on('ready', function() {
LEAPSCALE = 0.6;
SWIPE_THRESH = 100;
CELL_WIDTH = 300;
var cursor = new Cursor();
var fingerCursors = [new Cursor(), new Cursor(), new Cursor(), new Cursor(), new Cursor()];

var bombState = 0; // TODO: abstract this to a backbone object 

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

var addButtonModule = function(parentSelector, r, c) {
	b = document.createElement("button");
	b.innerHTML = "Press ME!";
	b.className = "circle-btn";
	$(parentSelector + " " + makeTableFromRC(r, c)).append(b);
}

/*// TODO: don't hardcode this
var intersectButton = function(intersectingModule, screenPosition) {
	if (intersectingModule[0] == 1 && intersectingModule[1] == 1) {
		if (screenPosition[0] > tableOrigin.left + CELL_WIDTH*c
			&& screenPosition[0] < tableOrigin.left + CELL_WIDTH*(c+1)
			&& screenPosition[1] > tableOrigin.top + CELL_WIDTH*r
			&& screenPosition[1] < tableOrigin.top + CELL_WIDTH*(r+1)) {
			return [r, c];
		}		
	}
}*/

var addKnobModule = function(parentSelector, r, c) {

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
	addButtonModule('#bomb-front', 1, 1);
	addKnobModule('#bomb-back', 2, 1);

	// hide the back
	$("#bomb-back").hide();

	setUpFingerCursors();
}

setUpUI();

var swiping = false;

// TODO : put this in a helpers 
var vec3Dist = function(vec1, vec2) {
	a = vec1[0]-vec2[0];
	a *= a;
	b = vec1[1]-vec2[1];
	b *= b;
	c = vec2[2]-vec2[2];
	c *= c;
	return Math.sqrt(a + b + c);
}

Leap.loop({hand: function(hand) {
    var handPosition = hand.screenPosition();
    var cursorPosition = [handPosition[0], handPosition[1]+300];

    intersectingModule = findIntersectingModule(cursorPosition);
    if (intersectingModule) {
    	setIntersectingModule(intersectingModule[0], intersectingModule[1]);
    } else {
    	stopIntersectingModule();
    }

    cursor.setScreenPosition(cursorPosition);
   
}, enableGestures: true}, function(frame) {
	if(frame.valid && frame.gestures.length > 0){
	    frame.gestures.forEach(function(gesture){
	        switch (gesture.type){
/*		        case "circle":
		            console.log("Circle Gesture");
		            break;
		        case "keyTap":
		            console.log("Key Tap Gesture");
		            break;
		        case "screenTap":
		            console.log("Screen Tap Gesture");
		            break;*/
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