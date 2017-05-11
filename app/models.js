var Cursor = Backbone.Model.extend({
  defaults: {
    screenPosition: [0, 0],
    color: '#f1c40f'
  },
  setScreenPosition: function(position) {
    this.set('screenPosition', position.slice(0));
  },
  setColor: function(color) {
  	this.set('color', color)
  }
});