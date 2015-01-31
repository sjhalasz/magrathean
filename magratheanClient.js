// client/magratheanClient.js
// sjhalasz@gmail.com
// see magrathean.md for explanation of the application

// this code runs only on the client

// create an instance for the Mongo collection named "table" 
// see magrathean.md for documentation
var Table = new Mongo.Collection('table_01');
// subscribe to the Mongo collection named "table";
// the server will publish only one document, the current one
Meteor.subscribe('table');

// create an instance for the Mongo collection named "sessions";
// this is used instead of the Meteor Session object so the server can update it;
// see magrathean.md for documentation
var Sessions = new Mongo.Collection('sessions');
// insert a document in the "sessions" collection for this session;
// recordId is index of current record in the records array, initially -1 for new record
var sessionId =  Sessions.insert({"createdAt": new Date(), "recordId": -1});
// subscribe to the "sessions" collection;
// the server will publish only one document, the one for this sessionId
Meteor.subscribe('sessions', sessionId);

  // *********************** helper functions ************************** 
  
  // helper function for Meteor template named recordId
  Template.recordId.helpers({
    // this function simply returns the record id or [new] if recordId is 0
    'recordId': function() {
      var recordId = recordIdGet();
      return (recordId < 0) ? '[new]' : recordId;
    }
  });

  // helper functions for the Meteor template named "controls"
  Template.controls.helpers({
    
    // this function returns an array of control specifier objects
    controls: function () {
      // controls is an object, but the Meteor template #each command needs an array;
      // eventually this will be sorted, but the sorting and selection of fields to show
      //   or hide will be via configurations that can be applied to create different 
      //   "views" of the schema represented by the "table" collection
      return _.toArray(currentTableDocGet().controls);
    },

    // this function returns true if its arguments are equal
    // it's used in the controls template with #if to use the correct template for the control
    equals:function(a, b) {return a === b;},
  });

  // global Meteor helper functions available to all templates
  UI.registerHelper(
    // the data function takes 1 or 3 arguments;
    // when called with 1 argument it returns the value for the
    //   current record for the field name;
    // when called with 3 arguments, if test is equal to the value for the
    //   current record for field named name, it returns text;
    //   this is used to insert "selected" in the tag for the selected option for select controls
    'data', function(name, test, text) {
      var recordId, record, value;
      // get the current record id
      recordId = recordIdGet();
      // get the record for the current recordId
      record = currentTableDocGet().records[recordId] || {};
      value = record[name]; // value for this control
      // if called with all 3 arguments, 
      //   - return text if value equals test
      //   - otherwise, return empty string
      // can't truncate argument list in Meteor templates so it will have value 0 if not used
      if(test !== 0) return (test === value) ? text : '';
      // when called with just 1 argument, return the data for the control
      return value;
    }
);

// helper functions for the Meteor template named select
Template.select.helpers({
  // commaSplit function splits its string argument on commas and returns array;
  // note that default behavior, omitting empty strings from adjacent delimiters, 
  //   is what we want here;
  // this is used to convert the comma delimited string of select options to an array
  //  that can be passed to #each
  "commaSplit": function(str) {
      return str.split(',');
    }
});

// **************************** event handler code ********************************

// this callback when date template is rendered initializes JQuery UI datepicker;
// sloppy, this should only be called on current instance, not
//   redundantly on all date controls;
// but... I can't get anything else to work
Template.date.rendered = function() {
  $(".datepicker").datepicker();
};

// callbacks for all forms
Template.body.events({
 
   // This controlUpdate callback is called when a soft control is added or changed
  "submit .controlUpdate": function (event) {
    var name, type, label, options, oldControl, newControl;
    // suppress default submit handling
    event.preventDefault();
    //  call the Meteor method "controlUpdate" with the values for the control
    name    = event.target.name.value;
    type    = event.target.type.value;
    label   = event.target.label.value;
    options = event.target.options.value;
    // original values for this control to test if they have changed
    oldControl = currentTableDocGet().controls[name] || {};
    // new values that we will send to the server if they have changed
    newControl = {};
    newControl.name = name;
    if(type !== oldControl.type) {newControl.type = type;}
    if(label !== oldControl.label) {newControl.label = label;}
    if(options !== oldControl.options) {newControl.options = options;}
    Meteor.call("controlUpdate", newControl);
    // Clear form
    event.target.name.value    = "";
    event.target.type.value    = "";
    event.target.label.value   = "";
    event.target.options.value = "";
  }, // end of submit controlUpdate function

  // The callback recordUpdate is called when a data record is 
  //   added or changed
  "submit .recordUpdate": function (event) {
    var recordId, oldRecord, newRecord, i, name, value;
    // suprress the default submit handling
    event.preventDefault();
    // get recordId of current record
    recordId = recordIdGet();
    // this holds the original record values for the current record before user changes
    oldRecord = currentTableDocGet().records[recordId] || {};
    // this will be the record sent for update, which will include only the user's changes
    newRecord = {};
    for(i = 0 ; i < event.target.length ; i++) { // for each soft control
      name = event.target[i].name;   // the name of the soft control
      // not all elements are controls; if it is a control, it has a non-empty name
      if(name) {                     // if this is a control
        value = event.target[i].value; // value from this soft control
        // only include fields changed by the user
        if(value !== oldRecord[name]){
          newRecord[name] = value;
        }
      }
    }
    // call the Meteor method recordUpdate with the record object
    Meteor.call(
      "recordUpdate", 
      sessionId,     // for new records, needed by the server to pass recordId back to client
      recordId,      // will be -1 for new records
      newRecord      // object with values from soft controls
    ); // end of Meteor.call
  }, // end of submit recordUpdate function
  
  // the recordBack callback fires when the user clicks on the back button 
  //   to go to the previous record;
  "click .recordBack":function(event) {
     // suppress default click handling
     event.preventDefault();
     // get the current recordId
     var recordId = recordIdGet();
     // if recordId is greater than 0, the lower limit, decrement it
     if(recordId > 0) {
       recordIdSet(recordId - 1);
     }
  },
  
  // the recordNext callback fires when the user clicks on the Next button to go to next record
  "click .recordNext":function(event) {
     // suppress default click handling
     event.preventDefault();
     // get the current recordId
     var recordId = recordIdGet();
     // if the current recordId is less than the highest available recordId, increment it
     if(recordId < currentTableDocGet().records.length - 1){
       recordIdSet(recordId + 1);
     }
  },
  
  // the recordNew callback fires when the user clicks on the New button to enter a new record
  "click .recordNew":function(event) {
     // suppress default click handling
     event.preventDefault();
     recordIdSet(-1); // -1 record id means this will be a new record
  },

// the controlDelete callback fires when the user clicks on a delete button "x" for a control
  "click .controlDelete": function (event) {
    // suppress default click handling
    event.preventDefault();
    // call the Meteor method "controlDelete" with the name of the control
    Meteor.call("controlDelete", this.name);
  }

}); // end of Template.body.events

// utility functions

// the currentTableGet function retrieves the current table,
//   initializing it if it doesn't exist
function currentTableDocGet(){
  return Table.findOne() || {"controls":{}, "records": []};
}

// the recordIdGet function retrieves the current recordId from the "sessions" collection
//   or returns -1 if there is none (there should always be one, though)
function recordIdGet(){
  // get the one and only "sessions" document for this session
  var session = Sessions.findOne();
  // return recordId from it or -1 if not found
  return session ? session.recordId : -1;
}

// the recordIdSet function sets a new current recordId for this session
// after Back, Next, or New buttons are clicked
function recordIdSet(recordId){
  // call the Meteor method "recordIdSet" with this sessionId and new recordId
  Meteor.call("recordIdSet", sessionId, recordId);
}
