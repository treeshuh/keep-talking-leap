# keep-talking-leap

## infrastructure on which we ran the system:
* Chrome
* Leap Motion SDK, version 3.2.0+45899

## notes on use
Make gestures extremely carefully. Once the user starts interacting with the dial module or the button module, success of failure of the module is determined when the user's cursor leaves the module. If the user should be pressing the button twice but the first press takes the cursor out of the module, the user will fail the module. This was a design choice made to enable the user to potentially fail the module. Previously, the user could spin the dial, leave the module, and then come back to continue spinning, and so the dial module could not be failed. In future, we might want to make changes so that the system can fail these modules without being so sensitive to momentary leaving the module.

Right now, the location, type, and which solution from the manual should be used for each module are hard coded (although the system does have and follow the complete logic specified in the included manual). For the sake of not needing to hunt down the correct actions in the manual, the correct actions are as follows:
* front wire module: cut the rightmost red wire
* front dial module: turn the dial to 7
* front button: press the button twice
* back wire module: cut the rightmost wire
* back button module: press the button twice