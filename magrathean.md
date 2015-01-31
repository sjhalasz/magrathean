An exercise for learning Meteor (see meteor.com for explanation of Meteor).
sjhalasz@gmail.com

As an exercise for learning Meteor, I'm implementing a record-keeping application that I previously started to write using the lamp stack for my wife's planned (but never launched) medical clinic. She wanted a way to design and use data collections herself without programmers because she was afraid I might die some day or at least become senile.

This application lets you interactively add, change, or delete controls on a form. I call the controls that the user can add, change or delete 'soft controls', as opposed to 'hard controls' that the user can't change that are used to define the 'soft controls'.

This version currently supports adding/changing/deleting 4 soft control types:

  text   - Simply inserts text in the form (not really a control).
  input  - Input of text values.
  select - Drop-down options selector.
  date   - Text input control that implements the JQuery UI datepicker.
  
To add a soft control, you enter a name in the (hard control) name field, which will become the name of the soft control and also the name of the corresponding data element. You choose the type and then enter a label. If the type is "select", you also enter the options separated by comma. Then, clicking on the Add/Change Control button adds the soft control to the form. To change a soft control, you use the same name with different parameters. 

The controls then appear farther down the page. Each soft control has an x button in front for deleting the control.

You enter data into the soft form for a record and click the Add/Change Record button to save it. You use the Back and Next buttons to navigate through the records and the New button to enter a new record. The current record number (or [new] if it's a new record) is displayed after the Next button.

There is currently no delete record function. I will implement delete record as a checkbox control in the record that allows "deleted" records to be displayed or not as part of a generalized filter/sort to be added later, which will enable viewing of deleted records as well as undelete.

Stucture and usage of the Mongo "table" collection...

The "table" collection holds all the data for both soft controls and records. I plan to add the ability to support multiple tables each as a separate collection.

The documents in this collection have the following structure:
  - a new document every time either the controls or records are changed, so only the most recent document is used and accessible to the client.  This provides version history and backing off of changes.
  - a document includes properties:
    createdAt: the timestamp of the version creation 
    controls: an object which contains a set of objects, one for each control;
              the name of each object is the name of the control;
              each object also contains the name as a property, which is redundant
                but makes coding cleaner and simpler
              the properties of each control object are:
              name:    the name of the soft control
              type:    the type of the soft control, e.g. input, select, date
              label:   the label text for the soft control
              options: the options if this is a select control, as a comma separated string
    records:  an array of objects, one for each record;
              the properties of the record are the field names, which are the same as
                the name of the control they were entered from;
              all values are stored as character

Only the most recent document in the collection, the active one, is published to the client. Updates to controls and records are always performed via Meteor methods in order to provide good concurrency control.

Structure and usage of the Mongo "sessions" collection...

Instead of using Meteor's Session object to save some session data, I'm using a Mongo collection to do the same thing when I need for the server to be able to update the data as well.

At startup, the session inserts a new document in the "sessions" collection and remembers the document id as variable sessionId. The "sessions" document contains a createdAt date and a recordId property, which is initially -1. The recordId property is the array index in the records array of the record which is currently displayed in the soft controls. A value of -1 indicates a new record to be added.

The sessionId value is used to reference and update the recordId property in the "sessions" collection. Only the client's own sessionId document is published to the client, so the client always has access to read only one document. The client updates recordId via a Meteor function with the sessionId as an argument. 

When a new record is added, the recordId is initially -1. After the server performs the update, the server needs to pass back the record number of this new record to the client. This is done by having the server set the recordId for the client's session document in the "sessions" collection. The assignment of sequential ordinal record numbers requires the implementation of concurrency control in the application as described below.

Structure and usage of the Mongo "lock" collection...

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
  
To avoid this problem, update processes need to be processed "single file".  That is, only one such process can be running at a time. To implement this, the server code brackets all such processes with the following concurrency control:

  - insert a new document in the "lock" collection with the current timestamp as property createdAt, keeing the id of the document created in variable lockId
  - remove any "stale" documents that have createdAt more than 10 seconds in the past, which are assumed to be orphans from failed processes
  - count the number of documents in the "lock" collection
    - if there is only one, proceed with the process, and when complete, remove the "lock" document
    - if there is more than one, remove the document having lockId, wait a random time, then try again from the beginning
    
