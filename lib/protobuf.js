/**
 * Created by Administrator on 2015/5/11.
 */

var fs = require('fs');
var path = require('path');
var __ = require('underscore');
var ProtoBuf = require('protobufjs');

var Proto = {};
module.exports = Proto;

fs.readdirSync(__dirname + '/proto').forEach(function (filename) {
    if (!/\.proto$/.test(filename)) {
        return;
    }

    var name = path.basename(filename, '.proto');
    var cmd = ProtoBuf.loadProtoFile(path.join(__dirname, 'proto', filename)).build('Cmd');
    for (var key in cmd) {
        var _load = {};

        var message = cmd[key];
        if (typeof message === 'function') {
            _load.encode = __.bind(function (data) {
                for (var attr in data)
                    this.set(attr, data[attr]);
                return this.encode().toBuffer();
            }, new message());
            _load.decode = message.decode;
            _load.decodeDelimited = message.decodeDelimited;
            _load.decode64 = message.decode64;
            _load.decodeHex = message.decodeHex;
        } else {
            _load = message;
        }

        if (!Proto[name])
            Proto[name] = {};

        Proto[name][key] = _load;
    }
});

//var data = {
//    signDay: 2,
//    signFlag: 3,
//    item: []
//}
//
//console.log(Proto.basetype.EProtoId.ERROR_CODE_S)
//Proto.activity.DailySignRet.encode(data)



