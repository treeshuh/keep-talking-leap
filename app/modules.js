var Module = Backbone.Model.extend({
	defaults: {
		side: null,
		row: null,
		column: null,
		passed: false,
		failed: false,
		active: false,
		hoverPosition: null,
		activeWire: null 		// all modules have this because to check for cutting motion, we need to know if a wire is active in the active module
	},

	onCircle: function(clockwise) {},

	onKeyTap: function() {},

	onScreenTap: function() {},

	/**
	 * Get the active wire index, counting from left to right.
	 * @return {int} the index off the current active wire, counting form left to right, or null if no wire is active
	 */
	getActiveWire: function() {
		return this.get("activeWire");
	},
});

var ModuleView = Backbone.View.extend({
	/**
	 * Change the view to reflect the module's activeness.
	 */
	changeActive: function() {
		var active = this.model.get("active");

		if (active) {
			this.$el.parent().addClass("active-module");
		} else {
			this.$el.parent().removeClass("active-module");
		}
	},

	onPass: function() {
		this.$el.parent().addClass("module-success");
	},

	onFail: function() {
		this.$el.parent().addClass("module-fail");
	}
});

var BombModel = Backbone.Model.extend({
	defaults: {
		side: 0		// 0 is front, 1 is back
	},

	changeSides: function() {
		var side = this.getSide();
		this.set({side: 1-side});
	},

	getSide: function() {
		return this.get("side");
	}
});

var BombSideView = Backbone.View.extend({
	tagName: "div",
	className: "bomb-side",
	template: _.template($("#bombSideTemplate").html()),

	initialize: function(attributes) {
		this.id = attributes.id;
		this.idText = attributes.idText;

		this.listenTo(this.model, "change:side", this.display);

		return this.render();
	},
	
	render: function() {
		this.$el.html(this.template({idText: this.idText}));

		return this.el;
	},

	display: function() {
		if (this.id == "bomb-front" && this.model.getSide() == 0) {
			this.$el.show();
		} else if (this.id == "bomb-back" && this.model.getSide() == 1) {
			this.$el.show();
		} else {
			this.$el.hide();
		}
	}
});

var ModuleManager = Backbone.Collection.extend({
	model: Module,

	/**
	 * Get the module at the specified location.
	 * @param {int} side - front is 0, back is 1
	 * @param {int} row - top row is 0, bottom row is 1
	 * @param {int} column - from left to right, columns are numbered 0 to 2
	 * @return {module} the module at the specified location, or null if there is no module at that location
	 */
	getModuleAt: function(side, row, column) {
		return this.findWhere({side: side, row: row, column: column});
	},

	/**
	 * Make the module at the specified location active and activate hover on it. Make all other active modules inactive and deactivate hover on them.
	 * @param {int} side - front is 0, back is 1
	 * @param {int} row - top row is 0, bottom row is 1
	 * @param {int} column - from left to right, columns are numbered 0 to 2
	 * @param {List<float>} screenPosition - screen position of cursor
	 */
	startIntersectingModule: function(side, row, column, screenPosition) {
		var activeModule = this.findWhere({active: true});

		if (activeModule) {
			if (activeModule.get("side") == side && activeModule.get("row") == row && activeModule.get("column") == column) {
				activeModule.set({hoverPosition: screenPosition});
				return ;
			} else {
				activeModule.set({hoverPosition: null});
			}
		}

		this.stopIntersectingModules();
		var newlyActiveModule = this.getModuleAt(side, row, column);

		if (newlyActiveModule) {
			newlyActiveModule.set({active: true, hoverPosition: screenPosition});
		}
	},

	/**
	 * Make all active modules inactive.
	 */
	stopIntersectingModules: function() {
		var activeModules = this.where({active: true});

		if (activeModules.length > 0) {
			for (var i=0; i<activeModules.length; ++i) {
				activeModules[i].set({active: false});
			}
		}
	},

	onCircle: function(clockwise) {
		var activeModule = this.findWhere({active: true});

		if (activeModule) {
			activeModule.onCircle(clockwise);
		}
	},

	onKeyTap: function() {
		var activeModule = this.findWhere({active: true});

		if (activeModule) {
			activeModule.onKeyTap();
		}
	},

	onScreenTap: function() {
		var activeModule = this.findWhere({active: true});

		if (activeModule) {
			activeModule.onScreenTap();
		}
	},

	/**
	 * Check if game is over.
	 * @param {int} currentTime - number of ms since game started
	 * @return {List<bool>} an array of 2 booleans answering:
	 *		1: is the game over?
	 *		2: did the player win?
	 */
	endGame: function(currentTime) {
		MAX_FAILS = 3;		// bomb explodes upon this many fails
		MAX_TIME = 600;		// num ms player starts with to disarm all modules
		num_disarmed_modules = this.where({ passed: true }).length;
		num_failed_modules = this.where({ failed: true }).length;

		if (num_failed_modules == MAX_FAILS || currentTime > MAX_TIME) {
			return [true, false];
		} else if (this.length == num_disarmed_modules + num_failed_modules) {
			return [true, true];
		} else {
			return [false, false];
		}
	}
});

var WiresModule = Module.extend({
	defaults: {
		POSSIBLE_WIRE_COLORS: ["red", "white", "blue", "black", "yellow"],
		MIN_NUM_WIRES: 3,
		MAX_NUM_WIRES: 6,

		wires: [],		// wires listed by color from left to right
		cutWires: [],	// is the wire at the corresponding index cut?
		cuttingWire: false 	// is the hand in position to cut the wire?
	},

	/**
	 * Set wires module parameters according to a specified situation in the manual based on number of wires and sub-situation.
	 * Call when setting up bomb modules.
	 * @param {String} attributes.side - one of front or back
	 * @param {int} attributes.row - top row is 0, bottom row is 1
	 * @param {int} attributes.column - from left to right, columns are numbered 0 to 2
	 * @param {int} options.numWires - the number of wire in the module. 0 means randomly choose a valid number of wires
	 * @param {int} options.situation - the number corresponding to the sub-situation given the number of wires stated in the manual. 
	 * 		0 means randomly choose a valid situation given number of wires. If situation is invalid given bomb parameters, default to else case.
	 * @param {int} options.serialNumber - the bomb's serial number
	 */
	initialize: function(attributes, options) {
		this.set({side: attributes.side, row: attributes.row, column: attributes.column});
		numWires = options.numWires;
		situation = options.situation;
		serialNumber = options.serialNumber;

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
			this.set({cutWires: [false, false, false]});

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

				for (var i=0; i<numWires; ++i) {
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
			this.set({cutWires: [false, false, false, false]});

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

				for (var i=0; i<numWires; ++i) {
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
			this.set({cutWires: [false, false, false, false, false]});

			if (situation == 1 & serialNumber % 2 == 1) {
				wireSet = _.sample(this.get("POSSIBLE_WIRE_COLORS"), numWires - 1);
				wireSet.push("black");
			} else if (situation == 2) {
				wireSet = _.sample(_.without(this.get("POSSIBLE_WIRE_COLORS"), "red", "yellow"), numWires);
				var numYellowWires = _.random(2, numWires - 1);
				var randomizedIndices = _.shuffle(_.range(0, numWires));

				for (var i=0; i<numYellowWires; ++i) {
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

				for (var i=0; i<numWires; ++i) {
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
			this.set({cutWires: [false, false, false, false, false, false]});

			if (situation == 1 && serialNumber % 2 == 1) {
				wireSet = _.sample(_.without(this.get("POSSIBLE_WIRE_COLORS"), "yellow"), numWires);
			} else if (situation == 2) {
				wireSet = _.sample(_.without(this.get("POSSIBLE_WIRE_COLORS"), "yellow", "white"), numWires);
				var yellowWireIndex = _.random(0, numWires - 1);
				wireSet[yellowWireIndex] = "yellow";
				var numWhiteWires = _.random(2, numWires - 1);
				var validIndices = _.without(_.range(0, numWires), yellowWireIndex);

				for (var i=0; i<numWhiteWires; ++i) {
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

				for (var i=0; i<numWires; ++i) {
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

		this.set({wires: wireSet});
	},

	/**
	 * Determine whether the player successfully disarms the wires module.
	 * Call when player cuts a wire.
	 * @param {int} wirePosition - the wire position, zero-indexed starting on the left side of the module
	 */
	passOrFail: function(wirePosition) {
		var numWires = this.get(wires).length;
		var passed = false;

		if (numWires == 3) {
			if (!this.get(wires).includes("red")) {
				passed = (wirePosition == 1);
			} else if (_.last(this.get(wires)) == "white") {
				passed = (wirePosition == numWires - 1);
			} else if (this.get(wires).indexOf("blue") != this.get(wires).lastIndexOf("blue")) {
				passed = (wirePosition == this.get(wires).lastIndexOf("blue"));
			} else {
				passed = (wirePosition == numWires - 1);
			}
		} else if (numWires == 4) {
			if (this.get(wires).indexOf("red") != this.get(wires).lastIndexOf("red") && serialNumber % 2 == 1) {
				passed = (wirePosition == this.get(wires).lastIndexOf("red"));
			} else if (_.last(this.get(wires)) == "yellow" && !this.get(wires).includes("red")) {
				passed = (wirePosition == 0);
			} else if (this.get(wires).indexOf("blue") == this.get(wires).lastIndexOf("blue") && this.get(wires).includes("blue")) {
				passed = (wirePosition == 0);
			} else if (this.get(wires).indexOf("yellow") != this.get(wires).lastIndexOf("yellow")) {
				passed = (wirePosition == numWires - 1);
			} else {
				passed = (wirePosition == 1);
			}
		} else if (numWires == 5) {
			if (_.last(this.get(wires)) == "black" && serialNumber % 2 == 1) {
				passed = (wirePosition == 3);
			} else if (this.get(wires).indexOf("red") == this.get(wires).lastIndexOf("red") && this.get(wires).includes("red") && this.get(wires).indexOf("yellow") != this.get(wires).lastIndexOf("yellow")) {
				passed = (wirePosition == 0);
			} else if (!this.get(wires).includes("black")) {
				passed = (wirePosition == 1);
			} else {
				passed = (wirePosition == 0);
			}
		} else {
			if (!this.get(wires).includes("yellow") && serialNumber % 2 == 1) {
				passed = (wirePosition == 2);
			} else if (this.get(wires).indexOf("yellow") == this.get(wires).lastIndexOf("yellow") && this.get(wires).includes("yellow") && this.get(wires).indexOf("white") != this.get(wires).lastIndexOf("white")) {
				passed = (wirePosition == 3);
			} else if (!this.get(wires).includes("red")) {
				passed = (wirePosition == numWires - 1);
			} else {
				passed =  (wirePosition == 3);
			}
		}

		if (passed) {
			this.set({passed: true});
		} else {
			this.set({failed: true});
		}
	},

	cutWire: function() {
		var activeWireIndex = this.getActiveWire();
		wireCuts = this.get("cutWires").slice();
		wireCuts[activeWireIndex] = true;
		this.set({cuttingWire: false, cutWires: wireCuts});
	}
});

var WiresView = ModuleView.extend({
	tagName: 'div',
	className: 'module wiresModule wire-container',
	template: _.template($("#wiresTemplate").html()),
	model: "none",
	attributes: {
		WIRE_MARGIN: 10
	},

	initialize: function(attributes) {
		this.model = attributes.model;
		this.attributes.cellWidth = attributes.cellWidth;
		var wireColors = this.model.get("wires");
		var numWires = wireColors.length;
		var emptySpace = this.attributes.cellWidth - numWires * this.attributes.WIRE_MARGIN;
		var spaceBetween = emptySpace / (numWires + 1);
		console.log(spaceBetween);

		for (var i=0; i<numWires; ++i) {
			var wire = document.createElement("div");
			wire.className = "wire " + wireColors[i];
			wire.id = this.createWireID(i);			
			wire.style.left = String(spaceBetween + (spaceBetween+this.attributes.WIRE_MARGIN)*i) + "px";
			this.el.append(wire);
		}

		this.listenTo(this.model, "change:active", this.changeActive);
		this.listenTo(this.model, "change:passed", this.onPass);
		this.listenTo(this.model, "change:failed", this.onFail);
		this.listenTo(this.model, "change:hoverPosition", this.onHover);
		this.listenTo(this.model, "change:cuttingWire", this.onIndicateCut)
		this.listenTo(this.model, "change:cutWires", this.onWireCut);

		return this.render();
	},

	render: function() {
		return this.el;
	},

	/**
	 * On hover, highlight module and wire as appropriate.
	 */
	onHover: function() {
		var screenPosition = this.model.get("hoverPosition");
		var cutWires = this.model.get("cutWires");
		var numWires = cutWires.length;
		var activeWireIndex = this.model.get("activeWire");

		for (var i=0; i<numWires; ++i) {
			var origin = $("#" + this.createWireID(i)).offset();

			if (origin && !cutWires[i] && screenPosition) {
				if (screenPosition[0] > origin.left - this.attributes.WIRE_MARGIN
					&& screenPosition[0] < origin.left + $("#" + this.createWireID(i)).width() + this.attributes.WIRE_MARGIN
					&& screenPosition[1] > origin.top - this.attributes.WIRE_MARGIN
					&& screenPosition[1] < origin.top + $("#" + this.createWireID(i)).height() + this.attributes.WIRE_MARGIN) {
					if (activeWireIndex != i && !this.model.get("cuttingWire")) {
						if (activeWireIndex) {
							this.onStopHoverOne(activeWireIndex);
						}
						
						this.model.set({activeWire: i});
						$("#" + this.createWireID(i)).addClass("hover-wire");
					}
				} else {
					if (activeWireIndex == i) {
						this.model.set({activeWire: null, cuttingWire: false});
						this.onStopHoverOne(activeWireIndex);
					}
				}
			}
		}
	},

	onStopHoverOne: function(wireNumber) {
		$("#" + this.createWireID(wireNumber)).removeClass("hover-wire");
		$("#" + this.createWireID(wireNumber)).removeClass("indicate-wire");
	},

	onStopHover: function() {
		this.model.set({activeWire: null});
		$(".wire").removeClass("hover-wire");
		$(".wire").removeClass("indicate-wire");
	},

	onIndicateCut: function() {
		var activeWireIndex = this.model.get("activeWire");

		if (activeWireIndex != null && this.model.get("cuttingWire")) {
			$("#" + this.createWireID(activeWireIndex)).removeClass("hover-wire");	
			$("#" + this.createWireID(activeWireIndex)).addClass("indicate-wire");
		} else if (!this.model.get("cuttingWire")) {
			$("#" + this.createWireID(activeWireIndex)).removeClass("indicate-wire");
			$("#" + this.createWireID(activeWireIndex)).addClass("hover-wire");
		}
	},

	onWireCut: function() {
		var wires = this.model.get("cutWires");

		for (var i=0; i<wires.length; ++i) {
			if (wires[i] == true) {
				$("#" + this.createWireID(i)).removeClass("indicate-wire");
				$("#" + this.createWireID(i)).removeClass("hover-wire");				
				$("#" + this.createWireID(i)).addClass("cut-wire");
			}
		}
	},

	/**
	 * Create id for wire given the row and column of the module and the wire number within the module counting from left to right.
	 * @param {int} wireNumber - the wire number within the module
	 * @return {String} the wire id
	 */
	createWireID: function(wireNumber) {
		var row = this.model.get("row");
		var column = this.model.get("column");

		return "wire-"+String(row)+"-"+String(column)+"-"+String(wireNumber);
	}
});

var ButtonModule = Module.extend({
	defaults: {
		POSSIBLE_BUTTON_COLORS: ["red", "yellow", "blue", "white", "green"],
		POSSIBLE_BUTTON_LABELS: ["abort", "detonate", "hold"],
		POSSIBLE_STRIP_COLORS: ["blue", "white", "yellow", "red", "green"],
		HOLD_BUFFER_TIME: 2000, // time in ms between initial button press and considering the press as a hold action

		buttonColor: "none",
		buttonLabel: "none",
		stripColor: "none",
		pressStartTime: "none"
	},

	/**
	 * Set button module parameters according to a specified situation in the manual.
	 * Call when setting up bomb modules.
	 * @param {String} attributes.side - one of front or back
	 * @param {int} attributes.row - top row is 0, bottom row is 1
	 * @param {int} attributes.column - from left to right, columns are numbered 0 to 2
	 * @param {int} options.situation - the number corresponding to the button parameters stated in the manual. 
	 * 		0 means randomly choose a situation. If situation is invalid given bomb parameters, default to else case.
	 * @param {int} options.numBatteries - the number of batteries on the bomb
	 * @param {List<String>} options.litIndicators - a list of indicator labels on the bomb that are lit
	 */
	initialize: function(attributes, options) {
		this.set({side: attributes.side, row: attributes.row, column: attributes.column});
		numBatteries = options.numBatteries;
		situation = options.situation;
		litIndicators = options.litIndicators;

		if (situation == 0) {
			situation = _.random(1, 7); 
		}

		if (situation == 1) {
			this.set({buttonColor: "blue", buttonLabel: "abort"});
		} else if (situation == 2 && numBatteries > 1) {
			this.set({buttonLabel: "detonate"});
		} else if (situation == 3 && litIndicators.includes("car")) {
			this.set({buttonColor: "white"});
		} else if (situation == 4 && numBatteries > 2 && litIndicators.includes("frk")) {
			
		} else if (situation == 5) {
			this.set({buttonColor: "yellow"});
		} else if (situation == 6) {
			this.set({buttonColor: "red", buttonLabel: "hold"});
		} else {
			this.set({buttonColor: _.sample(this.get("POSSIBLE_BUTTON_COLORS"))});
			var possibleLabels = this.get("POSSIBLE_BUTTON_LABELS");

			if (this.get("buttonColor") == "blue") {
				possibleLabels = _.without(this.get("POSSIBLE_BUTTON_LABELS"), "abort");
			} 

			if (numBatteries > 1) {
				possibleLabels = _.without(this.get("POSSIBLE_BUTTON_LABELS"), "detonate");
			}

			if (this.get("buttonColor") == "red") {
				possibleLabels = _.without(this.get("POSSIBLE_BUTTON_LABELS"), "hold");
			}

			this.set({buttonLabel: _.sample(possibleLabels)});
		}

		if (this.get("buttonColor") == "none") {
			this.set({buttonColor: _.sample(this.get("POSSIBLE_BUTTON_COLORS"))});
		}

		if (this.get("buttonLabel") == "none") {
			this.set({buttonLabel: _.sample(this.get("POSSIBLE_BUTTON_LABELS"))});
		}
	},

	/**
	 * Set the time at which the button was pressed.
	 * Call when button is pressed.
	 */
	onButtonPress: function() {
		var d = new Date();
		this.set({pressStartTime: d.getTime()});
	},

	/**
	 * Light up the colored strip on the right side of the module.
	 * Call when button is pressed and held (and should be held to disarm).
	 * Wait HOLD_BUFFER_TIME between player press before calling this function.
	 * @param {String} color - the color that the indicator should be
	 */
	onButtonHold: function(color) {
		this.set({stripColor: color});
	},

	/**
	 * Determine whether the player successfully disarms module when releasing a held button.
	 * Call when the player releases the held button.
	 * @param {String}	countdownTimerValue - the value on the countdown timer when the player releases a held button
	 */
	onHeldButtonRelease: function(countdownTimerValue) {
		if (this.get("stripColor") == "blue" && countdownTimerValue.contains("4")) {
			this.set({passed: true});
		} else if (this.get("stripColor") == "white" && countdownTimerValue.contains("1")) {
			this.set({passed: true});
		} else if (this.get("stripColor") == "yellow" && countdownTimerValue.contains("5")) {
			this.set({passed: true});
		} else if (countdownTimerValue.contains("1")) {
			this.set({passed: true});
		} else {
			this.set({failed: true});
		}
	},

	/**
	 * Determine whether the player successfully disarms the button module.
	 * Call when player releases the button.
	 * @param {int} numBatteries - the number of batteries on the bomb
	 * @param {List<String>} litIndicators - a list of indicator labels on the bomb that are lit
	 * @param {String} countdownTimerValue - the value on the countdown timer when the player releases the button
	 */
	passOrFail: function(numBatteries, litIndicators, countdownTimerValue) {
		var d = new Date();
		var timePressed = d.getTime() - this.get("pressStartTime");
		var passed = false;

		if (this.get("buttonColor") == "blue" && this.get("buttonLabel") == "abort") {
			if (timePressed > this.get("HOLD_BUFFER_TIME")) {
				passed = this.onHeldButtonRelease(countdownTimerValue);
			}
		} else if (numBatteries > 1 && this.get("buttonLabel") == "detonate") {
			passed = (timePressed < this.get("HOLD_BUFFER_TIME"));
		} else if (this.get("buttonColor") == "white" && litIndicators.includes("car")) {
			if (timePressed > this.get("HOLD_BUFFER_TIME")) {
				passed = this.onHeldButtonRelease(countdownTimerValue);
			}
		} else if (numBatteries > 2 && litIndicators.includes("frk")) {
			passed = (timePressed < this.get("HOLD_BUFFER_TIME"));
		} else if (this.get("buttonColor") == "yellow") {
			if (timePressed > this.get("HOLD_BUFFER_TIME")) {
				passed = this.onHeldButtonRelease(countdownTimerValue);
			}
		} else if (this.get("buttonColor") == "red" && this.get("buttonLabel") == "hold") {
			return passed = (timePressed < this.get("HOLD_BUFFER_TIME"));
		} else {
			if (timePressed > this.get("HOLD_BUFFER_TIME")) {
				passed = this.onHeldButtonRelease(countdownTimerValue);
			}
		}

		if (passed) {
			this.set({passed: true});
		} else {
			this.set({failed: true});
		}
	},

	onKeyTap: function() {
		console.log("Key Tap Gesture");
		this.set({passed: true});
	},

	onScreenTap: function() {
		console.log("Screen Tap Gesture");
		this.set({passed: true});
	}
});

var ButtonView = ModuleView.extend({
	tagName: "button",
	className: "module buttonModule circle-btn",
	template: _.template($("#buttonTemplate").html()),
	model: "none",

	initialize: function(attributes) {
		this.model = attributes.model;
		var buttonColor = this.model.get("buttonColor");
		this.$el.addClass(buttonColor);

		this.listenTo(this.model, "change:active", this.changeActive);
		this.listenTo(this.model, "change:passed", this.onPass);
		this.listenTo(this.model, "change:failed", this.onFail);
		this.listenTo(this.model, "change:hoverPosition", this.onHover);

		return this.render();
	},

	render: function() {
		this.$el.html(this.template(this.model.toJSON()));
		return this.el;
	},

	/**
	 * On hover, highlight module.
	 */
	onHover: function() {
		var origin = this.$el.offset();
		var screenPosition = this.model.get("hoverPosition");

		if (origin && screenPosition) {
			if (screenPosition[0] > origin.left
				&& screenPosition[0] < origin.left + 150
				&& screenPosition[1] > origin.top 
				&& screenPosition[1] < origin.top + 150) {
				this.$el.addClass("hover-btn");
			} else {
				this.onStopHover();
			}
		}
	},

	onStopHover: function() {
		this.$el.removeClass("hover-btn");
	}
});

var KnobsModule = Module.extend({
	defaults: {
		INITIAL_ROTATE: 268,
		ROTATE_RATE: 1,
		ROTATE_LOCK_ANGLE: 31.01,
		currentRotate: 268
	},

	initialize: function(attributes, options) {
		this.set({side: attributes.side, row: attributes.row, column: attributes.column});
		var situation = options.situation;
	},

	passOrFail: function() {},

	onCircle: function(clockwise) {
		console.log("Circle Gesture");
		var currentAngle = this.get("currentRotate");
		
		if (clockwise) {
			currentAngle += this.get("ROTATE_RATE");
		} else {
			currentAngle -= this.get("ROTATE_RATE");
		}

		this.set({currentRotate: currentAngle});
	}
});

var KnobsView = ModuleView.extend({
	tagName: "div",
	className: "module knobsModule",
	template: _.template($("#knobsTemplate").html()),
	model: "none",

	initialize: function(attributes) {
		this.model = attributes.model;

		this.listenTo(this.model, "change:active", this.changeActive);
		this.listenTo(this.model, "change:passed", this.onPass);
		this.listenTo(this.model, "change:failed", this.onFail);
		this.listenTo(this.model, "change:hoverPosition", this.onHover);
		this.listenTo(this.model, "change:currentRotate", this.onRotate);

		return this.render();
	},

	render: function() {
		this.$el.html(this.template(this.model.toJSON()));
		this.$el.children("img.knob-img").css({"transform": 'rotate(' + this.model.get("INITIAL_ROTATE") + 'deg)'});
		return this.el;
	},

	onHover: function() {
		var origin = this.$el.offset();
		var screenPosition = this.model.get("hoverPosition");

		if (origin && screenPosition) {
			if (screenPosition[0] > origin.left
				&& screenPosition[0] < origin.left + 200
				&& screenPosition[1] > origin.top 
				&& screenPosition[1] < origin.top + 200) {
				this.$el.addClass("hover-knob");
			} else {
				this.$el.removeClass("hover-knob");
			}		
		}
	},

	knobRotationToValue: function(rotation) {
		var initialRotate = this.model.get("INITIAL_ROTATE");
		var rotateLockAngle = this.model.get("ROTATE_LOCK_ANGLE");
		var value = Math.floor( ((rotation-initialRotate+720) % 360) / rotateLockAngle) + 1;

		if (value >= 1 && value <= 9) {
			return value;
		} else if (value == 10) {
			return 0;
		} else {
			return "";
		}
	},

	onRotate: function() {
		var rotation = this.model.get("currentRotate")
		this.$el.children("div.knob-text").text(this.knobRotationToValue(rotation));
		this.$el.children("img.knob-img").css({"transform": 'rotate(' + rotation + 'deg)'});	
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
*/