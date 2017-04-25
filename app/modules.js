/** 
 * How to create and display an external template in html page using backbone.js
 * http://stackoverflow.com/questions/19905406/how-to-create-and-display-external-template-in-html-page-using-backbone-js
 */

var GameManager = Backbone.Model.extend({
	defaults: {
		MAX_FAILS: 3,					// bomb explodes upon this many fails
		MAX_TIME: 600,					// num milliseconds player starts with to disarm all modules

		NUM_MODULES: 0,					// num modules in bomb
		NUM_DISARMED_MODULES: 0,		// num modules that have been disarmed
		NUM_FAILED_MODULES: 0			// num modules that player failed at disarming
	},

	/**
	 * Check if game is over.
	 * @return {List<bool>} an array of 2 booleans answering:
	 *		1: is the game over?
	 *		2: did the player win?
	 */
	endGame: function() {
		if (this.get("NUM_FAILED_MODULES") == this.get("MAX_FAILS")) {		// TODO: or if time runs out
			return [true, false];
		} else if (this.get("NUM_MODULES") == this.get("NUM_DISARMED_MODULES") + this.get("NUM_FAILED_MODULES")) {
			return [true, true];
		} else {
			return [false, false];
		}
	}
});

var ModuleManager = Backbone.Collection.extend({
	model: Module,

	/**
	 * Get the module at the specified location.
	 * @param {String} side - one of front or back
	 * @param {int} row - top row is 0, bottom row is 1
	 * @param {int} column - from left to right, columns are numbered 0 to 2
	 * @return {module} the module at the specified location, or null if there is no module at that location
	 */
	getModuleAt: function(side, row, column) {
		var moduleList =  this.where({side: side, row: row, column: column });

		if (moduleList.length > 1) {
			return moduleList[0];
		} else {
			return null;
		}
	}
});

var Module = Backbone.Model.extend({
	defaults: {
		side: null,
		row: null,
		column: null,
		passed: false,
		failed: false
	},

	/**
	 * Tell the module its location is at the specified location.
	 	* Call when initializing a module to place it in the bomb.
	 * @param {String} side - one of front or back
	 * @param {int} row - top row is 0, bottom row is 1
	 * @param {int} column - from left to right, columns are numbered 0 to 2
	 */
	setModuleLocation: function(side, row, column) {
			set({side: side, row: row, column: column});
	}
});

var WiresModule = Module.extend({
	defaults: {
		POSSIBLE_WIRE_COLORS: ["red", "white", "blue", "black", "yellow"],
		MIN_NUM_WIRES: 3,
		MAX_NUM_WIRES: 6,

		wires: []	// wires listed by color from left to right
	},

	/**
	 * Set wires module parameters according to a specified situation in the manual based on number of wires and sub-situation.
	 * Call when setting up bomb modules.
	 * @param {String} side - one of front or back
	 * @param {int} row - top row is 0, bottom row is 1
	 * @param {int} column - from left to right, columns are numbered 0 to 2
	 * @param {int} numWires - the number of wire in the module. 0 means randomly choose a valid number of wires
	 * @param {int} situation - the number corresponding to the sub-situation given the number of wires stated in the manual. 
	 * 		0 means randomly choose a valid situation given number of wires. If situation is invalid given bomb parameters, default to else case.
	 * @param {int} serialNumber - the bomb's serial number
	 */
	initialize: function(side, row, column, numWires, situation, serialNumber) {
		Backbone.Model.Module.prototype.setModuleLocation.call(this, side, row, column);

		if (numWires == 0) {
			numWires = _.random(this.get("MIN_NUM_WIRES"), this.get("MAX_NUM_WIRES"));
		}

		if (situation == 0) {
			if (numWires == 4) {
				situation = _.random(1, 5);
			} else {
				situation = _.random(1, 4);
			}
		}

		var wireSet = [];

		if (numWires == 3) {
			if (situation == 1) {
				var possibleColors = _.without(this.get("POSSIBLE_WIRE_COLORS"), "red");
				wireSet = _.sample(possibleColors, numWires);
			} else if (situation == 2) {
				wireSet = _.sample(this.get("POSSIBLE_WIRE_COLORS"), numWires);
				wireSet[2] = "white";
			} else if (situation == 3) {
				randomWireColorIndex = _.random(0, numWires - 1);
				wireSet = ["blue", "blue", "blue"];
				wireSet[randomWireColorIndex] = _.sample(this.get("POSSIBLE_WIRE_COLORS"));
			} else {
				var possibleColors = this.get("POSSIBLE_WIRE_COLORS");
				var possibleBlueWireIndex = _.random(0, numWires - 1);
				var redWireIndex = _.random(0, numWires - 1);

				for (i=0; i<numWires; ++i) {
					if (i == redWireIndex) {
						wireSet.push("red");
					} else {
						if (i == numWires - 1) {
							possibleColors = _.without(possibleColors, "white");
						}

						if (i != possibleBlueWireIndex) {
							wireSet.push(_.sample(_.without(possibleColors, "blue")));
						} else {
							wireSet.push(_.sample(possibleColors));
						}
					}
				}
			}
		} else if (numWires == 4) {
			if (situation == 1 && serialNumber % 2 == 1) {
				wireSet = _.sample(this.get("POSSIBLE_WIRE_COLORS"), numWires);

				if (!wireSet.includes("red")) {
					wireSet = _.sample(this.get("POSSIBLE_WIRE_COLORS"), numWires);
					var redWireIndex = _.random(0, numWires - 1);
					wireSet[redWireIndex] = "red";
				}
				
				if (wireSet.indexOf("red") == wireSet.lastIndexOf("red")) {
					var redWireIndex = _.sample(_.without(_.range(0, numWires), wireSet.indexOf("red")));
					wireSet[redWireIndex] = "red";
				}
			} else if (situation == 2) {
				wireSet = _.sample(_.without(this.get("POSSIBLE_WIRE_COLORS"), "red"), numWires - 1);
				wireSet.push("yellow");
			} else if (situation == 3) {
				wireSet = _.sample(_.without(this.get("POSSIBLE_WIRE_COLORS"), "blue"), numWires);
				var blueWireIndex = _.random(0, numWires - 1);
				wireSet[blueWireIndex] = "blue";
			} else if (situation == 4) {
				var numYellowWires = _.random(2, numWires);
				wireSet = ["yellow", "yellow", "yellow", "yellow"];

				if (numYellowWires < numWires) {
					var nonYellowWires = _.sample(_.without(this.get("POSSIBLE_WIRE_COLORS"), "yellow"), numWires - numYellowWires);
					var firstNonYellowWireIndex = _.random(0, numWires - 1);
					wireSet[firstNonYellowWireIndex] = nonYellowWires[0];

					if (numYellowWires + 1 < numWires) {
						var secondNonYellowWireIndex = _.sample(_.without(_.range(0, numWires), firstNonYellowWireIndex));
						wireSet[secondNonYellowWireIndex] = nonYellowWires[1];
					}
				}
			} else {
				var numRedWires = 0;
				var numYellowWires = _.random(0, 1);

				if (serialNumber % 2 == 1) {
					numRedWires = _.random(0, 1);
				} else {
					numRedWires = _.random(0, numWires);
				}

				if (numRedWires == numWires) {
					numYellowWires = 0;
				}

				var numOtherWireColors = numWires - numRedWires - numYellowWires;
				var numBlueWires = _.sample(_.without(_.range(0, numOtherWireColors + 1), 1));
				var selectedWireColors = [];
				numOtherWireColors -= numBlueWires;
				
				if (numOtherWireColors >= 1) {
					selectedWireColors = _.sample(_.without(this.get("POSSIBLE_WIRE_COLORS"), "red", "yellow", "blue"), numOtherWireColors);
				}

				for (i=0; i<numWires; ++i) {
					if (i < numRedWires) {
						selectedWireColors.push("red");
					}

					if (i < numYellowWires) {
						selectedWireColors.push("yellow");
					}

					if (i < numBlueWires) {
						selectedWireColors.push("blue");
					}
				}

				var lastColor = null;

				if (numRedWires == 0) {
					lastColor = _.sample(_.without(selectedWireColors, "yellow"));
					selectedWireColors.splice(indexOf(lastColor), 1);
				}

				wireSet = _.shuffle(selectedWireColors);

				if (numRedWires == 0) {
					wireSet.push(lastColor);
				}
			}
		} else if (numWires == 5) {
			if (situation == 1 & serialNumber % 2 == 1) {
				wireSet = _.sample(this.get("POSSIBLE_WIRE_COLORS"), numWires - 1);
				wireSet.push("black");
			} else if (situation == 2) {
				wireSet = _.sample(_.without(this.get("POSSIBLE_WIRE_COLORS"), "red", "yellow"), numWires);
				var numYellowWires = _.random(2, numWires - 1);
				var randomizedIndices = _.shuffle(_.range(0, numWires));

				for (i=0; i<numYellowWires; ++i) {
					wireSet[randomizedIndices[i]] = "yellow";
				}

				wireSet[randomizedIndices[numYellowWires]] = "red";
			} else if (situation == 3) {
				wireSet = _.sample(_.without(this.get("POSSIBLE_WIRE_COLORS"), "black"), numWires);
			} else {
				var numBlackWires = _.random(1, numWires);

				if (serialNumber % 2 == 1) {
					numBlackWires = _.random(1, numWires - 1);
				}

				var numOtherWireColors = numWires - numBlackWires;
				var numRedWires = _.random(0, numOtherWireColors);
				numOtherWireColors -= numRedWires;
				var numYellowWires = _.random(0, numOtherWireColors);

				if (numRedWires == 1 && numOtherWireColors >= 1) {
					numYellowWires = _.random(0, 1);
				}

				numOtherWireColors -= numYellowWires;
				var selectedWireColors = [];
				
				if (numOtherWireColors >= 1) {
					selectedWireColors = _.sample(_.without(this.get("POSSIBLE_WIRE_COLORS"), "red", "yellow", "black"), numOtherWireColors);
				}

				for (i=0; i<numWires; ++i) {
					if (i < numRedWires) {
						selectedWireColors.push("red");
					}

					if (i < numYellowWires) {
						selectedWireColors.push("yellow");
					}

					if (i < numBlackWires) {
						selectedWireColors.push("black");
					}
				}

				var lastColor = null;

				if (serialNumber % 2 == 1) {
					lastColor = _.sample(_.without(selectedWireColors, "black"));
					selectedWireColors.splice(indexOf(lastColor), 1);
				}

				wireSet = _.shuffle(selectedWireColors);

				if (serialNumber % 2 == 1) {
					wireSet.push(lastColor);
				}
			}
		} else {
			numWires = 6;

			if (situation == 1 && serialNumber % 2 == 1) {
				wireSet = _.sample(_.without(this.get("POSSIBLE_WIRE_COLORS"), "yellow"), numWires);
			} else if (situation == 2) {
				wireSet = _.sample(_.without(this.get("POSSIBLE_WIRE_COLORS"), "yellow", "white"), numWires);
				var yellowWireIndex = _.random(0, numWires - 1);
				wireSet[yellowWireIndex] = "yellow";
				var numWhiteWires = _.random(2, numWires - 1);
				var validIndices = _.without(_.range(0, numWires), yellowWireIndex);

				for (i=0; i<numWhiteWires; ++i) {
					var whiteWireIndex = _.sample(validIndices);
					wireSet[whiteWireIndex] = "white";
					validIndices.splice(indexOf(whiteWireIndex), 1);
				}
			} else if (situation == 3) {
				wireSet = _.sample(_.without(this.get("POSSIBLE_WIRE_COLORS"), "red"), numWires);
			} else {
				var numRedWires = _.random(1, numWires);
				var numOtherWireColors = numWires - numRedWires;
				var numYellowWires = _.random(0, numOtherWireColors);

				if (serialNumber % 2 == 1) {
					numYellowWires = _.random(1, numOtherWireColors);
				}

				numOtherWireColors -= numYellowWires;
				var numWhiteWires = _.random(0, numOtherWireColors);

				if (numYellowWires == 1 && numOtherWireColors >= 1) {
					numWhiteWires = _.random(0, 1);
				}

				numOtherWireColors -= numWhiteWires;
				var selectedWireColors = [];
				
				if (numOtherWireColors >= 1) {
					selectedWireColors = _.sample(_.without(this.get("POSSIBLE_WIRE_COLORS"), "red", "yellow", "white"), numOtherWireColors);
				}

				for (i=0; i<numWires; ++i) {
					if (i < numRedWires) {
						selectedWireColors.push("red");
					}

					if (i < numYellowWires) {
						selectedWireColors.push("yellow");
					}

					if (i < numBlackWires) {
						selectedWireColors.push("black");
					}
				}

				wireSet = _.shuffle(selectedWireColors);
			}
		}

		set({wires: wireSet});
	},

	/**
	 * Determine whether the player successfully disarms the wires module.
	 * Call when player cuts a wire.
	 * @param {int} wirePosition - the wire position, zero-indexed starting on the left side of the module
	 * @return {bool} whether the player successfully disarms the module
	 */
	passOrFail: function(wirePosition) {
		var numWires = this.get(wires).length;

		if (numWires == 3) {
			if (!this.get(wires).includes("red")) {
				return wirePosition == 1;
			} else if (_.last(this.get(wires)) == "white") {
				return wirePosition == numWires - 1;
			} else if (this.get(wires).indexOf("blue") != this.get(wires).lastIndexOf("blue")) {
				return wirePosition == this.get(wires).lastIndexOf("blue");
			} else {
				return wirePosition == numWires - 1;
			}
		} else if (numWires == 4) {
			if (this.get(wires).indexOf("red") != this.get(wires).lastIndexOf("red") && serialNumber % 2 == 1) {
				return wirePosition == this.get(wires).lastIndexOf("red");
			} else if (_.last(this.get(wires)) == "yellow" && !this.get(wires).includes("red")) {
				return wirePosition == 0;
			} else if (this.get(wires).indexOf("blue") == this.get(wires).lastIndexOf("blue") && this.get(wires).includes("blue")) {
				return wirePosition == 0;
			} else if (this.get(wires).indexOf("yellow") != this.get(wires).lastIndexOf("yellow")) {
				return wirePosition == numWires - 1;
			} else {
				return wirePosition == 1;
			}
		} else if (numWires == 5) {
			if (_.last(this.get(wires)) == "black" && serialNumber % 2 == 1) {
				return wirePosition == 3;
			} else if (this.get(wires).indexOf("red") == this.get(wires).lastIndexOf("red") && this.get(wires).includes("red") && this.get(wires).indexOf("yellow") != this.get(wires).lastIndexOf("yellow")) {
				return wirePosition == 0;
			} else if (!this.get(wires).includes("black")) {
				return wirePosition == 1;
			} else {
				return wirePosition == 0;
			}
		} else {
			if (!this.get(wires).includes("yellow") && serialNumber % 2 == 1) {
				return wirePosition == 2;
			} else if (this.get(wires).indexOf("yellow") == this.get(wires).lastIndexOf("yellow") && this.get(wires).includes("yellow") && this.get(wires).indexOf("white") != this.get(wires).lastIndexOf("white")) {
				return wirePosition == 3;
			} else if (!this.get(wires).includes("red")) {
				return wirePosition == numWires - 1;
			} else {
				return wirePosition == 3;
			}
		}
	}
});

var WiresView = Backbone.View.extend({
	tagName: 'div',
	className: 'wireModule',

	initialize: function() {
		this.render();
	},

	render: function() {

	}
});

var ButtonModule = Module.extend({
	defaults: {
		POSSIBLE_BUTTON_COLORS: ["red", "yellow", "blue", "white", "green"],
		POSSIBLE_BUTTON_LABELS: ["abort", "detonate", "hold"],
		POSSIBLE_STRIP_COLORS: ["blue", "white", "yellow", "red", "green"],
		HOLD_BUFFER_TIME: 500, // time in ms between initial button press and considering the press as a hold action

		buttonColor: "none",
		buttonLabel: "none",
		stripColor: "none",
		pressStartTime: "none"
	},

	/**
	 * Set button module parameters according to a specified situation in the manual.
	 * Call when setting up bomb modules.
	 * @param {String} side - one of front or back
	 * @param {int} row - top row is 0, bottom row is 1
	 * @param {int} column - from left to right, columns are numbered 0 to 2
	 * @param {int} situation - the number corresponding to the button parameters stated in the manual. 
	 * 		0 means randomly choose a situation. If situation is invalid given bomb parameters, default to else case.
	 * @param {int} numBatteries - the number of batteries on the bomb
	 * @param {List<String>} litIndicators - a list of indicator labels on the bomb that are lit
	 */
	initialize: function(side, row, column, situation, numBatteries, litIndicators) {
		Backbone.Model.Module.prototype.setModuleLocation.call(this, side, row, column);

		if (situation == 0) {
			situation = _.random(1, 7); 
		}

		if (situation == 1) {
			set({buttonColor: "blue", buttonLabel: "abort"});
		} else if (situation == 2 && numBatteries > 1) {
			set({buttonLabel: "detonate"});
		} else if (situation == 3 && litIndicators.includes("car")) {
			set({buttonColor: "white"});
		} else if (situation == 4 && numBatteries > 2 && litIndicators.includes("frk")) {
			
		} else if (situation == 5) {
			set({buttonColor: "yellow"});
		} else if (situation == 6) {
			set({buttonColor: "red", buttonLabel: "hold"});
		} else {
			set({buttonColor: _.sample(this.get("POSSIBLE_BUTTON_COLORS"))});
			var possibleLabels = this.get("POSSIBLE_BUTTON_LABELS");

			if (get(buttonColor) == "blue") {
				possibleLabels = _.without(this.get("POSSIBLE_BUTTON_LABELS"), "abort");
			} 

			if (numBatteries > 1) {
				possibleLabels = _.without(this.get("POSSIBLE_BUTTON_LABELS"), "detonate");
			}

			if (get(buttonColor) == "red") {
				possibleLabels = _.without(this.get("POSSIBLE_BUTTON_LABELS"), "hold");
			}

			set({buttonLabel: _.sample(possibleLabels)});
		}

		if (get(buttonColor) == "none") {
			set({buttonColor: _.sample(this.get("POSSIBLE_BUTTON_COLORS"))});
		}

		if (get(buttonLabel) == "none") {
			set({buttonLabel: _.sample(this.get("POSSIBLE_BUTTON_LABELS"))});
		}
	},

	/**
	 * Set the time at which the button was pressed.
	 * Call when button is pressed.
	 */
	onButtonPress: function() {
		var d = new Date();
		set({pressStartTime: d.getTime()});
	},

	/**
	 * Light up the colored strip on the right side of the module.
	 * Call when button is pressed and held (and should be held to disarm).
	 * Wait HOLD_BUFFER_TIME between player press before calling this function.
	 * @param {String} color - the color that the indicator should be
	 */
	onButtonHold: function(color) {
		set({stripColor: color});
	},

	/**
	 * Determine whether the player successfully disarms module when releasing a held button.
	 * Call when the player releases the held button.
	 * @param {String}	countdownTimerValue - the value on the countdown timer when the player releases a held button
	 * @return {bool} whether the player successfully disarms the bomb
	 */
	onHeldButtonRelease: function(countdownTimerValue) {
		if (this.get("stripColor") == "blue" && countdownTimerValue.contains("4")) {
			return true;
		} else if (this.get("stripColor") == "white" && countdownTimerValue.contains("1")) {
			return true;
		} else if (this.get("stripColor") == "yellow" && countdownTimerValue.contains("5")) {
			return true;
		} else if (countdownTimerValue.contains("1")) {
			return true;
		} else {
			return false;
		}
	},

	/**
	 * Determine whether the player successfully disarms the button module.
	 * Call when player releases the button.
	 * @param {int} numBatteries - the number of batteries on the bomb
	 * @param {List<String>} litIndicators - a list of indicator labels on the bomb that are lit
	 * @param {String} countdownTimerValue - the value on the countdown timer when the player releases the button
	 * @return {bool} whether the player successfully disarms the module
	 */
	passOrFail: function(numBatteries, litIndicators, countdownTimerValue) {
		var d = new Date();
		var timePressed = d.getTime() - this.get("pressStartTime");

		if (this.get("buttonColor") == "blue" && this.get("buttonLabel") == "abort") {
			if (timePressed > this.get("HOLD_BUFFER_TIME")) {
				return this.onHeldButtonRelease(countdownTimerValue);
			}
		} else if (numBatteries > 1 && this.get("buttonLabel") == "detonate") {
			return timePressed < this.get("HOLD_BUFFER_TIME");
		} else if (this.get("buttonColor") == "white" && litIndicators.includes("car")) {
			if (timePressed > this.get("HOLD_BUFFER_TIME")) {
				return this.onHeldButtonRelease(countdownTimerValue);
			}
		} else if (numBatteries > 2 && litIndicators.includes("frk")) {
			return timePressed < this.get("HOLD_BUFFER_TIME");
		} else if (this.get("buttonColor") == "yellow") {
			if (timePressed > this.get("HOLD_BUFFER_TIME")) {
				return this.onHeldButtonRelease(countdownTimerValue);
			}
		} else if (this.get("buttonColor") == "red" && this.get("buttonLabel") == "hold") {
			return timePressed < this.get("HOLD_BUFFER_TIME");
		} else {
			if (timePressed > this.get("HOLD_BUFFER_TIME")) {
				return this.onHeldButtonRelease(countdownTimerValue);
			}
		}

		return false;
	}
});

var ButtonView = Backbone.View.extend({
	tagName: 'div',
	className: 'buttonModule',

	initialize: function() {
		this.render();
	},

	render: function() {
		$.get('/templates/view_templates.html', function (data) {
            template = _.template(data, {  });
            this.$el.html(template);  
        }, 'html');
	}
});

/*
var KeypadModule = Module.extend({});

var SimonSaysModule = Module.extend({});

var WhosOnFirstModule = Module.extend({});

var MemoryModule = Module.extend({});

var MorseCodeModule = Module.extend({});

var ComplicatedWiresModule = Module.extend({});

var WireSequencesModule = Module.extend({});

var MazesModule = Module.extend({});

var PasswordsModule = Module.extend({});

var VentingGasModule = Module.extend({});

var CapacitatorDischargeModule = Module.extend({});

var KnobsModule = Module.extend({});
*/