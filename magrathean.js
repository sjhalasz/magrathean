// Magrathean page generator
// sjhalasz@gmail.com

Tasks = new Mongo.Collection("tasks");
Data = new Mongo.Collection("data");

function escapeHTML(html) {
  var text = document.createTextNode(html);
  var div  = document.createElement("div");
  div.appendChild(text);
  return div.innerHTML;
}

if (Meteor.isClient) {

  Meteor.startup(function(){
    setTimeout(function(){
      var cursor = Data.find({}, {sort: {_id: 1}});
      var ids = [];
      cursor.forEach(
        function(d) { 
          ids.push(d._id);
        }
      );
      Session.set("ids", ids);
      Session.set("dataindex", 0);
      var doc = Data.findOne({_id:ids[0]});
      Session.set("document", doc);
    }, 2000);
  });

  // This code only runs on the client
  Template.body.helpers({
    tasks: function () {return Tasks.find({});},
    index: function() {return Session.get("dataindex");},
    isdate:function(a) {return a.typ == 'date';}
  });

UI.registerHelper("makeTask", function (a, d) {
  z = a.txt + '(' + a.nam + ':' + a.typ + ') ';
  switch(a.typ) {
    case 'text':
      break;
    case 'input':
      z = z + '<input ';
      z = z + 'name="' + a.nam + '" ';
      if(d && d[a.nam]) {
        z = z + 'value="' + d[a.nam] + '" ';
      }
      z = z + '>';
      break;
    case 'select':
      z = z + '<select name="' + a.nam + '">';
      var opt = a.opt.split(',');
      for(var i = 0 ; i < opt.length ; i++) {
        z = z + '<option value="' + opt[i] + '"';
        if(d && d[a.nam] == opt[i]) 
          z = z + " selected";
        z = z + '>' + opt[i] + '</option>';
      }
      z = z + '</select>';
      break;
    case 'date':
      z = z + '<input class="datepicker" ';
      z = z + 'name="' + a.nam + '" ';
      z = z + 'onfocusin="$(this).datepicker();" ';
      if(d && d[a.nam]) {
        z = z + 'value="' + d[a.nam] + '" ';
      }
      z = z + '>';
      break;
    default:
      z = '';
  }
  return z + '<br>';
});

UI.registerHelper("makeDate", function (a, d) {
  z = a.txt + '(' + a.nam + ':' + a.typ + ') ';
  z = z + '<input class="datepicker" ';
  z = z + 'name="' + a.nam + '" ';
  if(d && d[a.nam]) {
    z = z + 'value="' + d[a.nam] + '" ';
  }
  z = z + '>';
  return z + '<br>';
});

Template.date.rendered = function() {
  $(".datepicker").datepicker();
};

Template.body.events({
  "submit .new-task": function (event) {
    // This function is called when a new control is added

    var nam = event.target.nam.value;
    var typ = event.target.typ.value;
    var txt = escapeHTML(event.target.txt.value);
    var opt = escapeHTML(event.target.opt.value);

    // insert if new otherwise update 
    var doc = Tasks.findOne({nam:nam});
    if(doc) {
      Tasks.update(
        { _id: doc._id },
        { nam: nam,
          typ: typ,
          txt: txt,
          opt: opt
        }
      );
    } else {
      Tasks.insert(
        { nam: nam,
          typ: typ,
          txt: txt,
          opt: opt
        }
      );
    }

    // Clear form
    event.target.nam.value = "";
    event.target.typ.value = "";
    event.target.txt.value = "";
    event.target.opt.value = "";

    // Prevent default form submit
    return false;
  },

  "submit .data-record": function (event) {
    // This function is called when a data record is appended

    var x = {};
    var name;
    var i;
    for(i = 0 ; i < event.target.length ; i++) {
      name = event.target[i].name;
      if(0 != name.length) {
        x[name] = event.target[i].value;
      }
    }
    var ids = Session.get("ids");
    var index = Session.get("dataindex");
    if(index > ids.length) {
      Data.insert(x);
    } else {
      Data.update(
        { _id: ids[index] },
        x
      );
    }
    // Prevent default form submit
    return false;
  },
  "click .back":function() {
     var index = Session.get("dataindex");
     var ids = Session.get("ids");
     if(index != 0) {
       index--;
       Session.set("dataindex", index);
       var doc = Data.findOne({_id:ids[index]});
       Session.set("document", doc);
     }
     return false;
  },
  "click .next":function() {
     var index = Session.get("dataindex");
     var ids = Session.get("ids");
     if(index < ids.length) {
       index++;
       Session.set("dataindex", index);
       var doc = Data.findOne({_id:ids[index]});
       Session.set("document", doc);
     }
     return false;
  }
});

Template.body.events({
  "click .delete": function () {
    Tasks.remove(this._id);
  }

});

Template.task.helpers({
  "data": function() {
    return Session.get("document");
  }
});

}
