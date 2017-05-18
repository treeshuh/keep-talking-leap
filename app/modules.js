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

	/**
	 * Shows/hide bomb sides.
	 */
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
	attributes: {
		MAX_FAILS: 3,
	},

	initialize: function() {
		this.addFailIndicator(0, 1, 2);
		this.addWireModule(0, 0, 0, 4, 1);
		this.addWireModule(1, 1, 1, 3, 2);
		this.addButtonModule(0, 1, 1, 6);
		this.addButtonModule(1, 1, 2, 4);
		this.addKnobModule(0, 0, 1, 7);

		this.on("change:failed", this.onFail);
		this.on("change:passed", this.onSuccess);
	},

	addFailIndicator: function(side, r, c) {
		var failIndicatorModel = new FailIndicator({side: side, row: r, column: c});
		this.add(failIndicatorModel);
	},

	addWireModule: function(side, r, c, numWires, situation) {
		var wiresModel = new WiresModule({side: side, row: r, column: c}, {numWires: numWires, situation: situation});
		this.add(wiresModel);
	},

	addButtonModule: function(side, r, c, situation) {
		var buttonModel = new ButtonModule({side: side, row: r, column: c}, {situation: situation});
		this.add(buttonModel);
	},

	addKnobModule: function(side, r, c, situation) {
		var knobsModel = new KnobsModule({side: side, row: r, column: c}, {situation: situation});
		this.add(knobsModel);
	},

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

	onFail: function() {
		var failIndicator = this.findWhere({TYPE: "failIndicator"});
		failIndicator.increaseFailCount();
		this.endGame();
	},

	onSuccess: function() {
		this.endGame();
	},

	/**
	 * Check if game is over.
	 */
	endGame: function() {
		var num_disarmed_modules = this.where({ passed: true }).length;
		var num_failed_modules = this.where({ failed: true }).length;
		
		if (num_failed_modules == this.attributes.MAX_FAILS) {
			window.alert("The bomb exploded!");
		} else if (this.length == num_disarmed_modules + num_failed_modules) {
			window.alert("You defused the bomb!");
		}
	}
});

var BombView = Backbone.View.extend({
	attributes: {},

	/**
	 * Displays bomb with all modules.
	 * @param {int} cellWidth - the width of a cell
	 */
	initialize: function(attributes) {
		this.collection = new ModuleManager();
		this.attributes.bombModel = new BombModel();

		var bombFrontView = new BombSideView({id: "bomb-front", idText: "FRONT", model: this.attributes.bombModel});
		var bombBackView = new BombSideView({id: "bomb-back", idText: "BACK", model: this.attributes.bombModel});

		this.collection.each(function(model) {
			var currentView = null;
			if (model.get("TYPE") == "wires") {
				currentView = new WiresView({model: model, cellWidth: attributes.cellWidth});
			} else if (model.get("TYPE") == "button") {
				currentView = new ButtonView({model: model});
			} else if (model.get("TYPE") == "knobs") {
				currentView = new KnobsView({model: model, cellWidth: attributes.cellWidth});
			} else if (model.get("TYPE") == "failIndicator") {
				currentView = new FailIndicatorView({model: model, cellWidth: attributes.cellWidth});
			}

			var side = model.get("side");
			var cellName = "td.r" + String(model.get("row")+1) + "-c" + String(model.get("column")+1);
			var cell = null;

			if (side) {
				cell = $(bombBackView.el).find(cellName);
			} else {
				cell = $(bombFrontView.el).find(cellName);
			}

			cell.html(currentView.el);
		});

		document.body.append(bombFrontView.el);
		document.body.append(bombBackView.el);
		
		// Display the front of the bomb and hide the back
		bombFrontView.display();
		bombBackView.display();

		return this.render();
	},

	render: function() {
		return this.el;
	},

	getSide: function() {
		return this.attributes.bombModel.getSide();
	},

	changeSides: function() {
		this.attributes.bombModel.changeSides();
	},

	/**
	 * Get the module at the specified location.
	 * @param {int} side - front is 0, back is 1
	 * @param {int} row - top row is 0, bottom row is 1
	 * @param {int} column - from left to right, columns are numbered 0 to 2
	 * @return {module} the module at the specified location, or null if there is no module at that location
	 */
	getModuleAt: function(side, row, column) {
		return this.collection.getModuleAt(side, row, column);
	},

	/**
	 * Make the module at the specified location active and activate hover on it. Make all other active modules inactive and deactivate hover on them.
	 * @param {int} side - front is 0, back is 1
	 * @param {int} row - top row is 0, bottom row is 1
	 * @param {int} column - from left to right, columns are numbered 0 to 2
	 * @param {List<float>} screenPosition - screen position of cursor
	 */
	startIntersectingModule: function(side, row, column, screenPosition) {
		this.collection.startIntersectingModule(side, row, column, screenPosition);
	},

	/**
	 * Make all active modules inactive.
	 */
	stopIntersectingModules: function() {
		this.collection.stopIntersectingModules();
	},

	onCircle: function(clockwise) {
		this.collection.onCircle(clockwise);
	},

	onKeyTap: function() {
		this.collection.onKeyTap();
	},

	onScreenTap: function() {
		this.collection.onScreenTap();
	},
});

var FailIndicator = Module.extend({
	defaults: {
		TYPE: "failIndicator",
		failCount: 0
	},

	initialize: function(attributes, options) {
		this.set({side: attributes.side, row: attributes.row, column: attributes.column});
		this.set({passed: true});
	},

	increaseFailCount: function() {
		var count = this.get("failCount");
		this.set({failCount: count + 1});
	}
});

var FailIndicatorView = ModuleView.extend({
	tagName: 'div',
	className: 'module fail-indicator',
	template: _.template($("#failIndicatorTemplate").html()),
	model: "none",
	attributes: {
		LED_WIDTH: 60
	},

	initialize: function(attributes) {
		this.model = attributes.model;
		this.attributes.cellWidth = attributes.cellWidth;
		this.listenTo(this.model, "change:failCount", this.onFail);

		return this.render();
	},

	render: function() {
		this.$el.html(this.template(this.model.toJSON()));
		this.$el.css({width: this.attributes.cellWidth, height: this.attributes.cellWidth});

		var blankSpace = this.attributes.cellWidth - this.attributes.LED_WIDTH*3;
		var offset = blankSpace / 4.0;

		this.$el.find("div.fail-led.left").css({left: String(offset+"px")});
		this.$el.find("div.fail-led.middle").css({left: String(this.attributes.LED_WIDTH + 2*offset + "px")});
		this.$el.find("div.fail-led.right").css({right: String(offset+"px")});

		return this.el;
	},

	onFail: function() {
		var leds = this.$el.children("div.fail-led");

		for (var i=0; i<this.model.get("failCount"); ++i) {
			$(leds[i]).addClass("on");
		}
	}
});

var WiresModule = Module.extend({
	defaults: {
		TYPE: "wires",
		POSSIBLE_WIRE_COLORS: ["red", "white", "blue", "green", "yellow"],
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
	 */
	initialize: function(attributes, options) {
		this.set({side: attributes.side, row: attributes.row, column: attributes.column});
		var numWires = options.numWires;
		var situation = options.situation;

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

			if (situation == 1) {
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
				var numRedWires = _.random(0, 1);
				var numYellowWires = _.random(0, 1);

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

			if (situation == 1) {
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
				wireSet = _.sample(_.without(this.get("POSSIBLE_WIRE_COLORS"), "green"), numWires);
			} else {
				var numGreenWires = _.random(1, numWires);
				var numOtherWireColors = numWires - numGreenWires;
				var numRedWires = _.random(0, numOtherWireColors);
				numOtherWireColors -= numRedWires;
				var numYellowWires = _.random(0, numOtherWireColors);

				if (numRedWires == 1 && numOtherWireColors >= 1) {
					numYellowWires = _.random(0, 1);
				}

				numOtherWireColors -= numYellowWires;
				var selectedWireColors = [];
				
				if (numOtherWireColors >= 1) {
					selectedWireColors = _.sample(_.without(this.get("POSSIBLE_WIRE_COLORS"), "red", "yellow", "green"), numOtherWireColors);
				}

				for (var i=0; i<numWires; ++i) {
					if (i < numRedWires) {
						selectedWireColors.push("red");
					}

					if (i < numYellowWires) {
						selectedWireColors.push("yellow");
					}

					if (i < numBlackWires) {
						selectedWireColors.push("green");
					}
				}

				var lastColor = null;

				lastColor = _.sample(_.without(selectedWireColors, "green"));
				selectedWireColors.splice(indexOf(lastColor), 1);
				wireSet = _.shuffle(selectedWireColors);
				wireSet.push(lastColor);
			}
		} else {
			numWires = 6;
			this.set({cutWires: [false, false, false, false, false, false]});

			if (situation == 1) {
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
				var numRedWires = _.random(1, numWires - 1);
				var numOtherWireColors = numWires - numRedWires;
				var numYellowWires = _.random(1, numOtherWireColors);

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
						selectedWireColors.push("white");
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
		var numWires = this.get("wires").length;
		var passed = false;

		if (numWires == 3) {
			if (!this.get("wires").includes("red")) {
				passed = (wirePosition == 1);
			} else if (_.last(this.get("wires")) == "white") {
				passed = (wirePosition == numWires - 1);
			} else if (this.get("wires").indexOf("blue") != this.get("wires").lastIndexOf("blue")) {
				passed = (wirePosition == this.get(wires).lastIndexOf("blue"));
			} else {
				passed = (wirePosition == numWires - 1);
			}
		} else if (numWires == 4) {
			if (this.get("wires").indexOf("red") != this.get("wires").lastIndexOf("red")) {
				passed = (wirePosition == this.get("wires").lastIndexOf("red"));
			} else if (_.last(this.get("wires")) == "yellow" && !this.get("wires").includes("red")) {
				passed = (wirePosition == 0);
			} else if (this.get("wires").indexOf("blue") == this.get("wires").lastIndexOf("blue") && this.get("wires").includes("blue")) {
				passed = (wirePosition == 0);
			} else if (this.get("wires").indexOf("yellow") != this.get("wires").lastIndexOf("yellow")) {
				passed = (wirePosition == numWires - 1);
			} else {
				passed = (wirePosition == 1);
			}
		} else if (numWires == 5) {
			if (_.last(this.get("wires")) == "green") {
				passed = (wirePosition == 3);
			} else if (this.get("wires").indexOf("red") == this.get("wires").lastIndexOf("red") && this.get("wires").includes("red") && this.get("wires").indexOf("yellow") != this.get("wires").lastIndexOf("yellow")) {
				passed = (wirePosition == 0);
			} else if (!this.get("wires").includes("green")) {
				passed = (wirePosition == 1);
			} else {
				passed = (wirePosition == 0);
			}
		} else {
			if (!this.get("wires").includes("yellow")) {
				passed = (wirePosition == 2);
			} else if (this.get("wires").indexOf("yellow") == this.get("wires").lastIndexOf("yellow") && this.get("wires").includes("yellow") && this.get("wires").indexOf("white") != this.get("wires").lastIndexOf("white")) {
				passed = (wirePosition == 3);
			} else if (!this.get("wires").includes("red")) {
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

		if (!this.get("passed") && !this.get("failed")) {
			this.passOrFail(activeWireIndex);
		}
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

	/**
	 * On hover, highlight module and wire as appropriate.
	 */
	onHover: function() {
		if (!this.model.get("passed") && !this.model.get("failed")) {
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
		TYPE: "button",
		POSSIBLE_BUTTON_COLORS: ["red", "yellow", "blue", "white", "green"],
		POSSIBLE_BUTTON_LABELS: ["abort", "detonate", "hold"],

		buttonColor: "none",
		buttonLabel: "none",
		numPresses: 0
	},

	/**
	 * Set button module parameters according to a specified situation in the manual.
	 * Call when setting up bomb modules.
	 * @param {String} attributes.side - one of front or back
	 * @param {int} attributes.row - top row is 0, bottom row is 1
	 * @param {int} attributes.column - from left to right, columns are numbered 0 to 2
	 * @param {int} options.situation - the number corresponding to the button parameters stated in the manual. 
	 * 		0 means randomly choose a situation. If situation is invalid given bomb parameters, default to else case.
	 */
	initialize: function(attributes, options) {
		this.set({side: attributes.side, row: attributes.row, column: attributes.column});
		var situation = options.situation;

		if (situation == 0) {
			situation = _.random(1, 7); 
		}

		if (situation == 1) {
			this.set({buttonColor: "blue", buttonLabel: "abort"});
		} else if (situation == 2 && numBatteries > 1) {
			this.set({buttonLabel: "detonate"});
		} else if (situation == 3 && litIndicators.includes("car")) {
			this.set({buttonColor: "white"});
		} else if (situation == 4) {
			this.set({buttonColor: "green", buttonLabel: "abort"});
		} else if (situation == 5) {
			this.set({buttonColor: "yellow"});
		} else if (situation == 6) {
			this.set({buttonColor: "red", buttonLabel: "hold"});
		} else {
			this.set({buttonColor: _.sample(this.get("POSSIBLE_BUTTON_COLORS"))});
			var possibleLabels = _.without(this.get("POSSIBLE_BUTTON_LABELS"), "detonate");

			if (this.get("buttonColor") == "blue" || this.get("buttonColor") == "green") {
				possibleLabels = _.without(this.get("POSSIBLE_BUTTON_LABELS"), "abort");
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
	 * Determine whether the player successfully disarms the button module.
	 * Call when player exits the module.
	 */
	passOrFail: function() {
		var passed = false;
		if (this.get("buttonColor") == "blue" && this.get("buttonLabel") == "abort") {
			passed = this.get("numPresses") == 1;
		} else if (this.get("buttonLabel") == "detonate") {
			passed = this.get("numPresses") == 2;
		} else if (this.get("buttonColor") == "white") {
			passed = this.get("numPresses") == 1;
		} else if (this.get("buttonColor") == "green" && this.get("buttonLabel") == "abort") {
			passed = this.get("numPresses") == 2;
		} else if (this.get("buttonColor") == "yellow") {
			passed = this.get("numPresses") == 1;
		} else if (this.get("buttonColor") == "red" && this.get("buttonLabel") == "hold") {
			passed = this.get("numPresses") == 2;
		} else {
			passed = this.get("numPresses") == 1;
		}

		if (passed) {
			this.set({passed: true});
		} else {
			this.set({failed: true});
		}
	},

	onKeyTap: function() {
		console.log("Key Tap Gesture");
		var prevNumPresses = this.get("numPresses");
		this.set({numPresses: prevNumPresses + 1});
	},

	onScreenTap: function() {
		console.log("Screen Tap Gesture");
		var prevNumPresses = this.get("numPresses");
		this.set({numPresses: prevNumPresses + 1});
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
		this.listenTo(this.model, "change:numPresses", this.onPress)

		return this.render();
	},

	render: function() {
		this.$el.html(this.template(this.model.toJSON()));
		return this.el;
	},

	/**
	 * Change the view to reflect the module's activeness. If the button has been pressed at all, check if the module is passed or failed.
	 */
	changeActive: function() {
		var active = this.model.get("active");

		if (active) {
			this.$el.parent().addClass("active-module");
		} else {
			this.$el.parent().removeClass("active-module");
			if (this.model.get("numPresses") > 0 && !this.model.get("passed") && !this.model.get("failed")) {
				this.model.passOrFail();
			}
		}
	},

	/**
	 * On hover, highlight module.
	 */
	onHover: function() {
		if (!this.model.get("passed") && !this.model.get("failed")) {
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
		}
	},

	onStopHover: function() {
		this.$el.removeClass("hover-btn");
		this.$el.removeClass("active-btn");
	},

	onPress: function() {
		this.$el.addClass("active-btn");
		var here = this.$el;

    	window.setTimeout(function() {
		    here.removeClass("active-btn");
		}, 500);
	},
});

var KnobsModule = Module.extend({
	defaults: {
		TYPE: "knobs",
		INITIAL_ROTATE: 268,
		ROTATE_RATE: 1,
		ROTATE_LOCK_ANGLE: 31.01,
		currentRotate: 268,
		currentValue: null
	},

	initialize: function(attributes, options) {
		var situation = options.situation;
		
		if (situation == 0) {
			situation = _.random(1, 10);
		}

		this.set({side: attributes.side, row: attributes.row, column: attributes.column, situation: situation});
	},

	passOrFail: function() {
		var correctValue = this.get("situation");

		if (correctValue == 10) {
			correctValue = 0;
		}

		if (correctValue == this.get("currentValue")) {
			this.set({passed: true});			
		} else {
			this.set({failed: true});
		}
	},

	onCircle: function(clockwise) {
		console.log("Circle Gesture");
		if (!this.get("passed") && !this.get("failed")) {
			var currentAngle = this.get("currentRotate");
			
			if (clockwise) {
				currentAngle += this.get("ROTATE_RATE");
			} else {
				currentAngle -= this.get("ROTATE_RATE");
			}

			this.set({currentRotate: currentAngle});
		}
	}
});

var KnobsView = ModuleView.extend({
	tagName: "div",
	className: "module knobsModule",
	template: _.template($("#knobsTemplate").html()),
	model: "none",
	attributes: {},

	initialize: function(attributes) {
		this.model = attributes.model;
		this.attributes.cellWidth = attributes.cellWidth;

		this.listenTo(this.model, "change:active", this.changeActive);
		this.listenTo(this.model, "change:passed", this.onPass);
		this.listenTo(this.model, "change:failed", this.onFail);
		this.listenTo(this.model, "change:hoverPosition", this.onHover);
		this.listenTo(this.model, "change:currentRotate", this.onRotate);

		return this.render();
	},

	render: function() {
		this.$el.html(this.template(this.model.toJSON()));
		this.$el.css({position: "relative", width: this.attributes.cellWidth, height: this.attributes.cellWidth, display: "table"});
		this.$el.find("img.knob-img").css({"transform": 'rotate(' + this.model.get("INITIAL_ROTATE") + 'deg)'});
		this.turnOnLeds();

		return this.el;
	},

	/**
	 * Change the view to reflect the module's activeness. If the knob has been turned at all, check if the module is passed or failed.
	 */
	changeActive: function() {
		var active = this.model.get("active");

		if (active) {
			this.$el.parent().addClass("active-module");
		} else {
			this.$el.parent().removeClass("active-module");
			if (this.model.get("currentValue") != null && !this.model.get("passed") && !this.model.get("failed")) {
				this.model.passOrFail();
			}
		}
	},

	turnOnLeds: function() {
		if (this.model.get("situation") == 1) {
			this.$el.find("div.knob-led.top.right").addClass("on");
			this.$el.find("div.knob-led.bottom.right").addClass("on");
		} else if (this.model.get("situation") == 2) {
			this.$el.find("div.knob-led.top.left").addClass("on");
			this.$el.find("div.knob-led.top.right").addClass("on");
		} else if (this.model.get("situation") == 3) {
			this.$el.find("div.knob-led.bottom.right").addClass("on");
		} else if (this.model.get("situation") == 4) {
			this.$el.find("div.knob-led.bottom.left").addClass("on");
			this.$el.find("div.knob-led.bottom.right").addClass("on");
		} else if (this.model.get("situation") == 5) {
			this.$el.find("div.knob-led.top.right").addClass("on");
		} else if (this.model.get("situation") == 6) {
			this.$el.find("div.knob-led.bottom.left").addClass("on");
		} else if (this.model.get("situation") == 7) {
			this.$el.find("div.knob-led.top.right").addClass("on");
			this.$el.find("div.knob-led.bottom.left").addClass("on");
		} else if (this.model.get("situation") == 8) {
			this.$el.find("div.knob-led.top.left").addClass("on");
			this.$el.find("div.knob-led.bottom.left").addClass("on");
		} else if (this.model.get("situation") == 9) {
			this.$el.find("div.knob-led.top.left").addClass("on");
			this.$el.find("div.knob-led.bottom.right").addClass("on");
		} else {
			this.$el.find("div.knob-led.top.left").addClass("on");
		}
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
		var rotation = this.model.get("currentRotate");
		var currentVal = this.knobRotationToValue(rotation);

		this.model.set({currentValue: currentVal});
		this.$el.find("div.knob-text").text(currentVal);
		this.$el.find("img.knob-img").css({"transform": 'rotate(' + rotation + 'deg)'});	
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