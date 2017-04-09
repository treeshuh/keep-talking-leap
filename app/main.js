$(document).on('ready', function() {
LEAPSCALE = 0.6;
var cursor = new Cursor();

var setUpUI = function() {
	var c = document.createElement("canvas");
	c.id = "cursor-canvas";
	c.width = window.innerWidth;
	c.height = window.innerHeight;
	document.body.appendChild(c);

	var ctx = c.getContext('2d');
	cursor.on("change:screenPosition", function(model, position) {
		ctx.clearRect(0,0,c.width,c.height);
		ctx.fillStyle = cursor.color;
		ctx.beginPath();
		ctx.arc(position[0], position[1], 10, 0, 2*Math.PI);
		ctx.fill();
	});
}

setUpUI();

Leap.loop({hand: function(hand) {
    var handPosition = hand.screenPosition();
    var cursorPosition = [handPosition[0], handPosition[1]+300];

    cursor.setScreenPosition(cursorPosition);
}}).use('screenPosition', {scale: LEAPSCALE});
});