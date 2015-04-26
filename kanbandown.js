(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*!
 * mustache.js - Logic-less {{mustache}} templates with JavaScript
 * http://github.com/janl/mustache.js
 */

/*global define: false*/

(function (global, factory) {
  if (typeof exports === "object" && exports) {
    factory(exports); // CommonJS
  } else if (typeof define === "function" && define.amd) {
    define(['exports'], factory); // AMD
  } else {
    factory(global.Mustache = {}); // <script>
  }
}(this, function (mustache) {

  var Object_toString = Object.prototype.toString;
  var isArray = Array.isArray || function (object) {
    return Object_toString.call(object) === '[object Array]';
  };

  function isFunction(object) {
    return typeof object === 'function';
  }

  function escapeRegExp(string) {
    return string.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
  }

  // Workaround for https://issues.apache.org/jira/browse/COUCHDB-577
  // See https://github.com/janl/mustache.js/issues/189
  var RegExp_test = RegExp.prototype.test;
  function testRegExp(re, string) {
    return RegExp_test.call(re, string);
  }

  var nonSpaceRe = /\S/;
  function isWhitespace(string) {
    return !testRegExp(nonSpaceRe, string);
  }

  var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
  };

  function escapeHtml(string) {
    return String(string).replace(/[&<>"'\/]/g, function (s) {
      return entityMap[s];
    });
  }

  var whiteRe = /\s*/;
  var spaceRe = /\s+/;
  var equalsRe = /\s*=/;
  var curlyRe = /\s*\}/;
  var tagRe = /#|\^|\/|>|\{|&|=|!/;

  /**
   * Breaks up the given `template` string into a tree of tokens. If the `tags`
   * argument is given here it must be an array with two string values: the
   * opening and closing tags used in the template (e.g. [ "<%", "%>" ]). Of
   * course, the default is to use mustaches (i.e. mustache.tags).
   *
   * A token is an array with at least 4 elements. The first element is the
   * mustache symbol that was used inside the tag, e.g. "#" or "&". If the tag
   * did not contain a symbol (i.e. {{myValue}}) this element is "name". For
   * all text that appears outside a symbol this element is "text".
   *
   * The second element of a token is its "value". For mustache tags this is
   * whatever else was inside the tag besides the opening symbol. For text tokens
   * this is the text itself.
   *
   * The third and fourth elements of the token are the start and end indices,
   * respectively, of the token in the original template.
   *
   * Tokens that are the root node of a subtree contain two more elements: 1) an
   * array of tokens in the subtree and 2) the index in the original template at
   * which the closing tag for that section begins.
   */
  function parseTemplate(template, tags) {
    if (!template)
      return [];

    var sections = [];     // Stack to hold section tokens
    var tokens = [];       // Buffer to hold the tokens
    var spaces = [];       // Indices of whitespace tokens on the current line
    var hasTag = false;    // Is there a {{tag}} on the current line?
    var nonSpace = false;  // Is there a non-space char on the current line?

    // Strips all whitespace tokens array for the current line
    // if there was a {{#tag}} on it and otherwise only space.
    function stripSpace() {
      if (hasTag && !nonSpace) {
        while (spaces.length)
          delete tokens[spaces.pop()];
      } else {
        spaces = [];
      }

      hasTag = false;
      nonSpace = false;
    }

    var openingTagRe, closingTagRe, closingCurlyRe;
    function compileTags(tags) {
      if (typeof tags === 'string')
        tags = tags.split(spaceRe, 2);

      if (!isArray(tags) || tags.length !== 2)
        throw new Error('Invalid tags: ' + tags);

      openingTagRe = new RegExp(escapeRegExp(tags[0]) + '\\s*');
      closingTagRe = new RegExp('\\s*' + escapeRegExp(tags[1]));
      closingCurlyRe = new RegExp('\\s*' + escapeRegExp('}' + tags[1]));
    }

    compileTags(tags || mustache.tags);

    var scanner = new Scanner(template);

    var start, type, value, chr, token, openSection;
    while (!scanner.eos()) {
      start = scanner.pos;

      // Match any text between tags.
      value = scanner.scanUntil(openingTagRe);

      if (value) {
        for (var i = 0, valueLength = value.length; i < valueLength; ++i) {
          chr = value.charAt(i);

          if (isWhitespace(chr)) {
            spaces.push(tokens.length);
          } else {
            nonSpace = true;
          }

          tokens.push([ 'text', chr, start, start + 1 ]);
          start += 1;

          // Check for whitespace on the current line.
          if (chr === '\n')
            stripSpace();
        }
      }

      // Match the opening tag.
      if (!scanner.scan(openingTagRe))
        break;

      hasTag = true;

      // Get the tag type.
      type = scanner.scan(tagRe) || 'name';
      scanner.scan(whiteRe);

      // Get the tag value.
      if (type === '=') {
        value = scanner.scanUntil(equalsRe);
        scanner.scan(equalsRe);
        scanner.scanUntil(closingTagRe);
      } else if (type === '{') {
        value = scanner.scanUntil(closingCurlyRe);
        scanner.scan(curlyRe);
        scanner.scanUntil(closingTagRe);
        type = '&';
      } else {
        value = scanner.scanUntil(closingTagRe);
      }

      // Match the closing tag.
      if (!scanner.scan(closingTagRe))
        throw new Error('Unclosed tag at ' + scanner.pos);

      token = [ type, value, start, scanner.pos ];
      tokens.push(token);

      if (type === '#' || type === '^') {
        sections.push(token);
      } else if (type === '/') {
        // Check section nesting.
        openSection = sections.pop();

        if (!openSection)
          throw new Error('Unopened section "' + value + '" at ' + start);

        if (openSection[1] !== value)
          throw new Error('Unclosed section "' + openSection[1] + '" at ' + start);
      } else if (type === 'name' || type === '{' || type === '&') {
        nonSpace = true;
      } else if (type === '=') {
        // Set the tags for the next time around.
        compileTags(value);
      }
    }

    // Make sure there are no open sections when we're done.
    openSection = sections.pop();

    if (openSection)
      throw new Error('Unclosed section "' + openSection[1] + '" at ' + scanner.pos);

    return nestTokens(squashTokens(tokens));
  }

  /**
   * Combines the values of consecutive text tokens in the given `tokens` array
   * to a single token.
   */
  function squashTokens(tokens) {
    var squashedTokens = [];

    var token, lastToken;
    for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
      token = tokens[i];

      if (token) {
        if (token[0] === 'text' && lastToken && lastToken[0] === 'text') {
          lastToken[1] += token[1];
          lastToken[3] = token[3];
        } else {
          squashedTokens.push(token);
          lastToken = token;
        }
      }
    }

    return squashedTokens;
  }

  /**
   * Forms the given array of `tokens` into a nested tree structure where
   * tokens that represent a section have two additional items: 1) an array of
   * all tokens that appear in that section and 2) the index in the original
   * template that represents the end of that section.
   */
  function nestTokens(tokens) {
    var nestedTokens = [];
    var collector = nestedTokens;
    var sections = [];

    var token, section;
    for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
      token = tokens[i];

      switch (token[0]) {
      case '#':
      case '^':
        collector.push(token);
        sections.push(token);
        collector = token[4] = [];
        break;
      case '/':
        section = sections.pop();
        section[5] = token[2];
        collector = sections.length > 0 ? sections[sections.length - 1][4] : nestedTokens;
        break;
      default:
        collector.push(token);
      }
    }

    return nestedTokens;
  }

  /**
   * A simple string scanner that is used by the template parser to find
   * tokens in template strings.
   */
  function Scanner(string) {
    this.string = string;
    this.tail = string;
    this.pos = 0;
  }

  /**
   * Returns `true` if the tail is empty (end of string).
   */
  Scanner.prototype.eos = function () {
    return this.tail === "";
  };

  /**
   * Tries to match the given regular expression at the current position.
   * Returns the matched text if it can match, the empty string otherwise.
   */
  Scanner.prototype.scan = function (re) {
    var match = this.tail.match(re);

    if (!match || match.index !== 0)
      return '';

    var string = match[0];

    this.tail = this.tail.substring(string.length);
    this.pos += string.length;

    return string;
  };

  /**
   * Skips all text until the given regular expression can be matched. Returns
   * the skipped string, which is the entire tail if no match can be made.
   */
  Scanner.prototype.scanUntil = function (re) {
    var index = this.tail.search(re), match;

    switch (index) {
    case -1:
      match = this.tail;
      this.tail = "";
      break;
    case 0:
      match = "";
      break;
    default:
      match = this.tail.substring(0, index);
      this.tail = this.tail.substring(index);
    }

    this.pos += match.length;

    return match;
  };

  /**
   * Represents a rendering context by wrapping a view object and
   * maintaining a reference to the parent context.
   */
  function Context(view, parentContext) {
    this.view = view;
    this.cache = { '.': this.view };
    this.parent = parentContext;
  }

  /**
   * Creates a new context using the given view with this context
   * as the parent.
   */
  Context.prototype.push = function (view) {
    return new Context(view, this);
  };

  /**
   * Returns the value of the given name in this context, traversing
   * up the context hierarchy if the value is absent in this context's view.
   */
  Context.prototype.lookup = function (name) {
    var cache = this.cache;

    var value;
    if (name in cache) {
      value = cache[name];
    } else {
      var context = this, names, index, lookupHit = false;

      while (context) {
        if (name.indexOf('.') > 0) {
          value = context.view;
          names = name.split('.');
          index = 0;

          /**
           * Using the dot notion path in `name`, we descend through the
           * nested objects.
           *
           * To be certain that the lookup has been successful, we have to
           * check if the last object in the path actually has the property
           * we are looking for. We store the result in `lookupHit`.
           *
           * This is specially necessary for when the value has been set to
           * `undefined` and we want to avoid looking up parent contexts.
           **/
          while (value != null && index < names.length) {
            if (index === names.length - 1 && value != null)
              lookupHit = (typeof value === 'object') &&
                value.hasOwnProperty(names[index]);
            value = value[names[index++]];
          }
        } else if (context.view != null && typeof context.view === 'object') {
          value = context.view[name];
          lookupHit = context.view.hasOwnProperty(name);
        }

        if (lookupHit)
          break;

        context = context.parent;
      }

      cache[name] = value;
    }

    if (isFunction(value))
      value = value.call(this.view);

    return value;
  };

  /**
   * A Writer knows how to take a stream of tokens and render them to a
   * string, given a context. It also maintains a cache of templates to
   * avoid the need to parse the same template twice.
   */
  function Writer() {
    this.cache = {};
  }

  /**
   * Clears all cached templates in this writer.
   */
  Writer.prototype.clearCache = function () {
    this.cache = {};
  };

  /**
   * Parses and caches the given `template` and returns the array of tokens
   * that is generated from the parse.
   */
  Writer.prototype.parse = function (template, tags) {
    var cache = this.cache;
    var tokens = cache[template];

    if (tokens == null)
      tokens = cache[template] = parseTemplate(template, tags);

    return tokens;
  };

  /**
   * High-level method that is used to render the given `template` with
   * the given `view`.
   *
   * The optional `partials` argument may be an object that contains the
   * names and templates of partials that are used in the template. It may
   * also be a function that is used to load partial templates on the fly
   * that takes a single argument: the name of the partial.
   */
  Writer.prototype.render = function (template, view, partials) {
    var tokens = this.parse(template);
    var context = (view instanceof Context) ? view : new Context(view);
    return this.renderTokens(tokens, context, partials, template);
  };

  /**
   * Low-level method that renders the given array of `tokens` using
   * the given `context` and `partials`.
   *
   * Note: The `originalTemplate` is only ever used to extract the portion
   * of the original template that was contained in a higher-order section.
   * If the template doesn't use higher-order sections, this argument may
   * be omitted.
   */
  Writer.prototype.renderTokens = function (tokens, context, partials, originalTemplate) {
    var buffer = '';

    var token, symbol, value;
    for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
      value = undefined;
      token = tokens[i];
      symbol = token[0];

      if (symbol === '#') value = this._renderSection(token, context, partials, originalTemplate);
      else if (symbol === '^') value = this._renderInverted(token, context, partials, originalTemplate);
      else if (symbol === '>') value = this._renderPartial(token, context, partials, originalTemplate);
      else if (symbol === '&') value = this._unescapedValue(token, context);
      else if (symbol === 'name') value = this._escapedValue(token, context);
      else if (symbol === 'text') value = this._rawValue(token);

      if (value !== undefined)
        buffer += value;
    }

    return buffer;
  };

  Writer.prototype._renderSection = function (token, context, partials, originalTemplate) {
    var self = this;
    var buffer = '';
    var value = context.lookup(token[1]);

    // This function is used to render an arbitrary template
    // in the current context by higher-order sections.
    function subRender(template) {
      return self.render(template, context, partials);
    }

    if (!value) return;

    if (isArray(value)) {
      for (var j = 0, valueLength = value.length; j < valueLength; ++j) {
        buffer += this.renderTokens(token[4], context.push(value[j]), partials, originalTemplate);
      }
    } else if (typeof value === 'object' || typeof value === 'string' || typeof value === 'number') {
      buffer += this.renderTokens(token[4], context.push(value), partials, originalTemplate);
    } else if (isFunction(value)) {
      if (typeof originalTemplate !== 'string')
        throw new Error('Cannot use higher-order sections without the original template');

      // Extract the portion of the original template that the section contains.
      value = value.call(context.view, originalTemplate.slice(token[3], token[5]), subRender);

      if (value != null)
        buffer += value;
    } else {
      buffer += this.renderTokens(token[4], context, partials, originalTemplate);
    }
    return buffer;
  };

  Writer.prototype._renderInverted = function(token, context, partials, originalTemplate) {
    var value = context.lookup(token[1]);

    // Use JavaScript's definition of falsy. Include empty arrays.
    // See https://github.com/janl/mustache.js/issues/186
    if (!value || (isArray(value) && value.length === 0))
      return this.renderTokens(token[4], context, partials, originalTemplate);
  };

  Writer.prototype._renderPartial = function(token, context, partials) {
    if (!partials) return;

    var value = isFunction(partials) ? partials(token[1]) : partials[token[1]];
    if (value != null)
      return this.renderTokens(this.parse(value), context, partials, value);
  };

  Writer.prototype._unescapedValue = function(token, context) {
    var value = context.lookup(token[1]);
    if (value != null)
      return value;
  };

  Writer.prototype._escapedValue = function(token, context) {
    var value = context.lookup(token[1]);
    if (value != null)
      return mustache.escape(value);
  };

  Writer.prototype._rawValue = function(token) {
    return token[1];
  };

  mustache.name = "mustache.js";
  mustache.version = "2.0.0";
  mustache.tags = [ "{{", "}}" ];

  // All high-level mustache.* functions use this writer.
  var defaultWriter = new Writer();

  /**
   * Clears all cached templates in the default writer.
   */
  mustache.clearCache = function () {
    return defaultWriter.clearCache();
  };

  /**
   * Parses and caches the given template in the default writer and returns the
   * array of tokens it contains. Doing this ahead of time avoids the need to
   * parse templates on the fly as they are rendered.
   */
  mustache.parse = function (template, tags) {
    return defaultWriter.parse(template, tags);
  };

  /**
   * Renders the `template` with the given `view` and `partials` using the
   * default writer.
   */
  mustache.render = function (template, view, partials) {
    return defaultWriter.render(template, view, partials);
  };

  // This is here for backwards compatibility with 0.4.x.
  mustache.to_html = function (template, view, partials, send) {
    var result = mustache.render(template, view, partials);

    if (isFunction(send)) {
      send(result);
    } else {
      return result;
    }
  };

  // Export the escaping function so that the user may override it.
  // See https://github.com/janl/mustache.js/issues/244
  mustache.escape = escapeHtml;

  // Export these mainly for testing, but also for advanced usage.
  mustache.Scanner = Scanner;
  mustache.Context = Context;
  mustache.Writer = Writer;

}));

},{}],2:[function(require,module,exports){
/**!
 * Sortable
 * @author	RubaXa   <trash@rubaxa.org>
 * @license MIT
 */


(function (factory) {
	"use strict";

	if (typeof define === "function" && define.amd) {
		define(factory);
	}
	else if (typeof module != "undefined" && typeof module.exports != "undefined") {
		module.exports = factory();
	}
	else if (typeof Package !== "undefined") {
		Sortable = factory();  // export for Meteor.js
	}
	else {
		/* jshint sub:true */
		window["Sortable"] = factory();
	}
})(function () {
	"use strict";

	var dragEl,
		ghostEl,
		cloneEl,
		rootEl,
		nextEl,

		scrollEl,
		scrollParentEl,

		lastEl,
		lastCSS,

		oldIndex,
		newIndex,

		activeGroup,
		autoScroll = {},

		tapEvt,
		touchEvt,

		expando = 'Sortable' + (new Date).getTime(),

		win = window,
		document = win.document,
		parseInt = win.parseInt,

		supportDraggable = !!('draggable' in document.createElement('div')),


		_silent = false,

		_dispatchEvent = function (rootEl, name, targetEl, fromEl, startIndex, newIndex) {
			var evt = document.createEvent('Event');

			evt.initEvent(name, true, true);

			evt.item = targetEl || rootEl;
			evt.from = fromEl || rootEl;
			evt.clone = cloneEl;

			evt.oldIndex = startIndex;
			evt.newIndex = newIndex;

			rootEl.dispatchEvent(evt);
		},

		_customEvents = 'onAdd onUpdate onRemove onStart onEnd onFilter onSort'.split(' '),

		noop = function () {},

		abs = Math.abs,
		slice = [].slice,

		touchDragOverListeners = [],

		_autoScroll = _throttle(function (/**Event*/evt, /**Object*/options, /**HTMLElement*/rootEl) {
			// Bug: https://bugzilla.mozilla.org/show_bug.cgi?id=505521
			if (rootEl && options.scroll) {
				var el,
					rect,
					sens = options.scrollSensitivity,
					speed = options.scrollSpeed,

					x = evt.clientX,
					y = evt.clientY,

					winWidth = window.innerWidth,
					winHeight = window.innerHeight,

					vx,
					vy
				;

				// Delect scrollEl
				if (scrollParentEl !== rootEl) {
					scrollEl = options.scroll;
					scrollParentEl = rootEl;

					if (scrollEl === true) {
						scrollEl = rootEl;

						do {
							if ((scrollEl.offsetWidth < scrollEl.scrollWidth) ||
								(scrollEl.offsetHeight < scrollEl.scrollHeight)
							) {
								break;
							}
							/* jshint boss:true */
						} while (scrollEl = scrollEl.parentNode);
					}
				}

				if (scrollEl) {
					el = scrollEl;
					rect = scrollEl.getBoundingClientRect();
					vx = (abs(rect.right - x) <= sens) - (abs(rect.left - x) <= sens);
					vy = (abs(rect.bottom - y) <= sens) - (abs(rect.top - y) <= sens);
				}


				if (!(vx || vy)) {
					vx = (winWidth - x <= sens) - (x <= sens);
					vy = (winHeight - y <= sens) - (y <= sens);

					/* jshint expr:true */
					(vx || vy) && (el = win);
				}


				if (autoScroll.vx !== vx || autoScroll.vy !== vy || autoScroll.el !== el) {
					autoScroll.el = el;
					autoScroll.vx = vx;
					autoScroll.vy = vy;

					clearInterval(autoScroll.pid);

					if (el) {
						autoScroll.pid = setInterval(function () {
							if (el === win) {
								win.scrollTo(win.scrollX + vx * speed, win.scrollY + vy * speed);
							} else {
								vy && (el.scrollTop += vy * speed);
								vx && (el.scrollLeft += vx * speed);
							}
						}, 24);
					}
				}
			}
		}, 30)
	;



	/**
	 * @class  Sortable
	 * @param  {HTMLElement}  el
	 * @param  {Object}       [options]
	 */
	function Sortable(el, options) {
		this.el = el; // root element
		this.options = options = (options || {});


		// Default options
		var defaults = {
			group: Math.random(),
			sort: true,
			disabled: false,
			store: null,
			handle: null,
			scroll: true,
			scrollSensitivity: 30,
			scrollSpeed: 10,
			draggable: /[uo]l/i.test(el.nodeName) ? 'li' : '>*',
			ghostClass: 'sortable-ghost',
			ignore: 'a, img',
			filter: null,
			animation: 0,
			setData: function (dataTransfer, dragEl) {
				dataTransfer.setData('Text', dragEl.textContent);
			},
			dropBubble: false,
			dragoverBubble: false
		};


		// Set default options
		for (var name in defaults) {
			!(name in options) && (options[name] = defaults[name]);
		}


		var group = options.group;

		if (!group || typeof group != 'object') {
			group = options.group = { name: group };
		}


		['pull', 'put'].forEach(function (key) {
			if (!(key in group)) {
				group[key] = true;
			}
		});


		// Define events
		_customEvents.forEach(function (name) {
			options[name] = _bind(this, options[name] || noop);
			_on(el, name.substr(2).toLowerCase(), options[name]);
		}, this);


		// Export options
		options.groups = ' ' + group.name + (group.put.join ? ' ' + group.put.join(' ') : '') + ' ';
		el[expando] = options;


		// Bind all private methods
		for (var fn in this) {
			if (fn.charAt(0) === '_') {
				this[fn] = _bind(this, this[fn]);
			}
		}


		// Bind events
		_on(el, 'mousedown', this._onTapStart);
		_on(el, 'touchstart', this._onTapStart);

		_on(el, 'dragover', this);
		_on(el, 'dragenter', this);

		touchDragOverListeners.push(this._onDragOver);

		// Restore sorting
		options.store && this.sort(options.store.get(this));
	}


	Sortable.prototype = /** @lends Sortable.prototype */ {
		constructor: Sortable,


		_dragStarted: function () {
			if (rootEl && dragEl) {
				// Apply effect
				_toggleClass(dragEl, this.options.ghostClass, true);

				Sortable.active = this;

				// Drag start event
				_dispatchEvent(rootEl, 'start', dragEl, rootEl, oldIndex);
			}
		},


		_onTapStart: function (/**Event|TouchEvent*/evt) {
			var type = evt.type,
				touch = evt.touches && evt.touches[0],
				target = (touch || evt).target,
				originalTarget = target,
				options =  this.options,
				el = this.el,
				filter = options.filter;

			if (type === 'mousedown' && evt.button !== 0 || options.disabled) {
				return; // only left button or enabled
			}

			target = _closest(target, options.draggable, el);

			if (!target) {
				return;
			}

			// get the index of the dragged element within its parent
			oldIndex = _index(target);

			// Check filter
			if (typeof filter === 'function') {
				if (filter.call(this, evt, target, this)) {
					_dispatchEvent(originalTarget, 'filter', target, el, oldIndex);
					evt.preventDefault();
					return; // cancel dnd
				}
			}
			else if (filter) {
				filter = filter.split(',').some(function (criteria) {
					criteria = _closest(originalTarget, criteria.trim(), el);

					if (criteria) {
						_dispatchEvent(criteria, 'filter', target, el, oldIndex);
						return true;
					}
				});

				if (filter) {
					evt.preventDefault();
					return; // cancel dnd
				}
			}


			if (options.handle && !_closest(originalTarget, options.handle, el)) {
				return;
			}


			// Prepare `dragstart`
			if (target && !dragEl && (target.parentNode === el)) {
				tapEvt = evt;

				rootEl = this.el;
				dragEl = target;
				nextEl = dragEl.nextSibling;
				activeGroup = this.options.group;

				dragEl.draggable = true;

				// Disable "draggable"
				options.ignore.split(',').forEach(function (criteria) {
					_find(target, criteria.trim(), _disableDraggable);
				});

				if (touch) {
					// Touch device support
					tapEvt = {
						target: target,
						clientX: touch.clientX,
						clientY: touch.clientY
					};

					this._onDragStart(tapEvt, 'touch');
					evt.preventDefault();
				}

				_on(document, 'mouseup', this._onDrop);
				_on(document, 'touchend', this._onDrop);
				_on(document, 'touchcancel', this._onDrop);

				_on(dragEl, 'dragend', this);
				_on(rootEl, 'dragstart', this._onDragStart);

				if (!supportDraggable) {
					this._onDragStart(tapEvt, true);
				}

				try {
					if (document.selection) {
						document.selection.empty();
					} else {
						window.getSelection().removeAllRanges();
					}
				} catch (err) {
				}
			}
		},

		_emulateDragOver: function () {
			if (touchEvt) {
				_css(ghostEl, 'display', 'none');

				var target = document.elementFromPoint(touchEvt.clientX, touchEvt.clientY),
					parent = target,
					groupName = ' ' + this.options.group.name + '',
					i = touchDragOverListeners.length;

				if (parent) {
					do {
						if (parent[expando] && parent[expando].groups.indexOf(groupName) > -1) {
							while (i--) {
								touchDragOverListeners[i]({
									clientX: touchEvt.clientX,
									clientY: touchEvt.clientY,
									target: target,
									rootEl: parent
								});
							}

							break;
						}

						target = parent; // store last element
					}
					/* jshint boss:true */
					while (parent = parent.parentNode);
				}

				_css(ghostEl, 'display', '');
			}
		},


		_onTouchMove: function (/**TouchEvent*/evt) {
			if (tapEvt) {
				var touch = evt.touches ? evt.touches[0] : evt,
					dx = touch.clientX - tapEvt.clientX,
					dy = touch.clientY - tapEvt.clientY,
					translate3d = evt.touches ? 'translate3d(' + dx + 'px,' + dy + 'px,0)' : 'translate(' + dx + 'px,' + dy + 'px)';

				touchEvt = touch;

				_css(ghostEl, 'webkitTransform', translate3d);
				_css(ghostEl, 'mozTransform', translate3d);
				_css(ghostEl, 'msTransform', translate3d);
				_css(ghostEl, 'transform', translate3d);

				evt.preventDefault();
			}
		},


		_onDragStart: function (/**Event*/evt, /**boolean*/useFallback) {
			var dataTransfer = evt.dataTransfer,
				options = this.options;

			this._offUpEvents();

			if (activeGroup.pull == 'clone') {
				cloneEl = dragEl.cloneNode(true);
				_css(cloneEl, 'display', 'none');
				rootEl.insertBefore(cloneEl, dragEl);
			}

			if (useFallback) {
				var rect = dragEl.getBoundingClientRect(),
					css = _css(dragEl),
					ghostRect;

				ghostEl = dragEl.cloneNode(true);

				_css(ghostEl, 'top', rect.top - parseInt(css.marginTop, 10));
				_css(ghostEl, 'left', rect.left - parseInt(css.marginLeft, 10));
				_css(ghostEl, 'width', rect.width);
				_css(ghostEl, 'height', rect.height);
				_css(ghostEl, 'opacity', '0.8');
				_css(ghostEl, 'position', 'fixed');
				_css(ghostEl, 'zIndex', '100000');

				rootEl.appendChild(ghostEl);

				// Fixing dimensions.
				ghostRect = ghostEl.getBoundingClientRect();
				_css(ghostEl, 'width', rect.width * 2 - ghostRect.width);
				_css(ghostEl, 'height', rect.height * 2 - ghostRect.height);

				if (useFallback === 'touch') {
					// Bind touch events
					_on(document, 'touchmove', this._onTouchMove);
					_on(document, 'touchend', this._onDrop);
					_on(document, 'touchcancel', this._onDrop);
				} else {
					// Old brwoser
					_on(document, 'mousemove', this._onTouchMove);
					_on(document, 'mouseup', this._onDrop);
				}

				this._loopId = setInterval(this._emulateDragOver, 150);
			}
			else {
				if (dataTransfer) {
					dataTransfer.effectAllowed = 'move';
					options.setData && options.setData.call(this, dataTransfer, dragEl);
				}

				_on(document, 'drop', this);
			}

			setTimeout(this._dragStarted, 0);
		},

		_onDragOver: function (/**Event*/evt) {
			var el = this.el,
				target,
				dragRect,
				revert,
				options = this.options,
				group = options.group,
				groupPut = group.put,
				isOwner = (activeGroup === group),
				canSort = options.sort;

			if (!dragEl) {
				return;
			}

			if (evt.preventDefault !== void 0) {
				evt.preventDefault();
				!options.dragoverBubble && evt.stopPropagation();
			}

			if (activeGroup && !options.disabled &&
				(isOwner
					? canSort || (revert = !rootEl.contains(dragEl))
					: activeGroup.pull && groupPut && (
						(activeGroup.name === group.name) || // by Name
						(groupPut.indexOf && ~groupPut.indexOf(activeGroup.name)) // by Array
					)
				) &&
				(evt.rootEl === void 0 || evt.rootEl === this.el)
			) {
				// Smart auto-scrolling
				_autoScroll(evt, options, this.el);

				if (_silent) {
					return;
				}

				target = _closest(evt.target, options.draggable, el);
				dragRect = dragEl.getBoundingClientRect();


				if (revert) {
					_cloneHide(true);

					if (cloneEl || nextEl) {
						rootEl.insertBefore(dragEl, cloneEl || nextEl);
					}
					else if (!canSort) {
						rootEl.appendChild(dragEl);
					}

					return;
				}


				if ((el.children.length === 0) || (el.children[0] === ghostEl) ||
					(el === evt.target) && (target = _ghostInBottom(el, evt))
				) {
					if (target) {
						if (target.animated) {
							return;
						}
						targetRect = target.getBoundingClientRect();
					}

					_cloneHide(isOwner);

					el.appendChild(dragEl);
					this._animate(dragRect, dragEl);
					target && this._animate(targetRect, target);
				}
				else if (target && !target.animated && target !== dragEl && (target.parentNode[expando] !== void 0)) {
					if (lastEl !== target) {
						lastEl = target;
						lastCSS = _css(target);
					}


					var targetRect = target.getBoundingClientRect(),
						width = targetRect.right - targetRect.left,
						height = targetRect.bottom - targetRect.top,
						floating = /left|right|inline/.test(lastCSS.cssFloat + lastCSS.display),
						isWide = (target.offsetWidth > dragEl.offsetWidth),
						isLong = (target.offsetHeight > dragEl.offsetHeight),
						halfway = (floating ? (evt.clientX - targetRect.left) / width : (evt.clientY - targetRect.top) / height) > 0.5,
						nextSibling = target.nextElementSibling,
						after
					;

					_silent = true;
					setTimeout(_unsilent, 30);

					_cloneHide(isOwner);

					if (floating) {
						after = (target.previousElementSibling === dragEl) && !isWide || halfway && isWide;
					} else {
						after = (nextSibling !== dragEl) && !isLong || halfway && isLong;
					}

					if (after && !nextSibling) {
						el.appendChild(dragEl);
					} else {
						target.parentNode.insertBefore(dragEl, after ? nextSibling : target);
					}

					this._animate(dragRect, dragEl);
					this._animate(targetRect, target);
				}
			}
		},

		_animate: function (prevRect, target) {
			var ms = this.options.animation;

			if (ms) {
				var currentRect = target.getBoundingClientRect();

				_css(target, 'transition', 'none');
				_css(target, 'transform', 'translate3d('
					+ (prevRect.left - currentRect.left) + 'px,'
					+ (prevRect.top - currentRect.top) + 'px,0)'
				);

				target.offsetWidth; // repaint

				_css(target, 'transition', 'all ' + ms + 'ms');
				_css(target, 'transform', 'translate3d(0,0,0)');

				clearTimeout(target.animated);
				target.animated = setTimeout(function () {
					_css(target, 'transition', '');
					_css(target, 'transform', '');
					target.animated = false;
				}, ms);
			}
		},

		_offUpEvents: function () {
			_off(document, 'mouseup', this._onDrop);
			_off(document, 'touchmove', this._onTouchMove);
			_off(document, 'touchend', this._onDrop);
			_off(document, 'touchcancel', this._onDrop);
		},

		_onDrop: function (/**Event*/evt) {
			var el = this.el,
				options = this.options;

			clearInterval(this._loopId);
			clearInterval(autoScroll.pid);

			// Unbind events
			_off(document, 'drop', this);
			_off(document, 'mousemove', this._onTouchMove);
			_off(el, 'dragstart', this._onDragStart);

			this._offUpEvents();

			if (evt) {
				evt.preventDefault();
				!options.dropBubble && evt.stopPropagation();

				ghostEl && ghostEl.parentNode.removeChild(ghostEl);

				if (dragEl) {
					_off(dragEl, 'dragend', this);

					_disableDraggable(dragEl);
					_toggleClass(dragEl, this.options.ghostClass, false);

					if (rootEl !== dragEl.parentNode) {
						newIndex = _index(dragEl);

						// drag from one list and drop into another
						_dispatchEvent(dragEl.parentNode, 'sort', dragEl, rootEl, oldIndex, newIndex);
						_dispatchEvent(rootEl, 'sort', dragEl, rootEl, oldIndex, newIndex);

						// Add event
						_dispatchEvent(dragEl, 'add', dragEl, rootEl, oldIndex, newIndex);

						// Remove event
						_dispatchEvent(rootEl, 'remove', dragEl, rootEl, oldIndex, newIndex);
					}
					else {
						// Remove clone
						cloneEl && cloneEl.parentNode.removeChild(cloneEl);

						if (dragEl.nextSibling !== nextEl) {
							// Get the index of the dragged element within its parent
							newIndex = _index(dragEl);

							// drag & drop within the same list
							_dispatchEvent(rootEl, 'update', dragEl, rootEl, oldIndex, newIndex);
							_dispatchEvent(rootEl, 'sort', dragEl, rootEl, oldIndex, newIndex);
						}
					}

					// Drag end event
					Sortable.active && _dispatchEvent(rootEl, 'end', dragEl, rootEl, oldIndex, newIndex);
				}

				// Nulling
				rootEl =
				dragEl =
				ghostEl =
				nextEl =
				cloneEl =

				scrollEl =
				scrollParentEl =

				tapEvt =
				touchEvt =

				lastEl =
				lastCSS =

				activeGroup =
				Sortable.active = null;

				// Save sorting
				this.save();
			}
		},


		handleEvent: function (/**Event*/evt) {
			var type = evt.type;

			if (type === 'dragover' || type === 'dragenter') {
				this._onDragOver(evt);
				_globalDragOver(evt);
			}
			else if (type === 'drop' || type === 'dragend') {
				this._onDrop(evt);
			}
		},


		/**
		 * Serializes the item into an array of string.
		 * @returns {String[]}
		 */
		toArray: function () {
			var order = [],
				el,
				children = this.el.children,
				i = 0,
				n = children.length;

			for (; i < n; i++) {
				el = children[i];
				if (_closest(el, this.options.draggable, this.el)) {
					order.push(el.getAttribute('data-id') || _generateId(el));
				}
			}

			return order;
		},


		/**
		 * Sorts the elements according to the array.
		 * @param  {String[]}  order  order of the items
		 */
		sort: function (order) {
			var items = {}, rootEl = this.el;

			this.toArray().forEach(function (id, i) {
				var el = rootEl.children[i];

				if (_closest(el, this.options.draggable, rootEl)) {
					items[id] = el;
				}
			}, this);

			order.forEach(function (id) {
				if (items[id]) {
					rootEl.removeChild(items[id]);
					rootEl.appendChild(items[id]);
				}
			});
		},


		/**
		 * Save the current sorting
		 */
		save: function () {
			var store = this.options.store;
			store && store.set(this);
		},


		/**
		 * For each element in the set, get the first element that matches the selector by testing the element itself and traversing up through its ancestors in the DOM tree.
		 * @param   {HTMLElement}  el
		 * @param   {String}       [selector]  default: `options.draggable`
		 * @returns {HTMLElement|null}
		 */
		closest: function (el, selector) {
			return _closest(el, selector || this.options.draggable, this.el);
		},


		/**
		 * Set/get option
		 * @param   {string} name
		 * @param   {*}      [value]
		 * @returns {*}
		 */
		option: function (name, value) {
			var options = this.options;

			if (value === void 0) {
				return options[name];
			} else {
				options[name] = value;
			}
		},


		/**
		 * Destroy
		 */
		destroy: function () {
			var el = this.el, options = this.options;

			_customEvents.forEach(function (name) {
				_off(el, name.substr(2).toLowerCase(), options[name]);
			});

			_off(el, 'mousedown', this._onTapStart);
			_off(el, 'touchstart', this._onTapStart);

			_off(el, 'dragover', this);
			_off(el, 'dragenter', this);

			//remove draggable attributes
			Array.prototype.forEach.call(el.querySelectorAll('[draggable]'), function (el) {
				el.removeAttribute('draggable');
			});

			touchDragOverListeners.splice(touchDragOverListeners.indexOf(this._onDragOver), 1);

			this._onDrop();

			this.el = null;
		}
	};


	function _cloneHide(state) {
		if (cloneEl && (cloneEl.state !== state)) {
			_css(cloneEl, 'display', state ? 'none' : '');
			!state && cloneEl.state && rootEl.insertBefore(cloneEl, dragEl);
			cloneEl.state = state;
		}
	}


	function _bind(ctx, fn) {
		var args = slice.call(arguments, 2);
		return	fn.bind ? fn.bind.apply(fn, [ctx].concat(args)) : function () {
			return fn.apply(ctx, args.concat(slice.call(arguments)));
		};
	}


	function _closest(/**HTMLElement*/el, /**String*/selector, /**HTMLElement*/ctx) {
		if (el) {
			ctx = ctx || document;
			selector = selector.split('.');

			var tag = selector.shift().toUpperCase(),
				re = new RegExp('\\s(' + selector.join('|') + ')\\s', 'g');

			do {
				if (
					(tag === '>*' && el.parentNode === ctx) || (
						(tag === '' || el.nodeName.toUpperCase() == tag) &&
						(!selector.length || ((' ' + el.className + ' ').match(re) || []).length == selector.length)
					)
				) {
					return el;
				}
			}
			while (el !== ctx && (el = el.parentNode));
		}

		return null;
	}


	function _globalDragOver(/**Event*/evt) {
		evt.dataTransfer.dropEffect = 'move';
		evt.preventDefault();
	}


	function _on(el, event, fn) {
		el.addEventListener(event, fn, false);
	}


	function _off(el, event, fn) {
		el.removeEventListener(event, fn, false);
	}


	function _toggleClass(el, name, state) {
		if (el) {
			if (el.classList) {
				el.classList[state ? 'add' : 'remove'](name);
			}
			else {
				var className = (' ' + el.className + ' ').replace(/\s+/g, ' ').replace(' ' + name + ' ', '');
				el.className = className + (state ? ' ' + name : '');
			}
		}
	}


	function _css(el, prop, val) {
		var style = el && el.style;

		if (style) {
			if (val === void 0) {
				if (document.defaultView && document.defaultView.getComputedStyle) {
					val = document.defaultView.getComputedStyle(el, '');
				}
				else if (el.currentStyle) {
					val = el.currentStyle;
				}

				return prop === void 0 ? val : val[prop];
			}
			else {
				if (!(prop in style)) {
					prop = '-webkit-' + prop;
				}

				style[prop] = val + (typeof val === 'string' ? '' : 'px');
			}
		}
	}


	function _find(ctx, tagName, iterator) {
		if (ctx) {
			var list = ctx.getElementsByTagName(tagName), i = 0, n = list.length;

			if (iterator) {
				for (; i < n; i++) {
					iterator(list[i], i);
				}
			}

			return list;
		}

		return [];
	}


	function _disableDraggable(el) {
		el.draggable = false;
	}


	function _unsilent() {
		_silent = false;
	}


	/** @returns {HTMLElement|false} */
	function _ghostInBottom(el, evt) {
		var lastEl = el.lastElementChild, rect = lastEl.getBoundingClientRect();
		return (evt.clientY - (rect.top + rect.height) > 5) && lastEl; // min delta
	}


	/**
	 * Generate id
	 * @param   {HTMLElement} el
	 * @returns {String}
	 * @private
	 */
	function _generateId(el) {
		var str = el.tagName + el.className + el.src + el.href + el.textContent,
			i = str.length,
			sum = 0;

		while (i--) {
			sum += str.charCodeAt(i);
		}

		return sum.toString(36);
	}

	/**
	 * Returns the index of an element within its parent
	 * @param el
	 * @returns {number}
	 * @private
	 */
	function _index(/**HTMLElement*/el) {
		var index = 0;
		while (el && (el = el.previousElementSibling)) {
			if (el.nodeName.toUpperCase() !== 'TEMPLATE') {
				index++;
			}
		}
		return index;
	}

	function _throttle(callback, ms) {
		var args, _this;

		return function () {
			if (args === void 0) {
				args = arguments;
				_this = this;

				setTimeout(function () {
					if (args.length === 1) {
						callback.call(_this, args[0]);
					} else {
						callback.apply(_this, args);
					}

					args = void 0;
				}, ms);
			}
		};
	}


	// Export utils
	Sortable.utils = {
		on: _on,
		off: _off,
		css: _css,
		find: _find,
		bind: _bind,
		is: function (el, selector) {
			return !!_closest(el, selector, el);
		},
		throttle: _throttle,
		closest: _closest,
		toggleClass: _toggleClass,
		dispatchEvent: _dispatchEvent,
		index: _index
	};


	Sortable.version = '1.1.1';


	/**
	 * Create sortable instance
	 * @param {HTMLElement}  el
	 * @param {Object}      [options]
	 */
	Sortable.create = function (el, options) {
		return new Sortable(el, options);
	};

	// Export
	return Sortable;
});

},{}],3:[function(require,module,exports){
"use strict";

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, "__esModule", {
    value: true
});
"use strict";

var Sortable = require("sortablejs");
var mustache = require("mustache");

var Kanban = (function () {
    function Kanban(options) {
        _classCallCheck(this, Kanban);

        options = options || {};
        options.update = options.hasOwnProperty("update") ? options.update : null;
        options.el = options.hasOwnProperty("el") ? options.el : "";
        options.data = options.hasOwnProperty("data") ? options.data : [];
        this._options = options;

        this._el = document.querySelector(this._options.el);
        if (!this._el) {
            console.error(this._options.el + " is not exist in the current dom!");
        }

        this._data = this._options.data;
        this._updateMethod = this._options.update;

        this.renderComponent();
        this.setupEvents();
    }

    _createClass(Kanban, [{
        key: "render",
        value: function render(data) {
            var result = "";
            data.forEach(function (board) {
                result += "<div class=\"board__list\">";
                result += "<div class=\"board__list__title\">" + board.name + "</div>";
                result += "<div class=\"board__list__cards\">";
                board.cards.forEach(function (card) {
                    result += "<div " + "data-raw=\"" + card.name + "\" " + "data-cardid=\"" + card.cardid + "\" " + "class=\"board__card\">" + card.name + "</div>";
                });

                result += "</div>";
                result += "</div>";
            });
            return result;
        }
    }, {
        key: "setupEvents",
        value: function setupEvents() {
            var _this = this;

            this._boardIdIndex = 0;

            var boards = this._el.querySelectorAll(".board__list__cards");
            this._sortables = [];
            var self = this;
            Array.prototype.forEach.call(this._el.querySelectorAll(".board__card"), function (card) {
                card.addEventListener("dblclick", function () {
                    var raw = card.dataset.raw;
                    card.innerHTML = "<input class=\"board__inplace\">";
                    var inplace = card.querySelector(".board__inplace");
                    inplace.value = raw;
                    inplace.focus();
                    inplace.setSelectionRange(0, 9999);

                    var applyValueToData = (function (_applyValueToData) {
                        function applyValueToData() {
                            return _applyValueToData.apply(this, arguments);
                        }

                        applyValueToData.toString = function () {
                            return _applyValueToData.toString();
                        };

                        return applyValueToData;
                    })(function () {
                        var value = inplace.value;
                        card.innerHTML = value;
                        self._data.forEach(function (board) {
                            board.cards.forEach(function (c) {
                                console.log(card.dataset.cardid + " vs " + c.cardid);
                                console.log(typeof card.dataset.cardid + " vs " + typeof c.cardid);
                                if (card.dataset.cardid === "" + c.cardid) {
                                    console.log("hit!");
                                    c.name = value;
                                }
                            });
                        });

                        self.renderComponent();
                        self.setupEvents();
                        self._options.onUpdate(self._data);

                        inplace.removeEventListener("blur", applyValueToData);
                    });

                    inplace.addEventListener("blur", applyValueToData);
                });
            });

            Array.prototype.forEach.call(boards, function (board) {
                board.dataset.boardid = _this._boardIdIndex++;
                var sortableOptions = {
                    group: "kanban",
                    animation: 150
                };

                // Sync this._data from sortablejs events
                // Element is dropped into the list from another list
                sortableOptions.onAdd = function ( /**Event*/evt) {
                    var itemEl = evt.item; // dragged HTMLElement
                    var target = _this._data[board.dataset.boardid].cards;
                    target.splice(evt.newIndex, 0, {
                        name: itemEl.dataset.raw,
                        cardid: itemEl.dataset.cardid
                    });
                    if (_this._options.onUpdate) {
                        _this._options.onUpdate(_this._data);
                    }
                };
                // Changed sorting within list
                sortableOptions.onUpdate = function ( /**Event*/evt) {
                    var target = _this._data[board.dataset.boardid].cards;
                    var removed = target.splice(evt.oldIndex, 1);
                    target.splice(evt.newIndex, 0, removed[0]);
                    if (_this._options.onUpdate) {
                        _this._options.onUpdate(_this._data);
                    }
                };

                // Element is removed from the list into another list
                sortableOptions.onRemove = function ( /**Event*/evt) {
                    var target = _this._data[board.dataset.boardid].cards;
                    target.splice(evt.oldIndex, 1);
                    if (_this._options.onUpdate) {
                        _this._options.onUpdate(_this._data);
                    }
                };

                _this._sortables.push(Sortable.create(board, sortableOptions));
            });
        }
    }, {
        key: "renderComponent",
        value: function renderComponent() {
            //Remove All Events
            Array.prototype.forEach.call(this._el.querySelectorAll(".board__card"), function (card) {
                card.removeEventListener("dblclick");
            });
            this._el.innerHTML = this.render(this._data);
        }
    }, {
        key: "update",
        value: function update() {
            this._updateMethod(this._data);
        }
    }, {
        key: "setData",
        value: function setData(data) {
            this._sortables.forEach(function (sortable) {
                sortable.destroy();
            });
            this._data = data;
            this.renderComponent();
            this.setupEvents();
        }
    }], [{
        key: "mdToKanban",
        value: function mdToKanban(text) {
            var cardid = 0;

            var lines = text.split(/[\r|\n|\r\n]/);

            var output = [];
            var cards = [];
            lines.forEach(function (line) {
                if (line.trim().indexOf("#") === 0) {
                    cards = [];

                    output.push({
                        name: line.trim().replace("#", "").trim(),
                        cards: cards
                    });
                } else if (line.trim().indexOf("*") === 0) {
                    cards.push({
                        name: line.trim().replace("*", "").trim(),
                        cardid: cardid++
                    });
                }
            });
            return output;
        }
    }, {
        key: "kanbanToMd",
        value: function kanbanToMd(data) {
            var output = [];
            data.forEach(function (board) {
                output.push("# " + board.name);
                board.cards.forEach(function (card) {
                    output.push(" * " + card.name);
                });
            });
            return output.join("\n");
        }
    }]);

    return Kanban;
})();

exports["default"] = Kanban;
module.exports = exports["default"];

},{"mustache":1,"sortablejs":2}]},{},[3])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy5ub2RlYnJldy9pb2pzL3YxLjYuNC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvbXVzdGFjaGUvbXVzdGFjaGUuanMiLCJub2RlX21vZHVsZXMvc29ydGFibGVqcy9Tb3J0YWJsZS5qcyIsIi9Vc2Vycy95dWl3YWkvV2Vic3Rvcm1Qcm9qZWN0cy9zdHVkeS9tZDJrYW5iYW4vc3JjL21haW4uZXM2Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6bEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7O0FDM2hDQSxZQUFZLENBQUM7O0FBRWIsSUFBSSxRQUFRLEdBQUcsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ3JDLElBQUksUUFBUSxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQzs7QUFFbkMsSUFBSSxNQUFNO0FBa0hLLGFBbEhJLE1BQU0sQ0FrSFQsT0FBTyxFQUFDOzhCQWxITCxNQUFNOztBQW1IakIsZUFBTyxHQUFHLE9BQU8sSUFBSSxFQUFFLENBQUM7QUFDeEIsZUFBTyxDQUFDLE1BQU0sR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO0FBQzFFLGVBQU8sQ0FBQyxFQUFFLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsR0FBRyxPQUFPLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQztBQUM1RCxlQUFPLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksR0FBRyxFQUFFLENBQUM7QUFDbEUsWUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUM7O0FBRXhCLFlBQUksQ0FBQyxHQUFHLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3BELFlBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFDO0FBQ1QsbUJBQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLEdBQUcsbUNBQW1DLENBQUMsQ0FBQztTQUN6RTs7QUFFRCxZQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDO0FBQ2hDLFlBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUM7O0FBRTFDLFlBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztBQUN2QixZQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7S0FDdEI7O2lCQW5JYyxNQUFNOztlQUNmLGdCQUFDLElBQUksRUFBQztBQUNSLGdCQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFDaEIsZ0JBQUksQ0FBQyxPQUFPLENBQUMsVUFBQyxLQUFLLEVBQUc7QUFDbEIsc0JBQU0sSUFBSSw2QkFBMkIsQ0FBQztBQUNsQyxzQkFBTSxJQUFJLG9DQUFrQyxHQUFHLEtBQUssQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDO0FBQ3JFLHNCQUFNLElBQUksb0NBQWtDLENBQUM7QUFDN0MscUJBQUssQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFVBQUMsSUFBSSxFQUFHO0FBQ3hCLDBCQUFNLElBQUksT0FBTyxHQUNiLGFBQVksR0FBRyxJQUFJLENBQUMsSUFBSSxHQUFHLEtBQUksR0FDL0IsZ0JBQWUsR0FBRyxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUksR0FDcEMsd0JBQXNCLEdBQUcsSUFBSSxDQUFDLElBQUksR0FBRyxRQUFRLENBQUM7aUJBQ3JELENBQUMsQ0FBQzs7QUFFUCxzQkFBTSxJQUFJLFFBQVEsQ0FBQztBQUNuQixzQkFBTSxJQUFJLFFBQVEsQ0FBQzthQUN0QixDQUFDLENBQUM7QUFDSCxtQkFBTyxNQUFNLENBQUM7U0FDakI7OztlQUVVLHVCQUFFOzs7QUFDVCxnQkFBSSxDQUFDLGFBQWEsR0FBRyxDQUFDLENBQUM7O0FBRXZCLGdCQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLHFCQUFxQixDQUFDLENBQUM7QUFDOUQsZ0JBQUksQ0FBQyxVQUFVLEdBQUcsRUFBRSxDQUFDO0FBQ3JCLGdCQUFJLElBQUksR0FBRyxJQUFJLENBQUM7QUFDaEIsaUJBQUssQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLGNBQWMsQ0FBQyxFQUFFLFVBQVMsSUFBSSxFQUFDO0FBQ2xGLG9CQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxFQUFFLFlBQUk7QUFDbEMsd0JBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDO0FBQzNCLHdCQUFJLENBQUMsU0FBUyxHQUFHLGtDQUFnQyxDQUFDO0FBQ2xELHdCQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLGlCQUFpQixDQUFDLENBQUM7QUFDcEQsMkJBQU8sQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDO0FBQ3BCLDJCQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDaEIsMkJBQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7O0FBRW5DLHdCQUFJLGdCQUFnQjs7Ozs7Ozs7Ozt1QkFBRyxZQUFJO0FBQ3ZCLDRCQUFJLEtBQUssR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDO0FBQzFCLDRCQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztBQUN2Qiw0QkFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBQyxLQUFLLEVBQUc7QUFDeEIsaUNBQUssQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFVBQUMsQ0FBQyxFQUFHO0FBQ3JCLHVDQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFJLE1BQU0sR0FBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUE7QUFDcEQsdUNBQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBSSxNQUFNLEdBQUUsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUE7QUFDbEUsb0NBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUM7QUFDckMsMkNBQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDcEIscUNBQUMsQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDO2lDQUNsQjs2QkFDSixDQUFDLENBQUE7eUJBQ0wsQ0FBQyxDQUFDOztBQUdILDRCQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7QUFDdkIsNEJBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztBQUNuQiw0QkFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDOztBQUVuQywrQkFBTyxDQUFDLG1CQUFtQixDQUFDLE1BQU0sRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO3FCQUN6RCxDQUFBLENBQUM7O0FBRUYsMkJBQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztpQkFDdEQsQ0FBQyxDQUFDO2FBQ04sQ0FBQyxDQUFDOztBQUVILGlCQUFLLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLFVBQUMsS0FBSyxFQUFJO0FBQzNDLHFCQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sR0FBRyxNQUFLLGFBQWEsRUFBRSxDQUFDO0FBQzdDLG9CQUFJLGVBQWUsR0FBRztBQUNsQix5QkFBSyxFQUFFLFFBQVE7QUFDZiw2QkFBUyxFQUFFLEdBQUc7aUJBQ2pCLENBQUM7Ozs7QUFJRiwrQkFBZSxDQUFDLEtBQUssR0FBRyxxQkFBVyxHQUFHLEVBQUs7QUFDdkMsd0JBQUksTUFBTSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUM7QUFDdEIsd0JBQUksTUFBTSxHQUFHLE1BQUssS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ3JELDBCQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxFQUFFO0FBQzNCLDRCQUFJLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHO0FBQ3hCLDhCQUFNLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNO3FCQUNoQyxDQUFDLENBQUM7QUFDSCx3QkFBRyxNQUFLLFFBQVEsQ0FBQyxRQUFRLEVBQUM7QUFDdEIsOEJBQUssUUFBUSxDQUFDLFFBQVEsQ0FBQyxNQUFLLEtBQUssQ0FBQyxDQUFDO3FCQUN0QztpQkFFSixDQUFDOztBQUVGLCtCQUFlLENBQUMsUUFBUSxHQUFHLHFCQUFXLEdBQUcsRUFBSztBQUMxQyx3QkFBSSxNQUFNLEdBQUcsTUFBSyxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDckQsd0JBQUksT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUM3QywwQkFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMzQyx3QkFBRyxNQUFLLFFBQVEsQ0FBQyxRQUFRLEVBQUM7QUFDdEIsOEJBQUssUUFBUSxDQUFDLFFBQVEsQ0FBQyxNQUFLLEtBQUssQ0FBQyxDQUFDO3FCQUN0QztpQkFFSixDQUFDOzs7QUFHRiwrQkFBZSxDQUFDLFFBQVEsR0FBRyxxQkFBVyxHQUFHLEVBQUs7QUFDMUMsd0JBQUksTUFBTSxHQUFHLE1BQUssS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ3JELDBCQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDL0Isd0JBQUcsTUFBSyxRQUFRLENBQUMsUUFBUSxFQUFDO0FBQ3RCLDhCQUFLLFFBQVEsQ0FBQyxRQUFRLENBQUMsTUFBSyxLQUFLLENBQUMsQ0FBQztxQkFDdEM7aUJBQ0osQ0FBQzs7QUFFRixzQkFBSyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUM7YUFDakUsQ0FBQyxDQUFDO1NBQ047OztlQUVjLDJCQUFFOztBQUViLGlCQUFLLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxjQUFjLENBQUMsRUFBRSxVQUFTLElBQUksRUFBQztBQUNsRixvQkFBSSxDQUFDLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxDQUFDO2FBQ3hDLENBQUMsQ0FBQztBQUNILGdCQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUNoRDs7O2VBcUJLLGtCQUFFO0FBQ0osZ0JBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQ2xDOzs7ZUFFTSxpQkFBQyxJQUFJLEVBQUM7QUFDVCxnQkFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsVUFBQyxRQUFRLEVBQUc7QUFDaEMsd0JBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQzthQUN0QixDQUFDLENBQUM7QUFDSCxnQkFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7QUFDbEIsZ0JBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztBQUN2QixnQkFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1NBQ3RCOzs7ZUFDZ0Isb0JBQUMsSUFBSSxFQUFDO0FBQ25CLGdCQUFJLE1BQU0sR0FBRyxDQUFDLENBQUM7O0FBRWYsZ0JBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUM7O0FBRXZDLGdCQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFDaEIsZ0JBQUksS0FBSyxHQUFHLEVBQUUsQ0FBQztBQUNmLGlCQUFLLENBQUMsT0FBTyxDQUFDLFVBQVMsSUFBSSxFQUFDO0FBQ3hCLG9CQUFHLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFDO0FBQzlCLHlCQUFLLEdBQUcsRUFBRSxDQUFDOztBQUVYLDBCQUFNLENBQUMsSUFBSSxDQUFDO0FBQ1IsNEJBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUU7QUFDekMsNkJBQUssRUFBRSxLQUFLO3FCQUNmLENBQUMsQ0FBQztpQkFDTixNQUFLLElBQUcsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUM7QUFDcEMseUJBQUssQ0FBQyxJQUFJLENBQUM7QUFDUCw0QkFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRTtBQUN6Qyw4QkFBTSxFQUFFLE1BQU0sRUFBRTtxQkFDbkIsQ0FBQyxDQUFDO2lCQUNOO2FBQ0osQ0FBQyxDQUFDO0FBQ0gsbUJBQU8sTUFBTSxDQUFDO1NBQ2pCOzs7ZUFFZ0Isb0JBQUMsSUFBSSxFQUFDO0FBQ25CLGdCQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFDaEIsZ0JBQUksQ0FBQyxPQUFPLENBQUMsVUFBUyxLQUFLLEVBQUM7QUFDeEIsc0JBQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMvQixxQkFBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBUyxJQUFJLEVBQUM7QUFDOUIsMEJBQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztpQkFDbEMsQ0FBQyxDQUFBO2FBQ0wsQ0FBQyxDQUFDO0FBQ0gsbUJBQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUM1Qjs7O1dBbkxjLE1BQU07SUFvTHhCLENBQUM7O3FCQUVhLE1BQU0iLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyohXG4gKiBtdXN0YWNoZS5qcyAtIExvZ2ljLWxlc3Mge3ttdXN0YWNoZX19IHRlbXBsYXRlcyB3aXRoIEphdmFTY3JpcHRcbiAqIGh0dHA6Ly9naXRodWIuY29tL2phbmwvbXVzdGFjaGUuanNcbiAqL1xuXG4vKmdsb2JhbCBkZWZpbmU6IGZhbHNlKi9cblxuKGZ1bmN0aW9uIChnbG9iYWwsIGZhY3RvcnkpIHtcbiAgaWYgKHR5cGVvZiBleHBvcnRzID09PSBcIm9iamVjdFwiICYmIGV4cG9ydHMpIHtcbiAgICBmYWN0b3J5KGV4cG9ydHMpOyAvLyBDb21tb25KU1xuICB9IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKFsnZXhwb3J0cyddLCBmYWN0b3J5KTsgLy8gQU1EXG4gIH0gZWxzZSB7XG4gICAgZmFjdG9yeShnbG9iYWwuTXVzdGFjaGUgPSB7fSk7IC8vIDxzY3JpcHQ+XG4gIH1cbn0odGhpcywgZnVuY3Rpb24gKG11c3RhY2hlKSB7XG5cbiAgdmFyIE9iamVjdF90b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG4gIHZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgcmV0dXJuIE9iamVjdF90b1N0cmluZy5jYWxsKG9iamVjdCkgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gIH07XG5cbiAgZnVuY3Rpb24gaXNGdW5jdGlvbihvYmplY3QpIHtcbiAgICByZXR1cm4gdHlwZW9mIG9iamVjdCA9PT0gJ2Z1bmN0aW9uJztcbiAgfVxuXG4gIGZ1bmN0aW9uIGVzY2FwZVJlZ0V4cChzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoL1tcXC1cXFtcXF17fSgpKis/LixcXFxcXFxeJHwjXFxzXS9nLCBcIlxcXFwkJlwiKTtcbiAgfVxuXG4gIC8vIFdvcmthcm91bmQgZm9yIGh0dHBzOi8vaXNzdWVzLmFwYWNoZS5vcmcvamlyYS9icm93c2UvQ09VQ0hEQi01NzdcbiAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9qYW5sL211c3RhY2hlLmpzL2lzc3Vlcy8xODlcbiAgdmFyIFJlZ0V4cF90ZXN0ID0gUmVnRXhwLnByb3RvdHlwZS50ZXN0O1xuICBmdW5jdGlvbiB0ZXN0UmVnRXhwKHJlLCBzdHJpbmcpIHtcbiAgICByZXR1cm4gUmVnRXhwX3Rlc3QuY2FsbChyZSwgc3RyaW5nKTtcbiAgfVxuXG4gIHZhciBub25TcGFjZVJlID0gL1xcUy87XG4gIGZ1bmN0aW9uIGlzV2hpdGVzcGFjZShzdHJpbmcpIHtcbiAgICByZXR1cm4gIXRlc3RSZWdFeHAobm9uU3BhY2VSZSwgc3RyaW5nKTtcbiAgfVxuXG4gIHZhciBlbnRpdHlNYXAgPSB7XG4gICAgXCImXCI6IFwiJmFtcDtcIixcbiAgICBcIjxcIjogXCImbHQ7XCIsXG4gICAgXCI+XCI6IFwiJmd0O1wiLFxuICAgICdcIic6ICcmcXVvdDsnLFxuICAgIFwiJ1wiOiAnJiMzOTsnLFxuICAgIFwiL1wiOiAnJiN4MkY7J1xuICB9O1xuXG4gIGZ1bmN0aW9uIGVzY2FwZUh0bWwoc3RyaW5nKSB7XG4gICAgcmV0dXJuIFN0cmluZyhzdHJpbmcpLnJlcGxhY2UoL1smPD5cIidcXC9dL2csIGZ1bmN0aW9uIChzKSB7XG4gICAgICByZXR1cm4gZW50aXR5TWFwW3NdO1xuICAgIH0pO1xuICB9XG5cbiAgdmFyIHdoaXRlUmUgPSAvXFxzKi87XG4gIHZhciBzcGFjZVJlID0gL1xccysvO1xuICB2YXIgZXF1YWxzUmUgPSAvXFxzKj0vO1xuICB2YXIgY3VybHlSZSA9IC9cXHMqXFx9LztcbiAgdmFyIHRhZ1JlID0gLyN8XFxefFxcL3w+fFxce3wmfD18IS87XG5cbiAgLyoqXG4gICAqIEJyZWFrcyB1cCB0aGUgZ2l2ZW4gYHRlbXBsYXRlYCBzdHJpbmcgaW50byBhIHRyZWUgb2YgdG9rZW5zLiBJZiB0aGUgYHRhZ3NgXG4gICAqIGFyZ3VtZW50IGlzIGdpdmVuIGhlcmUgaXQgbXVzdCBiZSBhbiBhcnJheSB3aXRoIHR3byBzdHJpbmcgdmFsdWVzOiB0aGVcbiAgICogb3BlbmluZyBhbmQgY2xvc2luZyB0YWdzIHVzZWQgaW4gdGhlIHRlbXBsYXRlIChlLmcuIFsgXCI8JVwiLCBcIiU+XCIgXSkuIE9mXG4gICAqIGNvdXJzZSwgdGhlIGRlZmF1bHQgaXMgdG8gdXNlIG11c3RhY2hlcyAoaS5lLiBtdXN0YWNoZS50YWdzKS5cbiAgICpcbiAgICogQSB0b2tlbiBpcyBhbiBhcnJheSB3aXRoIGF0IGxlYXN0IDQgZWxlbWVudHMuIFRoZSBmaXJzdCBlbGVtZW50IGlzIHRoZVxuICAgKiBtdXN0YWNoZSBzeW1ib2wgdGhhdCB3YXMgdXNlZCBpbnNpZGUgdGhlIHRhZywgZS5nLiBcIiNcIiBvciBcIiZcIi4gSWYgdGhlIHRhZ1xuICAgKiBkaWQgbm90IGNvbnRhaW4gYSBzeW1ib2wgKGkuZS4ge3tteVZhbHVlfX0pIHRoaXMgZWxlbWVudCBpcyBcIm5hbWVcIi4gRm9yXG4gICAqIGFsbCB0ZXh0IHRoYXQgYXBwZWFycyBvdXRzaWRlIGEgc3ltYm9sIHRoaXMgZWxlbWVudCBpcyBcInRleHRcIi5cbiAgICpcbiAgICogVGhlIHNlY29uZCBlbGVtZW50IG9mIGEgdG9rZW4gaXMgaXRzIFwidmFsdWVcIi4gRm9yIG11c3RhY2hlIHRhZ3MgdGhpcyBpc1xuICAgKiB3aGF0ZXZlciBlbHNlIHdhcyBpbnNpZGUgdGhlIHRhZyBiZXNpZGVzIHRoZSBvcGVuaW5nIHN5bWJvbC4gRm9yIHRleHQgdG9rZW5zXG4gICAqIHRoaXMgaXMgdGhlIHRleHQgaXRzZWxmLlxuICAgKlxuICAgKiBUaGUgdGhpcmQgYW5kIGZvdXJ0aCBlbGVtZW50cyBvZiB0aGUgdG9rZW4gYXJlIHRoZSBzdGFydCBhbmQgZW5kIGluZGljZXMsXG4gICAqIHJlc3BlY3RpdmVseSwgb2YgdGhlIHRva2VuIGluIHRoZSBvcmlnaW5hbCB0ZW1wbGF0ZS5cbiAgICpcbiAgICogVG9rZW5zIHRoYXQgYXJlIHRoZSByb290IG5vZGUgb2YgYSBzdWJ0cmVlIGNvbnRhaW4gdHdvIG1vcmUgZWxlbWVudHM6IDEpIGFuXG4gICAqIGFycmF5IG9mIHRva2VucyBpbiB0aGUgc3VidHJlZSBhbmQgMikgdGhlIGluZGV4IGluIHRoZSBvcmlnaW5hbCB0ZW1wbGF0ZSBhdFxuICAgKiB3aGljaCB0aGUgY2xvc2luZyB0YWcgZm9yIHRoYXQgc2VjdGlvbiBiZWdpbnMuXG4gICAqL1xuICBmdW5jdGlvbiBwYXJzZVRlbXBsYXRlKHRlbXBsYXRlLCB0YWdzKSB7XG4gICAgaWYgKCF0ZW1wbGF0ZSlcbiAgICAgIHJldHVybiBbXTtcblxuICAgIHZhciBzZWN0aW9ucyA9IFtdOyAgICAgLy8gU3RhY2sgdG8gaG9sZCBzZWN0aW9uIHRva2Vuc1xuICAgIHZhciB0b2tlbnMgPSBbXTsgICAgICAgLy8gQnVmZmVyIHRvIGhvbGQgdGhlIHRva2Vuc1xuICAgIHZhciBzcGFjZXMgPSBbXTsgICAgICAgLy8gSW5kaWNlcyBvZiB3aGl0ZXNwYWNlIHRva2VucyBvbiB0aGUgY3VycmVudCBsaW5lXG4gICAgdmFyIGhhc1RhZyA9IGZhbHNlOyAgICAvLyBJcyB0aGVyZSBhIHt7dGFnfX0gb24gdGhlIGN1cnJlbnQgbGluZT9cbiAgICB2YXIgbm9uU3BhY2UgPSBmYWxzZTsgIC8vIElzIHRoZXJlIGEgbm9uLXNwYWNlIGNoYXIgb24gdGhlIGN1cnJlbnQgbGluZT9cblxuICAgIC8vIFN0cmlwcyBhbGwgd2hpdGVzcGFjZSB0b2tlbnMgYXJyYXkgZm9yIHRoZSBjdXJyZW50IGxpbmVcbiAgICAvLyBpZiB0aGVyZSB3YXMgYSB7eyN0YWd9fSBvbiBpdCBhbmQgb3RoZXJ3aXNlIG9ubHkgc3BhY2UuXG4gICAgZnVuY3Rpb24gc3RyaXBTcGFjZSgpIHtcbiAgICAgIGlmIChoYXNUYWcgJiYgIW5vblNwYWNlKSB7XG4gICAgICAgIHdoaWxlIChzcGFjZXMubGVuZ3RoKVxuICAgICAgICAgIGRlbGV0ZSB0b2tlbnNbc3BhY2VzLnBvcCgpXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNwYWNlcyA9IFtdO1xuICAgICAgfVxuXG4gICAgICBoYXNUYWcgPSBmYWxzZTtcbiAgICAgIG5vblNwYWNlID0gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIG9wZW5pbmdUYWdSZSwgY2xvc2luZ1RhZ1JlLCBjbG9zaW5nQ3VybHlSZTtcbiAgICBmdW5jdGlvbiBjb21waWxlVGFncyh0YWdzKSB7XG4gICAgICBpZiAodHlwZW9mIHRhZ3MgPT09ICdzdHJpbmcnKVxuICAgICAgICB0YWdzID0gdGFncy5zcGxpdChzcGFjZVJlLCAyKTtcblxuICAgICAgaWYgKCFpc0FycmF5KHRhZ3MpIHx8IHRhZ3MubGVuZ3RoICE9PSAyKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgdGFnczogJyArIHRhZ3MpO1xuXG4gICAgICBvcGVuaW5nVGFnUmUgPSBuZXcgUmVnRXhwKGVzY2FwZVJlZ0V4cCh0YWdzWzBdKSArICdcXFxccyonKTtcbiAgICAgIGNsb3NpbmdUYWdSZSA9IG5ldyBSZWdFeHAoJ1xcXFxzKicgKyBlc2NhcGVSZWdFeHAodGFnc1sxXSkpO1xuICAgICAgY2xvc2luZ0N1cmx5UmUgPSBuZXcgUmVnRXhwKCdcXFxccyonICsgZXNjYXBlUmVnRXhwKCd9JyArIHRhZ3NbMV0pKTtcbiAgICB9XG5cbiAgICBjb21waWxlVGFncyh0YWdzIHx8IG11c3RhY2hlLnRhZ3MpO1xuXG4gICAgdmFyIHNjYW5uZXIgPSBuZXcgU2Nhbm5lcih0ZW1wbGF0ZSk7XG5cbiAgICB2YXIgc3RhcnQsIHR5cGUsIHZhbHVlLCBjaHIsIHRva2VuLCBvcGVuU2VjdGlvbjtcbiAgICB3aGlsZSAoIXNjYW5uZXIuZW9zKCkpIHtcbiAgICAgIHN0YXJ0ID0gc2Nhbm5lci5wb3M7XG5cbiAgICAgIC8vIE1hdGNoIGFueSB0ZXh0IGJldHdlZW4gdGFncy5cbiAgICAgIHZhbHVlID0gc2Nhbm5lci5zY2FuVW50aWwob3BlbmluZ1RhZ1JlKTtcblxuICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCB2YWx1ZUxlbmd0aCA9IHZhbHVlLmxlbmd0aDsgaSA8IHZhbHVlTGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICBjaHIgPSB2YWx1ZS5jaGFyQXQoaSk7XG5cbiAgICAgICAgICBpZiAoaXNXaGl0ZXNwYWNlKGNocikpIHtcbiAgICAgICAgICAgIHNwYWNlcy5wdXNoKHRva2Vucy5sZW5ndGgpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBub25TcGFjZSA9IHRydWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdG9rZW5zLnB1c2goWyAndGV4dCcsIGNociwgc3RhcnQsIHN0YXJ0ICsgMSBdKTtcbiAgICAgICAgICBzdGFydCArPSAxO1xuXG4gICAgICAgICAgLy8gQ2hlY2sgZm9yIHdoaXRlc3BhY2Ugb24gdGhlIGN1cnJlbnQgbGluZS5cbiAgICAgICAgICBpZiAoY2hyID09PSAnXFxuJylcbiAgICAgICAgICAgIHN0cmlwU3BhY2UoKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBNYXRjaCB0aGUgb3BlbmluZyB0YWcuXG4gICAgICBpZiAoIXNjYW5uZXIuc2NhbihvcGVuaW5nVGFnUmUpKVxuICAgICAgICBicmVhaztcblxuICAgICAgaGFzVGFnID0gdHJ1ZTtcblxuICAgICAgLy8gR2V0IHRoZSB0YWcgdHlwZS5cbiAgICAgIHR5cGUgPSBzY2FubmVyLnNjYW4odGFnUmUpIHx8ICduYW1lJztcbiAgICAgIHNjYW5uZXIuc2Nhbih3aGl0ZVJlKTtcblxuICAgICAgLy8gR2V0IHRoZSB0YWcgdmFsdWUuXG4gICAgICBpZiAodHlwZSA9PT0gJz0nKSB7XG4gICAgICAgIHZhbHVlID0gc2Nhbm5lci5zY2FuVW50aWwoZXF1YWxzUmUpO1xuICAgICAgICBzY2FubmVyLnNjYW4oZXF1YWxzUmUpO1xuICAgICAgICBzY2FubmVyLnNjYW5VbnRpbChjbG9zaW5nVGFnUmUpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAneycpIHtcbiAgICAgICAgdmFsdWUgPSBzY2FubmVyLnNjYW5VbnRpbChjbG9zaW5nQ3VybHlSZSk7XG4gICAgICAgIHNjYW5uZXIuc2NhbihjdXJseVJlKTtcbiAgICAgICAgc2Nhbm5lci5zY2FuVW50aWwoY2xvc2luZ1RhZ1JlKTtcbiAgICAgICAgdHlwZSA9ICcmJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbHVlID0gc2Nhbm5lci5zY2FuVW50aWwoY2xvc2luZ1RhZ1JlKTtcbiAgICAgIH1cblxuICAgICAgLy8gTWF0Y2ggdGhlIGNsb3NpbmcgdGFnLlxuICAgICAgaWYgKCFzY2FubmVyLnNjYW4oY2xvc2luZ1RhZ1JlKSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmNsb3NlZCB0YWcgYXQgJyArIHNjYW5uZXIucG9zKTtcblxuICAgICAgdG9rZW4gPSBbIHR5cGUsIHZhbHVlLCBzdGFydCwgc2Nhbm5lci5wb3MgXTtcbiAgICAgIHRva2Vucy5wdXNoKHRva2VuKTtcblxuICAgICAgaWYgKHR5cGUgPT09ICcjJyB8fCB0eXBlID09PSAnXicpIHtcbiAgICAgICAgc2VjdGlvbnMucHVzaCh0b2tlbik7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICcvJykge1xuICAgICAgICAvLyBDaGVjayBzZWN0aW9uIG5lc3RpbmcuXG4gICAgICAgIG9wZW5TZWN0aW9uID0gc2VjdGlvbnMucG9wKCk7XG5cbiAgICAgICAgaWYgKCFvcGVuU2VjdGlvbilcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vub3BlbmVkIHNlY3Rpb24gXCInICsgdmFsdWUgKyAnXCIgYXQgJyArIHN0YXJ0KTtcblxuICAgICAgICBpZiAob3BlblNlY3Rpb25bMV0gIT09IHZhbHVlKVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5jbG9zZWQgc2VjdGlvbiBcIicgKyBvcGVuU2VjdGlvblsxXSArICdcIiBhdCAnICsgc3RhcnQpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnbmFtZScgfHwgdHlwZSA9PT0gJ3snIHx8IHR5cGUgPT09ICcmJykge1xuICAgICAgICBub25TcGFjZSA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICc9Jykge1xuICAgICAgICAvLyBTZXQgdGhlIHRhZ3MgZm9yIHRoZSBuZXh0IHRpbWUgYXJvdW5kLlxuICAgICAgICBjb21waWxlVGFncyh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTWFrZSBzdXJlIHRoZXJlIGFyZSBubyBvcGVuIHNlY3Rpb25zIHdoZW4gd2UncmUgZG9uZS5cbiAgICBvcGVuU2VjdGlvbiA9IHNlY3Rpb25zLnBvcCgpO1xuXG4gICAgaWYgKG9wZW5TZWN0aW9uKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmNsb3NlZCBzZWN0aW9uIFwiJyArIG9wZW5TZWN0aW9uWzFdICsgJ1wiIGF0ICcgKyBzY2FubmVyLnBvcyk7XG5cbiAgICByZXR1cm4gbmVzdFRva2VucyhzcXVhc2hUb2tlbnModG9rZW5zKSk7XG4gIH1cblxuICAvKipcbiAgICogQ29tYmluZXMgdGhlIHZhbHVlcyBvZiBjb25zZWN1dGl2ZSB0ZXh0IHRva2VucyBpbiB0aGUgZ2l2ZW4gYHRva2Vuc2AgYXJyYXlcbiAgICogdG8gYSBzaW5nbGUgdG9rZW4uXG4gICAqL1xuICBmdW5jdGlvbiBzcXVhc2hUb2tlbnModG9rZW5zKSB7XG4gICAgdmFyIHNxdWFzaGVkVG9rZW5zID0gW107XG5cbiAgICB2YXIgdG9rZW4sIGxhc3RUb2tlbjtcbiAgICBmb3IgKHZhciBpID0gMCwgbnVtVG9rZW5zID0gdG9rZW5zLmxlbmd0aDsgaSA8IG51bVRva2VuczsgKytpKSB7XG4gICAgICB0b2tlbiA9IHRva2Vuc1tpXTtcblxuICAgICAgaWYgKHRva2VuKSB7XG4gICAgICAgIGlmICh0b2tlblswXSA9PT0gJ3RleHQnICYmIGxhc3RUb2tlbiAmJiBsYXN0VG9rZW5bMF0gPT09ICd0ZXh0Jykge1xuICAgICAgICAgIGxhc3RUb2tlblsxXSArPSB0b2tlblsxXTtcbiAgICAgICAgICBsYXN0VG9rZW5bM10gPSB0b2tlblszXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzcXVhc2hlZFRva2Vucy5wdXNoKHRva2VuKTtcbiAgICAgICAgICBsYXN0VG9rZW4gPSB0b2tlbjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzcXVhc2hlZFRva2VucztcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3JtcyB0aGUgZ2l2ZW4gYXJyYXkgb2YgYHRva2Vuc2AgaW50byBhIG5lc3RlZCB0cmVlIHN0cnVjdHVyZSB3aGVyZVxuICAgKiB0b2tlbnMgdGhhdCByZXByZXNlbnQgYSBzZWN0aW9uIGhhdmUgdHdvIGFkZGl0aW9uYWwgaXRlbXM6IDEpIGFuIGFycmF5IG9mXG4gICAqIGFsbCB0b2tlbnMgdGhhdCBhcHBlYXIgaW4gdGhhdCBzZWN0aW9uIGFuZCAyKSB0aGUgaW5kZXggaW4gdGhlIG9yaWdpbmFsXG4gICAqIHRlbXBsYXRlIHRoYXQgcmVwcmVzZW50cyB0aGUgZW5kIG9mIHRoYXQgc2VjdGlvbi5cbiAgICovXG4gIGZ1bmN0aW9uIG5lc3RUb2tlbnModG9rZW5zKSB7XG4gICAgdmFyIG5lc3RlZFRva2VucyA9IFtdO1xuICAgIHZhciBjb2xsZWN0b3IgPSBuZXN0ZWRUb2tlbnM7XG4gICAgdmFyIHNlY3Rpb25zID0gW107XG5cbiAgICB2YXIgdG9rZW4sIHNlY3Rpb247XG4gICAgZm9yICh2YXIgaSA9IDAsIG51bVRva2VucyA9IHRva2Vucy5sZW5ndGg7IGkgPCBudW1Ub2tlbnM7ICsraSkge1xuICAgICAgdG9rZW4gPSB0b2tlbnNbaV07XG5cbiAgICAgIHN3aXRjaCAodG9rZW5bMF0pIHtcbiAgICAgIGNhc2UgJyMnOlxuICAgICAgY2FzZSAnXic6XG4gICAgICAgIGNvbGxlY3Rvci5wdXNoKHRva2VuKTtcbiAgICAgICAgc2VjdGlvbnMucHVzaCh0b2tlbik7XG4gICAgICAgIGNvbGxlY3RvciA9IHRva2VuWzRdID0gW107XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnLyc6XG4gICAgICAgIHNlY3Rpb24gPSBzZWN0aW9ucy5wb3AoKTtcbiAgICAgICAgc2VjdGlvbls1XSA9IHRva2VuWzJdO1xuICAgICAgICBjb2xsZWN0b3IgPSBzZWN0aW9ucy5sZW5ndGggPiAwID8gc2VjdGlvbnNbc2VjdGlvbnMubGVuZ3RoIC0gMV1bNF0gOiBuZXN0ZWRUb2tlbnM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgY29sbGVjdG9yLnB1c2godG9rZW4pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBuZXN0ZWRUb2tlbnM7XG4gIH1cblxuICAvKipcbiAgICogQSBzaW1wbGUgc3RyaW5nIHNjYW5uZXIgdGhhdCBpcyB1c2VkIGJ5IHRoZSB0ZW1wbGF0ZSBwYXJzZXIgdG8gZmluZFxuICAgKiB0b2tlbnMgaW4gdGVtcGxhdGUgc3RyaW5ncy5cbiAgICovXG4gIGZ1bmN0aW9uIFNjYW5uZXIoc3RyaW5nKSB7XG4gICAgdGhpcy5zdHJpbmcgPSBzdHJpbmc7XG4gICAgdGhpcy50YWlsID0gc3RyaW5nO1xuICAgIHRoaXMucG9zID0gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdGFpbCBpcyBlbXB0eSAoZW5kIG9mIHN0cmluZykuXG4gICAqL1xuICBTY2FubmVyLnByb3RvdHlwZS5lb3MgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMudGFpbCA9PT0gXCJcIjtcbiAgfTtcblxuICAvKipcbiAgICogVHJpZXMgdG8gbWF0Y2ggdGhlIGdpdmVuIHJlZ3VsYXIgZXhwcmVzc2lvbiBhdCB0aGUgY3VycmVudCBwb3NpdGlvbi5cbiAgICogUmV0dXJucyB0aGUgbWF0Y2hlZCB0ZXh0IGlmIGl0IGNhbiBtYXRjaCwgdGhlIGVtcHR5IHN0cmluZyBvdGhlcndpc2UuXG4gICAqL1xuICBTY2FubmVyLnByb3RvdHlwZS5zY2FuID0gZnVuY3Rpb24gKHJlKSB7XG4gICAgdmFyIG1hdGNoID0gdGhpcy50YWlsLm1hdGNoKHJlKTtcblxuICAgIGlmICghbWF0Y2ggfHwgbWF0Y2guaW5kZXggIT09IDApXG4gICAgICByZXR1cm4gJyc7XG5cbiAgICB2YXIgc3RyaW5nID0gbWF0Y2hbMF07XG5cbiAgICB0aGlzLnRhaWwgPSB0aGlzLnRhaWwuc3Vic3RyaW5nKHN0cmluZy5sZW5ndGgpO1xuICAgIHRoaXMucG9zICs9IHN0cmluZy5sZW5ndGg7XG5cbiAgICByZXR1cm4gc3RyaW5nO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTa2lwcyBhbGwgdGV4dCB1bnRpbCB0aGUgZ2l2ZW4gcmVndWxhciBleHByZXNzaW9uIGNhbiBiZSBtYXRjaGVkLiBSZXR1cm5zXG4gICAqIHRoZSBza2lwcGVkIHN0cmluZywgd2hpY2ggaXMgdGhlIGVudGlyZSB0YWlsIGlmIG5vIG1hdGNoIGNhbiBiZSBtYWRlLlxuICAgKi9cbiAgU2Nhbm5lci5wcm90b3R5cGUuc2NhblVudGlsID0gZnVuY3Rpb24gKHJlKSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy50YWlsLnNlYXJjaChyZSksIG1hdGNoO1xuXG4gICAgc3dpdGNoIChpbmRleCkge1xuICAgIGNhc2UgLTE6XG4gICAgICBtYXRjaCA9IHRoaXMudGFpbDtcbiAgICAgIHRoaXMudGFpbCA9IFwiXCI7XG4gICAgICBicmVhaztcbiAgICBjYXNlIDA6XG4gICAgICBtYXRjaCA9IFwiXCI7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgbWF0Y2ggPSB0aGlzLnRhaWwuc3Vic3RyaW5nKDAsIGluZGV4KTtcbiAgICAgIHRoaXMudGFpbCA9IHRoaXMudGFpbC5zdWJzdHJpbmcoaW5kZXgpO1xuICAgIH1cblxuICAgIHRoaXMucG9zICs9IG1hdGNoLmxlbmd0aDtcblxuICAgIHJldHVybiBtYXRjaDtcbiAgfTtcblxuICAvKipcbiAgICogUmVwcmVzZW50cyBhIHJlbmRlcmluZyBjb250ZXh0IGJ5IHdyYXBwaW5nIGEgdmlldyBvYmplY3QgYW5kXG4gICAqIG1haW50YWluaW5nIGEgcmVmZXJlbmNlIHRvIHRoZSBwYXJlbnQgY29udGV4dC5cbiAgICovXG4gIGZ1bmN0aW9uIENvbnRleHQodmlldywgcGFyZW50Q29udGV4dCkge1xuICAgIHRoaXMudmlldyA9IHZpZXc7XG4gICAgdGhpcy5jYWNoZSA9IHsgJy4nOiB0aGlzLnZpZXcgfTtcbiAgICB0aGlzLnBhcmVudCA9IHBhcmVudENvbnRleHQ7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBjb250ZXh0IHVzaW5nIHRoZSBnaXZlbiB2aWV3IHdpdGggdGhpcyBjb250ZXh0XG4gICAqIGFzIHRoZSBwYXJlbnQuXG4gICAqL1xuICBDb250ZXh0LnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24gKHZpZXcpIHtcbiAgICByZXR1cm4gbmV3IENvbnRleHQodmlldywgdGhpcyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHZhbHVlIG9mIHRoZSBnaXZlbiBuYW1lIGluIHRoaXMgY29udGV4dCwgdHJhdmVyc2luZ1xuICAgKiB1cCB0aGUgY29udGV4dCBoaWVyYXJjaHkgaWYgdGhlIHZhbHVlIGlzIGFic2VudCBpbiB0aGlzIGNvbnRleHQncyB2aWV3LlxuICAgKi9cbiAgQ29udGV4dC5wcm90b3R5cGUubG9va3VwID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB2YXIgY2FjaGUgPSB0aGlzLmNhY2hlO1xuXG4gICAgdmFyIHZhbHVlO1xuICAgIGlmIChuYW1lIGluIGNhY2hlKSB7XG4gICAgICB2YWx1ZSA9IGNhY2hlW25hbWVdO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgY29udGV4dCA9IHRoaXMsIG5hbWVzLCBpbmRleCwgbG9va3VwSGl0ID0gZmFsc2U7XG5cbiAgICAgIHdoaWxlIChjb250ZXh0KSB7XG4gICAgICAgIGlmIChuYW1lLmluZGV4T2YoJy4nKSA+IDApIHtcbiAgICAgICAgICB2YWx1ZSA9IGNvbnRleHQudmlldztcbiAgICAgICAgICBuYW1lcyA9IG5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgICBpbmRleCA9IDA7XG5cbiAgICAgICAgICAvKipcbiAgICAgICAgICAgKiBVc2luZyB0aGUgZG90IG5vdGlvbiBwYXRoIGluIGBuYW1lYCwgd2UgZGVzY2VuZCB0aHJvdWdoIHRoZVxuICAgICAgICAgICAqIG5lc3RlZCBvYmplY3RzLlxuICAgICAgICAgICAqXG4gICAgICAgICAgICogVG8gYmUgY2VydGFpbiB0aGF0IHRoZSBsb29rdXAgaGFzIGJlZW4gc3VjY2Vzc2Z1bCwgd2UgaGF2ZSB0b1xuICAgICAgICAgICAqIGNoZWNrIGlmIHRoZSBsYXN0IG9iamVjdCBpbiB0aGUgcGF0aCBhY3R1YWxseSBoYXMgdGhlIHByb3BlcnR5XG4gICAgICAgICAgICogd2UgYXJlIGxvb2tpbmcgZm9yLiBXZSBzdG9yZSB0aGUgcmVzdWx0IGluIGBsb29rdXBIaXRgLlxuICAgICAgICAgICAqXG4gICAgICAgICAgICogVGhpcyBpcyBzcGVjaWFsbHkgbmVjZXNzYXJ5IGZvciB3aGVuIHRoZSB2YWx1ZSBoYXMgYmVlbiBzZXQgdG9cbiAgICAgICAgICAgKiBgdW5kZWZpbmVkYCBhbmQgd2Ugd2FudCB0byBhdm9pZCBsb29raW5nIHVwIHBhcmVudCBjb250ZXh0cy5cbiAgICAgICAgICAgKiovXG4gICAgICAgICAgd2hpbGUgKHZhbHVlICE9IG51bGwgJiYgaW5kZXggPCBuYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChpbmRleCA9PT0gbmFtZXMubGVuZ3RoIC0gMSAmJiB2YWx1ZSAhPSBudWxsKVxuICAgICAgICAgICAgICBsb29rdXBIaXQgPSAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JykgJiZcbiAgICAgICAgICAgICAgICB2YWx1ZS5oYXNPd25Qcm9wZXJ0eShuYW1lc1tpbmRleF0pO1xuICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZVtuYW1lc1tpbmRleCsrXV07XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGNvbnRleHQudmlldyAhPSBudWxsICYmIHR5cGVvZiBjb250ZXh0LnZpZXcgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgdmFsdWUgPSBjb250ZXh0LnZpZXdbbmFtZV07XG4gICAgICAgICAgbG9va3VwSGl0ID0gY29udGV4dC52aWV3Lmhhc093blByb3BlcnR5KG5hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGxvb2t1cEhpdClcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjb250ZXh0ID0gY29udGV4dC5wYXJlbnQ7XG4gICAgICB9XG5cbiAgICAgIGNhY2hlW25hbWVdID0gdmFsdWU7XG4gICAgfVxuXG4gICAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKVxuICAgICAgdmFsdWUgPSB2YWx1ZS5jYWxsKHRoaXMudmlldyk7XG5cbiAgICByZXR1cm4gdmFsdWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIEEgV3JpdGVyIGtub3dzIGhvdyB0byB0YWtlIGEgc3RyZWFtIG9mIHRva2VucyBhbmQgcmVuZGVyIHRoZW0gdG8gYVxuICAgKiBzdHJpbmcsIGdpdmVuIGEgY29udGV4dC4gSXQgYWxzbyBtYWludGFpbnMgYSBjYWNoZSBvZiB0ZW1wbGF0ZXMgdG9cbiAgICogYXZvaWQgdGhlIG5lZWQgdG8gcGFyc2UgdGhlIHNhbWUgdGVtcGxhdGUgdHdpY2UuXG4gICAqL1xuICBmdW5jdGlvbiBXcml0ZXIoKSB7XG4gICAgdGhpcy5jYWNoZSA9IHt9O1xuICB9XG5cbiAgLyoqXG4gICAqIENsZWFycyBhbGwgY2FjaGVkIHRlbXBsYXRlcyBpbiB0aGlzIHdyaXRlci5cbiAgICovXG4gIFdyaXRlci5wcm90b3R5cGUuY2xlYXJDYWNoZSA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmNhY2hlID0ge307XG4gIH07XG5cbiAgLyoqXG4gICAqIFBhcnNlcyBhbmQgY2FjaGVzIHRoZSBnaXZlbiBgdGVtcGxhdGVgIGFuZCByZXR1cm5zIHRoZSBhcnJheSBvZiB0b2tlbnNcbiAgICogdGhhdCBpcyBnZW5lcmF0ZWQgZnJvbSB0aGUgcGFyc2UuXG4gICAqL1xuICBXcml0ZXIucHJvdG90eXBlLnBhcnNlID0gZnVuY3Rpb24gKHRlbXBsYXRlLCB0YWdzKSB7XG4gICAgdmFyIGNhY2hlID0gdGhpcy5jYWNoZTtcbiAgICB2YXIgdG9rZW5zID0gY2FjaGVbdGVtcGxhdGVdO1xuXG4gICAgaWYgKHRva2VucyA9PSBudWxsKVxuICAgICAgdG9rZW5zID0gY2FjaGVbdGVtcGxhdGVdID0gcGFyc2VUZW1wbGF0ZSh0ZW1wbGF0ZSwgdGFncyk7XG5cbiAgICByZXR1cm4gdG9rZW5zO1xuICB9O1xuXG4gIC8qKlxuICAgKiBIaWdoLWxldmVsIG1ldGhvZCB0aGF0IGlzIHVzZWQgdG8gcmVuZGVyIHRoZSBnaXZlbiBgdGVtcGxhdGVgIHdpdGhcbiAgICogdGhlIGdpdmVuIGB2aWV3YC5cbiAgICpcbiAgICogVGhlIG9wdGlvbmFsIGBwYXJ0aWFsc2AgYXJndW1lbnQgbWF5IGJlIGFuIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZVxuICAgKiBuYW1lcyBhbmQgdGVtcGxhdGVzIG9mIHBhcnRpYWxzIHRoYXQgYXJlIHVzZWQgaW4gdGhlIHRlbXBsYXRlLiBJdCBtYXlcbiAgICogYWxzbyBiZSBhIGZ1bmN0aW9uIHRoYXQgaXMgdXNlZCB0byBsb2FkIHBhcnRpYWwgdGVtcGxhdGVzIG9uIHRoZSBmbHlcbiAgICogdGhhdCB0YWtlcyBhIHNpbmdsZSBhcmd1bWVudDogdGhlIG5hbWUgb2YgdGhlIHBhcnRpYWwuXG4gICAqL1xuICBXcml0ZXIucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uICh0ZW1wbGF0ZSwgdmlldywgcGFydGlhbHMpIHtcbiAgICB2YXIgdG9rZW5zID0gdGhpcy5wYXJzZSh0ZW1wbGF0ZSk7XG4gICAgdmFyIGNvbnRleHQgPSAodmlldyBpbnN0YW5jZW9mIENvbnRleHQpID8gdmlldyA6IG5ldyBDb250ZXh0KHZpZXcpO1xuICAgIHJldHVybiB0aGlzLnJlbmRlclRva2Vucyh0b2tlbnMsIGNvbnRleHQsIHBhcnRpYWxzLCB0ZW1wbGF0ZSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIExvdy1sZXZlbCBtZXRob2QgdGhhdCByZW5kZXJzIHRoZSBnaXZlbiBhcnJheSBvZiBgdG9rZW5zYCB1c2luZ1xuICAgKiB0aGUgZ2l2ZW4gYGNvbnRleHRgIGFuZCBgcGFydGlhbHNgLlxuICAgKlxuICAgKiBOb3RlOiBUaGUgYG9yaWdpbmFsVGVtcGxhdGVgIGlzIG9ubHkgZXZlciB1c2VkIHRvIGV4dHJhY3QgdGhlIHBvcnRpb25cbiAgICogb2YgdGhlIG9yaWdpbmFsIHRlbXBsYXRlIHRoYXQgd2FzIGNvbnRhaW5lZCBpbiBhIGhpZ2hlci1vcmRlciBzZWN0aW9uLlxuICAgKiBJZiB0aGUgdGVtcGxhdGUgZG9lc24ndCB1c2UgaGlnaGVyLW9yZGVyIHNlY3Rpb25zLCB0aGlzIGFyZ3VtZW50IG1heVxuICAgKiBiZSBvbWl0dGVkLlxuICAgKi9cbiAgV3JpdGVyLnByb3RvdHlwZS5yZW5kZXJUb2tlbnMgPSBmdW5jdGlvbiAodG9rZW5zLCBjb250ZXh0LCBwYXJ0aWFscywgb3JpZ2luYWxUZW1wbGF0ZSkge1xuICAgIHZhciBidWZmZXIgPSAnJztcblxuICAgIHZhciB0b2tlbiwgc3ltYm9sLCB2YWx1ZTtcbiAgICBmb3IgKHZhciBpID0gMCwgbnVtVG9rZW5zID0gdG9rZW5zLmxlbmd0aDsgaSA8IG51bVRva2VuczsgKytpKSB7XG4gICAgICB2YWx1ZSA9IHVuZGVmaW5lZDtcbiAgICAgIHRva2VuID0gdG9rZW5zW2ldO1xuICAgICAgc3ltYm9sID0gdG9rZW5bMF07XG5cbiAgICAgIGlmIChzeW1ib2wgPT09ICcjJykgdmFsdWUgPSB0aGlzLl9yZW5kZXJTZWN0aW9uKHRva2VuLCBjb250ZXh0LCBwYXJ0aWFscywgb3JpZ2luYWxUZW1wbGF0ZSk7XG4gICAgICBlbHNlIGlmIChzeW1ib2wgPT09ICdeJykgdmFsdWUgPSB0aGlzLl9yZW5kZXJJbnZlcnRlZCh0b2tlbiwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpO1xuICAgICAgZWxzZSBpZiAoc3ltYm9sID09PSAnPicpIHZhbHVlID0gdGhpcy5fcmVuZGVyUGFydGlhbCh0b2tlbiwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpO1xuICAgICAgZWxzZSBpZiAoc3ltYm9sID09PSAnJicpIHZhbHVlID0gdGhpcy5fdW5lc2NhcGVkVmFsdWUodG9rZW4sIGNvbnRleHQpO1xuICAgICAgZWxzZSBpZiAoc3ltYm9sID09PSAnbmFtZScpIHZhbHVlID0gdGhpcy5fZXNjYXBlZFZhbHVlKHRva2VuLCBjb250ZXh0KTtcbiAgICAgIGVsc2UgaWYgKHN5bWJvbCA9PT0gJ3RleHQnKSB2YWx1ZSA9IHRoaXMuX3Jhd1ZhbHVlKHRva2VuKTtcblxuICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpXG4gICAgICAgIGJ1ZmZlciArPSB2YWx1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gYnVmZmVyO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUuX3JlbmRlclNlY3Rpb24gPSBmdW5jdGlvbiAodG9rZW4sIGNvbnRleHQsIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBidWZmZXIgPSAnJztcbiAgICB2YXIgdmFsdWUgPSBjb250ZXh0Lmxvb2t1cCh0b2tlblsxXSk7XG5cbiAgICAvLyBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgdG8gcmVuZGVyIGFuIGFyYml0cmFyeSB0ZW1wbGF0ZVxuICAgIC8vIGluIHRoZSBjdXJyZW50IGNvbnRleHQgYnkgaGlnaGVyLW9yZGVyIHNlY3Rpb25zLlxuICAgIGZ1bmN0aW9uIHN1YlJlbmRlcih0ZW1wbGF0ZSkge1xuICAgICAgcmV0dXJuIHNlbGYucmVuZGVyKHRlbXBsYXRlLCBjb250ZXh0LCBwYXJ0aWFscyk7XG4gICAgfVxuXG4gICAgaWYgKCF2YWx1ZSkgcmV0dXJuO1xuXG4gICAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgICBmb3IgKHZhciBqID0gMCwgdmFsdWVMZW5ndGggPSB2YWx1ZS5sZW5ndGg7IGogPCB2YWx1ZUxlbmd0aDsgKytqKSB7XG4gICAgICAgIGJ1ZmZlciArPSB0aGlzLnJlbmRlclRva2Vucyh0b2tlbls0XSwgY29udGV4dC5wdXNoKHZhbHVlW2pdKSwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyB8fCB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgIGJ1ZmZlciArPSB0aGlzLnJlbmRlclRva2Vucyh0b2tlbls0XSwgY29udGV4dC5wdXNoKHZhbHVlKSwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpO1xuICAgIH0gZWxzZSBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICAgIGlmICh0eXBlb2Ygb3JpZ2luYWxUZW1wbGF0ZSAhPT0gJ3N0cmluZycpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IHVzZSBoaWdoZXItb3JkZXIgc2VjdGlvbnMgd2l0aG91dCB0aGUgb3JpZ2luYWwgdGVtcGxhdGUnKTtcblxuICAgICAgLy8gRXh0cmFjdCB0aGUgcG9ydGlvbiBvZiB0aGUgb3JpZ2luYWwgdGVtcGxhdGUgdGhhdCB0aGUgc2VjdGlvbiBjb250YWlucy5cbiAgICAgIHZhbHVlID0gdmFsdWUuY2FsbChjb250ZXh0LnZpZXcsIG9yaWdpbmFsVGVtcGxhdGUuc2xpY2UodG9rZW5bM10sIHRva2VuWzVdKSwgc3ViUmVuZGVyKTtcblxuICAgICAgaWYgKHZhbHVlICE9IG51bGwpXG4gICAgICAgIGJ1ZmZlciArPSB2YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYnVmZmVyICs9IHRoaXMucmVuZGVyVG9rZW5zKHRva2VuWzRdLCBjb250ZXh0LCBwYXJ0aWFscywgb3JpZ2luYWxUZW1wbGF0ZSk7XG4gICAgfVxuICAgIHJldHVybiBidWZmZXI7XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5fcmVuZGVySW52ZXJ0ZWQgPSBmdW5jdGlvbih0b2tlbiwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpIHtcbiAgICB2YXIgdmFsdWUgPSBjb250ZXh0Lmxvb2t1cCh0b2tlblsxXSk7XG5cbiAgICAvLyBVc2UgSmF2YVNjcmlwdCdzIGRlZmluaXRpb24gb2YgZmFsc3kuIEluY2x1ZGUgZW1wdHkgYXJyYXlzLlxuICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vamFubC9tdXN0YWNoZS5qcy9pc3N1ZXMvMTg2XG4gICAgaWYgKCF2YWx1ZSB8fCAoaXNBcnJheSh2YWx1ZSkgJiYgdmFsdWUubGVuZ3RoID09PSAwKSlcbiAgICAgIHJldHVybiB0aGlzLnJlbmRlclRva2Vucyh0b2tlbls0XSwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUuX3JlbmRlclBhcnRpYWwgPSBmdW5jdGlvbih0b2tlbiwgY29udGV4dCwgcGFydGlhbHMpIHtcbiAgICBpZiAoIXBhcnRpYWxzKSByZXR1cm47XG5cbiAgICB2YXIgdmFsdWUgPSBpc0Z1bmN0aW9uKHBhcnRpYWxzKSA/IHBhcnRpYWxzKHRva2VuWzFdKSA6IHBhcnRpYWxzW3Rva2VuWzFdXTtcbiAgICBpZiAodmFsdWUgIT0gbnVsbClcbiAgICAgIHJldHVybiB0aGlzLnJlbmRlclRva2Vucyh0aGlzLnBhcnNlKHZhbHVlKSwgY29udGV4dCwgcGFydGlhbHMsIHZhbHVlKTtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLl91bmVzY2FwZWRWYWx1ZSA9IGZ1bmN0aW9uKHRva2VuLCBjb250ZXh0KSB7XG4gICAgdmFyIHZhbHVlID0gY29udGV4dC5sb29rdXAodG9rZW5bMV0pO1xuICAgIGlmICh2YWx1ZSAhPSBudWxsKVxuICAgICAgcmV0dXJuIHZhbHVlO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUuX2VzY2FwZWRWYWx1ZSA9IGZ1bmN0aW9uKHRva2VuLCBjb250ZXh0KSB7XG4gICAgdmFyIHZhbHVlID0gY29udGV4dC5sb29rdXAodG9rZW5bMV0pO1xuICAgIGlmICh2YWx1ZSAhPSBudWxsKVxuICAgICAgcmV0dXJuIG11c3RhY2hlLmVzY2FwZSh2YWx1ZSk7XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5fcmF3VmFsdWUgPSBmdW5jdGlvbih0b2tlbikge1xuICAgIHJldHVybiB0b2tlblsxXTtcbiAgfTtcblxuICBtdXN0YWNoZS5uYW1lID0gXCJtdXN0YWNoZS5qc1wiO1xuICBtdXN0YWNoZS52ZXJzaW9uID0gXCIyLjAuMFwiO1xuICBtdXN0YWNoZS50YWdzID0gWyBcInt7XCIsIFwifX1cIiBdO1xuXG4gIC8vIEFsbCBoaWdoLWxldmVsIG11c3RhY2hlLiogZnVuY3Rpb25zIHVzZSB0aGlzIHdyaXRlci5cbiAgdmFyIGRlZmF1bHRXcml0ZXIgPSBuZXcgV3JpdGVyKCk7XG5cbiAgLyoqXG4gICAqIENsZWFycyBhbGwgY2FjaGVkIHRlbXBsYXRlcyBpbiB0aGUgZGVmYXVsdCB3cml0ZXIuXG4gICAqL1xuICBtdXN0YWNoZS5jbGVhckNhY2hlID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBkZWZhdWx0V3JpdGVyLmNsZWFyQ2FjaGUoKTtcbiAgfTtcblxuICAvKipcbiAgICogUGFyc2VzIGFuZCBjYWNoZXMgdGhlIGdpdmVuIHRlbXBsYXRlIGluIHRoZSBkZWZhdWx0IHdyaXRlciBhbmQgcmV0dXJucyB0aGVcbiAgICogYXJyYXkgb2YgdG9rZW5zIGl0IGNvbnRhaW5zLiBEb2luZyB0aGlzIGFoZWFkIG9mIHRpbWUgYXZvaWRzIHRoZSBuZWVkIHRvXG4gICAqIHBhcnNlIHRlbXBsYXRlcyBvbiB0aGUgZmx5IGFzIHRoZXkgYXJlIHJlbmRlcmVkLlxuICAgKi9cbiAgbXVzdGFjaGUucGFyc2UgPSBmdW5jdGlvbiAodGVtcGxhdGUsIHRhZ3MpIHtcbiAgICByZXR1cm4gZGVmYXVsdFdyaXRlci5wYXJzZSh0ZW1wbGF0ZSwgdGFncyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlbmRlcnMgdGhlIGB0ZW1wbGF0ZWAgd2l0aCB0aGUgZ2l2ZW4gYHZpZXdgIGFuZCBgcGFydGlhbHNgIHVzaW5nIHRoZVxuICAgKiBkZWZhdWx0IHdyaXRlci5cbiAgICovXG4gIG11c3RhY2hlLnJlbmRlciA9IGZ1bmN0aW9uICh0ZW1wbGF0ZSwgdmlldywgcGFydGlhbHMpIHtcbiAgICByZXR1cm4gZGVmYXVsdFdyaXRlci5yZW5kZXIodGVtcGxhdGUsIHZpZXcsIHBhcnRpYWxzKTtcbiAgfTtcblxuICAvLyBUaGlzIGlzIGhlcmUgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5IHdpdGggMC40LnguXG4gIG11c3RhY2hlLnRvX2h0bWwgPSBmdW5jdGlvbiAodGVtcGxhdGUsIHZpZXcsIHBhcnRpYWxzLCBzZW5kKSB7XG4gICAgdmFyIHJlc3VsdCA9IG11c3RhY2hlLnJlbmRlcih0ZW1wbGF0ZSwgdmlldywgcGFydGlhbHMpO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oc2VuZCkpIHtcbiAgICAgIHNlbmQocmVzdWx0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gIH07XG5cbiAgLy8gRXhwb3J0IHRoZSBlc2NhcGluZyBmdW5jdGlvbiBzbyB0aGF0IHRoZSB1c2VyIG1heSBvdmVycmlkZSBpdC5cbiAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9qYW5sL211c3RhY2hlLmpzL2lzc3Vlcy8yNDRcbiAgbXVzdGFjaGUuZXNjYXBlID0gZXNjYXBlSHRtbDtcblxuICAvLyBFeHBvcnQgdGhlc2UgbWFpbmx5IGZvciB0ZXN0aW5nLCBidXQgYWxzbyBmb3IgYWR2YW5jZWQgdXNhZ2UuXG4gIG11c3RhY2hlLlNjYW5uZXIgPSBTY2FubmVyO1xuICBtdXN0YWNoZS5Db250ZXh0ID0gQ29udGV4dDtcbiAgbXVzdGFjaGUuV3JpdGVyID0gV3JpdGVyO1xuXG59KSk7XG4iLCIvKiohXG4gKiBTb3J0YWJsZVxuICogQGF1dGhvclx0UnViYVhhICAgPHRyYXNoQHJ1YmF4YS5vcmc+XG4gKiBAbGljZW5zZSBNSVRcbiAqL1xuXG5cbihmdW5jdGlvbiAoZmFjdG9yeSkge1xuXHRcInVzZSBzdHJpY3RcIjtcblxuXHRpZiAodHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIGRlZmluZS5hbWQpIHtcblx0XHRkZWZpbmUoZmFjdG9yeSk7XG5cdH1cblx0ZWxzZSBpZiAodHlwZW9mIG1vZHVsZSAhPSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyAhPSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0bW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCk7XG5cdH1cblx0ZWxzZSBpZiAodHlwZW9mIFBhY2thZ2UgIT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHRTb3J0YWJsZSA9IGZhY3RvcnkoKTsgIC8vIGV4cG9ydCBmb3IgTWV0ZW9yLmpzXG5cdH1cblx0ZWxzZSB7XG5cdFx0LyoganNoaW50IHN1Yjp0cnVlICovXG5cdFx0d2luZG93W1wiU29ydGFibGVcIl0gPSBmYWN0b3J5KCk7XG5cdH1cbn0pKGZ1bmN0aW9uICgpIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIGRyYWdFbCxcblx0XHRnaG9zdEVsLFxuXHRcdGNsb25lRWwsXG5cdFx0cm9vdEVsLFxuXHRcdG5leHRFbCxcblxuXHRcdHNjcm9sbEVsLFxuXHRcdHNjcm9sbFBhcmVudEVsLFxuXG5cdFx0bGFzdEVsLFxuXHRcdGxhc3RDU1MsXG5cblx0XHRvbGRJbmRleCxcblx0XHRuZXdJbmRleCxcblxuXHRcdGFjdGl2ZUdyb3VwLFxuXHRcdGF1dG9TY3JvbGwgPSB7fSxcblxuXHRcdHRhcEV2dCxcblx0XHR0b3VjaEV2dCxcblxuXHRcdGV4cGFuZG8gPSAnU29ydGFibGUnICsgKG5ldyBEYXRlKS5nZXRUaW1lKCksXG5cblx0XHR3aW4gPSB3aW5kb3csXG5cdFx0ZG9jdW1lbnQgPSB3aW4uZG9jdW1lbnQsXG5cdFx0cGFyc2VJbnQgPSB3aW4ucGFyc2VJbnQsXG5cblx0XHRzdXBwb3J0RHJhZ2dhYmxlID0gISEoJ2RyYWdnYWJsZScgaW4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JykpLFxuXG5cblx0XHRfc2lsZW50ID0gZmFsc2UsXG5cblx0XHRfZGlzcGF0Y2hFdmVudCA9IGZ1bmN0aW9uIChyb290RWwsIG5hbWUsIHRhcmdldEVsLCBmcm9tRWwsIHN0YXJ0SW5kZXgsIG5ld0luZGV4KSB7XG5cdFx0XHR2YXIgZXZ0ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoJ0V2ZW50Jyk7XG5cblx0XHRcdGV2dC5pbml0RXZlbnQobmFtZSwgdHJ1ZSwgdHJ1ZSk7XG5cblx0XHRcdGV2dC5pdGVtID0gdGFyZ2V0RWwgfHwgcm9vdEVsO1xuXHRcdFx0ZXZ0LmZyb20gPSBmcm9tRWwgfHwgcm9vdEVsO1xuXHRcdFx0ZXZ0LmNsb25lID0gY2xvbmVFbDtcblxuXHRcdFx0ZXZ0Lm9sZEluZGV4ID0gc3RhcnRJbmRleDtcblx0XHRcdGV2dC5uZXdJbmRleCA9IG5ld0luZGV4O1xuXG5cdFx0XHRyb290RWwuZGlzcGF0Y2hFdmVudChldnQpO1xuXHRcdH0sXG5cblx0XHRfY3VzdG9tRXZlbnRzID0gJ29uQWRkIG9uVXBkYXRlIG9uUmVtb3ZlIG9uU3RhcnQgb25FbmQgb25GaWx0ZXIgb25Tb3J0Jy5zcGxpdCgnICcpLFxuXG5cdFx0bm9vcCA9IGZ1bmN0aW9uICgpIHt9LFxuXG5cdFx0YWJzID0gTWF0aC5hYnMsXG5cdFx0c2xpY2UgPSBbXS5zbGljZSxcblxuXHRcdHRvdWNoRHJhZ092ZXJMaXN0ZW5lcnMgPSBbXSxcblxuXHRcdF9hdXRvU2Nyb2xsID0gX3Rocm90dGxlKGZ1bmN0aW9uICgvKipFdmVudCovZXZ0LCAvKipPYmplY3QqL29wdGlvbnMsIC8qKkhUTUxFbGVtZW50Ki9yb290RWwpIHtcblx0XHRcdC8vIEJ1ZzogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9NTA1NTIxXG5cdFx0XHRpZiAocm9vdEVsICYmIG9wdGlvbnMuc2Nyb2xsKSB7XG5cdFx0XHRcdHZhciBlbCxcblx0XHRcdFx0XHRyZWN0LFxuXHRcdFx0XHRcdHNlbnMgPSBvcHRpb25zLnNjcm9sbFNlbnNpdGl2aXR5LFxuXHRcdFx0XHRcdHNwZWVkID0gb3B0aW9ucy5zY3JvbGxTcGVlZCxcblxuXHRcdFx0XHRcdHggPSBldnQuY2xpZW50WCxcblx0XHRcdFx0XHR5ID0gZXZ0LmNsaWVudFksXG5cblx0XHRcdFx0XHR3aW5XaWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoLFxuXHRcdFx0XHRcdHdpbkhlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodCxcblxuXHRcdFx0XHRcdHZ4LFxuXHRcdFx0XHRcdHZ5XG5cdFx0XHRcdDtcblxuXHRcdFx0XHQvLyBEZWxlY3Qgc2Nyb2xsRWxcblx0XHRcdFx0aWYgKHNjcm9sbFBhcmVudEVsICE9PSByb290RWwpIHtcblx0XHRcdFx0XHRzY3JvbGxFbCA9IG9wdGlvbnMuc2Nyb2xsO1xuXHRcdFx0XHRcdHNjcm9sbFBhcmVudEVsID0gcm9vdEVsO1xuXG5cdFx0XHRcdFx0aWYgKHNjcm9sbEVsID09PSB0cnVlKSB7XG5cdFx0XHRcdFx0XHRzY3JvbGxFbCA9IHJvb3RFbDtcblxuXHRcdFx0XHRcdFx0ZG8ge1xuXHRcdFx0XHRcdFx0XHRpZiAoKHNjcm9sbEVsLm9mZnNldFdpZHRoIDwgc2Nyb2xsRWwuc2Nyb2xsV2lkdGgpIHx8XG5cdFx0XHRcdFx0XHRcdFx0KHNjcm9sbEVsLm9mZnNldEhlaWdodCA8IHNjcm9sbEVsLnNjcm9sbEhlaWdodClcblx0XHRcdFx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0LyoganNoaW50IGJvc3M6dHJ1ZSAqL1xuXHRcdFx0XHRcdFx0fSB3aGlsZSAoc2Nyb2xsRWwgPSBzY3JvbGxFbC5wYXJlbnROb2RlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoc2Nyb2xsRWwpIHtcblx0XHRcdFx0XHRlbCA9IHNjcm9sbEVsO1xuXHRcdFx0XHRcdHJlY3QgPSBzY3JvbGxFbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdFx0XHR2eCA9IChhYnMocmVjdC5yaWdodCAtIHgpIDw9IHNlbnMpIC0gKGFicyhyZWN0LmxlZnQgLSB4KSA8PSBzZW5zKTtcblx0XHRcdFx0XHR2eSA9IChhYnMocmVjdC5ib3R0b20gLSB5KSA8PSBzZW5zKSAtIChhYnMocmVjdC50b3AgLSB5KSA8PSBzZW5zKTtcblx0XHRcdFx0fVxuXG5cblx0XHRcdFx0aWYgKCEodnggfHwgdnkpKSB7XG5cdFx0XHRcdFx0dnggPSAod2luV2lkdGggLSB4IDw9IHNlbnMpIC0gKHggPD0gc2Vucyk7XG5cdFx0XHRcdFx0dnkgPSAod2luSGVpZ2h0IC0geSA8PSBzZW5zKSAtICh5IDw9IHNlbnMpO1xuXG5cdFx0XHRcdFx0LyoganNoaW50IGV4cHI6dHJ1ZSAqL1xuXHRcdFx0XHRcdCh2eCB8fCB2eSkgJiYgKGVsID0gd2luKTtcblx0XHRcdFx0fVxuXG5cblx0XHRcdFx0aWYgKGF1dG9TY3JvbGwudnggIT09IHZ4IHx8IGF1dG9TY3JvbGwudnkgIT09IHZ5IHx8IGF1dG9TY3JvbGwuZWwgIT09IGVsKSB7XG5cdFx0XHRcdFx0YXV0b1Njcm9sbC5lbCA9IGVsO1xuXHRcdFx0XHRcdGF1dG9TY3JvbGwudnggPSB2eDtcblx0XHRcdFx0XHRhdXRvU2Nyb2xsLnZ5ID0gdnk7XG5cblx0XHRcdFx0XHRjbGVhckludGVydmFsKGF1dG9TY3JvbGwucGlkKTtcblxuXHRcdFx0XHRcdGlmIChlbCkge1xuXHRcdFx0XHRcdFx0YXV0b1Njcm9sbC5waWQgPSBzZXRJbnRlcnZhbChmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRcdGlmIChlbCA9PT0gd2luKSB7XG5cdFx0XHRcdFx0XHRcdFx0d2luLnNjcm9sbFRvKHdpbi5zY3JvbGxYICsgdnggKiBzcGVlZCwgd2luLnNjcm9sbFkgKyB2eSAqIHNwZWVkKTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHR2eSAmJiAoZWwuc2Nyb2xsVG9wICs9IHZ5ICogc3BlZWQpO1xuXHRcdFx0XHRcdFx0XHRcdHZ4ICYmIChlbC5zY3JvbGxMZWZ0ICs9IHZ4ICogc3BlZWQpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9LCAyNCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSwgMzApXG5cdDtcblxuXG5cblx0LyoqXG5cdCAqIEBjbGFzcyAgU29ydGFibGVcblx0ICogQHBhcmFtICB7SFRNTEVsZW1lbnR9ICBlbFxuXHQgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgIFtvcHRpb25zXVxuXHQgKi9cblx0ZnVuY3Rpb24gU29ydGFibGUoZWwsIG9wdGlvbnMpIHtcblx0XHR0aGlzLmVsID0gZWw7IC8vIHJvb3QgZWxlbWVudFxuXHRcdHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgPSAob3B0aW9ucyB8fCB7fSk7XG5cblxuXHRcdC8vIERlZmF1bHQgb3B0aW9uc1xuXHRcdHZhciBkZWZhdWx0cyA9IHtcblx0XHRcdGdyb3VwOiBNYXRoLnJhbmRvbSgpLFxuXHRcdFx0c29ydDogdHJ1ZSxcblx0XHRcdGRpc2FibGVkOiBmYWxzZSxcblx0XHRcdHN0b3JlOiBudWxsLFxuXHRcdFx0aGFuZGxlOiBudWxsLFxuXHRcdFx0c2Nyb2xsOiB0cnVlLFxuXHRcdFx0c2Nyb2xsU2Vuc2l0aXZpdHk6IDMwLFxuXHRcdFx0c2Nyb2xsU3BlZWQ6IDEwLFxuXHRcdFx0ZHJhZ2dhYmxlOiAvW3VvXWwvaS50ZXN0KGVsLm5vZGVOYW1lKSA/ICdsaScgOiAnPionLFxuXHRcdFx0Z2hvc3RDbGFzczogJ3NvcnRhYmxlLWdob3N0Jyxcblx0XHRcdGlnbm9yZTogJ2EsIGltZycsXG5cdFx0XHRmaWx0ZXI6IG51bGwsXG5cdFx0XHRhbmltYXRpb246IDAsXG5cdFx0XHRzZXREYXRhOiBmdW5jdGlvbiAoZGF0YVRyYW5zZmVyLCBkcmFnRWwpIHtcblx0XHRcdFx0ZGF0YVRyYW5zZmVyLnNldERhdGEoJ1RleHQnLCBkcmFnRWwudGV4dENvbnRlbnQpO1xuXHRcdFx0fSxcblx0XHRcdGRyb3BCdWJibGU6IGZhbHNlLFxuXHRcdFx0ZHJhZ292ZXJCdWJibGU6IGZhbHNlXG5cdFx0fTtcblxuXG5cdFx0Ly8gU2V0IGRlZmF1bHQgb3B0aW9uc1xuXHRcdGZvciAodmFyIG5hbWUgaW4gZGVmYXVsdHMpIHtcblx0XHRcdCEobmFtZSBpbiBvcHRpb25zKSAmJiAob3B0aW9uc1tuYW1lXSA9IGRlZmF1bHRzW25hbWVdKTtcblx0XHR9XG5cblxuXHRcdHZhciBncm91cCA9IG9wdGlvbnMuZ3JvdXA7XG5cblx0XHRpZiAoIWdyb3VwIHx8IHR5cGVvZiBncm91cCAhPSAnb2JqZWN0Jykge1xuXHRcdFx0Z3JvdXAgPSBvcHRpb25zLmdyb3VwID0geyBuYW1lOiBncm91cCB9O1xuXHRcdH1cblxuXG5cdFx0WydwdWxsJywgJ3B1dCddLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuXHRcdFx0aWYgKCEoa2V5IGluIGdyb3VwKSkge1xuXHRcdFx0XHRncm91cFtrZXldID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9KTtcblxuXG5cdFx0Ly8gRGVmaW5lIGV2ZW50c1xuXHRcdF9jdXN0b21FdmVudHMuZm9yRWFjaChmdW5jdGlvbiAobmFtZSkge1xuXHRcdFx0b3B0aW9uc1tuYW1lXSA9IF9iaW5kKHRoaXMsIG9wdGlvbnNbbmFtZV0gfHwgbm9vcCk7XG5cdFx0XHRfb24oZWwsIG5hbWUuc3Vic3RyKDIpLnRvTG93ZXJDYXNlKCksIG9wdGlvbnNbbmFtZV0pO1xuXHRcdH0sIHRoaXMpO1xuXG5cblx0XHQvLyBFeHBvcnQgb3B0aW9uc1xuXHRcdG9wdGlvbnMuZ3JvdXBzID0gJyAnICsgZ3JvdXAubmFtZSArIChncm91cC5wdXQuam9pbiA/ICcgJyArIGdyb3VwLnB1dC5qb2luKCcgJykgOiAnJykgKyAnICc7XG5cdFx0ZWxbZXhwYW5kb10gPSBvcHRpb25zO1xuXG5cblx0XHQvLyBCaW5kIGFsbCBwcml2YXRlIG1ldGhvZHNcblx0XHRmb3IgKHZhciBmbiBpbiB0aGlzKSB7XG5cdFx0XHRpZiAoZm4uY2hhckF0KDApID09PSAnXycpIHtcblx0XHRcdFx0dGhpc1tmbl0gPSBfYmluZCh0aGlzLCB0aGlzW2ZuXSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cblx0XHQvLyBCaW5kIGV2ZW50c1xuXHRcdF9vbihlbCwgJ21vdXNlZG93bicsIHRoaXMuX29uVGFwU3RhcnQpO1xuXHRcdF9vbihlbCwgJ3RvdWNoc3RhcnQnLCB0aGlzLl9vblRhcFN0YXJ0KTtcblxuXHRcdF9vbihlbCwgJ2RyYWdvdmVyJywgdGhpcyk7XG5cdFx0X29uKGVsLCAnZHJhZ2VudGVyJywgdGhpcyk7XG5cblx0XHR0b3VjaERyYWdPdmVyTGlzdGVuZXJzLnB1c2godGhpcy5fb25EcmFnT3Zlcik7XG5cblx0XHQvLyBSZXN0b3JlIHNvcnRpbmdcblx0XHRvcHRpb25zLnN0b3JlICYmIHRoaXMuc29ydChvcHRpb25zLnN0b3JlLmdldCh0aGlzKSk7XG5cdH1cblxuXG5cdFNvcnRhYmxlLnByb3RvdHlwZSA9IC8qKiBAbGVuZHMgU29ydGFibGUucHJvdG90eXBlICovIHtcblx0XHRjb25zdHJ1Y3RvcjogU29ydGFibGUsXG5cblxuXHRcdF9kcmFnU3RhcnRlZDogZnVuY3Rpb24gKCkge1xuXHRcdFx0aWYgKHJvb3RFbCAmJiBkcmFnRWwpIHtcblx0XHRcdFx0Ly8gQXBwbHkgZWZmZWN0XG5cdFx0XHRcdF90b2dnbGVDbGFzcyhkcmFnRWwsIHRoaXMub3B0aW9ucy5naG9zdENsYXNzLCB0cnVlKTtcblxuXHRcdFx0XHRTb3J0YWJsZS5hY3RpdmUgPSB0aGlzO1xuXG5cdFx0XHRcdC8vIERyYWcgc3RhcnQgZXZlbnRcblx0XHRcdFx0X2Rpc3BhdGNoRXZlbnQocm9vdEVsLCAnc3RhcnQnLCBkcmFnRWwsIHJvb3RFbCwgb2xkSW5kZXgpO1xuXHRcdFx0fVxuXHRcdH0sXG5cblxuXHRcdF9vblRhcFN0YXJ0OiBmdW5jdGlvbiAoLyoqRXZlbnR8VG91Y2hFdmVudCovZXZ0KSB7XG5cdFx0XHR2YXIgdHlwZSA9IGV2dC50eXBlLFxuXHRcdFx0XHR0b3VjaCA9IGV2dC50b3VjaGVzICYmIGV2dC50b3VjaGVzWzBdLFxuXHRcdFx0XHR0YXJnZXQgPSAodG91Y2ggfHwgZXZ0KS50YXJnZXQsXG5cdFx0XHRcdG9yaWdpbmFsVGFyZ2V0ID0gdGFyZ2V0LFxuXHRcdFx0XHRvcHRpb25zID0gIHRoaXMub3B0aW9ucyxcblx0XHRcdFx0ZWwgPSB0aGlzLmVsLFxuXHRcdFx0XHRmaWx0ZXIgPSBvcHRpb25zLmZpbHRlcjtcblxuXHRcdFx0aWYgKHR5cGUgPT09ICdtb3VzZWRvd24nICYmIGV2dC5idXR0b24gIT09IDAgfHwgb3B0aW9ucy5kaXNhYmxlZCkge1xuXHRcdFx0XHRyZXR1cm47IC8vIG9ubHkgbGVmdCBidXR0b24gb3IgZW5hYmxlZFxuXHRcdFx0fVxuXG5cdFx0XHR0YXJnZXQgPSBfY2xvc2VzdCh0YXJnZXQsIG9wdGlvbnMuZHJhZ2dhYmxlLCBlbCk7XG5cblx0XHRcdGlmICghdGFyZ2V0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gZ2V0IHRoZSBpbmRleCBvZiB0aGUgZHJhZ2dlZCBlbGVtZW50IHdpdGhpbiBpdHMgcGFyZW50XG5cdFx0XHRvbGRJbmRleCA9IF9pbmRleCh0YXJnZXQpO1xuXG5cdFx0XHQvLyBDaGVjayBmaWx0ZXJcblx0XHRcdGlmICh0eXBlb2YgZmlsdGVyID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdGlmIChmaWx0ZXIuY2FsbCh0aGlzLCBldnQsIHRhcmdldCwgdGhpcykpIHtcblx0XHRcdFx0XHRfZGlzcGF0Y2hFdmVudChvcmlnaW5hbFRhcmdldCwgJ2ZpbHRlcicsIHRhcmdldCwgZWwsIG9sZEluZGV4KTtcblx0XHRcdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0XHRyZXR1cm47IC8vIGNhbmNlbCBkbmRcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAoZmlsdGVyKSB7XG5cdFx0XHRcdGZpbHRlciA9IGZpbHRlci5zcGxpdCgnLCcpLnNvbWUoZnVuY3Rpb24gKGNyaXRlcmlhKSB7XG5cdFx0XHRcdFx0Y3JpdGVyaWEgPSBfY2xvc2VzdChvcmlnaW5hbFRhcmdldCwgY3JpdGVyaWEudHJpbSgpLCBlbCk7XG5cblx0XHRcdFx0XHRpZiAoY3JpdGVyaWEpIHtcblx0XHRcdFx0XHRcdF9kaXNwYXRjaEV2ZW50KGNyaXRlcmlhLCAnZmlsdGVyJywgdGFyZ2V0LCBlbCwgb2xkSW5kZXgpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRpZiAoZmlsdGVyKSB7XG5cdFx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0cmV0dXJuOyAvLyBjYW5jZWwgZG5kXG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXG5cdFx0XHRpZiAob3B0aW9ucy5oYW5kbGUgJiYgIV9jbG9zZXN0KG9yaWdpbmFsVGFyZ2V0LCBvcHRpb25zLmhhbmRsZSwgZWwpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXG5cdFx0XHQvLyBQcmVwYXJlIGBkcmFnc3RhcnRgXG5cdFx0XHRpZiAodGFyZ2V0ICYmICFkcmFnRWwgJiYgKHRhcmdldC5wYXJlbnROb2RlID09PSBlbCkpIHtcblx0XHRcdFx0dGFwRXZ0ID0gZXZ0O1xuXG5cdFx0XHRcdHJvb3RFbCA9IHRoaXMuZWw7XG5cdFx0XHRcdGRyYWdFbCA9IHRhcmdldDtcblx0XHRcdFx0bmV4dEVsID0gZHJhZ0VsLm5leHRTaWJsaW5nO1xuXHRcdFx0XHRhY3RpdmVHcm91cCA9IHRoaXMub3B0aW9ucy5ncm91cDtcblxuXHRcdFx0XHRkcmFnRWwuZHJhZ2dhYmxlID0gdHJ1ZTtcblxuXHRcdFx0XHQvLyBEaXNhYmxlIFwiZHJhZ2dhYmxlXCJcblx0XHRcdFx0b3B0aW9ucy5pZ25vcmUuc3BsaXQoJywnKS5mb3JFYWNoKGZ1bmN0aW9uIChjcml0ZXJpYSkge1xuXHRcdFx0XHRcdF9maW5kKHRhcmdldCwgY3JpdGVyaWEudHJpbSgpLCBfZGlzYWJsZURyYWdnYWJsZSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGlmICh0b3VjaCkge1xuXHRcdFx0XHRcdC8vIFRvdWNoIGRldmljZSBzdXBwb3J0XG5cdFx0XHRcdFx0dGFwRXZ0ID0ge1xuXHRcdFx0XHRcdFx0dGFyZ2V0OiB0YXJnZXQsXG5cdFx0XHRcdFx0XHRjbGllbnRYOiB0b3VjaC5jbGllbnRYLFxuXHRcdFx0XHRcdFx0Y2xpZW50WTogdG91Y2guY2xpZW50WVxuXHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHR0aGlzLl9vbkRyYWdTdGFydCh0YXBFdnQsICd0b3VjaCcpO1xuXHRcdFx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0X29uKGRvY3VtZW50LCAnbW91c2V1cCcsIHRoaXMuX29uRHJvcCk7XG5cdFx0XHRcdF9vbihkb2N1bWVudCwgJ3RvdWNoZW5kJywgdGhpcy5fb25Ecm9wKTtcblx0XHRcdFx0X29uKGRvY3VtZW50LCAndG91Y2hjYW5jZWwnLCB0aGlzLl9vbkRyb3ApO1xuXG5cdFx0XHRcdF9vbihkcmFnRWwsICdkcmFnZW5kJywgdGhpcyk7XG5cdFx0XHRcdF9vbihyb290RWwsICdkcmFnc3RhcnQnLCB0aGlzLl9vbkRyYWdTdGFydCk7XG5cblx0XHRcdFx0aWYgKCFzdXBwb3J0RHJhZ2dhYmxlKSB7XG5cdFx0XHRcdFx0dGhpcy5fb25EcmFnU3RhcnQodGFwRXZ0LCB0cnVlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0aWYgKGRvY3VtZW50LnNlbGVjdGlvbikge1xuXHRcdFx0XHRcdFx0ZG9jdW1lbnQuc2VsZWN0aW9uLmVtcHR5KCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHdpbmRvdy5nZXRTZWxlY3Rpb24oKS5yZW1vdmVBbGxSYW5nZXMoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdF9lbXVsYXRlRHJhZ092ZXI6IGZ1bmN0aW9uICgpIHtcblx0XHRcdGlmICh0b3VjaEV2dCkge1xuXHRcdFx0XHRfY3NzKGdob3N0RWwsICdkaXNwbGF5JywgJ25vbmUnKTtcblxuXHRcdFx0XHR2YXIgdGFyZ2V0ID0gZG9jdW1lbnQuZWxlbWVudEZyb21Qb2ludCh0b3VjaEV2dC5jbGllbnRYLCB0b3VjaEV2dC5jbGllbnRZKSxcblx0XHRcdFx0XHRwYXJlbnQgPSB0YXJnZXQsXG5cdFx0XHRcdFx0Z3JvdXBOYW1lID0gJyAnICsgdGhpcy5vcHRpb25zLmdyb3VwLm5hbWUgKyAnJyxcblx0XHRcdFx0XHRpID0gdG91Y2hEcmFnT3Zlckxpc3RlbmVycy5sZW5ndGg7XG5cblx0XHRcdFx0aWYgKHBhcmVudCkge1xuXHRcdFx0XHRcdGRvIHtcblx0XHRcdFx0XHRcdGlmIChwYXJlbnRbZXhwYW5kb10gJiYgcGFyZW50W2V4cGFuZG9dLmdyb3Vwcy5pbmRleE9mKGdyb3VwTmFtZSkgPiAtMSkge1xuXHRcdFx0XHRcdFx0XHR3aGlsZSAoaS0tKSB7XG5cdFx0XHRcdFx0XHRcdFx0dG91Y2hEcmFnT3Zlckxpc3RlbmVyc1tpXSh7XG5cdFx0XHRcdFx0XHRcdFx0XHRjbGllbnRYOiB0b3VjaEV2dC5jbGllbnRYLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y2xpZW50WTogdG91Y2hFdnQuY2xpZW50WSxcblx0XHRcdFx0XHRcdFx0XHRcdHRhcmdldDogdGFyZ2V0LFxuXHRcdFx0XHRcdFx0XHRcdFx0cm9vdEVsOiBwYXJlbnRcblx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHR0YXJnZXQgPSBwYXJlbnQ7IC8vIHN0b3JlIGxhc3QgZWxlbWVudFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHQvKiBqc2hpbnQgYm9zczp0cnVlICovXG5cdFx0XHRcdFx0d2hpbGUgKHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdF9jc3MoZ2hvc3RFbCwgJ2Rpc3BsYXknLCAnJyk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXG5cdFx0X29uVG91Y2hNb3ZlOiBmdW5jdGlvbiAoLyoqVG91Y2hFdmVudCovZXZ0KSB7XG5cdFx0XHRpZiAodGFwRXZ0KSB7XG5cdFx0XHRcdHZhciB0b3VjaCA9IGV2dC50b3VjaGVzID8gZXZ0LnRvdWNoZXNbMF0gOiBldnQsXG5cdFx0XHRcdFx0ZHggPSB0b3VjaC5jbGllbnRYIC0gdGFwRXZ0LmNsaWVudFgsXG5cdFx0XHRcdFx0ZHkgPSB0b3VjaC5jbGllbnRZIC0gdGFwRXZ0LmNsaWVudFksXG5cdFx0XHRcdFx0dHJhbnNsYXRlM2QgPSBldnQudG91Y2hlcyA/ICd0cmFuc2xhdGUzZCgnICsgZHggKyAncHgsJyArIGR5ICsgJ3B4LDApJyA6ICd0cmFuc2xhdGUoJyArIGR4ICsgJ3B4LCcgKyBkeSArICdweCknO1xuXG5cdFx0XHRcdHRvdWNoRXZ0ID0gdG91Y2g7XG5cblx0XHRcdFx0X2NzcyhnaG9zdEVsLCAnd2Via2l0VHJhbnNmb3JtJywgdHJhbnNsYXRlM2QpO1xuXHRcdFx0XHRfY3NzKGdob3N0RWwsICdtb3pUcmFuc2Zvcm0nLCB0cmFuc2xhdGUzZCk7XG5cdFx0XHRcdF9jc3MoZ2hvc3RFbCwgJ21zVHJhbnNmb3JtJywgdHJhbnNsYXRlM2QpO1xuXHRcdFx0XHRfY3NzKGdob3N0RWwsICd0cmFuc2Zvcm0nLCB0cmFuc2xhdGUzZCk7XG5cblx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXG5cdFx0X29uRHJhZ1N0YXJ0OiBmdW5jdGlvbiAoLyoqRXZlbnQqL2V2dCwgLyoqYm9vbGVhbiovdXNlRmFsbGJhY2spIHtcblx0XHRcdHZhciBkYXRhVHJhbnNmZXIgPSBldnQuZGF0YVRyYW5zZmVyLFxuXHRcdFx0XHRvcHRpb25zID0gdGhpcy5vcHRpb25zO1xuXG5cdFx0XHR0aGlzLl9vZmZVcEV2ZW50cygpO1xuXG5cdFx0XHRpZiAoYWN0aXZlR3JvdXAucHVsbCA9PSAnY2xvbmUnKSB7XG5cdFx0XHRcdGNsb25lRWwgPSBkcmFnRWwuY2xvbmVOb2RlKHRydWUpO1xuXHRcdFx0XHRfY3NzKGNsb25lRWwsICdkaXNwbGF5JywgJ25vbmUnKTtcblx0XHRcdFx0cm9vdEVsLmluc2VydEJlZm9yZShjbG9uZUVsLCBkcmFnRWwpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodXNlRmFsbGJhY2spIHtcblx0XHRcdFx0dmFyIHJlY3QgPSBkcmFnRWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCksXG5cdFx0XHRcdFx0Y3NzID0gX2NzcyhkcmFnRWwpLFxuXHRcdFx0XHRcdGdob3N0UmVjdDtcblxuXHRcdFx0XHRnaG9zdEVsID0gZHJhZ0VsLmNsb25lTm9kZSh0cnVlKTtcblxuXHRcdFx0XHRfY3NzKGdob3N0RWwsICd0b3AnLCByZWN0LnRvcCAtIHBhcnNlSW50KGNzcy5tYXJnaW5Ub3AsIDEwKSk7XG5cdFx0XHRcdF9jc3MoZ2hvc3RFbCwgJ2xlZnQnLCByZWN0LmxlZnQgLSBwYXJzZUludChjc3MubWFyZ2luTGVmdCwgMTApKTtcblx0XHRcdFx0X2NzcyhnaG9zdEVsLCAnd2lkdGgnLCByZWN0LndpZHRoKTtcblx0XHRcdFx0X2NzcyhnaG9zdEVsLCAnaGVpZ2h0JywgcmVjdC5oZWlnaHQpO1xuXHRcdFx0XHRfY3NzKGdob3N0RWwsICdvcGFjaXR5JywgJzAuOCcpO1xuXHRcdFx0XHRfY3NzKGdob3N0RWwsICdwb3NpdGlvbicsICdmaXhlZCcpO1xuXHRcdFx0XHRfY3NzKGdob3N0RWwsICd6SW5kZXgnLCAnMTAwMDAwJyk7XG5cblx0XHRcdFx0cm9vdEVsLmFwcGVuZENoaWxkKGdob3N0RWwpO1xuXG5cdFx0XHRcdC8vIEZpeGluZyBkaW1lbnNpb25zLlxuXHRcdFx0XHRnaG9zdFJlY3QgPSBnaG9zdEVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0XHRfY3NzKGdob3N0RWwsICd3aWR0aCcsIHJlY3Qud2lkdGggKiAyIC0gZ2hvc3RSZWN0LndpZHRoKTtcblx0XHRcdFx0X2NzcyhnaG9zdEVsLCAnaGVpZ2h0JywgcmVjdC5oZWlnaHQgKiAyIC0gZ2hvc3RSZWN0LmhlaWdodCk7XG5cblx0XHRcdFx0aWYgKHVzZUZhbGxiYWNrID09PSAndG91Y2gnKSB7XG5cdFx0XHRcdFx0Ly8gQmluZCB0b3VjaCBldmVudHNcblx0XHRcdFx0XHRfb24oZG9jdW1lbnQsICd0b3VjaG1vdmUnLCB0aGlzLl9vblRvdWNoTW92ZSk7XG5cdFx0XHRcdFx0X29uKGRvY3VtZW50LCAndG91Y2hlbmQnLCB0aGlzLl9vbkRyb3ApO1xuXHRcdFx0XHRcdF9vbihkb2N1bWVudCwgJ3RvdWNoY2FuY2VsJywgdGhpcy5fb25Ecm9wKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBPbGQgYnJ3b3NlclxuXHRcdFx0XHRcdF9vbihkb2N1bWVudCwgJ21vdXNlbW92ZScsIHRoaXMuX29uVG91Y2hNb3ZlKTtcblx0XHRcdFx0XHRfb24oZG9jdW1lbnQsICdtb3VzZXVwJywgdGhpcy5fb25Ecm9wKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuX2xvb3BJZCA9IHNldEludGVydmFsKHRoaXMuX2VtdWxhdGVEcmFnT3ZlciwgMTUwKTtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRpZiAoZGF0YVRyYW5zZmVyKSB7XG5cdFx0XHRcdFx0ZGF0YVRyYW5zZmVyLmVmZmVjdEFsbG93ZWQgPSAnbW92ZSc7XG5cdFx0XHRcdFx0b3B0aW9ucy5zZXREYXRhICYmIG9wdGlvbnMuc2V0RGF0YS5jYWxsKHRoaXMsIGRhdGFUcmFuc2ZlciwgZHJhZ0VsKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdF9vbihkb2N1bWVudCwgJ2Ryb3AnLCB0aGlzKTtcblx0XHRcdH1cblxuXHRcdFx0c2V0VGltZW91dCh0aGlzLl9kcmFnU3RhcnRlZCwgMCk7XG5cdFx0fSxcblxuXHRcdF9vbkRyYWdPdmVyOiBmdW5jdGlvbiAoLyoqRXZlbnQqL2V2dCkge1xuXHRcdFx0dmFyIGVsID0gdGhpcy5lbCxcblx0XHRcdFx0dGFyZ2V0LFxuXHRcdFx0XHRkcmFnUmVjdCxcblx0XHRcdFx0cmV2ZXJ0LFxuXHRcdFx0XHRvcHRpb25zID0gdGhpcy5vcHRpb25zLFxuXHRcdFx0XHRncm91cCA9IG9wdGlvbnMuZ3JvdXAsXG5cdFx0XHRcdGdyb3VwUHV0ID0gZ3JvdXAucHV0LFxuXHRcdFx0XHRpc093bmVyID0gKGFjdGl2ZUdyb3VwID09PSBncm91cCksXG5cdFx0XHRcdGNhblNvcnQgPSBvcHRpb25zLnNvcnQ7XG5cblx0XHRcdGlmICghZHJhZ0VsKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGV2dC5wcmV2ZW50RGVmYXVsdCAhPT0gdm9pZCAwKSB7XG5cdFx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHQhb3B0aW9ucy5kcmFnb3ZlckJ1YmJsZSAmJiBldnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChhY3RpdmVHcm91cCAmJiAhb3B0aW9ucy5kaXNhYmxlZCAmJlxuXHRcdFx0XHQoaXNPd25lclxuXHRcdFx0XHRcdD8gY2FuU29ydCB8fCAocmV2ZXJ0ID0gIXJvb3RFbC5jb250YWlucyhkcmFnRWwpKVxuXHRcdFx0XHRcdDogYWN0aXZlR3JvdXAucHVsbCAmJiBncm91cFB1dCAmJiAoXG5cdFx0XHRcdFx0XHQoYWN0aXZlR3JvdXAubmFtZSA9PT0gZ3JvdXAubmFtZSkgfHwgLy8gYnkgTmFtZVxuXHRcdFx0XHRcdFx0KGdyb3VwUHV0LmluZGV4T2YgJiYgfmdyb3VwUHV0LmluZGV4T2YoYWN0aXZlR3JvdXAubmFtZSkpIC8vIGJ5IEFycmF5XG5cdFx0XHRcdFx0KVxuXHRcdFx0XHQpICYmXG5cdFx0XHRcdChldnQucm9vdEVsID09PSB2b2lkIDAgfHwgZXZ0LnJvb3RFbCA9PT0gdGhpcy5lbClcblx0XHRcdCkge1xuXHRcdFx0XHQvLyBTbWFydCBhdXRvLXNjcm9sbGluZ1xuXHRcdFx0XHRfYXV0b1Njcm9sbChldnQsIG9wdGlvbnMsIHRoaXMuZWwpO1xuXG5cdFx0XHRcdGlmIChfc2lsZW50KSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGFyZ2V0ID0gX2Nsb3Nlc3QoZXZ0LnRhcmdldCwgb3B0aW9ucy5kcmFnZ2FibGUsIGVsKTtcblx0XHRcdFx0ZHJhZ1JlY3QgPSBkcmFnRWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cblxuXHRcdFx0XHRpZiAocmV2ZXJ0KSB7XG5cdFx0XHRcdFx0X2Nsb25lSGlkZSh0cnVlKTtcblxuXHRcdFx0XHRcdGlmIChjbG9uZUVsIHx8IG5leHRFbCkge1xuXHRcdFx0XHRcdFx0cm9vdEVsLmluc2VydEJlZm9yZShkcmFnRWwsIGNsb25lRWwgfHwgbmV4dEVsKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSBpZiAoIWNhblNvcnQpIHtcblx0XHRcdFx0XHRcdHJvb3RFbC5hcHBlbmRDaGlsZChkcmFnRWwpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cblx0XHRcdFx0aWYgKChlbC5jaGlsZHJlbi5sZW5ndGggPT09IDApIHx8IChlbC5jaGlsZHJlblswXSA9PT0gZ2hvc3RFbCkgfHxcblx0XHRcdFx0XHQoZWwgPT09IGV2dC50YXJnZXQpICYmICh0YXJnZXQgPSBfZ2hvc3RJbkJvdHRvbShlbCwgZXZ0KSlcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0aWYgKHRhcmdldCkge1xuXHRcdFx0XHRcdFx0aWYgKHRhcmdldC5hbmltYXRlZCkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR0YXJnZXRSZWN0ID0gdGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdF9jbG9uZUhpZGUoaXNPd25lcik7XG5cblx0XHRcdFx0XHRlbC5hcHBlbmRDaGlsZChkcmFnRWwpO1xuXHRcdFx0XHRcdHRoaXMuX2FuaW1hdGUoZHJhZ1JlY3QsIGRyYWdFbCk7XG5cdFx0XHRcdFx0dGFyZ2V0ICYmIHRoaXMuX2FuaW1hdGUodGFyZ2V0UmVjdCwgdGFyZ2V0KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIGlmICh0YXJnZXQgJiYgIXRhcmdldC5hbmltYXRlZCAmJiB0YXJnZXQgIT09IGRyYWdFbCAmJiAodGFyZ2V0LnBhcmVudE5vZGVbZXhwYW5kb10gIT09IHZvaWQgMCkpIHtcblx0XHRcdFx0XHRpZiAobGFzdEVsICE9PSB0YXJnZXQpIHtcblx0XHRcdFx0XHRcdGxhc3RFbCA9IHRhcmdldDtcblx0XHRcdFx0XHRcdGxhc3RDU1MgPSBfY3NzKHRhcmdldCk7XG5cdFx0XHRcdFx0fVxuXG5cblx0XHRcdFx0XHR2YXIgdGFyZ2V0UmVjdCA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSxcblx0XHRcdFx0XHRcdHdpZHRoID0gdGFyZ2V0UmVjdC5yaWdodCAtIHRhcmdldFJlY3QubGVmdCxcblx0XHRcdFx0XHRcdGhlaWdodCA9IHRhcmdldFJlY3QuYm90dG9tIC0gdGFyZ2V0UmVjdC50b3AsXG5cdFx0XHRcdFx0XHRmbG9hdGluZyA9IC9sZWZ0fHJpZ2h0fGlubGluZS8udGVzdChsYXN0Q1NTLmNzc0Zsb2F0ICsgbGFzdENTUy5kaXNwbGF5KSxcblx0XHRcdFx0XHRcdGlzV2lkZSA9ICh0YXJnZXQub2Zmc2V0V2lkdGggPiBkcmFnRWwub2Zmc2V0V2lkdGgpLFxuXHRcdFx0XHRcdFx0aXNMb25nID0gKHRhcmdldC5vZmZzZXRIZWlnaHQgPiBkcmFnRWwub2Zmc2V0SGVpZ2h0KSxcblx0XHRcdFx0XHRcdGhhbGZ3YXkgPSAoZmxvYXRpbmcgPyAoZXZ0LmNsaWVudFggLSB0YXJnZXRSZWN0LmxlZnQpIC8gd2lkdGggOiAoZXZ0LmNsaWVudFkgLSB0YXJnZXRSZWN0LnRvcCkgLyBoZWlnaHQpID4gMC41LFxuXHRcdFx0XHRcdFx0bmV4dFNpYmxpbmcgPSB0YXJnZXQubmV4dEVsZW1lbnRTaWJsaW5nLFxuXHRcdFx0XHRcdFx0YWZ0ZXJcblx0XHRcdFx0XHQ7XG5cblx0XHRcdFx0XHRfc2lsZW50ID0gdHJ1ZTtcblx0XHRcdFx0XHRzZXRUaW1lb3V0KF91bnNpbGVudCwgMzApO1xuXG5cdFx0XHRcdFx0X2Nsb25lSGlkZShpc093bmVyKTtcblxuXHRcdFx0XHRcdGlmIChmbG9hdGluZykge1xuXHRcdFx0XHRcdFx0YWZ0ZXIgPSAodGFyZ2V0LnByZXZpb3VzRWxlbWVudFNpYmxpbmcgPT09IGRyYWdFbCkgJiYgIWlzV2lkZSB8fCBoYWxmd2F5ICYmIGlzV2lkZTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0YWZ0ZXIgPSAobmV4dFNpYmxpbmcgIT09IGRyYWdFbCkgJiYgIWlzTG9uZyB8fCBoYWxmd2F5ICYmIGlzTG9uZztcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoYWZ0ZXIgJiYgIW5leHRTaWJsaW5nKSB7XG5cdFx0XHRcdFx0XHRlbC5hcHBlbmRDaGlsZChkcmFnRWwpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0YXJnZXQucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoZHJhZ0VsLCBhZnRlciA/IG5leHRTaWJsaW5nIDogdGFyZ2V0KTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0aGlzLl9hbmltYXRlKGRyYWdSZWN0LCBkcmFnRWwpO1xuXHRcdFx0XHRcdHRoaXMuX2FuaW1hdGUodGFyZ2V0UmVjdCwgdGFyZ2V0KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHRfYW5pbWF0ZTogZnVuY3Rpb24gKHByZXZSZWN0LCB0YXJnZXQpIHtcblx0XHRcdHZhciBtcyA9IHRoaXMub3B0aW9ucy5hbmltYXRpb247XG5cblx0XHRcdGlmIChtcykge1xuXHRcdFx0XHR2YXIgY3VycmVudFJlY3QgPSB0YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cblx0XHRcdFx0X2Nzcyh0YXJnZXQsICd0cmFuc2l0aW9uJywgJ25vbmUnKTtcblx0XHRcdFx0X2Nzcyh0YXJnZXQsICd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlM2QoJ1xuXHRcdFx0XHRcdCsgKHByZXZSZWN0LmxlZnQgLSBjdXJyZW50UmVjdC5sZWZ0KSArICdweCwnXG5cdFx0XHRcdFx0KyAocHJldlJlY3QudG9wIC0gY3VycmVudFJlY3QudG9wKSArICdweCwwKSdcblx0XHRcdFx0KTtcblxuXHRcdFx0XHR0YXJnZXQub2Zmc2V0V2lkdGg7IC8vIHJlcGFpbnRcblxuXHRcdFx0XHRfY3NzKHRhcmdldCwgJ3RyYW5zaXRpb24nLCAnYWxsICcgKyBtcyArICdtcycpO1xuXHRcdFx0XHRfY3NzKHRhcmdldCwgJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUzZCgwLDAsMCknKTtcblxuXHRcdFx0XHRjbGVhclRpbWVvdXQodGFyZ2V0LmFuaW1hdGVkKTtcblx0XHRcdFx0dGFyZ2V0LmFuaW1hdGVkID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0X2Nzcyh0YXJnZXQsICd0cmFuc2l0aW9uJywgJycpO1xuXHRcdFx0XHRcdF9jc3ModGFyZ2V0LCAndHJhbnNmb3JtJywgJycpO1xuXHRcdFx0XHRcdHRhcmdldC5hbmltYXRlZCA9IGZhbHNlO1xuXHRcdFx0XHR9LCBtcyk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdF9vZmZVcEV2ZW50czogZnVuY3Rpb24gKCkge1xuXHRcdFx0X29mZihkb2N1bWVudCwgJ21vdXNldXAnLCB0aGlzLl9vbkRyb3ApO1xuXHRcdFx0X29mZihkb2N1bWVudCwgJ3RvdWNobW92ZScsIHRoaXMuX29uVG91Y2hNb3ZlKTtcblx0XHRcdF9vZmYoZG9jdW1lbnQsICd0b3VjaGVuZCcsIHRoaXMuX29uRHJvcCk7XG5cdFx0XHRfb2ZmKGRvY3VtZW50LCAndG91Y2hjYW5jZWwnLCB0aGlzLl9vbkRyb3ApO1xuXHRcdH0sXG5cblx0XHRfb25Ecm9wOiBmdW5jdGlvbiAoLyoqRXZlbnQqL2V2dCkge1xuXHRcdFx0dmFyIGVsID0gdGhpcy5lbCxcblx0XHRcdFx0b3B0aW9ucyA9IHRoaXMub3B0aW9ucztcblxuXHRcdFx0Y2xlYXJJbnRlcnZhbCh0aGlzLl9sb29wSWQpO1xuXHRcdFx0Y2xlYXJJbnRlcnZhbChhdXRvU2Nyb2xsLnBpZCk7XG5cblx0XHRcdC8vIFVuYmluZCBldmVudHNcblx0XHRcdF9vZmYoZG9jdW1lbnQsICdkcm9wJywgdGhpcyk7XG5cdFx0XHRfb2ZmKGRvY3VtZW50LCAnbW91c2Vtb3ZlJywgdGhpcy5fb25Ub3VjaE1vdmUpO1xuXHRcdFx0X29mZihlbCwgJ2RyYWdzdGFydCcsIHRoaXMuX29uRHJhZ1N0YXJ0KTtcblxuXHRcdFx0dGhpcy5fb2ZmVXBFdmVudHMoKTtcblxuXHRcdFx0aWYgKGV2dCkge1xuXHRcdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0IW9wdGlvbnMuZHJvcEJ1YmJsZSAmJiBldnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cblx0XHRcdFx0Z2hvc3RFbCAmJiBnaG9zdEVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoZ2hvc3RFbCk7XG5cblx0XHRcdFx0aWYgKGRyYWdFbCkge1xuXHRcdFx0XHRcdF9vZmYoZHJhZ0VsLCAnZHJhZ2VuZCcsIHRoaXMpO1xuXG5cdFx0XHRcdFx0X2Rpc2FibGVEcmFnZ2FibGUoZHJhZ0VsKTtcblx0XHRcdFx0XHRfdG9nZ2xlQ2xhc3MoZHJhZ0VsLCB0aGlzLm9wdGlvbnMuZ2hvc3RDbGFzcywgZmFsc2UpO1xuXG5cdFx0XHRcdFx0aWYgKHJvb3RFbCAhPT0gZHJhZ0VsLnBhcmVudE5vZGUpIHtcblx0XHRcdFx0XHRcdG5ld0luZGV4ID0gX2luZGV4KGRyYWdFbCk7XG5cblx0XHRcdFx0XHRcdC8vIGRyYWcgZnJvbSBvbmUgbGlzdCBhbmQgZHJvcCBpbnRvIGFub3RoZXJcblx0XHRcdFx0XHRcdF9kaXNwYXRjaEV2ZW50KGRyYWdFbC5wYXJlbnROb2RlLCAnc29ydCcsIGRyYWdFbCwgcm9vdEVsLCBvbGRJbmRleCwgbmV3SW5kZXgpO1xuXHRcdFx0XHRcdFx0X2Rpc3BhdGNoRXZlbnQocm9vdEVsLCAnc29ydCcsIGRyYWdFbCwgcm9vdEVsLCBvbGRJbmRleCwgbmV3SW5kZXgpO1xuXG5cdFx0XHRcdFx0XHQvLyBBZGQgZXZlbnRcblx0XHRcdFx0XHRcdF9kaXNwYXRjaEV2ZW50KGRyYWdFbCwgJ2FkZCcsIGRyYWdFbCwgcm9vdEVsLCBvbGRJbmRleCwgbmV3SW5kZXgpO1xuXG5cdFx0XHRcdFx0XHQvLyBSZW1vdmUgZXZlbnRcblx0XHRcdFx0XHRcdF9kaXNwYXRjaEV2ZW50KHJvb3RFbCwgJ3JlbW92ZScsIGRyYWdFbCwgcm9vdEVsLCBvbGRJbmRleCwgbmV3SW5kZXgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdC8vIFJlbW92ZSBjbG9uZVxuXHRcdFx0XHRcdFx0Y2xvbmVFbCAmJiBjbG9uZUVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoY2xvbmVFbCk7XG5cblx0XHRcdFx0XHRcdGlmIChkcmFnRWwubmV4dFNpYmxpbmcgIT09IG5leHRFbCkge1xuXHRcdFx0XHRcdFx0XHQvLyBHZXQgdGhlIGluZGV4IG9mIHRoZSBkcmFnZ2VkIGVsZW1lbnQgd2l0aGluIGl0cyBwYXJlbnRcblx0XHRcdFx0XHRcdFx0bmV3SW5kZXggPSBfaW5kZXgoZHJhZ0VsKTtcblxuXHRcdFx0XHRcdFx0XHQvLyBkcmFnICYgZHJvcCB3aXRoaW4gdGhlIHNhbWUgbGlzdFxuXHRcdFx0XHRcdFx0XHRfZGlzcGF0Y2hFdmVudChyb290RWwsICd1cGRhdGUnLCBkcmFnRWwsIHJvb3RFbCwgb2xkSW5kZXgsIG5ld0luZGV4KTtcblx0XHRcdFx0XHRcdFx0X2Rpc3BhdGNoRXZlbnQocm9vdEVsLCAnc29ydCcsIGRyYWdFbCwgcm9vdEVsLCBvbGRJbmRleCwgbmV3SW5kZXgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIERyYWcgZW5kIGV2ZW50XG5cdFx0XHRcdFx0U29ydGFibGUuYWN0aXZlICYmIF9kaXNwYXRjaEV2ZW50KHJvb3RFbCwgJ2VuZCcsIGRyYWdFbCwgcm9vdEVsLCBvbGRJbmRleCwgbmV3SW5kZXgpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gTnVsbGluZ1xuXHRcdFx0XHRyb290RWwgPVxuXHRcdFx0XHRkcmFnRWwgPVxuXHRcdFx0XHRnaG9zdEVsID1cblx0XHRcdFx0bmV4dEVsID1cblx0XHRcdFx0Y2xvbmVFbCA9XG5cblx0XHRcdFx0c2Nyb2xsRWwgPVxuXHRcdFx0XHRzY3JvbGxQYXJlbnRFbCA9XG5cblx0XHRcdFx0dGFwRXZ0ID1cblx0XHRcdFx0dG91Y2hFdnQgPVxuXG5cdFx0XHRcdGxhc3RFbCA9XG5cdFx0XHRcdGxhc3RDU1MgPVxuXG5cdFx0XHRcdGFjdGl2ZUdyb3VwID1cblx0XHRcdFx0U29ydGFibGUuYWN0aXZlID0gbnVsbDtcblxuXHRcdFx0XHQvLyBTYXZlIHNvcnRpbmdcblx0XHRcdFx0dGhpcy5zYXZlKCk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXG5cdFx0aGFuZGxlRXZlbnQ6IGZ1bmN0aW9uICgvKipFdmVudCovZXZ0KSB7XG5cdFx0XHR2YXIgdHlwZSA9IGV2dC50eXBlO1xuXG5cdFx0XHRpZiAodHlwZSA9PT0gJ2RyYWdvdmVyJyB8fCB0eXBlID09PSAnZHJhZ2VudGVyJykge1xuXHRcdFx0XHR0aGlzLl9vbkRyYWdPdmVyKGV2dCk7XG5cdFx0XHRcdF9nbG9iYWxEcmFnT3ZlcihldnQpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAodHlwZSA9PT0gJ2Ryb3AnIHx8IHR5cGUgPT09ICdkcmFnZW5kJykge1xuXHRcdFx0XHR0aGlzLl9vbkRyb3AoZXZ0KTtcblx0XHRcdH1cblx0XHR9LFxuXG5cblx0XHQvKipcblx0XHQgKiBTZXJpYWxpemVzIHRoZSBpdGVtIGludG8gYW4gYXJyYXkgb2Ygc3RyaW5nLlxuXHRcdCAqIEByZXR1cm5zIHtTdHJpbmdbXX1cblx0XHQgKi9cblx0XHR0b0FycmF5OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgb3JkZXIgPSBbXSxcblx0XHRcdFx0ZWwsXG5cdFx0XHRcdGNoaWxkcmVuID0gdGhpcy5lbC5jaGlsZHJlbixcblx0XHRcdFx0aSA9IDAsXG5cdFx0XHRcdG4gPSBjaGlsZHJlbi5sZW5ndGg7XG5cblx0XHRcdGZvciAoOyBpIDwgbjsgaSsrKSB7XG5cdFx0XHRcdGVsID0gY2hpbGRyZW5baV07XG5cdFx0XHRcdGlmIChfY2xvc2VzdChlbCwgdGhpcy5vcHRpb25zLmRyYWdnYWJsZSwgdGhpcy5lbCkpIHtcblx0XHRcdFx0XHRvcmRlci5wdXNoKGVsLmdldEF0dHJpYnV0ZSgnZGF0YS1pZCcpIHx8IF9nZW5lcmF0ZUlkKGVsKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG9yZGVyO1xuXHRcdH0sXG5cblxuXHRcdC8qKlxuXHRcdCAqIFNvcnRzIHRoZSBlbGVtZW50cyBhY2NvcmRpbmcgdG8gdGhlIGFycmF5LlxuXHRcdCAqIEBwYXJhbSAge1N0cmluZ1tdfSAgb3JkZXIgIG9yZGVyIG9mIHRoZSBpdGVtc1xuXHRcdCAqL1xuXHRcdHNvcnQ6IGZ1bmN0aW9uIChvcmRlcikge1xuXHRcdFx0dmFyIGl0ZW1zID0ge30sIHJvb3RFbCA9IHRoaXMuZWw7XG5cblx0XHRcdHRoaXMudG9BcnJheSgpLmZvckVhY2goZnVuY3Rpb24gKGlkLCBpKSB7XG5cdFx0XHRcdHZhciBlbCA9IHJvb3RFbC5jaGlsZHJlbltpXTtcblxuXHRcdFx0XHRpZiAoX2Nsb3Nlc3QoZWwsIHRoaXMub3B0aW9ucy5kcmFnZ2FibGUsIHJvb3RFbCkpIHtcblx0XHRcdFx0XHRpdGVtc1tpZF0gPSBlbDtcblx0XHRcdFx0fVxuXHRcdFx0fSwgdGhpcyk7XG5cblx0XHRcdG9yZGVyLmZvckVhY2goZnVuY3Rpb24gKGlkKSB7XG5cdFx0XHRcdGlmIChpdGVtc1tpZF0pIHtcblx0XHRcdFx0XHRyb290RWwucmVtb3ZlQ2hpbGQoaXRlbXNbaWRdKTtcblx0XHRcdFx0XHRyb290RWwuYXBwZW5kQ2hpbGQoaXRlbXNbaWRdKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSxcblxuXG5cdFx0LyoqXG5cdFx0ICogU2F2ZSB0aGUgY3VycmVudCBzb3J0aW5nXG5cdFx0ICovXG5cdFx0c2F2ZTogZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyIHN0b3JlID0gdGhpcy5vcHRpb25zLnN0b3JlO1xuXHRcdFx0c3RvcmUgJiYgc3RvcmUuc2V0KHRoaXMpO1xuXHRcdH0sXG5cblxuXHRcdC8qKlxuXHRcdCAqIEZvciBlYWNoIGVsZW1lbnQgaW4gdGhlIHNldCwgZ2V0IHRoZSBmaXJzdCBlbGVtZW50IHRoYXQgbWF0Y2hlcyB0aGUgc2VsZWN0b3IgYnkgdGVzdGluZyB0aGUgZWxlbWVudCBpdHNlbGYgYW5kIHRyYXZlcnNpbmcgdXAgdGhyb3VnaCBpdHMgYW5jZXN0b3JzIGluIHRoZSBET00gdHJlZS5cblx0XHQgKiBAcGFyYW0gICB7SFRNTEVsZW1lbnR9ICBlbFxuXHRcdCAqIEBwYXJhbSAgIHtTdHJpbmd9ICAgICAgIFtzZWxlY3Rvcl0gIGRlZmF1bHQ6IGBvcHRpb25zLmRyYWdnYWJsZWBcblx0XHQgKiBAcmV0dXJucyB7SFRNTEVsZW1lbnR8bnVsbH1cblx0XHQgKi9cblx0XHRjbG9zZXN0OiBmdW5jdGlvbiAoZWwsIHNlbGVjdG9yKSB7XG5cdFx0XHRyZXR1cm4gX2Nsb3Nlc3QoZWwsIHNlbGVjdG9yIHx8IHRoaXMub3B0aW9ucy5kcmFnZ2FibGUsIHRoaXMuZWwpO1xuXHRcdH0sXG5cblxuXHRcdC8qKlxuXHRcdCAqIFNldC9nZXQgb3B0aW9uXG5cdFx0ICogQHBhcmFtICAge3N0cmluZ30gbmFtZVxuXHRcdCAqIEBwYXJhbSAgIHsqfSAgICAgIFt2YWx1ZV1cblx0XHQgKiBAcmV0dXJucyB7Kn1cblx0XHQgKi9cblx0XHRvcHRpb246IGZ1bmN0aW9uIChuYW1lLCB2YWx1ZSkge1xuXHRcdFx0dmFyIG9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XG5cblx0XHRcdGlmICh2YWx1ZSA9PT0gdm9pZCAwKSB7XG5cdFx0XHRcdHJldHVybiBvcHRpb25zW25hbWVdO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b3B0aW9uc1tuYW1lXSA9IHZhbHVlO1xuXHRcdFx0fVxuXHRcdH0sXG5cblxuXHRcdC8qKlxuXHRcdCAqIERlc3Ryb3lcblx0XHQgKi9cblx0XHRkZXN0cm95OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgZWwgPSB0aGlzLmVsLCBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xuXG5cdFx0XHRfY3VzdG9tRXZlbnRzLmZvckVhY2goZnVuY3Rpb24gKG5hbWUpIHtcblx0XHRcdFx0X29mZihlbCwgbmFtZS5zdWJzdHIoMikudG9Mb3dlckNhc2UoKSwgb3B0aW9uc1tuYW1lXSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0X29mZihlbCwgJ21vdXNlZG93bicsIHRoaXMuX29uVGFwU3RhcnQpO1xuXHRcdFx0X29mZihlbCwgJ3RvdWNoc3RhcnQnLCB0aGlzLl9vblRhcFN0YXJ0KTtcblxuXHRcdFx0X29mZihlbCwgJ2RyYWdvdmVyJywgdGhpcyk7XG5cdFx0XHRfb2ZmKGVsLCAnZHJhZ2VudGVyJywgdGhpcyk7XG5cblx0XHRcdC8vcmVtb3ZlIGRyYWdnYWJsZSBhdHRyaWJ1dGVzXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKGVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkcmFnZ2FibGVdJyksIGZ1bmN0aW9uIChlbCkge1xuXHRcdFx0XHRlbC5yZW1vdmVBdHRyaWJ1dGUoJ2RyYWdnYWJsZScpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRvdWNoRHJhZ092ZXJMaXN0ZW5lcnMuc3BsaWNlKHRvdWNoRHJhZ092ZXJMaXN0ZW5lcnMuaW5kZXhPZih0aGlzLl9vbkRyYWdPdmVyKSwgMSk7XG5cblx0XHRcdHRoaXMuX29uRHJvcCgpO1xuXG5cdFx0XHR0aGlzLmVsID0gbnVsbDtcblx0XHR9XG5cdH07XG5cblxuXHRmdW5jdGlvbiBfY2xvbmVIaWRlKHN0YXRlKSB7XG5cdFx0aWYgKGNsb25lRWwgJiYgKGNsb25lRWwuc3RhdGUgIT09IHN0YXRlKSkge1xuXHRcdFx0X2NzcyhjbG9uZUVsLCAnZGlzcGxheScsIHN0YXRlID8gJ25vbmUnIDogJycpO1xuXHRcdFx0IXN0YXRlICYmIGNsb25lRWwuc3RhdGUgJiYgcm9vdEVsLmluc2VydEJlZm9yZShjbG9uZUVsLCBkcmFnRWwpO1xuXHRcdFx0Y2xvbmVFbC5zdGF0ZSA9IHN0YXRlO1xuXHRcdH1cblx0fVxuXG5cblx0ZnVuY3Rpb24gX2JpbmQoY3R4LCBmbikge1xuXHRcdHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuXHRcdHJldHVyblx0Zm4uYmluZCA/IGZuLmJpbmQuYXBwbHkoZm4sIFtjdHhdLmNvbmNhdChhcmdzKSkgOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRyZXR1cm4gZm4uYXBwbHkoY3R4LCBhcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcblx0XHR9O1xuXHR9XG5cblxuXHRmdW5jdGlvbiBfY2xvc2VzdCgvKipIVE1MRWxlbWVudCovZWwsIC8qKlN0cmluZyovc2VsZWN0b3IsIC8qKkhUTUxFbGVtZW50Ki9jdHgpIHtcblx0XHRpZiAoZWwpIHtcblx0XHRcdGN0eCA9IGN0eCB8fCBkb2N1bWVudDtcblx0XHRcdHNlbGVjdG9yID0gc2VsZWN0b3Iuc3BsaXQoJy4nKTtcblxuXHRcdFx0dmFyIHRhZyA9IHNlbGVjdG9yLnNoaWZ0KCkudG9VcHBlckNhc2UoKSxcblx0XHRcdFx0cmUgPSBuZXcgUmVnRXhwKCdcXFxccygnICsgc2VsZWN0b3Iuam9pbignfCcpICsgJylcXFxccycsICdnJyk7XG5cblx0XHRcdGRvIHtcblx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdCh0YWcgPT09ICc+KicgJiYgZWwucGFyZW50Tm9kZSA9PT0gY3R4KSB8fCAoXG5cdFx0XHRcdFx0XHQodGFnID09PSAnJyB8fCBlbC5ub2RlTmFtZS50b1VwcGVyQ2FzZSgpID09IHRhZykgJiZcblx0XHRcdFx0XHRcdCghc2VsZWN0b3IubGVuZ3RoIHx8ICgoJyAnICsgZWwuY2xhc3NOYW1lICsgJyAnKS5tYXRjaChyZSkgfHwgW10pLmxlbmd0aCA9PSBzZWxlY3Rvci5sZW5ndGgpXG5cdFx0XHRcdFx0KVxuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHRyZXR1cm4gZWw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHdoaWxlIChlbCAhPT0gY3R4ICYmIChlbCA9IGVsLnBhcmVudE5vZGUpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cblx0ZnVuY3Rpb24gX2dsb2JhbERyYWdPdmVyKC8qKkV2ZW50Ki9ldnQpIHtcblx0XHRldnQuZGF0YVRyYW5zZmVyLmRyb3BFZmZlY3QgPSAnbW92ZSc7XG5cdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdH1cblxuXG5cdGZ1bmN0aW9uIF9vbihlbCwgZXZlbnQsIGZuKSB7XG5cdFx0ZWwuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgZm4sIGZhbHNlKTtcblx0fVxuXG5cblx0ZnVuY3Rpb24gX29mZihlbCwgZXZlbnQsIGZuKSB7XG5cdFx0ZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudCwgZm4sIGZhbHNlKTtcblx0fVxuXG5cblx0ZnVuY3Rpb24gX3RvZ2dsZUNsYXNzKGVsLCBuYW1lLCBzdGF0ZSkge1xuXHRcdGlmIChlbCkge1xuXHRcdFx0aWYgKGVsLmNsYXNzTGlzdCkge1xuXHRcdFx0XHRlbC5jbGFzc0xpc3Rbc3RhdGUgPyAnYWRkJyA6ICdyZW1vdmUnXShuYW1lKTtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHR2YXIgY2xhc3NOYW1lID0gKCcgJyArIGVsLmNsYXNzTmFtZSArICcgJykucmVwbGFjZSgvXFxzKy9nLCAnICcpLnJlcGxhY2UoJyAnICsgbmFtZSArICcgJywgJycpO1xuXHRcdFx0XHRlbC5jbGFzc05hbWUgPSBjbGFzc05hbWUgKyAoc3RhdGUgPyAnICcgKyBuYW1lIDogJycpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cblx0ZnVuY3Rpb24gX2NzcyhlbCwgcHJvcCwgdmFsKSB7XG5cdFx0dmFyIHN0eWxlID0gZWwgJiYgZWwuc3R5bGU7XG5cblx0XHRpZiAoc3R5bGUpIHtcblx0XHRcdGlmICh2YWwgPT09IHZvaWQgMCkge1xuXHRcdFx0XHRpZiAoZG9jdW1lbnQuZGVmYXVsdFZpZXcgJiYgZG9jdW1lbnQuZGVmYXVsdFZpZXcuZ2V0Q29tcHV0ZWRTdHlsZSkge1xuXHRcdFx0XHRcdHZhbCA9IGRvY3VtZW50LmRlZmF1bHRWaWV3LmdldENvbXB1dGVkU3R5bGUoZWwsICcnKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIGlmIChlbC5jdXJyZW50U3R5bGUpIHtcblx0XHRcdFx0XHR2YWwgPSBlbC5jdXJyZW50U3R5bGU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gcHJvcCA9PT0gdm9pZCAwID8gdmFsIDogdmFsW3Byb3BdO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGlmICghKHByb3AgaW4gc3R5bGUpKSB7XG5cdFx0XHRcdFx0cHJvcCA9ICctd2Via2l0LScgKyBwcm9wO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0c3R5bGVbcHJvcF0gPSB2YWwgKyAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycgPyAnJyA6ICdweCcpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cblx0ZnVuY3Rpb24gX2ZpbmQoY3R4LCB0YWdOYW1lLCBpdGVyYXRvcikge1xuXHRcdGlmIChjdHgpIHtcblx0XHRcdHZhciBsaXN0ID0gY3R4LmdldEVsZW1lbnRzQnlUYWdOYW1lKHRhZ05hbWUpLCBpID0gMCwgbiA9IGxpc3QubGVuZ3RoO1xuXG5cdFx0XHRpZiAoaXRlcmF0b3IpIHtcblx0XHRcdFx0Zm9yICg7IGkgPCBuOyBpKyspIHtcblx0XHRcdFx0XHRpdGVyYXRvcihsaXN0W2ldLCBpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gbGlzdDtcblx0XHR9XG5cblx0XHRyZXR1cm4gW107XG5cdH1cblxuXG5cdGZ1bmN0aW9uIF9kaXNhYmxlRHJhZ2dhYmxlKGVsKSB7XG5cdFx0ZWwuZHJhZ2dhYmxlID0gZmFsc2U7XG5cdH1cblxuXG5cdGZ1bmN0aW9uIF91bnNpbGVudCgpIHtcblx0XHRfc2lsZW50ID0gZmFsc2U7XG5cdH1cblxuXG5cdC8qKiBAcmV0dXJucyB7SFRNTEVsZW1lbnR8ZmFsc2V9ICovXG5cdGZ1bmN0aW9uIF9naG9zdEluQm90dG9tKGVsLCBldnQpIHtcblx0XHR2YXIgbGFzdEVsID0gZWwubGFzdEVsZW1lbnRDaGlsZCwgcmVjdCA9IGxhc3RFbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRyZXR1cm4gKGV2dC5jbGllbnRZIC0gKHJlY3QudG9wICsgcmVjdC5oZWlnaHQpID4gNSkgJiYgbGFzdEVsOyAvLyBtaW4gZGVsdGFcblx0fVxuXG5cblx0LyoqXG5cdCAqIEdlbmVyYXRlIGlkXG5cdCAqIEBwYXJhbSAgIHtIVE1MRWxlbWVudH0gZWxcblx0ICogQHJldHVybnMge1N0cmluZ31cblx0ICogQHByaXZhdGVcblx0ICovXG5cdGZ1bmN0aW9uIF9nZW5lcmF0ZUlkKGVsKSB7XG5cdFx0dmFyIHN0ciA9IGVsLnRhZ05hbWUgKyBlbC5jbGFzc05hbWUgKyBlbC5zcmMgKyBlbC5ocmVmICsgZWwudGV4dENvbnRlbnQsXG5cdFx0XHRpID0gc3RyLmxlbmd0aCxcblx0XHRcdHN1bSA9IDA7XG5cblx0XHR3aGlsZSAoaS0tKSB7XG5cdFx0XHRzdW0gKz0gc3RyLmNoYXJDb2RlQXQoaSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN1bS50b1N0cmluZygzNik7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgaW5kZXggb2YgYW4gZWxlbWVudCB3aXRoaW4gaXRzIHBhcmVudFxuXHQgKiBAcGFyYW0gZWxcblx0ICogQHJldHVybnMge251bWJlcn1cblx0ICogQHByaXZhdGVcblx0ICovXG5cdGZ1bmN0aW9uIF9pbmRleCgvKipIVE1MRWxlbWVudCovZWwpIHtcblx0XHR2YXIgaW5kZXggPSAwO1xuXHRcdHdoaWxlIChlbCAmJiAoZWwgPSBlbC5wcmV2aW91c0VsZW1lbnRTaWJsaW5nKSkge1xuXHRcdFx0aWYgKGVsLm5vZGVOYW1lLnRvVXBwZXJDYXNlKCkgIT09ICdURU1QTEFURScpIHtcblx0XHRcdFx0aW5kZXgrKztcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGluZGV4O1xuXHR9XG5cblx0ZnVuY3Rpb24gX3Rocm90dGxlKGNhbGxiYWNrLCBtcykge1xuXHRcdHZhciBhcmdzLCBfdGhpcztcblxuXHRcdHJldHVybiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoYXJncyA9PT0gdm9pZCAwKSB7XG5cdFx0XHRcdGFyZ3MgPSBhcmd1bWVudHM7XG5cdFx0XHRcdF90aGlzID0gdGhpcztcblxuXHRcdFx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRpZiAoYXJncy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0XHRcdGNhbGxiYWNrLmNhbGwoX3RoaXMsIGFyZ3NbMF0pO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjYWxsYmFjay5hcHBseShfdGhpcywgYXJncyk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0YXJncyA9IHZvaWQgMDtcblx0XHRcdFx0fSwgbXMpO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXG5cdC8vIEV4cG9ydCB1dGlsc1xuXHRTb3J0YWJsZS51dGlscyA9IHtcblx0XHRvbjogX29uLFxuXHRcdG9mZjogX29mZixcblx0XHRjc3M6IF9jc3MsXG5cdFx0ZmluZDogX2ZpbmQsXG5cdFx0YmluZDogX2JpbmQsXG5cdFx0aXM6IGZ1bmN0aW9uIChlbCwgc2VsZWN0b3IpIHtcblx0XHRcdHJldHVybiAhIV9jbG9zZXN0KGVsLCBzZWxlY3RvciwgZWwpO1xuXHRcdH0sXG5cdFx0dGhyb3R0bGU6IF90aHJvdHRsZSxcblx0XHRjbG9zZXN0OiBfY2xvc2VzdCxcblx0XHR0b2dnbGVDbGFzczogX3RvZ2dsZUNsYXNzLFxuXHRcdGRpc3BhdGNoRXZlbnQ6IF9kaXNwYXRjaEV2ZW50LFxuXHRcdGluZGV4OiBfaW5kZXhcblx0fTtcblxuXG5cdFNvcnRhYmxlLnZlcnNpb24gPSAnMS4xLjEnO1xuXG5cblx0LyoqXG5cdCAqIENyZWF0ZSBzb3J0YWJsZSBpbnN0YW5jZVxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSAgZWxcblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgW29wdGlvbnNdXG5cdCAqL1xuXHRTb3J0YWJsZS5jcmVhdGUgPSBmdW5jdGlvbiAoZWwsIG9wdGlvbnMpIHtcblx0XHRyZXR1cm4gbmV3IFNvcnRhYmxlKGVsLCBvcHRpb25zKTtcblx0fTtcblxuXHQvLyBFeHBvcnRcblx0cmV0dXJuIFNvcnRhYmxlO1xufSk7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIFNvcnRhYmxlID0gcmVxdWlyZShcInNvcnRhYmxlanNcIik7XG52YXIgbXVzdGFjaGUgPSByZXF1aXJlKFwibXVzdGFjaGVcIik7XG5cbnZhciBLYW5iYW4gPSBjbGFzcyBLYW5iYW57XG4gICAgcmVuZGVyKGRhdGEpe1xuICAgICAgICB2YXIgcmVzdWx0ID0gXCJcIjtcbiAgICAgICAgZGF0YS5mb3JFYWNoKChib2FyZCk9PntcbiAgICAgICAgICAgIHJlc3VsdCArPSAnPGRpdiBjbGFzcz1cImJvYXJkX19saXN0XCI+JztcbiAgICAgICAgICAgICAgICByZXN1bHQgKz0gJzxkaXYgY2xhc3M9XCJib2FyZF9fbGlzdF9fdGl0bGVcIj4nICsgYm9hcmQubmFtZSArICc8L2Rpdj4nO1xuICAgICAgICAgICAgICAgIHJlc3VsdCArPSAnPGRpdiBjbGFzcz1cImJvYXJkX19saXN0X19jYXJkc1wiPic7XG4gICAgICAgICAgICAgICAgYm9hcmQuY2FyZHMuZm9yRWFjaCgoY2FyZCk9PntcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ICs9ICc8ZGl2ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ2RhdGEtcmF3PVwiJyArIGNhcmQubmFtZSArICdcIiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXRhLWNhcmRpZD1cIicgKyBjYXJkLmNhcmRpZCArICdcIiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICdjbGFzcz1cImJvYXJkX19jYXJkXCI+JyArIGNhcmQubmFtZSArICc8L2Rpdj4nO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXN1bHQgKz0gXCI8L2Rpdj5cIjtcbiAgICAgICAgICAgIHJlc3VsdCArPSBcIjwvZGl2PlwiO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBzZXR1cEV2ZW50cygpe1xuICAgICAgICB0aGlzLl9ib2FyZElkSW5kZXggPSAwO1xuXG4gICAgICAgIHZhciBib2FyZHMgPSB0aGlzLl9lbC5xdWVyeVNlbGVjdG9yQWxsKFwiLmJvYXJkX19saXN0X19jYXJkc1wiKTtcbiAgICAgICAgdGhpcy5fc29ydGFibGVzID0gW107XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCh0aGlzLl9lbC5xdWVyeVNlbGVjdG9yQWxsKFwiLmJvYXJkX19jYXJkXCIpLCBmdW5jdGlvbihjYXJkKXtcbiAgICAgICAgICAgIGNhcmQuYWRkRXZlbnRMaXN0ZW5lcihcImRibGNsaWNrXCIsICgpPT57XG4gICAgICAgICAgICAgICAgdmFyIHJhdyA9IGNhcmQuZGF0YXNldC5yYXc7XG4gICAgICAgICAgICAgICAgY2FyZC5pbm5lckhUTUwgPSAnPGlucHV0IGNsYXNzPVwiYm9hcmRfX2lucGxhY2VcIj4nO1xuICAgICAgICAgICAgICAgIHZhciBpbnBsYWNlID0gY2FyZC5xdWVyeVNlbGVjdG9yKFwiLmJvYXJkX19pbnBsYWNlXCIpO1xuICAgICAgICAgICAgICAgIGlucGxhY2UudmFsdWUgPSByYXc7XG4gICAgICAgICAgICAgICAgaW5wbGFjZS5mb2N1cygpO1xuICAgICAgICAgICAgICAgIGlucGxhY2Uuc2V0U2VsZWN0aW9uUmFuZ2UoMCwgOTk5OSk7XG5cbiAgICAgICAgICAgICAgICB2YXIgYXBwbHlWYWx1ZVRvRGF0YSA9ICgpPT57XG4gICAgICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IGlucGxhY2UudmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIGNhcmQuaW5uZXJIVE1MID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuX2RhdGEuZm9yRWFjaCgoYm9hcmQpPT57XG4gICAgICAgICAgICAgICAgICAgICAgICBib2FyZC5jYXJkcy5mb3JFYWNoKChjKT0+e1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNhcmQuZGF0YXNldC5jYXJkaWQgKyAgXCIgdnMgXCIrIGMuY2FyZGlkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHR5cGVvZiBjYXJkLmRhdGFzZXQuY2FyZGlkICsgIFwiIHZzIFwiKyB0eXBlb2YgYy5jYXJkaWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoY2FyZC5kYXRhc2V0LmNhcmRpZCA9PT0gXCJcIiArIGMuY2FyZGlkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJoaXQhXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjLm5hbWUgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICB9KTtcblxuXG4gICAgICAgICAgICAgICAgICAgIHNlbGYucmVuZGVyQ29tcG9uZW50KCk7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuc2V0dXBFdmVudHMoKTtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5fb3B0aW9ucy5vblVwZGF0ZShzZWxmLl9kYXRhKTtcblxuICAgICAgICAgICAgICAgICAgICBpbnBsYWNlLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJibHVyXCIsIGFwcGx5VmFsdWVUb0RhdGEpO1xuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICBpbnBsYWNlLmFkZEV2ZW50TGlzdGVuZXIoXCJibHVyXCIsIGFwcGx5VmFsdWVUb0RhdGEpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoYm9hcmRzLCAoYm9hcmQpPT4ge1xuICAgICAgICAgICAgYm9hcmQuZGF0YXNldC5ib2FyZGlkID0gdGhpcy5fYm9hcmRJZEluZGV4Kys7XG4gICAgICAgICAgICB2YXIgc29ydGFibGVPcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIGdyb3VwOiBcImthbmJhblwiLFxuICAgICAgICAgICAgICAgIGFuaW1hdGlvbjogMTUwXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBTeW5jIHRoaXMuX2RhdGEgZnJvbSBzb3J0YWJsZWpzIGV2ZW50c1xuICAgICAgICAgICAgLy8gRWxlbWVudCBpcyBkcm9wcGVkIGludG8gdGhlIGxpc3QgZnJvbSBhbm90aGVyIGxpc3RcbiAgICAgICAgICAgIHNvcnRhYmxlT3B0aW9ucy5vbkFkZCA9ICgvKipFdmVudCovZXZ0KSA9PiB7XG4gICAgICAgICAgICAgICAgdmFyIGl0ZW1FbCA9IGV2dC5pdGVtOyAgLy8gZHJhZ2dlZCBIVE1MRWxlbWVudFxuICAgICAgICAgICAgICAgIHZhciB0YXJnZXQgPSB0aGlzLl9kYXRhW2JvYXJkLmRhdGFzZXQuYm9hcmRpZF0uY2FyZHM7XG4gICAgICAgICAgICAgICAgdGFyZ2V0LnNwbGljZShldnQubmV3SW5kZXgsIDAsIHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogaXRlbUVsLmRhdGFzZXQucmF3LFxuICAgICAgICAgICAgICAgICAgICBjYXJkaWQ6IGl0ZW1FbC5kYXRhc2V0LmNhcmRpZFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmKHRoaXMuX29wdGlvbnMub25VcGRhdGUpe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9vcHRpb25zLm9uVXBkYXRlKHRoaXMuX2RhdGEpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIC8vIENoYW5nZWQgc29ydGluZyB3aXRoaW4gbGlzdFxuICAgICAgICAgICAgc29ydGFibGVPcHRpb25zLm9uVXBkYXRlID0gKC8qKkV2ZW50Ki9ldnQpID0+IHtcbiAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0ID0gdGhpcy5fZGF0YVtib2FyZC5kYXRhc2V0LmJvYXJkaWRdLmNhcmRzO1xuICAgICAgICAgICAgICAgIHZhciByZW1vdmVkID0gdGFyZ2V0LnNwbGljZShldnQub2xkSW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgIHRhcmdldC5zcGxpY2UoZXZ0Lm5ld0luZGV4LCAwLCByZW1vdmVkWzBdKTtcbiAgICAgICAgICAgICAgICBpZih0aGlzLl9vcHRpb25zLm9uVXBkYXRlKXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fb3B0aW9ucy5vblVwZGF0ZSh0aGlzLl9kYXRhKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIEVsZW1lbnQgaXMgcmVtb3ZlZCBmcm9tIHRoZSBsaXN0IGludG8gYW5vdGhlciBsaXN0XG4gICAgICAgICAgICBzb3J0YWJsZU9wdGlvbnMub25SZW1vdmUgPSAoLyoqRXZlbnQqL2V2dCkgPT4ge1xuICAgICAgICAgICAgICAgIHZhciB0YXJnZXQgPSB0aGlzLl9kYXRhW2JvYXJkLmRhdGFzZXQuYm9hcmRpZF0uY2FyZHM7XG4gICAgICAgICAgICAgICAgdGFyZ2V0LnNwbGljZShldnQub2xkSW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgIGlmKHRoaXMuX29wdGlvbnMub25VcGRhdGUpe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9vcHRpb25zLm9uVXBkYXRlKHRoaXMuX2RhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHRoaXMuX3NvcnRhYmxlcy5wdXNoKFNvcnRhYmxlLmNyZWF0ZShib2FyZCwgc29ydGFibGVPcHRpb25zKSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJlbmRlckNvbXBvbmVudCgpe1xuICAgICAgICAvL1JlbW92ZSBBbGwgRXZlbnRzXG4gICAgICAgIEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwodGhpcy5fZWwucXVlcnlTZWxlY3RvckFsbChcIi5ib2FyZF9fY2FyZFwiKSwgZnVuY3Rpb24oY2FyZCl7XG4gICAgICAgICAgICBjYXJkLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJkYmxjbGlja1wiKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2VsLmlubmVySFRNTCA9IHRoaXMucmVuZGVyKHRoaXMuX2RhdGEpO1xuICAgIH1cblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgICAgb3B0aW9ucy51cGRhdGUgPSBvcHRpb25zLmhhc093blByb3BlcnR5KCd1cGRhdGUnKSA/IG9wdGlvbnMudXBkYXRlIDogbnVsbDtcbiAgICAgICAgb3B0aW9ucy5lbCA9IG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ2VsJykgPyBvcHRpb25zLmVsIDogXCJcIjtcbiAgICAgICAgb3B0aW9ucy5kYXRhID0gb3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgnZGF0YScpID8gb3B0aW9ucy5kYXRhIDogW107XG4gICAgICAgIHRoaXMuX29wdGlvbnMgPSBvcHRpb25zO1xuXG4gICAgICAgIHRoaXMuX2VsID0gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcih0aGlzLl9vcHRpb25zLmVsKTtcbiAgICAgICAgaWYoIXRoaXMuX2VsKXtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IodGhpcy5fb3B0aW9ucy5lbCArIFwiIGlzIG5vdCBleGlzdCBpbiB0aGUgY3VycmVudCBkb20hXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZGF0YSA9IHRoaXMuX29wdGlvbnMuZGF0YTtcbiAgICAgICAgdGhpcy5fdXBkYXRlTWV0aG9kID0gdGhpcy5fb3B0aW9ucy51cGRhdGU7XG5cbiAgICAgICAgdGhpcy5yZW5kZXJDb21wb25lbnQoKTtcbiAgICAgICAgdGhpcy5zZXR1cEV2ZW50cygpO1xuICAgIH1cblxuICAgIHVwZGF0ZSgpe1xuICAgICAgICB0aGlzLl91cGRhdGVNZXRob2QodGhpcy5fZGF0YSk7XG4gICAgfVxuXG4gICAgc2V0RGF0YShkYXRhKXtcbiAgICAgICAgdGhpcy5fc29ydGFibGVzLmZvckVhY2goKHNvcnRhYmxlKT0+e1xuICAgICAgICAgICAgc29ydGFibGUuZGVzdHJveSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fZGF0YSA9IGRhdGE7XG4gICAgICAgIHRoaXMucmVuZGVyQ29tcG9uZW50KCk7XG4gICAgICAgIHRoaXMuc2V0dXBFdmVudHMoKTtcbiAgICB9XG4gICAgc3RhdGljIG1kVG9LYW5iYW4odGV4dCl7XG4gICAgICAgIHZhciBjYXJkaWQgPSAwO1xuXG4gICAgICAgIHZhciBsaW5lcyA9IHRleHQuc3BsaXQoL1tcXHJ8XFxufFxcclxcbl0vKTtcblxuICAgICAgICB2YXIgb3V0cHV0ID0gW107XG4gICAgICAgIHZhciBjYXJkcyA9IFtdO1xuICAgICAgICBsaW5lcy5mb3JFYWNoKGZ1bmN0aW9uKGxpbmUpe1xuICAgICAgICAgICAgaWYobGluZS50cmltKCkuaW5kZXhPZihcIiNcIikgPT09IDApe1xuICAgICAgICAgICAgICAgIGNhcmRzID0gW107XG5cbiAgICAgICAgICAgICAgICBvdXRwdXQucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IGxpbmUudHJpbSgpLnJlcGxhY2UoXCIjXCIsIFwiXCIpLnRyaW0oKSxcbiAgICAgICAgICAgICAgICAgICAgY2FyZHM6IGNhcmRzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9ZWxzZSBpZihsaW5lLnRyaW0oKS5pbmRleE9mKFwiKlwiKSA9PT0gMCl7XG4gICAgICAgICAgICAgICAgY2FyZHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IGxpbmUudHJpbSgpLnJlcGxhY2UoXCIqXCIsIFwiXCIpLnRyaW0oKSxcbiAgICAgICAgICAgICAgICAgICAgY2FyZGlkOiBjYXJkaWQrK1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9XG5cbiAgICBzdGF0aWMga2FuYmFuVG9NZChkYXRhKXtcbiAgICAgICAgdmFyIG91dHB1dCA9IFtdO1xuICAgICAgICBkYXRhLmZvckVhY2goZnVuY3Rpb24oYm9hcmQpe1xuICAgICAgICAgICAgb3V0cHV0LnB1c2goXCIjIFwiICsgYm9hcmQubmFtZSk7XG4gICAgICAgICAgICBib2FyZC5jYXJkcy5mb3JFYWNoKGZ1bmN0aW9uKGNhcmQpe1xuICAgICAgICAgICAgICAgIG91dHB1dC5wdXNoKFwiICogXCIgKyBjYXJkLm5hbWUpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBvdXRwdXQuam9pbihcIlxcblwiKTtcbiAgICB9XG59O1xuXG5leHBvcnQgZGVmYXVsdCBLYW5iYW47Il19
