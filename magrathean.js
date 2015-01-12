// magrathean.js
// sjhalasz@gmail.com
// see magrathean.html comments for description of the application

// ************************* both client and server code *******************

// Create an instance of a Mongo collection named "main" 
// It will be created if it doesn't exist
// The documents in this collection have the following structure:
//   - one document for each control that the user can add to the form interactively
//     (I call these 'soft controls')
//   - document includes fields:
//       nam: the name of the soft control
//       typ: the type of the soft control, e.g. input, select, date
//       lab: the label text for the soft control
//       opt: the options if this is a select control, a comma separated string
//       dat: an array of objects containing record values for this soft control,
//            having properties:
//              index: the record number
//              data:  the value of this control for the record identified by index
Controls = new Mongo.Collection("controls");

// ******************************* client code *****************************

// code in this block runs only in the client
if (Meteor.isClient) {

  // This function runs when the client starts up
  Meteor.startup(function(){
    // initialize session variable named dataindex, which is record number, to be 0
    Session.set("dataindex", 0);
  });

  // *********************** helper functions ************************** 
  
  // helper function for Meteor template named index
  Template.index.helpers({
    // this function simply returns the record number
    index: function() {return Session.get("dataindex");},
  });

  // helper functions for the Meteor template named controls
  Template.controls.helpers({
    // this function returns a Meteor Mongo cursor for all documents in Controls collection
    controls: function () {return Controls.find({});},
    // this function returns true if its arguments are equal
	equals:function(a, b) {return a === b;},
  });

  // global Meteor helper functions available to all templates
  Handlebars.registerHelper(
    // the data function takes 1 or 3 arguments;
	// when called with 1 argument it returns the value for the
	//   current record for the field named nam;
	// when called with 3 arguments, if val is equal to the value for the
	//   current record for field named nam, it returns txt;
    'data', function(nam, val, txt) {
      // get the current record number
      var index = Session.get('dataindex');
	  // get the document for the control named nam, but just the dat field
	  //   which contains the values for this field for all records
      // there is a slick way in Mongo to pick elements of an array
	  //   but it doesn't work in Meteor so need to get the whole array
	  //   and find the element using JS
      var doc = Controls.findOne(
        {'nam': nam}, // retrieve document for soft control named nam
        {'dat':1} // retrieve just the dat property
      );
	  // it should always be there, but, just to be sure
      //   (because I don't know how Mongo handles race conditions)...
      // if found, get the data array, otherwise use an empty array
      var dat = doc ? doc.dat : [];
	  // find the array element for the current record;
	  // elements are objects with properties...
	  //   index - the record number
	  //   data  - the value of the control for this record
	  // this returns an array containing elements where the index property
	  //   equals the current record number saved in the variable named index;
      // there should only be one
      dat = $.grep(dat, function(e) { 
        return e.index === index
      });
      // if found, get the data property from the (hopefully) one and only element;
      // otherwise use empty string
      dat = dat ? dat[0].data : '';
	  // if called with all 3 arguments, 
	  //   - return txt if dat equals val
	  //   - otherwise, return empty string
      if(val) return (dat === val) ? txt : '';
	  // when called with just 1 argument, return the data for the control
      return dat;
    }
);

// helper functions for the Meteor template named select
Template.select.helpers({
  // commaSplit function splits its string argument on commas and returns array
  // note that default behavior, omitting empty strings from adjacent delimiters, 
  // is what we want here
  "commaSplit": function(str) {
      return str.split(',');
    }
});

// **************************** event handler code ********************************

// this callback when date template is rendered initializes JQuery UI datepicker;
// sloppy, should only be called on current instance, not
//   redundantly on all date controls;
// but... I can't get anything else to work
Template.date.rendered = function() {
  $(".datepicker").datepicker();
};

// callbacks for all forms
Template.body.events({
 
   // This function is called when a new soft control is added
  "submit .new-control": function (event) {

    // the values of the controls in this form
    var nam = event.target.nam.value; // the name of the control to add/change
    var typ = event.target.typ.value; // the control type, e.g. input, select, date, etc.
    var lab = escapeHTML(event.target.lab.value); // the control's label
    var opt = escapeHTML(event.target.opt.value); // options for select controls

    // insert if new, otherwise update 
	// look for an existing control with this name
    var doc = Controls.findOne({'nam':nam});
    if(doc) { // if found...
      Controls.update( // update the control
        { _id: doc._id }, // Meteor only allows client updates by document id
        { $set: {         // $set keeps all document properties even if not set here
          'nam': nam,
          'typ': typ,
          'lab': lab,
          'opt': opt
          }
        }
      );
    } else { // no document exists yet for this control so add it
      Controls.insert(
        { 'nam': nam,
          'typ': typ,
          'lab': lab,
          'opt': opt,
          'dat': []     // this will hold the record values for this control
        }
      );
    }

    // Clear form
    event.target.nam.value = "";
    event.target.typ.value = "";
    event.target.lab.value = "";
    event.target.opt.value = "";

    // Prevent default form submit
    return false;
  },

  // This function is called when a data record is 
  // appended or changed
  "submit .data-record": function (event) {

    var name; // name of the soft data control
    var i;    // counter in soft data controls
    var doc;  // document that defines a soft control
    var index = Session.get("dataindex"); // index of current data record
    var value; // the value to be assigned to this control for this record
    for(i = 0 ; i < event.target.length ; i++) { // for each soft control
      name = event.target[i].name; // the name of the soft control
	  // not all elements are controls; if it is a control, it has a non-empty name
      if(name) { // if this is a control
        value = event.target[i].value; // value from this soft control
        doc = Controls.findOne({'nam':name}); // current document for this soft control
        // the dat property is an array of objects that has these properties:
		//   index: the record number for this value
		//   data:  the value for this record for this soft control
        // replace or append the element for this record;
        // there is a better way to do this in Mongo than removing the old value
		//   for this record and inserting a new one but it doesn't work in Meteor
        Controls.update( // remove the value for this record index
          {'_id': doc._id}, // Meteor updates must always be by document id
          {'$pull': {'dat': {'index':index}}} // remove the element for this record
        );
        Controls.update( // add the element with new value for this record index 
		                 //   back into the dat array (order undefined) 
          {'_id': doc._id},
          {'$addToSet':{'dat':{'index':index,'data':value}}} 
        ); 
      }
    }
    // Prevent default form submit
    return false;
  },
  
  // the callback fires when the user clicks on the back button to go to the previous record;
  // note that Meteor automatically keeps track of sets and gets for session variables
  //   and reruns anything that is dependent on a change to them
  "click .back":function() {
     var index = Session.get("dataindex"); // the current record index
     if(index != 0) { // if not at 0, the lower bound
       index--; // decrement it
       Session.set("dataindex", index); // save the new value
     }
     return false; // prevent form submit
  },
  
  // this callback fires when the user clicks on the Next button to go to next or new record
  "click .next":function() {
     var index = Session.get("dataindex"); // the current record index
     index++; // increment (no bounds checking; to do: how to know highest record index?)
     Session.set("dataindex", index); // save the new record index
     return false; // prevent form submit
  },

// this callback fires when the user clicks on a delete button "x" next to a control
  "click .delete": function () {
    Controls.remove(this._id); // delete this control
  }

}); // end of Template.body.events

} // end of client-only code

// ***************************** utility functions ************************

// function to escape characters with special meaning in HTML if they occur in input text
function escapeHTML(str) {
  var tnode = document.createTextNode(str); // create a text node with this text
  var div  = document.createElement("div"); // create a phanthom div element
  div.appendChild(tnode); // add the text node as a child of the div
  return div.innerHTML; // return the div's inner html
}
