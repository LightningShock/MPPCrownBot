var schema = require("./schema.js");
var Client = require("mpp-client");
var Express = require("express");
var mongoose = require("mongoose");
var bodyParser = require("body-parser");
var auth = require("basic-auth");
var fs = require("fs");
var cors = require('cors');

var User = mongoose.model("User", schema.User);
var Ban = mongoose.model("Ban", schema.Ban);
var Admin = mongoose.model("Admin", schema.Admin);

var app = Express();
var api = Express.Router();

var client = new Client("ws://www.multiplayerpiano.com/");
mongoose.Promise = Promise;
mongoose.connect('mongodb://localhost:27017/crownbot', { useMongoClient: true }).then(function() {
    console.log("connected to crownbot db")
    client.start();
});


var admins = [];
var who = undefined;
client.setChannel("mytestroom");

client.on("participant update", updateUsers);
client.on("participant added", checkBans);
client.on("a", function(msg) {
    console.log(msg.a);
    var args = msg.a.split(" ");
    var cmd = args[0].toLowerCase();
    var text = args.slice(1).join(" ");
    var admin = (admins.indexOf(msg.p._id) !== -1);
    if (cmd == "/amiadmin") {
        if (admin) {
            client.sendChat("yes");
        }
        else {
            getAdmin(msg.p._id, function(a) {
                if (a !== null && a._id == msg.p._id) {
                    admins.push(a._id);
                    client.sendChat("yes");
                }
                else {
                    client.sendChat("no");
                }
            });
        }
    }
    if (cmd == "/who" && admin) {
        var result = client.search(text);
        if (result) {
            who = result;
            client.sendChat(`User found! _id:${result._id} color:${result.color} name:${result.name}`);
        }
        else {
            client.sendChat(`Couldn't find user.`);
            who = undefined;
        }
    }
    if (cmd == "/ban" && admin) {
        if (!who) {
            client.sendChat(`No user found. Can't ban.`);
        }
        else {
            getAdmin(who._id, function(user) {
                if (user !== null) {
                    client.sendChat(`User is admin. Can't ban.`);
                }
                else {
                    addBan(who._id, ((Number(args[1]) == "NaN") ? 1 : Number(args[1])));
                    client.kickBan(who._id, 60000);
                }
            });
        }

    }
    if (cmd == "/js" && admin) {
        try {
            client.sendChat("Console: " + eval(text));
        }
        catch (e) {
            client.sendChat("Error: " + e);
        }
    }
    if (cmd == "/takecrown" && admin) {
        client.sendArray([{ m: "chown", id: msg.p.id }]);
    }
    if (cmd == "/reset" && admin) {
        client.sendArray([{ m: "chset", set: { color: "#000000", visible: true } }]);
        client.sendChat("Channel settings should be reset");
    }
});

app.use(cors({ credentials: true, origin: true }));

app.use(pwRequired);

api.use(pwRequired);

api.use(function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8888');
    res.setHeader('Content-Type', 'application/json');
    next();
});
api.get("/", function(req, res) {
    res.end(JSON.stringify({
        data: true
    }));
});
api.get("/user/name/:name", function(req, res) {
    User.find({ name: req.params.name }).then(function(users) {
        res.end(JSON.stringify({ users }));
    });
});
api.get("/user/_id/:id", function(req, res) {
    User.findOne({ _id: req.params.id }).then(function(dbuser) {
        res.end(JSON.stringify({
            user: dbuser
        }));
    });
});
api.get("/ban/:id-:hours", function(req, res) {
    addBan(req.params.id, req.params.hours, function() {
        req.end(JSON.stringify({
            ban: true
        }));
    });
});
api.get("/user/1h", function(req, res) {
    User.find({ lastSeen: { "$gt": new Date().getTime() - 3600000 /*86400000*/ } }, null, { sort: { date: 1 } }).then(function(users) {
        res.end(JSON.stringify(users));
    });
})

app.use("/api", api);
app.get("/", function(req, res) {
    fs.createReadStream("./container/index.html").pipe(res);
});
app.post("/admin", bodyParser.urlencoded(), function(req, res) {
    console.log(req.body);
    addAdmin(req.body._id, req.body.name, function() {
        res.end(JSON.stringify(req.body));
    });
});

api.use(function(req, res, next) {
    res.status(404).send({ error: "404 not found" });
});

app.listen(8083);

function addUser(user, cb) {
    console.log("Adding user");
    console.log(user);

    var u = new User({
        _id: user._id,
        color: user.color,
        name: user.name,
    });
    u.save(cb);
}

function getUser(user_id, cb) {
    console.log("getting user");
    User.findOne({ _id: user_id }, function(err, user) {
        if (err) {
            console.log(`ERROR!!!\n${err}`);
            cb(err, null);
        }
        if (user !== null) {
            console.log("User found");
            cb(null, user);
        }
        else {
            console.log("User not found");
            cb(null, null);
        }
    });
}

function addBan(user_id, hours, cb) {
    console.log("Banning...");
    var now = new Date().getTime();

    var b = new Ban({
        end: now.setHours(now.getHours() + hours),
        _id: user_id
    });
    b.save(cb);
}

function addAdmin(user_id, name, cb) {
    var a = new Admin({
        _id: user_id,
        name
    });
    a.save(cb);
}

function getAdmin(user_id, cb) {
    Admin.findOne({ _id: user_id }).then(function(admin) {
        if (admin !== null) {
            cb(admin);
        }
        else {
            cb(null);
        }
    });
}

function updateUser(dbuser, user, cb) {
    dbuser.color = user.color;
    dbuser.lastSeen = new Date().getTime();
    dbuser.name = user.name;
    dbuser.save(cb);
}

function updateUsers(msg) {
    console.log("Updating user...");
    getUser(msg._id, function(err, user) {
        if (err) {
            console.log(`ERROR!!!\n${err}`);
        }
        console.log("" + user);
        if (user !== null) {
            updateUser(user, msg, function(err, uuser) {
                console.log(err);
                if (err) process.exit(1);
                console.log(uuser);
                console.log(`Updated user ${msg._id}`);
            });
        }
        else {
            addUser(msg, function(err, suser) {
                console.log(err);
                console.log(suser);
                client.sendChat("Welcome " + suser.name + " to the RP Room!");
            });
        }
    });
    getAdmin(msg._id, function(admin) {
        if (admin !== null && admin._id == msg.p._id) {
            admins.push(admin._id);
        }
    });
}

function checkBans(user) {
    var now = new Date().getTime();
    Ban.findOne({ _id: user._id }).then(function(ban) {
        if (ban !== null) {
            if (ban.end == 0) { //inf ban, never unban pls thanks
                client.kickBan(user._id, 3600000);
            }
            else if (ban.end < now) { //if ban time over, delete ban in database
                ban.remove().exec();
            }
            else { //ban isnt over
                if ((ban.end - now) > 3600000) { //ban greater than an hour, kick full hour.
                    client.kickBan(user._id, 3600000);
                }
                else { //ban less than an hour, kick remaining milliseconds.
                    console.log("Kicking "+user._id+" for "+ (ban.end - now)+"ms");
                    client.kickBan(user._id, ban.end - now);
                }
            }
        }
    });
}

Client.prototype.sendChat = function(chat) {
    return this.send(JSON.stringify([{ m: "a", message: chat }]));
}
Client.prototype.kickBan = function(id, ms) {
    client.sendArray([{ m: "kickban", _id: id, ms: ms }]);
};
Client.prototype.search = function(msg) {
    if (msg.trim() == "") return false;
    for (var i in this.ppl) {
        var part = this.ppl[i];
        if (part.name.toLowerCase().indexOf(msg.toLowerCase()) !== -1 || part._id == msg || msg.id == msg) {
            return part;
            break;
        }
    }
};

function pwRequired(req, res, next) {
    var credentials = auth(req);
    if (credentials) {
        if (credentials.name == "admin" && credentials.pass == "admin") {
            next();
        }
        else if (credentials.name == "admin" && credentials.pass == "admin") {
            next();
        }
        else {
            res.statusCode = 401;
            res.setHeader('WWW-Authenticate', 'Basic realm="Admin Login Required"');
            res.end('Access denied');
        }
    }
    else {
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Login Required"');
        res.end('Access denied');
    }
}
