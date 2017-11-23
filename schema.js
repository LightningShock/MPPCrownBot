var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var User = new Schema({
    _id: String,
    color: String,
    lastSeen: { type: Number, default: function(){return new Date().getTime()} },
    name: String
}, { _id: false });

var Ban = new Schema({
    _id: String,
    start: { type: Number, default: function(){return new Date().getTime()} },
    end: Number
}, { _id: false });

var Admin = new Schema({
    _id: String,
    name: String
}, {_id: false});

module.exports = {
    Ban,
    User,
    Admin
};