// server/magratheanServer.js
// sjhalasz@gmail.com
// see magrathean.md for explanation of the application

// this code runs only on the server

// create an instance for Mongo collection named "table_01";
// see magrathean.md for structure and usage of this collection
var Table = new Mongo.Collection("table_01");
// options specifier for retrieving the current (most recent) document
//   from the table collection;
// with sorting by descending timestamp, most recent first,
//   get just one document
var currentTableMongoOptions = {"sort": {"createdAt":-1}, "limit": 1};
// publish the "table" collection to the client, but only the most recent document
//   which contains both control definitions and records
Meteor.publish('table', function() {
  return Table.find({}, currentTableMongoOptions);
});

// create an instance for Mongo collection named "sessions";
// see magrathean.md for structure and usage of this collection;
// (I'm assuming that the Meteor server runs stateless so I can't just assign sessionId here 
//   as a global, is that true?)
var Sessions = new Mongo.Collection("sessions");
// allow clients to insert new documents;
// the id they get back from the insert will be their key to reading and updating session stuff
Sessions.allow({"insert": function(){return true;}});
Meteor.publish('sessions', function(sessionId){
  return Sessions.find({"_id": sessionId});
});

// create an instance for Mongo collection named "lock"
// see magrathean.md for structure and usage of this collection
var Lock = new Mongo.Collection("lock");

// Meteor methods are callable from the client ...
Meteor.methods({

  // recordIdSet method sets the recordId for a session identified by sessionId
  "recordIdSet": function(sessionId, recordId){
    Sessions.update({"_id": sessionId},{"$set": {"recordId": recordId}}); 
  },
  
  // controlUpdate method is run when a soft control is created or changed
  // arguments:
  //   newControl - object with properties...
  //     name - name of the control
  //     the following properties may be present if new or changed...
  //     type - type of the control
  //     label - label for the control
  //     options - comma separated options if it's a select control
  "controlUpdate": function (newControl) {
    // only one session at a time will be running any of the processes 
    //   invoked via the lock function
    lock(function() {
      var table, oldControl, key;
      // get the current table data
      table = currentTableDocGet();
      // make a copy of the existing definition for this control
      oldControl = table.controls[newControl.name] || {};
      oldControl.name = newControl.name; // set name in case this is a new control
      // for each property, set it if it was intended to be changed by the client
      for(key in newControl){oldControl[key] = newControl[key];}
      // assign the updated object for this control
      table.controls[oldControl.name] = oldControl;
      // insert the new current document
      currentTableDocInsert(table);
    });
}, // end of controlsUpdate function

  // controlDelete function
  // called to delete a soft control
  "controlDelete": function(name){
    // only one session at a time will be running any of the processes 
    //   invoked via the lock function
    lock(function(){
      // get the current document
      var table = currentTableDocGet();
      // remove the object with this name from the controls object
      delete table.controls[name];
      // insert a new current document
      currentTableDocInsert(table);
    });
  }, // end of controlDelete function
  
  // recordUpdate function
  // this function is called from the client when a record is added or changed
  // arguments are:
  //   sessionId - unique session identifier for passing back a new record's recordId
  //   recordId  - record index to change or -1 to add new record
  //   newRecord   - object with control names as keys and record values
  "recordUpdate": function(sessionId, recordId, newRecord) {
    // only one session at a time will be running any of the processes 
    //   invoked via the lock function
    lock(function(){
      var isNewRecord, table, oldRecord, key;
      // if recordId is -1, this is a new record so assign the next available recordId
      isNewRecord = recordId < 0;
      // get the current table document
      table = currentTableDocGet();
      // if this is a new record, need to get the next available index in records array
      if(isNewRecord) recordId = table.records.length;
      // get the record for this recordId
      oldRecord = table.records[recordId] || {};
      // for each name/value pair in newValues, 
      //   assign the new value for the field to the existing record;
      //   note that fields in oldValues not included in newValues will remain untouched
      for(key in newRecord){oldRecord[key] = newRecord[key];}
      // insert the record back into the records array
      table.records[recordId] = oldRecord;
      // insert the modified table as a new current table document
      currentTableDocInsert(table);
      // if this is a new record, the recordId needs to be sent back to the client
      if(isNewRecord){
        Sessions.update({"_id": sessionId}, {"$set": {"recordId": recordId}});
      }
    });
  } // end of dataUpdate function
  
}); // end of Meteor.methods

// ***************************** utility functions ************************

// currentTableDocGet function retrievew the current (most recent) table document
//   and initializes it if it doesn't exist
function currentTableDocGet(){
  return Table.findOne({}, currentTableMongoOptions) || {"controls": {}, "records": []};
}

// currentTableDocInsert function inserts a new version of the current table document
function currentTableDocInsert(table){
    // assign the createdAt property to be the timestamp for creation of this version
    table.createdAt = new Date();
    // make sure the _id property doesn't exist or the insert will fail
    delete table._id;
    // perform the insert into the "table" collection
    Table.insert(table);
}

// lock function 
// ensures that only one session at a time runs any process invoked via this function
// argument fn is a function that runs the process
function lock(fn){
  var lockId, stale;
  // insert my unique session and created at date into "lock" collection, 
  //   returning _id of document
  lockId = Lock.insert({"createdAt":new Date()});
  // create a timestamp that is 10 seconds in the past to find and remove any stale locks
  stale = new Date();
  stale.setSeconds(stale.getSeconds() - 10);
  // remove documents more than 10 seconds old, which are assumed to be orphaned locks
  //   created by crashed processes
  Lock.remove({"createdAt": {"$lt": stale}});
  // if, after inserting my document, I find more than one, I will back mine out and try again
  if(1 < Lock.find().count()){
    // remove my lock document
    Lock.remove({"_id": lockId});
    // randomly wait 0, 100, or 200 milliseconds and try again
    setTimeout(function(){lock(fn);}, 100 * Math.floor(Math.random() * 3));
  }
  // I have the lock so run my process now
  fn(); 
  // remove my lock
  Lock.remove({"_id": lockId});
}

