"use strict";
var Sortable = require("sortablejs");
var Kanban = (function () {
    function Kanban(options) {
        options = options || {};
        options.update = options.hasOwnProperty('update') ? options.update : null;
        options.el = options.hasOwnProperty('el') ? options.el : "";
        options.data = options.hasOwnProperty('data') ? options.data : [];
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
    Kanban.prototype.render = function (data) {
        var result = "";
        data.forEach(function (board) {
            result += '<div class="board__list">';
            result += '<div class="board__list__title">' + board.name + '</div>';
            result += '<div class="board__list__cards">';
            board.cards.forEach(function (card) {
                result += '<div ' +
                    'data-raw="' + card.name + '" ' +
                    'data-cardid="' + card.cardid + '" ' +
                    'class="board__card">' + card.name + '</div>';
            });
            result += "</div>";
            result += "</div>";
        });
        return result;
    };
    Kanban.prototype.setupEvents = function () {
        var _this = this;
        this._boardIdIndex = 0;
        var boards = this._el.querySelectorAll(".board__list__cards");
        this._sortables = [];
        var self = this;
        Array.prototype.forEach.call(this._el.querySelectorAll(".board__card"), function (card) {
            card.addEventListener("dblclick", function () {
                var raw = card.dataset.raw;
                card.innerHTML = '<input class="board__inplace">';
                var inplace = card.querySelector(".board__inplace");
                inplace.value = raw;
                inplace.focus();
                inplace.setSelectionRange(0, 9999);
                var applyValueToData = function () {
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
                };
                inplace.addEventListener("blur", applyValueToData);
            });
        });
        Array.prototype.forEach.call(boards, function (board) {
            board.dataset.boardid = _this._boardIdIndex++;
            var sortableOptions = {
                group: "kanban",
                animation: 150,
                onAdd: function (/**Event*/ evt) {
                    var itemEl = evt.item; // dragged HTMLElement
                    var target = _this._data[board.dataset.boardid].cards;
                    target.splice(evt.newIndex, 0, {
                        name: itemEl.dataset.raw,
                        cardid: itemEl.dataset.cardid
                    });
                    if (_this._options.onUpdate) {
                        _this._options.onUpdate(_this._data);
                    }
                },
                onUpdate: function (/**Event*/ evt) {
                    var target = _this._data[board.dataset.boardid].cards;
                    var removed = target.splice(evt.oldIndex, 1);
                    target.splice(evt.newIndex, 0, removed[0]);
                    if (_this._options.onUpdate) {
                        _this._options.onUpdate(_this._data);
                    }
                },
                onRemove: function (/**Event*/ evt) {
                    var target = _this._data[board.dataset.boardid].cards;
                    target.splice(evt.oldIndex, 1);
                    if (_this._options.onUpdate) {
                        _this._options.onUpdate(_this._data);
                    }
                }
            };
            _this._sortables.push(Sortable.create(board, sortableOptions));
        });
    };
    Kanban.prototype.renderComponent = function () {
        //Remove All Events
        Array.prototype.forEach.call(this._el.querySelectorAll(".board__card"), function (card) {
            card.removeEventListener("dblclick");
        });
        this._el.innerHTML = this.render(this._data);
    };
    Kanban.prototype.update = function () {
        this._updateMethod(this._data);
    };
    Kanban.prototype.setData = function (data) {
        this._sortables.forEach(function (sortable) {
            sortable.destroy();
        });
        this._data = data;
        this.renderComponent();
        this.setupEvents();
    };
    Kanban.mdToKanban = function (text) {
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
            }
            else if (line.trim().indexOf("*") === 0) {
                cards.push({
                    name: line.trim().replace("*", "").trim(),
                    cardid: cardid++
                });
            }
        });
        return output;
    };
    Kanban.kanbanToMd = function (data) {
        var output = [];
        data.forEach(function (board) {
            output.push("# " + board.name);
            board.cards.forEach(function (card) {
                output.push(" * " + card.name);
            });
        });
        return output.join("\n");
    };
    return Kanban;
}());
exports.Kanban = Kanban;
;
