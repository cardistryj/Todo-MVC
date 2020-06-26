let $ = sel => document.querySelector(sel);
let $All = sel => document.querySelectorAll(sel);

const CL_COMPLETED = 'completed';
const CL_SELECTED = 'selected';
const CL_TOUCHED = 'touched';
const CL_CHECKED = 'checked';
const CL_CLEAN = 'clean';
const CL_MODALSHOW = 'modal-show';
const CL_ACTIVE = 'active';

let dataSym = Symbol();     // bind data for DOM
let matchSym = Symbol();    // bind matched content for todo item

// load data
let todoItems = JSON.parse(localStorage.getItem('todoItems'))||[];

// sift the orignal todo-list under given filter conditions
function flush(){
    let condition = { keyword:'' };
    if($('.filter-icon').classList.contains(CL_ACTIVE)){
      Object.assign(condition, {
        keyword: $('.new-todo').value,
        completed: (status=>{
            return {'all':'all', 'pending': false, 'completed': true}[status]
          })($('#status label').innerHTML),
        date: $('#date label').innerHTML,
        priority: $('#priority label').innerHTML,
        tags: [...$All('.tags>span')].map(ele=> ele.innerHTML)
      })
    }
    let renderlist=todoItems.filter(ele=>{
      for(let key in condition){
        if(key=='keyword'){       // match keyword in 'title' as prefix, and all in 'content'
          let contentPlain = ele.content.split(/<.+?>/).join('');   // degrade rich text to the plain one
          let matchIdx = contentPlain.indexOf(condition[key]);
          if(matchIdx!=-1){
            let startIdx = Math.max(matchIdx - 3,0);
            let matchLength = Math.min(condition[key].length, 7);
            let endIdx = Math.min(matchIdx+10, contentPlain.length);
            ele[matchSym] =                                         // format matched result
`${startIdx>0?'..':''}${contentPlain.slice(startIdx, matchIdx)}\
<strong>${contentPlain.slice(matchIdx, matchIdx+matchLength)}</strong>\
${contentPlain.slice(matchIdx+matchLength, endIdx)}\
${endIdx<contentPlain.length?'..':''}`;
          }
          else if(!ele.title.startsWith(condition[key]))
              return false;
        }
        else if(key=='tags'){
          if(condition[key].some(tag=>{
            return ele.tags.indexOf(tag)==-1;
          }))
            return false;
        }
        else{
          if(condition[key]=='all')
            continue;
          else if(condition[key]!=ele[key])
            return false;
        }
      }
      return true;
    })
    render(renderlist);
}

// render the given filtered list from function 'flush'
function render(renderlist){
  let renderlistDom = $('.todo-list');
  let newrenderlistDom = document.createElement('ul');
  newrenderlistDom.classList.add('todo-list');

  let leftNum = 0;
  renderlist.forEach( ele=>{
    let itemDom = document.createElement('li');
    itemDom.innerHTML = `<div class="view">
                        <input class="toggle" type="checkbox">
                            <label class="todo-label">
                              ${ele.title.length<8?ele.title:ele.title.slice(0, 6).padEnd(8, '.')}
                            </label>
                            <span class="match-content">${ele[matchSym]}</span>
                            <span class="date">${ele.date}</span>
                            <span class="${ele.priority}"></span>
                        </div>`;

    leftNum += !ele.completed;
    if(ele.completed) 
      itemDom.classList.add(CL_COMPLETED);

    // toggle todo item
    let toggle=itemDom.querySelector('.toggle');
    toggle.checked = ele.completed;
    toggle[dataSym] = {ele};
    toggle.onchange = flushers.toggleItemStatus;

    // edit todo item
    let label = itemDom.querySelector('.todo-label');
    label[dataSym] = {ele};
    label.ontouchend = utils.openModal;

    // drag to delete
    itemDom[dataSym] = {ele};
    itemDom.ontouchstart = gestures.touchItem;
    itemDom.ontouchmove = gestures.dragItem;
    itemDom.addEventListener('touchend', gestures.releaseItem, true)

    newrenderlistDom.appendChild(itemDom);
  })
  $('.main').replaceChild(newrenderlistDom, renderlistDom);

  // todo items count
  $('.todo-count').innerHTML = `${renderlist.length? `${renderlist.length} items, <strong>${leftNum}</strong> left.`:'No item.'}`;

  // toggle all todo items
  let toggleAll = $('.toggle-all input')
  toggleAll.checked = leftNum == 0;
  toggleAll[dataSym] = {renderlist};

  // clear completed
  let clearComplete = $('.clear-completed');
  if(renderlist.length - leftNum > 0)
    clearComplete.classList.add(CL_CLEAN);
  else
    clearComplete.classList.remove(CL_CLEAN)
  
  clearComplete[dataSym] = {renderlist};
}

// all methods which impose modification on the present todo list, and need a flush
let flushers = {
  removeItem:function() {
    todoItems.splice(todoItems.indexOf(this[dataSym].ele), 1);
    utils.updateTagsAndDates();
  },
  toggleItemStatus: function(){
    this[dataSym].ele.completed = !this[dataSym].ele.completed;
  },
  toggleAllItemStatus: function(){
    if(this.checked)
      this[dataSym].renderlist.forEach(item=>{
        item.completed = true;
      })
    else
      this[dataSym].renderlist.forEach(item=>{
        item.completed = false;
      })
  },
  clearCompleted: function(){
    this[dataSym].renderlist.forEach(item=>{
      if(item.completed)
        todoItems.splice(todoItems.indexOf(item), 1);
    })
    utils.updateTagsAndDates();
  },
  selectListItem: function(){       // select a value in the filter dropdown list
      let label = this.parentElement.previousElementSibling;
      label.innerHTML=this.innerHTML;
      label.classList.remove('high','middle','normal','low');
      label.classList.add(this.classList.item(0));
  },
  toggleTag: function(event){     // select or remove a tag, used in both filter and a single todo item
    this.parentElement.previousElementSibling.focus();
    if(this.classList.contains(CL_SELECTED)){
      this.classList.remove(CL_SELECTED);
      this[dataSym].tag.remove();
    }
    else{
      let tag = document.createElement('span');
      let tagPanel = this.parentElement.nextElementSibling;
      tag.innerHTML=`${this.innerHTML}`;
      tag[dataSym] = {ele: this};
      this[dataSym] = {tag};
      this.classList.add(CL_SELECTED);
      tagPanel.appendChild(tag);
      tag.onclick = flushers.removeTagSpan;
    }
    event.stopPropagation();
  },
  removeTagSpan: function(){      // remove tag from its present area
    this[dataSym].ele.click();
  },
  addTodoItem: function(ev) {
    // 'Enter' pressed
    if (ev.keyCode != 13 || $('.filter-icon').classList.contains(CL_ACTIVE)) return;
    let title = this.value;
    if (title == '') {
      console.warn('message is empty');
      return;
    }
    todoItems.unshift({
      title, 
      completed: false, 
      priority: 'normal', 
      content: '', 
      tags: [], 
      date: utils.formatDate(new Date())
    })
    this.value = '';
    this.blur();      // manually blur to collapse keyboard on the mobile
  },
  toggleFilters: function(){    // enable filters 
    this.classList.toggle(CL_ACTIVE);
    $('.filters').classList.toggle(CL_ACTIVE);
    let placeholder = this.classList.contains(CL_ACTIVE)?'...or search something':'What needs to be done?';
    $('.new-todo').setAttribute('placeholder', placeholder);
  },
  closeModal: function(event){  // close edit modal, while update the corresponding todo item
    if(event.target == event.currentTarget){
      this.classList.remove(CL_MODALSHOW);
      this.previousElementSibling.classList.remove(CL_MODALSHOW);
      Object.assign(this[dataSym].ele, {
        title: this.querySelector('#item-title').value,
        completed: this.querySelector('#item-status').checked,
        date: this.querySelector('#item-date').value,
        priority: this.querySelector('#item-label').innerHTML,
        tags: [...this.querySelectorAll('.item-tag>span')].map(ele=>{
          return ele.innerHTML;
        }),
        content: this.querySelector('#richtext').innerHTML
      })
      utils.updateTagsAndDates();
      event.stopPropagation();
    }
  },
};

// bind 'flush' method for all those flushers
(function(flushers) {
  for(let key in flushers){
    flushers[key] = new Proxy(flushers[key], {
      apply: function(){
        Reflect.apply(...arguments);
        flush();
      }
    });
  };
}) (flushers);

// other method or tools, which do not need to reflush
let utils = {
  clearDropDown: function(){          // collapse all dropdown filters
    $All('label').forEach(ele=>{
      ele.classList.remove(CL_CHECKED);
    })
  },
  toggleDropdown: function(event){    // unfold or collapse certain dropdown filter
    let flag = this.classList.contains(CL_CHECKED);
    utils.clearDropDown();
    if(!flag)
      this.classList.add(CL_CHECKED)
    event.stopPropagation();
  },
  formatDate: function(date){
    return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
  },
  addTags: function(ev){
    if (ev.keyCode != 13) return;
    let tagsUl = this.nextElementSibling;
    // handle duplicate tags, select them directly
    let existedTag = [...tagsUl.querySelectorAll('li')].find(ele=>{
      return ele.innerHTML==this.value;
    })
    if(existedTag){
      if(!existedTag.classList.contains(CL_SELECTED))
        existedTag.click();
      return;
    }
    let new_tag = document.createElement('li');
    new_tag.innerHTML = this.value;
    // update tags in the filters simultaneously, for ease of diff later
    let new_tag_ = document.createElement('li');
    new_tag_.innerHTML = this.value;
    this.value = '';
    tagsUl.insertBefore(new_tag, tagsUl.firstElementChild);
    let filterTagUl = $('#tag ul');
    filterTagUl.insertBefore(new_tag_, filterTagUl.firstElementChild)
    new_tag.onclick = flushers.toggleTag;
    new_tag_.onclick = flushers.toggleTag;
    new_tag.click();
  },
  openModal: function(){    // open edit modal, infuse corresponding todo item data
    let modal = $('.modal');
    modal.classList.add(CL_MODALSHOW);
    $('.modal-backdrop').classList.add(CL_MODALSHOW);
    let ele = this[dataSym].ele;
    let titleDom = modal.querySelector('#item-title');
    titleDom.value = ele.title;
    titleDom.focus();
    let itemStatus = modal.querySelector('#item-status');
    if(itemStatus.checked !== ele.completed)
      itemStatus.click();
    modal.querySelector('#item-date').value = ele.date;
    let priorityLabel = modal.querySelector('#item-label');
    priorityLabel.innerHTML = ele.priority;
    priorityLabel.classList.remove('high','middle','normal','low');
    priorityLabel.classList.add(ele.priority);
    modal.querySelector('#edit-tag').value = '';
    modal.querySelectorAll('.filtered-tags>li').forEach(tagLi =>{
      // manually click to sychronize tags
      if((ele.tags.indexOf(tagLi.innerHTML)!=-1)!==(tagLi.classList.contains(CL_SELECTED))){
        tagLi.click()
      }
    })
    modal.querySelector('#richtext').innerHTML = ele.content;
    modal[dataSym] = this[dataSym];
  },
  updateTagsAndDates: function(){  // diff the tags and dates, patch or remove to update
    let tags = []
    let datesSet = new Set();
    datesSet.add('all')
    todoItems.forEach(item=>{
      tags = tags.concat(item.tags);
      datesSet.add(item.date);
    })
    let tagsSet = new Set(tags);
    let oriTagsSet = new Set();
    let oriDatesSet = new Set();

    let FilterTags = $('#tag ul');
    let ItemTags = $('.filtered-tags');
    let Dates = $('#date ul');
    let dateLabel = $('#date label');

    // compute difference and remove those old outliers
    $All('#tag ul li,.filtered-tags li').forEach(ele=>{
      oriTagsSet.add(ele.innerHTML)
      if(!tagsSet.has(ele.innerHTML)){
        if(ele.classList.contains(CL_SELECTED))
          ele.click();
        ele.remove();
      }
    });
    // patch those new tags
    tagsSet.forEach(tag=>{
      if(!oriTagsSet.has(tag)){
        let new_li=document.createElement('li');
        let new_li_=document.createElement('li');
        new_li.innerHTML=new_li_.innerHTML=tag;
        new_li.onclick=new_li_.onclick=flushers.toggleTag;
        FilterTags.appendChild(new_li);
        ItemTags.appendChild(new_li_);
      }
    })

    // similarly...
    Dates.querySelectorAll('li').forEach(ele=>{
      oriDatesSet.add(ele.innerHTML)
      if(!datesSet.has(ele.innerHTML))
        ele.remove();
    });
    if(!datesSet.has(dateLabel.innerHTML))
      dateLabel.innerHTML='all';    
    datesSet.forEach(date=>{
      if(!oriDatesSet.has(date)){
        let new_li=document.createElement('li');
        new_li.innerHTML=date;
        new_li.onclick=flushers.selectListItem;
        Dates.appendChild(new_li);
      }
    })
  }
}

// manage gestures to drag and delete todo item
let gestures = {
  oldTouch: null,
  oldCoorX: null,
  touchItem: function(ev) {
    this.classList.add(CL_TOUCHED);
    gestures.oldTouch = ev.touches[0];
    gestures.oldCoorX = this.style.left;
  },
  dragItem: function(ev) {
    let newTouch = ev.touches[0];
    let style = this.style;
    style.left =
      parseFloat(style.left || 0) +
      (newTouch.clientX - gestures.oldTouch.clientX) +
      "px";
    gestures.oldTouch = newTouch;
  },
  releaseItem: function(ev) {
    if(Math.abs(parseFloat(this.style.left))>screen.width/1.8){
      flushers.removeItem.apply(this);
      ev.stopPropagation();
    }
    else{
      if(!this.style.left == gestures.oldCoorX){
        this.style.left = gestures.oldCoorX;
        ev.stopPropagation()
      }
      this.classList.remove(CL_TOUCHED);
    }
  }
}

// manage the operations on the rich text
let richTextEditor = {
  updateEditor: function(){     // update the status of those UI components for editing richtext
    setTimeout(() => {
      let range = window.getSelection().getRangeAt(0);
      let fontStyles = (range=>{
        let styleSet = new Set();
        let startNode = range.startContainer;
        let endNode = range.endContainer;
        while(startNode&&startNode!=this){
          styleSet.add(startNode.nodeName);
          startNode = startNode.parentNode;
        }
        while(endNode&&endNode!=this){
          styleSet.add(endNode.nodeName);
          endNode = endNode.parentNode;
        }
        return ['B','I','U'].map(x=> styleSet.has(x));
      })(range);

        $('.bold').checked=fontStyles[0];
        $('.italic').checked=fontStyles[1];
        $('.underline').checked=fontStyles[2];
    }, 0);
  },
  editMode: function(command, tag){   // excute richtext command
    return function(){
      setTimeout(() => {
        $('#richtext').focus();
        document.execCommand(command, false, tag);   
      }, 0);
    }
  }
}

window.onload = function init() {
    // init main input
    let newTodo = $('.new-todo');
    newTodo.addEventListener('keyup', flushers.addTodoItem);

    // init all filters
    $('body').addEventListener('click', utils.clearDropDown);

    $All('label').forEach(ele=>{
        ele.onclick = utils.toggleDropdown;
      }
    );
    $('#edit-tag').onfocus = function(){
      this.classList.add(CL_CHECKED);
    }
    $('#edit-tag').onblur = function(){
      setTimeout(()=>{
        if(this != document.activeElement)
          this.classList.remove(CL_CHECKED);
      }, 0)
    }
    $('#edit-tag').onkeyup = utils.addTags;

    $All('div:not(#tag)>ul>li').forEach(ele=>{
      ele.ontouchend = flushers.selectListItem;
    });

    $All('#tag li').forEach(ele=>{
      ele.onclick = flushers.toggleTag;
    })

    $All('.filtered-tags li').forEach(ele=>{
      ele.onclick = flushers.toggleTag;
    })
    $('.filter-icon').ontouchend = flushers.toggleFilters;

    // init modal
    let modal = $('.modal');
    modal.addEventListener('touchend', flushers.closeModal, true)

    $('#item-status').onclick = function(){
      $('.modal-panel').classList.toggle(CL_COMPLETED)
    }
    // init richtext editor
    $('.bold').ontouchend = richTextEditor.editMode('bold');
    $('.italic').ontouchend = richTextEditor.editMode('italic');
    $('.underline').ontouchend = richTextEditor.editMode('underline');
    $('.side-header').ontouchend = richTextEditor.editMode('formatBlock', '<h4>');
    $('.horizontal-line').ontouchend = richTextEditor.editMode('insertHorizontalRule');
    $('.paragraph').ontouchend = richTextEditor.editMode('formatBlock', '<p>');

    $('#richtext').ontouchend = richTextEditor.updateEditor;
    $('#richtext').onkeyup = richTextEditor.updateEditor;

    // init toggle-all and clear-completed
    $('.toggle-all input').onclick = flushers.toggleAllItemStatus;
    $('.clear-completed').ontouchend = flushers.clearCompleted;

    utils.updateTagsAndDates();
    flush();
  };

// save data
window.onbeforeunload = function(){
  todoItems.forEach(ele=>{
    delete ele[matchSym];
  })
  localStorage.setItem('todoItems', JSON.stringify(todoItems))
}