var GameManager = Backbone.Model.extend({
	defaults: {
		maxFails: 3,				// bomb explodes upon this many fails
		maxTime: 600,				// num milliseconds player starts with to disarm all modules

		numModules: 0,				// num modules in bomb
		numDisarmedModules: 0,		// num modules that have been disarmed
		numFailedModules: 0			// num modules that player failed at disarming
	},

	/**
	 * Check if game is over.
	 * @return {List<bool>} an array of 2 booleans answering:
	 *		1: is the game over?
	 *		2: did the player win?
	 */
	endGame: function() {
		if (numFailedModules == maxFails) {		// TODO: or if tie runs out
			return [true, false];
		} else if (numModules == numDisarmedModules + numFailedModules) {
			return [true, true];
		} else {
			return [false, false];
		}
	}
});

var ModuleManager = Backbone.Collection.extend({
	model: module,

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
	 * @param {String} side - one of front or back
	 * @param {int} row - top row is 0, bottom row is 1
	 * @param {int} column - from left to right, columns are numbered 0 to 2
	 */
	setModuleLocation: function(side, row, column) {
			set({side: side, row: row, column: column});
	}
});

/*
var WiresModule = Module.extend({});
*/

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
	 * Assumes that the battery count and indicator lights on the bomb match the specified situation.
	 * @param {int} situation - the number corresponding to the button parameters stated in the manual. 0 means randomly choose a situation.
	 */
	createModule: function(situation) {
		if (situation == 0) {
			min = 1
			max = 7;
			situation = Math.floor(Math.random() * (max - min + 1)) + min;
		}

		if (situation == 1) {
			set({buttonColor: "blue", buttonLabel: "abort"});
		} else if (situation == 2) { // there must be 1 battery
			set({buttonLabel: "detonate"});
		} else if (situation == 3) { // indicator labelled 'car' must be lit
			set({buttonColor: "white"});
		} else if (situation == 4) { // there must be at least 2 batteries, indicator labelled 'frk' must be lit
			
		} else if (situation == 5) {
			set({buttonColor: "yellow"});
		} else if (situation == 6) {
			set({buttonColor: "red", buttonLabel: "hold"});
		} else {

		}

		if (get(buttonColor) == "none") {
			set({buttonColor: _.sample(POSSIBLE_BUTTON_COLORS)});
		}

		if (get(buttonLabel) == "none") {
			set({buttonLabel: _.sample(POSSIBLE_BUTTON_LABELS)});
		}
	},

	/**
	 * Set the time at which the button was pressed.
	 * Call when button is pressed.
	 */
	onButtonPress: function() {
		d = new Date();
		pressStartTime = d.getTime();
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
		if (stripColor == "blue" && countdownTimerValue.contains("4")) {
			return true;
		} else if (stripColor == "white" && countdownTimerValue.contains("1")) {
			return true;
		} else if (stripColor == "yellow" && countdownTimerValue.contains("5")) {
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
	 * @return {bool} whether the player successfully disarms the bomb
	 */
	passOrFail: function(numBatteries, litIndicators, countdownTimerValue) {
		var d = new Date();
		timePressed = d.getTime() - pressStartTime;

		if (get(color) == "blue" && get(buttonLabel) == "abort") {
			if (timePressed > HOLD_BUFFER_TIME) {
				return onHeldButtonRelease(countdownTimerValue);
			}
		} else if (numBatteries > 1 && get(buttonLabel) == "detonate") {
			return timePressed < HOLD_BUFFER_TIME;
		} else if (get(color) == "white" && litIndicators.includes("car")) {
			if (timePressed > HOLD_BUFFER_TIME) {
				return onHeldButtonRelease(countdownTimerValue);
			}
		} else if (numBatteries > 2 && litIndicators.includes("frk")) {
			return timePressed < HOLD_BUFFER_TIME;
		} else if (get(color) == "yellow") {
			if (timePressed > HOLD_BUFFER_TIME) {
				return onHeldButtonRelease(countdownTimerValue);
			}
		} else if (get(color) == "red" && get(buttonLabel) == "hold") {
			return timePressed < HOLD_BUFFER_TIME;
		} else {
			if (timePressed > HOLD_BUFFER_TIME) {
				return onHeldButtonRelease(countdownTimerValue);
			}
		}

		return false;
	}
});

/*
var KeypadModule = Module.extend({});

var SimonSaysModule = Module.extend({});

var WhosOnFirstModule = Module.extend({});

var MemoryModule = Module.extend({});

var MorseCodeModule = ({});

var ComplicatedWiresModule = ({});

var WireSequencesModule =({});

function MazesModule = {}

function PasswordsModule = {}

function VentingGasModule = {}

function CapacitatorDischargeModule = {}

function KnobsModule = {}
*/