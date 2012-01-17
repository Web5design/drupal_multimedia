/** The minplayer namespace. */
var minplayer = minplayer || {};

/** Define the controllers object. */
minplayer.controllers = minplayer.controllers || {};

/**
 * @constructor
 * @extends minplayer.display
 * @class This is the base minplayer controller.  Other controllers can derive
 * from the base and either build on top of it or simply define the elements
 * that this base controller uses.
 *
 * @param {object} context The jQuery context.
 * @param {object} options This components options.
 */
minplayer.controllers.base = function(context, options) {

  // Derive from display
  minplayer.display.call(this, context, options);
};

// Define the prototype for all controllers.
var controllersBase = minplayer.controllers.base;

/** Derive from minplayer.display. */
minplayer.controllers.base.prototype = new minplayer.display();

/** Reset the constructor. */
minplayer.controllers.base.prototype.constructor = minplayer.controllers.base;

/**
 * A static function that will format a time value into a string time format.
 *
 * @param {integer} time An integer value of time.
 * @return {string} A string representation of the time.
 */
minplayer.formatTime = function(time) {
  time = time || 0;
  var seconds = 0, minutes = 0, hour = 0, timeString = '';

  hour = Math.floor(time / 3600);
  time -= (hour * 3600);
  minutes = Math.floor(time / 60);
  time -= (minutes * 60);
  seconds = Math.floor(time % 60);

  if (hour) {
    timeString += String(hour);
    timeString += ':';
  }

  timeString += (minutes >= 10) ? String(minutes) : ('0' + String(minutes));
  timeString += ':';
  timeString += (seconds >= 10) ? String(seconds) : ('0' + String(seconds));
  return {time: timeString, units: ''};
};

/**
 * @see minplayer.display#getElements
 * @return {object} The elements defined by this display.
 */
minplayer.controllers.base.prototype.getElements = function() {
  var elements = minplayer.display.prototype.getElements.call(this);
  return jQuery.extend(elements, {
    play: null,
    pause: null,
    fullscreen: null,
    seek: null,
    volume: null,
    timer: null
  });
};

/**
 * @see minplayer.plugin#construct
 */
minplayer.controllers.base.prototype.construct = function() {

  // Call the minplayer plugin constructor.
  minplayer.display.prototype.construct.call(this);

  // Play or pause the player.
  function playPause(controller, state) {
    var type = state ? 'play' : 'pause';
    controller.display.trigger(type);
    controller.setPlayPause(state);
    if (controller.player) {
      controller.player[type]();
    }
  }

  // Trigger the controller events.
  if (this.elements.play) {
    this.elements.play.bind('click', {obj: this}, function(event) {
      event.preventDefault();
      playPause(event.data.obj, true);
    });
  }

  if (this.elements.pause) {
    this.elements.pause.bind('click', {obj: this}, function(event) {
      event.preventDefault();
      playPause(event.data.obj, false);
    });
  }

  // Fullscreen button.
  var _this = this, sliderOptions = {};
  if (this.elements.fullscreen) {
    this.elements.fullscreen.click(function() {
      var isFull = _this.elements.player.hasClass('fullscreen');
      if (isFull) {
        _this.elements.player.removeClass('fullscreen');
      }
      else {
        _this.elements.player.addClass('fullscreen');
      }
    }).css({'pointer' : 'hand'});
  }

  // Create the slider.
  this.dragging = false;

  // Add a seekBar and volumeBar using jQuery UI Slider.
  if (this.elements.seek) {
    this.seekBar = this.elements.seek.slider({range: 'min'});
  }
  if (this.elements.volume) {
    sliderOptions = {range: 'min', orientation: 'vertical'};
    this.volumeBar = this.elements.volume.slider(sliderOptions);
  }
};

/**
 * Sets the play and pause state of the control bar.
 *
 * @param {boolean} state TRUE - Show Play, FALSE - Show Pause.
 */
minplayer.controllers.base.prototype.setPlayPause = function(state) {
  var css = '';
  if (this.elements.play) {
    css = state ? 'inherit' : 'none';
    this.elements.play.css('display', css);
  }
  if (this.elements.pause) {
    css = state ? 'none' : 'inherit';
    this.elements.pause.css('display', css);
  }
};

/**
 * Sets the time string on the control bar.
 *
 * @param {string} element The name of the element to set.
 * @param {number} time The total time amount to set.
 */
minplayer.controllers.base.prototype.setTimeString = function(element, time) {
  if (this.elements[element]) {
    this.elements[element].text(minplayer.formatTime(time).time);
  }
};

/**
 * @see minplayer.plugin#setPlayer
 */
minplayer.controllers.base.prototype.setPlayer = function(player) {
  minplayer.display.prototype.setPlayer.call(this, player);
  player.display.bind('pause', {obj: this}, function(event) {
    event.data.obj.setPlayPause(true);
    clearInterval(event.data.obj.interval);
  });
  player.display.bind('playing', {obj: this}, function(event) {
    event.data.obj.setPlayPause(false);
  });
  player.display.bind('durationchange', {obj: this}, function(event, data) {
    event.data.obj.setTimeString('duration', data.duration);
  });
  player.display.bind('timeupdate', {obj: this}, function(event, data) {
    if (!event.data.obj.dragging) {
      var value = 0;
      if (data.duration) {
        value = (data.currentTime / data.duration) * 100;
      }

      // Update the seek bar if it exists.
      if (event.data.obj.seekBar) {
        event.data.obj.seekBar.slider('option', 'value', value);
      }

      event.data.obj.setTimeString('timer', data.currentTime);
    }
  });

  // Register the events for the control bar to control the media.
  if (this.seekBar) {
    var _this = this;
    this.seekBar.slider({
      start: function(event, ui) {
        _this.dragging = true;
      },
      stop: function(event, ui) {
        _this.dragging = false;
        var time = (ui.value / 100) * player.getDuration();
        player.seek(time);
      },
      slide: function(event, ui) {
        var time = (ui.value / 100) * player.getDuration();
        if (!_this.dragging) {
          player.seek(time);
        }

        _this.setTimeString('timer', time);
      }
    });
  }

  // Register the volume bar to adjust the player volume.
  player.setVolume(this.options.volume / 100);

  // Setup the volume bar.
  if (this.volumeBar) {
    this.volumeBar.slider('option', 'value', this.options.volume);
    this.volumeBar.slider({
      slide: function(event, ui) {
        player.setVolume(ui.value / 100);
      }
    });
  }
};