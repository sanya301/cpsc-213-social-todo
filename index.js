'use strict';

const express = require('express');
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const mongoose = require('mongoose');
const validator = require('validator');
//const Handlebars = require('handlebars');


var MONGODB_URL = require('./config/database.js');


const app = express();
mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGO_URL);

const Users = require('./models/users.js');
const Tasks = require('./models/tasks.js');

// Configure our app
const store = new MongoDBStore({
  uri: process.env.MONGO_URL,
  collection: 'sessions',
});

var hbs = exphbs.create({
    // Specify helpers which are only registered on this instance. 
    helpers: {
        isequal: function (lvalue, rvalue, options) {
          if (arguments.length < 3)
            console.log("Handlebars Helper equal needs 2 parameters");
          if( String(lvalue) != String(rvalue) ) {
            return options.inverse(this);
          } else {
            return options.fn(this);
          }
        }
    }
});

app.engine('handlebars', hbs.engine);

//app.engine('handlebars', exphbs({
//  defaultLayout: 'main',
//}));
app.set('view engine', 'handlebars');
app.use(bodyParser.urlencoded({
  extended: true,
})); // for parsing application/x-www-form-urlencoded
// Configure session middleware that will parse the cookies
// of an incoming request to see if there is a session for this cookie.
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: 'auto',
  },
  store,
}));

// Middleware that looks up the current user for this sesssion, if there
// is one.
app.use((req, res, next) => {
  if (req.session.userId) {
    Users.findById(req.session.userId, (err, user) => {
      if (!err) {
        res.locals.currentUser = user;
      }
      next();
    });
  } else {
    next();
  }
});

// Middleware that checks if a user is logged in. If so, the
// request continues to be processed, otherwise a 403 is returned.
function isLoggedIn(req, res, next) {
  if (res.locals.currentUser) {
    next();
  } else {
    res.sendStatus(403);
  }
}

// Middleware that loads a users tasks if they are logged in.
function loadUserTasks(req, res, next) {
  if (!res.locals.currentUser) {
    return next();
  }
  Tasks.find({}).or([
    {owner:res.locals.currentUser},
    {collaborators: res.locals.currentUser.email}])
    .exec (function(err, tasks) {
    if (!err) {
      res.locals.tasks = tasks;
    }
    next();
  });
}

// Return the home page after loading tasks for users, or not.
app.get('/', loadUserTasks, (req, res) => {
  res.render('index');
});

// Handle submitted form for new users
app.post('/user/register', (req, res) => {
  if (req.body.newpassword!== req.body.confirmpassword) {
    return res.render('index', {errors: "Passwords do not match"});
  }
  var newUser = new Users();
  newUser.hashed_password = req.body.newpassword;
  newUser.email = req.body.newemail;
  newUser.name = req.body.name;
  newUser.save(function(err, user) {
    if (err) {
      err = "Error registering";
      res.render ('index', {errors:err});
    }
    else {
      req.session.userId= user._id;
      res.redirect('/');
    }
  });
  
});

app.post('/user/login', (req, res) => {
  var user = Users.findOne ({email:req.body.email}, function (err,user) {
    if (err|| !user) {
      err = "Error Logging in";
      res.render ('index', {errors:err});
      return;
    }
    user.comparePassword (req.body.password, function(err, isMatch) {
      if (err||!isMatch) {
        err = "Error Logging in";
        res.render ('index', {errors:err});
      }
      else {
        req.session.userId = user._id;
        res.redirect('/');
      }
    });
  });
});

// Log a user out
app.get('/user/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

//  All the controllers and routes below this require
//  the user to be logged in.
app.use(isLoggedIn);


// Handle submission of new task form
app.post('/tasks/:id/:action(complete|incomplete)', (req, res) => {
  var id = req.params.id;
  var iscompleted = req.params.action;

	Tasks.findById(id, function(err,savedTask) {
		if(err|| !savedTask) {
			console.log('Error finding task on database.');
			res.redirect('/');
		}
		else {
			savedTask.completeTask();
			res.redirect('/');
		}
	});

});

app.post('/tasks/:id/delete', (req, res) => {
  var id = req.params.id;
	Tasks.findById(id, function(err, taskToRemove) {
		if(err || !taskToRemove) {
			console.log('Error finding task on database.');
			res.redirect('/');
		}
		else {
			taskToRemove.remove();
			res.redirect('/');
		}
	});
  
});

// Handle submission of new task form
app.post('/task/create', (req, res) => {

  var newTask = new Tasks();
  newTask.owner = res.locals.currentUser._id;
  newTask.name = req.body.name;
  newTask.description = req.body.description;
  newTask.collaborators = [req.body.collaborator1, req.body.collaborator2, req.body.collaborator3];
  newTask.isComplete = false;
  
/*  for (var i = 0; i < 3; i++) {
    if (newTask.collaborators[i]) {
      Users.findOne ({email:newTask.collaborators[i]}, function (err,user) {
        if (err|| !user) {
          err = "Error saving Task";
          res.render ('index', {errors:err});
          return;
        }
      });
    }
  } */
  
  newTask.save(function(err, savedTask) {
    if (err || !savedTask) {
      err = "Error saving task";
      res.render ('index', {errors:err});
    }
    else {
      res.redirect('/');
    }
  });
}); 

// Start the server
app.listen(process.env.PORT, () => {
  console.log(`Example app listening on port http://localhost:${process.env.PORT}`);
});
