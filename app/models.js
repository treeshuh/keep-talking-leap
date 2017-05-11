var Cursor = Backbone.Model.extend({
  defaults: {
    screenPosition: [0, 0],
    color: '#9b59b6'
  },
  setScreenPosition: function(position) {
    this.set('screenPosition', position.slice(0));
  },
  setColor: function(color) {
  	this.set('color', color)
  }
});