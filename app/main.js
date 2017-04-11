$(document).on('ready', function() {
LEAPSCALE = 0.6;
SWIPE_THRESH = 100;
var cursor = new Cursor();

var bombState = 0; // TODO: abstract this to a backbone object 

var setUpUI = function() {
	// set up cursor
	var c = document.createElement("canvas");
	c.id = "cursor-canvas";
	c.width = window.innerWidth;
	c.height = window.innerHeight;
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

	// set up modules
	var t = document.createElement("h1");
	t.id = "bombstate-tag";
	t.innerHTML = "FRONT";
	document.body.appendChild(t);
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
							$("#bombstate-tag").text("BACK");
						} else {
							$("#bombstate-tag").text("FRONT");
						}
						window.setTimeout(function() {
							swiping = false;
						}, 1000);
						console.log('Swiped!!!!')
					}
					break;
	        }
	    });
  }
}).use('screenPosition', {scale: LEAPSCALE});
});