"use strict";

var Sortable = require("sortablejs");
var mustache = require("mustache");

var Kanban = class Kanban{
    render(data){
        var result = "";
        data.forEach((board)=>{
            result += '<div class="board__list">';
                result += '<div class="board__list__title">' + board.name + '</div>';
                result += '<div class="board__list__cards">';
                board.cards.forEach((card)=>{
                    result += '<div ' +
                        'data-raw="' + card.name + '" ' +
                        'data-cardid="' + card.cardid + '" ' +
                        'class="board__card">' + card.name + '</div>';
                });

            result += "</div>";
            result += "</div>";
        });
        return result;
    }

    setupEvents(){
        this._boardIdIndex = 0;

        var boards = this._el.querySelectorAll(".board__list__cards");
        this._sortables = [];
        var self = this;
        Array.prototype.forEach.call(this._el.querySelectorAll(".board__card"), function(card){
            card.addEventListener("dblclick", ()=>{
                var raw = card.dataset.raw;
                card.innerHTML = '<input class="board__inplace">';
                var inplace = card.querySelector(".board__inplace");
                inplace.value = raw;
                inplace.focus();
                inplace.setSelectionRange(0, 9999);

                var applyValueToData = ()=>{
                    var value = inplace.value;
                    card.innerHTML = value;
                    self._data.forEach((board)=>{
                        board.cards.forEach((c)=>{
                            console.log(card.dataset.cardid +  " vs "+ c.cardid)
                            console.log(typeof card.dataset.cardid +  " vs "+ typeof c.cardid)
                            if(card.dataset.cardid === "" + c.cardid){
                                console.log("hit!");
                                c.name = value;
                            }
                        })
                    });


                    self.renderComponent();
                    self.setupEvents();
                    self._options.onUpdate(self._data);

                    inplace.removeEventListener("blur", applyValueToData);
                };

                inplace.addEventListener("blur", applyValueToData);
            });
        });

        Array.prototype.forEach.call(boards, (board)=> {
            board.dataset.boardid = this._boardIdIndex++;
            var sortableOptions = {
                group: "kanban",
                animation: 150
            };

            // Sync this._data from sortablejs events
            // Element is dropped into the list from another list
            sortableOptions.onAdd = (/**Event*/evt) => {
                var itemEl = evt.item;  // dragged HTMLElement
                var target = this._data[board.dataset.boardid].cards;
                target.splice(evt.newIndex, 0, {
                    name: itemEl.dataset.raw,
                    cardid: itemEl.dataset.cardid
                });
                if(this._options.onUpdate){
                    this._options.onUpdate(this._data);
                }

            };
            // Changed sorting within list
            sortableOptions.onUpdate = (/**Event*/evt) => {
                var target = this._data[board.dataset.boardid].cards;
                var removed = target.splice(evt.oldIndex, 1);
                target.splice(evt.newIndex, 0, removed[0]);
                if(this._options.onUpdate){
                    this._options.onUpdate(this._data);
                }

            };

            // Element is removed from the list into another list
            sortableOptions.onRemove = (/**Event*/evt) => {
                var target = this._data[board.dataset.boardid].cards;
                target.splice(evt.oldIndex, 1);
                if(this._options.onUpdate){
                    this._options.onUpdate(this._data);
                }
            };

            this._sortables.push(Sortable.create(board, sortableOptions));
        });
    }

    renderComponent(){
        //Remove All Events
        Array.prototype.forEach.call(this._el.querySelectorAll(".board__card"), function(card){
            card.removeEventListener("dblclick");
        });
        this._el.innerHTML = this.render(this._data);
    }

    constructor(options){
        options = options || {};
        options.update = options.hasOwnProperty('update') ? options.update : null;
        options.el = options.hasOwnProperty('el') ? options.el : "";
        options.data = options.hasOwnProperty('data') ? options.data : [];
        this._options = options;

        this._el = document.querySelector(this._options.el);
        if(!this._el){
            console.error(this._options.el + " is not exist in the current dom!");
        }

        this._data = this._options.data;
        this._updateMethod = this._options.update;

        this.renderComponent();
        this.setupEvents();
    }

    update(){
        this._updateMethod(this._data);
    }

    setData(data){
        this._sortables.forEach((sortable)=>{
            sortable.destroy();
        });
        this._data = data;
        this.renderComponent();
        this.setupEvents();
    }
    static mdToKanban(text){
        var cardid = 0;

        var lines = text.split(/[\r|\n|\r\n]/);

        var output = [];
        var cards = [];
        lines.forEach(function(line){
            if(line.trim().indexOf("#") === 0){
                cards = [];

                output.push({
                    name: line.trim().replace("#", "").trim(),
                    cards: cards
                });
            }else if(line.trim().indexOf("*") === 0){
                cards.push({
                    name: line.trim().replace("*", "").trim(),
                    cardid: cardid++
                });
            }
        });
        return output;
    }

    static kanbanToMd(data){
        var output = [];
        data.forEach(function(board){
            output.push("# " + board.name);
            board.cards.forEach(function(card){
                output.push(" * " + card.name);
            })
        });
        return output.join("\n");
    }
};

export default Kanban;