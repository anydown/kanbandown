# kanbandown

Kanban to Markdown to Kanban :tada:

# Example

![kanbandown](https://cloud.githubusercontent.com/assets/3132889/7337014/f6b25ee6-ec52-11e4-99ea-d074b2b9bcff.gif)

# Usage

```js
new Kanban({
    el: ".board",
    data: Kanban.mdToKanban(markdown), //Pass markdown here
    onUpdate : function(data){
      //Will be called when you update the kanban
    }
});
```
