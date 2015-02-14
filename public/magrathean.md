# Magrathean Table Maker: An Exercise for Learning Meteor 
sjhalasz@gmail.com

See meteor.com for explanation of Meteor. The code is saved at [this github repository](https://github.com/sjhalasz/magrathean). The code is live at [this Meteor site](http://sjhalasz03.meteor.com).

As an exercise for learning Meteor, I'm implementing a record-keeping application that I previously started to write using the lamp stack for my wife's planned but never launched medical clinic. She wanted a way to design and use data collections herself without programmers because she was afraid I might die some day or at least become senile.

The application lets you interactively create tables and add, change, or delete fields in those tables. Field "type" is determined by the type of control used with the field, i.e. text input, select, datepicker, checkbox, etc.

You can create a user name and log in, but it's not necessary. Currently the only thing that logging in does is record and report the user who made the last update to a table.

You can select any table name and it will be created if it doesn't exist.

This version currently supports 4 field types:

  - text   - simply inserts text in the form (not really a field).
  - input  - input of text values.
  - select - drop-down options selector.
  - date   - text input field that implements the JQuery UI datepicker.
  
To add a field, you enter a name in the field definition form, which will become the name of the field. You choose the type and then enter a label. If the type is "select", you also enter the options separated by comma. Then, clicking on the Add/Change Field button adds the field to the table. To change a field, you use the same name with different parameters. 

The fields then appear in the Add/Change/Navigate Records Form farther down the page where you can enter data for a record. Each field has a delete button and an edit button next to it. The edit button copies the current field definition into the Add/Change Fields form.

You enter data into the fields for a record and click the Add/Change Record button to save it. You use the Back and Next buttons to navigate through the records and the New button to enter a new record. The current record number (or [new] if it's a new record) is displayed after the Next button. The application maintains ordinal record numbers, which is a little tricky to do using Meteor. It requires processing updates on the server and using a locking mechanism to make sure that they are processed one at a time. The application also provides data versioning, and that too requires the use of the locking mechanism.

There is currently no delete record function. I will implement delete record as a checkbox control in the record that allows "deleted" records to be displayed or not as part of a generalized filter/sort "view" mechanism to be added later, which will enable viewing of deleted records as well as undelete.

Each table may have one or more views associated with it. The view determines:

  - which fields are displayed and in what order
  - order and filtering of records

The design contemplates that a table and one of its views will be specified for a page presented to the user. 

At the top of the page is a button for toggling between "definition" mode and "preview" mode. Definition mode is for defining tables and views, while preview mode shows what the form would look like to an end user.

## Stucture and usage of the Mongo "tables" collection...

Here is a typical example of a document in the "tables" collection:

<pre><code>
{  
    "tableName": "table_01",  
    "views": {  
        "view_01": {  
            "firstname": {  
                "sort": "asc",
                "order": 1
                },
            "city": {
                "filter": "Rome",
                "order": 0,
                "hide": true
                }
            }
        },
    "fields": {
        "firstname": {
            "name": "firstname",
            "type": "input",
            "label": "First Name:",
            "options": ""
            },
        "city": {
            "name": "city ",
            "type": "select ",
            "label": "City: ", 
            "options": ",Omsk,Sarasota,Cleveland,Rome" 
            } 
        }, 
    "records" : [
                    { 
                    "firstname": "Steve ",
                    "city": "Sarasota"
                    },
                    {
                    "firstname": "Elena",
                    "city" : "Omsk"
                    },
                    {
                    "firstname": "Le",
                    "city": "Sarasota"
                    },
                    {
                    "firstname": "Leslie",
                    "city": "Cleveland"
                    },
                    {
                    "firstname": "Anastasia",
                    "city": "Rome" 
                    },
                    {
                    "firstname": "Fabio",
                    "city": "Rome"
                    },
                    {
                    "firstname": "Fabian",
                    "city": "Rome"
                    }
                ],
    "createdAt": ISODate("2015-02-04T16:18:50.425Z"),
    "userId": "yJEC2bbKybKdy9b9J",
    "userName": "sjhalasz",
    "_id": "TAvKW33FXp8Xym2uz" 
}
</code></pre>

A document in the "table" collection holds all the data for both fields and records for one table. When changes are made to field definitions or records, a revised document is inserted with a current timestamp. Only the most recent document for each table is used. This provides version history and allows easy and reliable backing off and diffing of changes.

The documents in this collection have the following structure:  

- tableName: the name of this document's table  
- views: an array of views for this table 
 - each element is a view with view name as key, and contains a collection of view parameters, one for each field
 - the properties for each field may be:
   -- sort:  either "asc" or "desc" indicating records are sorted by this field
   -- order: an integer indicating the order to display the fields in the form
   -- filter: a string for filtering records based on this field
   -- hide: if true, the field is not displayed
- createdAt: the timestamp of the version creation 
- fields:    an object which contains an unordered set of objects,
    one for each field;
 - the key for each field object is the name of the field;
 - each object also contains the name as a property, which is
    redundant but makes coding cleaner and simpler;
 - the properties of each field object are:
  -- name:    the name of the field
  -- type:    the type of the field, e.g. input, select, date
 -- label:   the label text for the field
 -- options: the options if this is a select field, as a comma separated string
- records:  an ordered array of objects, one for each record;
   - the properties of the record object are the field names, which are the same as the name of the control they were entered from;
   - all values are stored as character
   - records are never removed from the array, and the index of the record in the array is the permanent ordinal record identifier

The collection is retrieved by the client with descending sort by createdAt 
timestamp. The client does a findOne for the table currently in use by the client,
which retrieves the current version of that table.

## Structure and usage of the Mongo "sessions" collection...

Meteor's Session object isn't available in the server, but I want the server to be able to write to the session state in order to pass back to the client the ordinal record number of a newly saved record. So I'm using a Mongo collection to do the same thing when I need for the server to be able to update the session state.

At startup, the session inserts a new document in the "sessions" collection and remembers the document id as variable sessionId. 

The "sessions" document contains a createdAt date and a recordId property, which is initially -1 meaning "new record" (or if you prefer "no record"). The recordId property is the array index in the records array of the tables document of the record which is currently displayed. 

The sessionId value is used to reference and update the recordId property in the "sessions" collection. Only the client's own sessionId document is published to the client, so the client always has access to read only one document. 

## Structure and usage of the Mongo "lock" collection...

Data versioning is implemented as follows:

  - the most recent existing document is read on the server, 
  - the variable is modified, 
  - the variable is inserted as a new document. 
  
This creates a concurrency problem as follows:

  - session A reads the most recent document and modifies it in memory
  - session B reads the most recent document and makes a different change to it in memory
  - session A inserts a new document with A's change only
  - session B inserts a new document with B's change but without A's change
  - session A's change gets lost
  
To avoid this problem, update processes for a table need to be processed "single file".  That is, only one such process can be running at a time for any one table. To implement this, the server code brackets all such processes with the following concurrency control:

  - insert a new document in the "lock" collection with properties for the table name and the current timestamp, keeing the id of the document created in variable lockId
  - remove any "stale" documents that have timestamp more than 10 seconds in the past, which are assumed to be orphans from failed processes
  - count the number of documents in the "lock" collection
    - if there is only one, proceed with the process, and when complete, remove the "lock" document
    - if there is more than one, remove the document having lockId, wait a random time, then try again from the beginning
    
