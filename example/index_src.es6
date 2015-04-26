import Kanban from "../src/main.es6";
var jQuery = require("jquery");
var Vue = require("vue");

var kanban;

emojify.setConfig({
    img_dir : 'images/basic'
});

new Vue({
    el: "#main",
    data: {
        textOutput: "# TODO\n * タスク１\n * タスク２ :warning:\n * タスク３\n# DOING\n * タスク４\n# DONE\n * タスク５\n * タスク６"
    },
    methods: {
        updateKanban : function(){
            kanban.setData(Kanban.mdToKanban(this.textOutput));
            emojify.run();
        }
    },
    ready: function(){
        kanban = new Kanban({
            el: ".board",
            data: Kanban.mdToKanban(this.textOutput),
            onUpdate : (data)=>{
                this.textOutput = Kanban.kanbanToMd(data);
                emojify.run();
            }
        });
        emojify.run();
    }
});


