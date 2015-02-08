// both/magratheanBoth.js
// sjhalasz@gmail.com
// see public/magrathean.md for explanation of the application

// this code is available to both client and server

// Meteor wraps all files in a function, so in order to make functions visible
//   outside this file, they need to be anonymous functions assigned to a
//   global variable

// create an instance for the Mongo collection named "table" 
// see magrathean.md for documentation
Tables = new Mongo.Collection('tables');

// create an instance for the Mongo collection named "sessions";
// this is used instead of the Meteor Session object when the server needs to update it;
// see public/magrathean.md for documentation of this
Sessions = new Mongo.Collection('sessions');

// the currentTableDocGet function retrieves the current table,
//   initializing it if it doesn't exist yet
currentTableDocGet = function(tableName){
  // find the most recent document for this table
  var table = Tables.findOne({"tableName":tableName}, {"sort":{"createdAt": -1}});
  // or, if none exists, initialize its properties
  return table || {"tableName": tableName, "views": {}, "fields": {}, "records": []};
};

// This takes the fields list and the current view from the current table
//   and returns the fields as an array ordered according to the view;
// as a side effect, it modifies view by initializing the [field] and [field].order properties
fieldsOrder = function (fields, view){
  var fieldsArray, i, name;
  // convert fields list to array, producing default ordering for this implementation
  fieldsArray = _.toArray(fields);
  // capture default ordering in view if it's not defined yet
  // note that initialization of view modifies it in the calling environment
  for(i = 0; i < fieldsArray.length; i++){
    // name of the field
    name = fieldsArray[i].name;
    // create view for this field if it doesn't exist yet
    if(! _.has(view, name)){view[name] = {};}
    // assign default ordering if order property doesn't exist yet for this field
    if(! _.has(view[name], "order")) {view[name].order = i;}
  }
  // sort fields array on view ordering.
  return fieldsArray.sort(function(a, b){return view[a.name].order - view[b.name].order;});
}
