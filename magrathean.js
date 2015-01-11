// Magrathean page generator
// sjhalasz@gmail.com

Tasks = new Mongo.Collection("tasks");

function escapeHTML(html) {
  var text = document.createTextNode(html);
  var div  = document.createElement("div");
  div.appendChild(text);
  return div.innerHTML;
}

if (Meteor.isClient) {

  Meteor.startup(function(){
    Session.set("dataindex", 0);
  });

  Template.index.helpers({
    index: function() {return Session.get("dataindex");},
  });

  Template.controls.helpers({
    tasks: function () {return Tasks.find({});},
    isdate:function(typ) {return typ == 'date';},
    istext:function(typ) {return typ == 'text';},
    isinput:function(typ) {return typ == 'input';},
    isselect:function(typ) {return typ == 'select';},
  });

Handlebars.registerHelper(
    'data', function(nam, val, txt) {
      var index = Session.get('dataindex');
      var doc = Tasks.findOne(
        {'nam': nam},
        {'dat':1}
      );
      var dat = doc ? doc.dat : [];
      dat = $.grep(dat, function(e) { 
        return e.index === index
      });
      dat = dat ? dat[0].data : '';
      if(val) return (dat === val) ? txt : '';
      return dat;
    }
);

Template.select.helpers({
  "options": function(opt) {
      return opt.split(',');
    },
  "datequals": function(val, txt) {
      var dat = Session.get('dat');
      return (dat == val) ? txt : '';
    }
  }
);

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
        { $set: {
          nam: nam,
          typ: typ,
          txt: txt,
          opt: opt
          }
        }
      );
    } else {
      Tasks.insert(
        { nam: nam,
          typ: typ,
          txt: txt,
          opt: opt,
          dat: []
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
    // This function is called when a data record is 
    // appended or changed

    //var x = {};
    var name;
    var i;
    var doc;
    var index = Session.get("dataindex");
    var value;
    for(i = 0 ; i < event.target.length ; i++) {
      name = event.target[i].name;
      if(name) {
        value = event.target[i].value;
        doc = Tasks.findOne({'nam':name});
        Tasks.update( // remove this index
          {'_id': doc._id},
          {'$pull': {'dat': {'index':index}}}
        );
        Tasks.update( // add it back with new value
          {'_id': doc._id},
          {'$addToSet':{'dat':{'index':index,'data':value}}}
        ); 
      }
    }
    // Prevent default form submit
    return false;
  },
  "click .back":function() {
     var index = Session.get("dataindex");
     if(index != 0) {
       index--;
       Session.set("dataindex", index);
     }
     return false;
  },
  "click .next":function() {
     var index = Session.get("dataindex");
     var ids = Session.get("ids");
     index++;
     Session.set("dataindex", index);
     return false;
  },
  "click .delete": function () {
    Tasks.remove(this._id);
  }

});

}
