require("./utils.js");
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fs = require("fs");
const MongoStore = require("connect-mongo");
const Joi = require("joi");
const bodyParser = require("body-parser");
require('dotenv').config();

const jsonParser = bodyParser.json();

const encryptRounds = 12;

const port = process.env.PORT || 3020;

const app = express();

const expireTime = 60 * 60 * 1000;

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;

const node_session_secret = process.env.NODE_SESSION_SECRET;

var {database} = include('connections');

const userCollection = database.db(mongodb_database).collection('users');

app.set('view engine', 'ejs');

app.use(express.urlencoded({extended: false}));


var mongoStore = MongoStore.create({
    mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/?retryWrites=true&w=majority`,
    crypto: {
        secret: mongodb_session_secret
    }
});

function isValidSession(req) {
    if (req.session.authenticated) {
        return true;
    }
    return false;
}

function sessionValidation(req,res,next) {
    if (isValidSession(req)) {
        next();
    }
    else {
        res.redirect('/login');
    }
}


function isAdmin(req) {
    if (req.session.user_type == 'admin') {
        return true;
    }
    return false;
}

function adminAuthorization(req, res, next) {
    if (!isAdmin(req)) {
        res.status(403);
        res.render("errorMessage", {error: "Not Authorized"});
        return;
    }
    else {
        next();
    }
}

app.use(session({
    secret: node_session_secret,
        store: mongoStore,
        saveUninitialized: false,
        resave: true
}));

app.get('/', (req, res) => {
    var authState = false;
    if (req.session.authenticated != undefined){
        authState = true;
    }
    res.render("index", {auth: authState, name: req.session.name});
});


app.get('/members', sessionValidation, (req, res) => {
    if (req.session.authenticated == undefined){
        res.redirect("/login");
        return;
    } else {
        doc = fs.readFileSync("./members.html", "utf-8");
        var randImg = Math.floor(Math.random() * 3);
        if (randImg == 0){
            doc = doc.replace(`<div id="forms">`, `<p>Hello ${req.session.name}</p><img src='/trumpet.jpg' style='width: 250px;'/>
            Photo by <a href="https://unsplash.com/@halacious?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Hal Gatewood</a> on <a href="https://unsplash.com/photos/fTPSm7KD_d0?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Unsplash</a>
            `)
        } else if (randImg == 1){
            doc = doc.replace(`<div id="forms">`, `<p>Hello ${req.session.name}</p><img src='/keyboard.jpg' style='width: 250px;'/>
            Photo by <a href="https://unsplash.com/@nileane?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Niléane</a> on <a href="https://unsplash.com/photos/-TxL1NXXvoM?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Unsplash</a>
            `)
        } else if (randImg == 2){
            doc = doc.replace(`<div id="forms">`, `<p>Hello ${req.session.name}</p><img src='/drum.jpg' style='width: 250px;'/>
            Photo by <a href="https://unsplash.com/@paul_1865?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Paul Zoetemeijer</a> on <a href="https://unsplash.com/photos/ekBOf6sJYYo?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Unsplash</a>
            `)
        }

        // res.send(doc);
        var authState = false;
    if (req.session.authenticated != undefined){
        authState = true;
    }
        res.render("members", {auth: authState, name: req.session.name});
        
    }
});

app.get('/signup', (req, res) => {
    let doc = fs.readFileSync("./signup.html","utf-8");

    // res.send(doc);
    res.render("signup");
});

app.post('/signupSubmit', async (req, res) => {
    var email = req.body.email;
    var pw = req.body.password;
    var name = req.body.name;
    var user_type = "user";
    var html = "";
    // console.log(email, pw, name)

    if (!email){
        // res.redirect('/signup?missing=1');
        html += "Please enter a valid email <br><a href=\"./signup\">Try Again</a>";
        res.send(html);
    } else if (!pw){
        html += "Please enter a valid password <br><a href=\"./signup\">Try Again</a>";
        res.send(html);
    } else if (!name){
        html += "Please enter a valid name <br><a href=\"./signup\">Try Again</a>";
        res.send(html);
    } else {

        const schema = Joi.object({
            email: Joi.string().email().max(20).required(),
            pw: Joi.string().min(8).max(20).required(),
            name: Joi.string().alphanum().max(20).required()
        });
    
        const validation = schema.validate({email, pw, name});
    
        if (validation.error != null){
            console.log(validation.error);
            res.redirect("/signup");
            return;
        }

        var hashedPass = await bcrypt.hash(pw, encryptRounds);

        await userCollection.insertOne({username: name, email: email, password: hashedPass, user_type: "user"});
	    // console.log("Inserted user", + name + ","  + email + ","  + hashedPass);

        req.session.authenticated = true;
        req.session.email = email;
        req.session.pass = hashedPass;
        req.session.name = name;
        req.session.user_type = user_type;
        req.session.cookie.maxAge = expireTime;
        console.log(req.session.email)
        res.redirect("/members");
    }
});

app.get('/login', (req, res) => {
    let doc = fs.readFileSync("./login.html","utf-8");


    // res.send(doc);
    var authState = false;
    if (req.session.authenticated != undefined){
        authState = true;
    }
    res.render("login", {auth: authState});
});

app.post('/loginsubmit', async (req, res) => {
    var email = req.body.email;
    var pw = req.body.password;
    var html = "";
    console.log(email, pw)

    if (!email || !pw){
        // res.redirect('/signup?missing=1');
        html += "Invalid Email/password combination<br><a href=\"./login\">Try Again</a>";
        res.send(html);
    } else {

        const schema = Joi.object({
            email: Joi.string().email().max(20).required(),
            pw: Joi.string().min(8).max(20).required(),
        });
    
        const validation = schema.validate({email, pw});
    
        if (validation.error != null){
            console.log(validation.error);
            res.redirect("/signup");
            return;
        }

        var hashedPass = await bcrypt.hash(pw, encryptRounds);

        const result = await userCollection.find({email: email}).project({username: 1, email: 1, password: 1, user_type: 1, _id: 1}).toArray();
        // console.log(email + " " + hashedPass);
        // console.log(result[0]);
        if (result.length != 1){
            res.redirect("/login");
            return;
        }
        if (await bcrypt.compare(pw, result[0].password) && email == result[0].email){
            console.log("correct password");
		    req.session.authenticated = true;
            req.session.name = result[0].username;
		    req.session.email = email;
            req.session.user_type = result[0].user_type;
		    req.session.cookie.maxAge = expireTime;

		    res.redirect('/members');
		    return;
        } else {
            html += "Invalid Email/password combination<br><a href=\"./login\">Try Again</a>";
            res.send(html);
            // console.log("incorrect password");
            // res.redirect("/login");
            // return;
        }

    }

});

app.get("/logout", (req, res) => {
    req.session.destroy();
    var html = `
    <p>You are now logged out</p>
    <a href=\"/\">Return to main page<a>`
    res.send(html);
});

app.get("/admin", sessionValidation, adminAuthorization, async (req, res) => {
    var userSet = await userCollection.find().toArray();
    // console.log(req.session.user_type);
    var authState = false;
    if (req.session.authenticated != undefined){
        authState = true;
    }
    res.render("admin", {auth: authState, type: req.session.user_type, users: userSet})

});

app.post("/promote/:user", async (req, res) => {
    var toChange = req.params.user;
    await userCollection.find();
    await userCollection.updateOne({username: toChange}, {$set: {user_type: "admin"}});
    res.redirect("/admin");
});

app.post("/demote/:user", async (req, res) => {
    var toChange = req.params.user;
    await userCollection.find();
    await userCollection.updateOne({username: toChange}, {$set: {user_type: "user"}});
    res.redirect("/admin");
});


app.use(express.static(__dirname + "/public"));

app.get('*', (req, res) => {
    res.status(404);
    // res.send("There is no page here - 404");
    var authState = false;
    if (req.session.authenticated != undefined){
        authState = true;
    }
    res.render("404", {auth: authState});
});

app.listen(port, async () => {
    console.log("Launched on port " + port);
    var result = await userCollection.find().toArray();
    // console.log(result[0]);
});