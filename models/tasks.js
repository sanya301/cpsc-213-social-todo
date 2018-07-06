'use strict';

const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

const stringField = {
  type: String,
  minlength: 1,
  maxlength: 500,
};

/*const collaboratorField = {
    type: String,
    minlength: 1,
    maxlength: 50,
    lowercase: true,
    unique: false,
}; */

const TaskSchema = new Schema({
  owner: ObjectId,
  name: stringField,
  description: stringField,
  isComplete: Boolean,
  collaborators: [String],
});


//This method will be responsible for task completion.
TaskSchema.methods.completeTask = function(err) {
	if(!err) {
		this.isComplete = !(this.isComplete);
		this.save();
	}
	else {
		console.log('Error completing a task.');
	}
	return;
};


module.exports = mongoose.model('Tasks', TaskSchema);