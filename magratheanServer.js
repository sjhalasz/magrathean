// server/magratheanServer.js
// sjhalasz@gmail.com
// see magrathean.md for explanation of the application

// this code runs only on the server

Meteor.publish('tables', function() {
  return Tables.find();
});

// allow clients to insert and update documents to "sessions";
// the id they get back from the insert will be their key to reading and updating session stuff;
// this relies on the assumption that users can't guess other users' session ids
Sessions.allow({
  "insert": function(){return true;}, 
  "update": function(){return true;}
});
// publish only the document with the session id that the session got from insert
Meteor.publish('sessions', function(sessionId){
  return Sessions.find({"_id": sessionId});
});

// create an instance for Mongo collection named "lock"
// see public/magrathean.md for structure and usage of this collection
var Lock = new Mongo.Collection("lock");

// Meteor methods are callable from the client ...
Meteor.methods({

  // fieldUpdate method is run when a field is created or changed
  // arguments:
  //   tableName - the name of the table to update
  //   newField - object with one or more properties...
  //     name - name of the field
  //     the following properties may be present if new or changed...
  //     type - type of the field
  //     label - label for the field
  //     options - comma separated options if it's a select field
  "fieldUpdate": function (tableName, newField) {
    // only one session at a time will be running any of the processes 
    //   invoked via the lock function for a given table
    lock(tableName, function() {
      var table, oldField, key;
      // get the current table data
      table = currentTableDocGet(tableName);
      // make a copy of the existing definition for this field
      oldField = table.fields[newField.name] || {};
      oldField.name = newField.name; // set name in case this is a new field
      // for each property, set it if it was sent by the client
      for(key in newField){oldField[key] = newField[key];}
      // assign the updated object for this field (in case it didn't exist before)
      table.fields[oldField.name] = oldField;
      // insert the new current document
      currentTableDocInsert(table);
    });
  }, // end of fieldUpdate function

  // fieldDelete function
  // called to delete a field
  "fieldDelete": function(tableName, fieldName){
    // only one session at a time will be running any of the processes 
    //   invoked via the lock function for a given table
    lock(tableName, function(){
      // get the current document
      var table = currentTableDocGet(tableName);
      // remove the object with this name from the fields property
      delete table.fields[fieldName];
      // insert a new current document
      currentTableDocInsert(table);
    });
  }, // end of fieldDelete function
  
  // recordUpdate function
  // this function is called from the client when a record is added or changed
  // arguments are:
  //   sessionId - unique session identifier for passing back a new record's recordId
  //   tableName - the name of the table to update
  //   recordId  - record index to change or -1 to add new record
  //   newRecord - object with field names as keys and record values
  "recordUpdate": function(sessionId, tableName, recordId, newRecord) {
    // only one session at a time will be running any of the processes 
    //   invoked via the lock function for a given table
    lock(tableName, function(){
      var isNewRecord, table, oldRecord, key;
      // if recordId is -1, this is a new record so assign the next available recordId
      isNewRecord = recordId < 0;
      // get the current table document
      table = currentTableDocGet(tableName);
      // if this is a new record, need to get the next available index in records array
      if(isNewRecord) recordId = table.records.length;
      // get the existing record for this recordId, initializing if it doesn't exist yet
      oldRecord = table.records[recordId] || {};
      // for each name/value pair in newValues, 
      //   assign the new value for the field to the existing record;
      //   note that fields in oldValues not included in newValues will remain untouched
      for(key in newRecord){oldRecord[key] = newRecord[key];}
      // insert the record back into the records array (in case it was newly initialized)
      table.records[recordId] = oldRecord;
      // insert the modified table as a new current table document
      currentTableDocInsert(table);
      // if this is a new record, the recordId needs to be sent back to the client
      if(isNewRecord){
        Sessions.update({"_id": sessionId}, {"$set": {"recordId": recordId}});
      }
    });
  }, // end of recordUpdate method
  
  // the viewUpdate method is called when most changes are made to a view
  //   (except order, handled by viewOrderUpdate below)
  "viewUpdate": function(tableName, viewName, fieldName, propertyName, newValue){
    // only one session at a time will be running any of the processes 
    //   invoked via the lock function for a given table
    lock(tableName, function(){
      var table, view, fieldView, field;
      // get the current table document
      table = currentTableDocGet(tableName);
      // get the session's view
      view = table.views[viewName] || {};
      // get the view for this field
      fieldView = view[fieldName] || {};
      // set the new value of the property
      fieldView[propertyName] = newValue;
      // replace the field's view back into the session's view (in case it's newly created)
      view[fieldName] = fieldView;
      // only allow one field to be used for sort or filter
      if(propertyName == "sort" || propertyName == "filter"){
        for(field in view){ // for each field in the session's view
          if(field != fieldName){ // for all fields other than the one being updated
            fieldView = view[field]; // the view for this field
            if(fieldView) {delete fieldView[propertyName];} // remove this property
          }
        }
      }
      // put this view into the views list (in case it was newly created)
      table.views[viewName] = view;
      // insert a new current document for the table
      currentTableDocInsert(table);
    });
  }, // end of viewUpdate method

  // the viewOrderUpdate method is called when a field is moved up or down in a view
  "viewOrderUpdate": function(tableName, viewName, fieldName, direction){
    // only one session at a time will be running any of the processes 
    //   invoked via the lock function for a given table
    lock(tableName, function(){
      var table, view, fields, i, name, fieldsArray, oldIndex, newIndex;
      // retrieve the curent table document
      table = currentTableDocGet(tableName);
      // get the view for this viewName or initialize if none saved yet
      view = table.views[viewName] || {};
      // get the fields list from the current table
      fields = table.fields;
      // handle degenerate case of less than 2 fields
      if(_.keys(fields).length < 2) {return fields;} 
      // get the field definitions for this table ordered according to the view;
      // as a side effect, this initializes the [field] and [field].order properties in view
      fieldsArray = fieldsOrder(fields, view); // this function is in magratheanBoth.js
      // normalize the order property in the view to sequential numbering
      for(i = 0; i < fieldsArray.length; i++){view[fieldsArray[i].name].order = i;}
      // order property is now the same as the index in fieldsArray, which is sorted
      // get the index of the field that is moving
      oldIndex = view[fieldName].order;  
      // get the new index depending on direction of move
      newIndex = oldIndex + ((direction == "up") ? -1 : 1);
      // just quit if going up and already at first or going down and already at last
      if(newIndex < 0 || newIndex >= fieldsArray.length) {return;}
      // assign this field's order to the field to swap 
      view[fieldsArray[newIndex].name].order = oldIndex;
      // assign other field's order to this field
      view[fieldName].order = newIndex; 
      // assign the current view in the collection of views for the table (it might not have existed originally)
      table.views[viewName] = view;
      // insert a new version of the table
      currentTableDocInsert(table);    
    }); // end of lock function
  } // end of viewOrderUpdate method             }
}); // end of Meteor.methods

// ***************************** utility functions ************************

// currentTableDocInsert function inserts a new version of the current table document
function currentTableDocInsert(table){
    // assign the createdAt property to be the timestamp for creation of this version
    table.createdAt = new Date();
    // make sure the _id property doesn't exist or the insert will fail
    delete table._id;
    // record the user id and name
    table.userId = Meteor.userId();
    table.userName = (Meteor.user() || {}).username;
    // perform the insert into the "table" collection
    Tables.insert(table);
}

// lock function 
// ensures that only one session at a time runs any process invoked via this function
//   on a particular table;
// argument tableName is the name of the table to lock;
// argument fn is a function that runs the process
function lock(tableName, fn){
  var lockId, stale;
  // insert table name and created-at date into "lock" collection, 
  //   returning _id of document
  lockId = Lock.insert({"tableName": tableName, "createdAt":new Date()});
  // create a timestamp that is 10 seconds in the past to find and remove any stale locks
  stale = new Date();
  stale.setSeconds(stale.getSeconds() - 10);
  // remove documents more than 10 seconds old, which are assumed to be orphaned locks
  //   created by crashed processes
  Lock.remove({"createdAt": {"$lt": stale}});
  // if, after inserting my document, I find more than one for this table, I will back mine out and try again
  if(1 < Lock.find({"tableName": tableName}).count()){
    // remove my lock document
    Lock.remove({"_id": lockId});
    // randomly wait 0, 100, or 200 milliseconds and try again
    setTimeout(function(){lock(tableName, fn);}, 100 * Math.floor(Math.random() * 3));
  }
  // I have the lock so run my process now
  fn(); 
  // remove my lock
  Lock.remove({"_id": lockId});
}

