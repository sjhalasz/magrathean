// client/magratheanClient.js
// sjhalasz@gmail.com
// see public/magrathean.md for explanation of the application

// this code runs only on the client

// subscribe to the Mongo collection named "table";
Meteor.subscribe('tables');
// set the default initial table name 
Session.setDefault("tableName", "table_01"); // this value must match initial value of tableName control in HTML
Session.setDefault("viewName", "view_01"); // likewise

// insert a document in the "sessions" collection for this session;
// recordId is index of current record in the records array of the tables document, initially -1 for new record
var sessionId =  Sessions.insert({"createdAt": new Date(), "recordId": -1});
// subscribe to the "sessions" collection;
// the server will publish only one document, the one for this sessionId
Meteor.subscribe('sessions', sessionId);

// definition mode allows defining tables and table views and fields
Session.setDefault("definitionMode", true);

// *********************** helper functions ************************** 
  

// helper functions for the "tableSelect" template
Template.tableSelect.helpers({

  // returns the current table name
  "tableName": function(){
    return Session.get("tableName");
  },  
  
  // returns the current view name
  "viewName": function(){
    return Session.get("viewName");
  }
});

// helper function for Meteor template named recordId
Template.recordId.helpers({
  // this function simply returns the record id or [new] if recordId is 0
  'recordId': function() {
    var recordId = recordIdGet();
    return (recordId < 0) ? '[new]' : recordId;
  }
});

// helper functions for the Meteor template named "fields"
Template.fields.helpers({
  
  // this function returns an array of field specifier objects
  fields: function () {
    var table, view;
    // get the current table document for the current table
    table = currentTableDocGet(Session.get("tableName"));
    // get the current view from the views for this table
    view = table.views[Session.get("viewName")] || {};
    // return the fields ordered according to the current view;
    // this returns an array;
    // fields is an object, but the Meteor template #each command needs an array;
    return fieldsOrder(table.fields, view); // fieldsOrder is in magratheanBoth.js
  },

  // the showField helper function returns true if the field named "name" is shown
  showField: function(name){
    var table, view, hide;
    // get the current table document for the current table
    table = currentTableDocGet(Session.get("tableName"));
    // get the current view for this table
    view = table.views[Session.get("viewName")] || {};
    // get the hide property from the view document for this field
    hide = (view[name] || {}).hide
    // show this field if it's not hidden or if in definition mode...
    return Session.get("definitionMode") || !hide;
  }    
    
  });

Template.recordControls.helpers({

  // this function returns the filter value specified for this field in the current view
  filter: function(name){
    var table, view;
    table = currentTableDocGet(Session.get("tableName"));
    view = table.views[Session.get("viewName")] || {};
    return (view[name] || {}).filter;
  },

  // this function compares argument "test" to the value of the sort property for the current view
  //   and if it matches, returns argument "text"
  sort: function(name, test, text){
    var table, view, sort;
    // get the current table document
    table = currentTableDocGet(Session.get("tableName"));
    // get the current view for this table
    view = table.views[Session.get("viewName")] || {};
    // get the sort property from the current view for this field
    sort = (view[name] || {}).sort;
    // return text if property matches test
    return (sort === test) ? text : '';
  },
    
  // this function returns its argument "text" if the current view does not hide (i.e. shows) this field
  show: function(name, text){
    var table, view, hide;
    // get the current table
    table = currentTableDocGet(Session.get("tableName"));
    // get the current view
    view = table.views[Session.get("viewName")] || {};
    // get the hide property for this field from the current view
    hide = (view[name] || {}).hide
    // return empty if not showing this field, otherwise return text
    return hide ? '' : text;
  }

}); // end of Template.recordControls.helpers
  
// "data" Meteor helper function available to all templates
UI.registerHelper(
  // the data function takes 1 or 3 arguments;
  // when called with 1 argument it returns the value for the
  //   current record for the field name;
  // when called with 3 arguments, if test is equal to the value for the
  //   current record for field named "name", it returns text;
  //   this extended usage is to insert "selected" in the tag for the selected option for select fields
  'data', function(name, test, text) {
    var recordId, table, records, record, value;
    // get the current record id
    recordId = recordIdGet();
    // just quit if this is a new record
    if(recordId < 0) return '';
    // get the current table
    table = currentTableDocGet(Session.get("tableName"));
    // get the records for the current table
    records = table.records;
    // get the record for the current recordId
    record = records[recordId] || {};
    value = record[name]; // value for this field
    // if called with all 3 arguments, 
    //   - return text if value equals test
    //   - otherwise, return empty string
    // can't truncate argument list in Meteor templates so it will have value 0 if not used
    if(test !== 0) return (test === value) ? text : '';
    // when called with just 1 argument, return the data for the field
    return value;
  }
);

// "disabled" helper function available to all templates
// it returns the text "disabled" if the field "fieldName" is hidden
UI.registerHelper("disabled", function(fieldName){
    var table, view, fieldView;
    // get the current table
    table = currentTableDocGet(Session.get("tableName"));
    // get the current table view
    view = table.views[Session.get("viewName")] || {}; 
    // get the view for this field
    fieldView = view[fieldName] || {};
    // return "disabled" if field is hidden; otherwise return empty
    return fieldView.hide ? 'disabled' : '';
  }
);

// "definition" helper function available to all templates
// it returns true when in definition mode
UI.registerHelper("definition", function(){
  return Session.get("definitionMode");
});

// helper functions for the Meteor template named "select"
Template.select.helpers({
  // commaSplit function splits its string argument on commas and returns array;
  // this is used to convert the comma delimited string of select options to an array
  //   that can be passed to #each
  "commaSplit": function(str) {
      return str.split(',');
    }
});

// helper functions for the template named "lastModified"
Template.lastModified.helpers({
  
  // this function returns the user name who last modified the table or "[unknown]" if none
  "lastModifiedUserName": function(){
    return currentTableDocGet(Session.get("tableName")).userName || "[unknown]";
  },

  // this function returns the timestamp of the last table modification or "[empty data]" if no table yet
  "lastModifiedDate": function (){
    return currentTableDocGet(Session.get("tableName")).createdAt || "[empty data]";
  }
  
});

// **************************** event handler code ********************************

// this callback when date template is rendered initializes JQuery UI datepicker;
// it's sloppy; this should only be called on current instance, not redundantly on all date fields;
// but... I can't get anything else to work
Template.date.rendered = function() {
  $(".datepicker").datepicker();
};

// callbacks for all controls
Template.body.events({
   
  // set definition mode to false when the preview mode button is clicked
  "click .preview": function(event){
    Session.set("definitionMode", false);
  },

  // set definition mode to true when the definition mode button is clicked
  "click .definition": function(event){
    Session.set("definitionMode", true);
  },
  
  // the tableSelect callback selects which table to use
  "submit .tableSelect": function(event){
     // suppress default click handling
     event.preventDefault();
    // setting a new table name causes everything to re-fire with the new table
    Session.set("tableName", event.target.tableName.value);
    // best to set the recordId to "new record" when switching tables
    recordIdSet(-1);
  },
  
  // the viewSelect callback selects which view to use
  "submit .viewSelect": function(event){
     // suppress default click handling
     event.preventDefault();
    Session.set("viewName", event.target.viewName.value);
    // best to set the recordId to "new record" when switching views
    recordIdSet(-1);
  },
  
   // This fieldUpdate callback is called when a field is added or changed
  "submit .fieldUpdate": function (event) {
    var tableName, name, type, label, options, oldField, newField;
    // suppress default submit handling
    event.preventDefault();
    //  call the Meteor method "fieldUpdate" with the values for the field
    name    = event.target.name.value;
    type    = event.target.type.value;
    label   = event.target.label.value;
    options = event.target.options.value;
    // get the name of the current table
    tableName = Session.get("tableName");
    // original values for this field to test if they have changed
    oldField = currentTableDocGet(tableName).fields[name] || {};
    // new values that we will send to the server if they have changed
    newField = {};
    newField.name = name;
    if(type !== oldField.type) {newField.type = type;}
    if(label !== oldField.label) {newField.label = label;}
    if(options !== oldField.options) {newField.options = options;}
    Meteor.call("fieldUpdate", tableName, newField);
    // Clear form
    event.target.name.value    = "";
    event.target.type.value    = "";
    event.target.label.value   = "";
    event.target.options.value = "";
  }, // end of submit fieldUpdate function

  // The callback recordUpdate is called when a data record is 
  //   added or changed
  "submit .recordUpdate": function (event) {
    var tableName, recordId, oldRecord, newRecord, i, name, value;
    // suprress the default submit handling
    event.preventDefault();
    // get recordId of current record
    recordId = recordIdGet();
    // get the current table name
    tableName = Session.get("tableName");
    // this holds the original record values for the current record before user changes
    oldRecord = currentTableDocGet(tableName).records[recordId] || {};
    // this will be the record sent for update, which will include only the user's changes
    newRecord = {};
    for(i = 0 ; i < event.target.length ; i++) { // for each field
      name = event.target[i].name;     // the name of the field
      // not all elements are fields; if it is a field, it has a non-empty name
      if(name) {                       // if this is a field
        value = event.target[i].value; // value from this field
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
      tableName,     // the name of the table to update
      recordId,      // will be -1 for new records
      newRecord      // object with values from fields
    ); // end of Meteor.call
  }, // end of submit recordUpdate function
  
  // the recordBack callback fires when the user clicks on the back button 
  //   to go to the previous record;
  "click .recordBack":function(event) {
     // suppress default click handling
     event.preventDefault();
     // move the current recordId back in the current record selection
     recordIdNext(-1);
  },
  
  // the recordNext callback fires when the user clicks on the Next button to go to next record
  "click .recordNext":function(event) {
     // suppress default click handling
     event.preventDefault();
     // move the current recordId forward in the current record selection
     recordIdNext(1);
  },
  
  // the recordNew callback fires when the user clicks on the New button to enter a new record
  "click .recordNew":function(event) {
     // suppress default click handling
     event.preventDefault();
     recordIdSet(-1); // -1 record id means go to a new record
  },

// the fieldDelete callback fires when the user clicks on a delete button "x" for a field
  "click .fieldDelete": function (event) {
    // suppress default click handling
    event.preventDefault();
    // call the Meteor method "fieldDelete" with the name of the field
    Meteor.call("fieldDelete", Session.get("tableName"), this.name);
  },

// the fieldEdit callback fires when the user clicks on the edit button for a field
  "click .fieldEdit": function (event) {
    // suppress default click handling
    event.preventDefault();
    // copy this field's parameters into the form for creating/editing fields
    var field = currentTableDocGet(Session.get("tableName")).fields[this.name] || {};
    document.getElementById("name").value    = field.name;
    document.getElementById("type").value    = field.type;
    document.getElementById("label").value   = field.label;
    document.getElementById("options").value = field.options;
},
  
  // this callback fires when the user clicks on the checkbox to show or hide a field
  "click .fieldShow": function(event) {
    Meteor.call(
      "viewUpdate",
      Session.get("tableName"),
      Session.get("viewName"),
      this.name,
      "hide",
      !event.target.checked
    );
  },
  
  // this callback fires when the user clicks on the up arrow to move a field up
  "click .fieldUp": function(event) {
    // suppress default click handling
    event.preventDefault();
    Meteor.call(
      "viewOrderUpdate",
      Session.get("tableName"),
      Session.get("viewName"),
      this.name,
      "up"
    );
  },
  
  // this callback fires when the user clicks on the down arrow to move a field down
  "click .fieldDown": function(event) {
    // suppress default click handling
    event.preventDefault();
    Meteor.call(
      "viewOrderUpdate",
      Session.get("tableName"),
      Session.get("viewName"),
      this.name,
      "down"
    );
  },

  // this callback fires when the user selects to sort records by a field
  "change .fieldSort": function(event) {
    Meteor.call(
      "viewUpdate",
      Session.get("tableName"),
      Session.get("viewName"),
      this.name,
      "sort",
      event.target.value // will be "asc" or "desc"
    );
    recordIdSet(-1); // best to go to new record when sorting is changed
  },
  
  // this callback fires when the user enters a filter value for a field
  "change .fieldFilter": function(event) {
    Meteor.call(
      "viewUpdate",
      Session.get("tableName"),
      Session.get("viewName"),
      this.name,
      "filter",
      event.target.value
    );
    recordIdSet(-1); // best to go to new record when changing the filtering
  }
  
}); // end of Template.body.events

// this is needed for the account creating/sign on package
Accounts.ui.config({
  passwordSignupFields: "USERNAME_ONLY"
});

// utility functions

// the recordIdGet function retrieves the current recordId from the "sessions" collection
//   or returns -1 if there is none (there should always be one, though)
function recordIdGet(){
  // get the one and only "sessions" document for this session
  var session = Sessions.findOne();
  // return recordId from it or -1 if not found
  return session ? session.recordId : -1;
}

// the recordIdSet function sets a new current recordId for this session
// after Back, Next, or New buttons are clicked, and in some cases
// when it's best to reset to new record
function recordIdSet(recordId){
  // call the Meteor method "recordIdSet" with this sessionId and new recordId
  Sessions.update({"_id": sessionId},{"$set": {"recordId": recordId}}); 
}

// get the next recordId forward (direction = 1) or back (direction = -1)
function recordIdNext(direction){
  var oldRecordId, records, oldIndex, newIndex, newRecordId;
  // get the current recordId
  oldRecordId = recordIdGet();
  // get the records for current table with current view filter/sort applied
  // this also adds property _recordId to each record
  //   which is the index in the original, unfiltered, unsorted records array from the table document
  records = recordsFilterSort();
  // find position in the sorted/filtered records of the current recordId
  oldIndex = _.pluck(records, "_recordId").indexOf(oldRecordId);
  // calculate the new position in the sorted/filtered records by adding the move direction
  newIndex = oldIndex + direction;
  // if the new position is in range, set recordId to the _recordId property for the
  //   record in the new position
  if(newIndex >= 0 && newIndex < records.length){
    recordIdSet(records[newIndex]._recordId);
  }
} // end of recordIdNext function  

// return records for current table applying filter/sort from current view;
// adds property _recordId to each record
function recordsFilterSort(){
  var table, records, view, field, fieldView, sort, filter, i;
  // get the current table
  table = currentTableDocGet(Session.get("tableName"));
  // get the records for the current table
  records = table.records;
  // get the current view for the current table
  view = table.views[Session.get("viewName")];
  // for each field in the view, see if any have sort and/or filter property;
  // there will only be one field for each
  for(field in view) {
    fieldView = view[field] || {};
    if(fieldView.sort) sort = {"field": field, "direction": fieldView.sort == "asc" ? 1 : -1};
    if(fieldView.filter) filter = {"field": field, "value": fieldView.filter};
  }
  // assign property _recordId to be the index in the original, unfiltered records array
  // note that this initialization carries into the calling environment
  for(i = 0; i < records.length; i++){records[i]._recordId = i;}
  // if there is a filter, apply it to the records
  if(filter){
    records = _.filter(records, function(record){
      // return true if this record has filter value for filter field
      return record[filter.field] === filter.value;
    });
  }
  // if there is a sort, apply it to the records
  if(sort){
    records.sort(function(a,b){
      // compare sort field for each record;
      // sort.direction is 1 for ascending and -1 for descending
      if(a[sort.field] > b[sort.field]){ return sort.direction;}
      if(a[sort.field] < b[sort.field]){ return -sort.direction;}
      return 0;
    });
  }
  return records;
}
