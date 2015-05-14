/**
 * Created by Administrator on 2015/4/24.
 */

/**
 * protocol for bleach
 */

var ByteBuffer = require('dena-bytebuffer');

var Protocol = {}

Protocol.encode = function (EProtoId, EProtoBody) {
    var byteLength = EProtoBody === undefined ? 0 : EProtoBody.length;
    var byteBuffer = new ByteBuffer().littleEndian(); // 小端

    byteBuffer.uint32(2 + byteLength);
    byteBuffer.ushort(EProtoId);

    if (byteLength) {
        byteBuffer.byteArray(EProtoBody, byteLength);
    }

    return byteBuffer.pack();
}

Protocol.decode = function (msg) {
    var package = {'EProtoLen': 0, 'EProtoId': 0, 'EProtoBody': null};
    var byteBuffer = new ByteBuffer(msg).littleEndian(); // 小端

    if (msg.length === 4) {
        package.EProtoLen = byteBuffer.uint32().unpack().shift();
    } else if (msg.length === 6) {
        var unpackArray = byteBuffer.uint32().ushort().unpack();
        package.EProtoLen = unpackArray.shift();
        package.EProtoId = unpackArray.shift();
        package.EProtoBody = new Buffer(0);
    } else if (msg.length > 6) {
        var unpackArray = byteBuffer.uint32().ushort().byteArray(null, msg.length - 4 - 2).unpack();
        package.EProtoLen = unpackArray.shift();
        package.EProtoId = unpackArray.shift();
        package.EProtoBody = new Buffer(unpackArray.shift());
    } else {
        throw new Error('Unexpected msg Length!');
    }

    return package
}

/**
 * bleach client
 */

var net = require('net');

var Bleach = function () {
    this.socket = null;
    this.fn = null;

    this.dataChunks = [];
    this.actions = [];
    this.packageList = [];
    this.callbacks = {};
    this.customValue = {};

    this.breathIntervalTime = 100; // 单位 : 毫秒
    this.responseOverTime = 5000; // 单位 : 毫秒
    this.thinkTimeMax = 3000; // 最大思考时间 单位 : 毫秒
};

module.exports = Bleach;

Bleach.prototype.run = function () {
    var self = this;

    var timer = setInterval(breath, self.breathIntervalTime);

    function breath() {
        if (self.fn === null) {
            self.fn = self.actions.shift();
            return
        }

        if (self.fn() === undefined) {
            if (self.actions.length) {
                self.fn = self.actions.shift();
            } else {
                console.log('clear timer')
                clearInterval(timer);
            }
        }
    }
};

Bleach.prototype.getThinkTime = function () {
    return Math.ceil(Math.random() * this.thinkTimeMax / 1000);
}

Bleach.prototype.connect = function (params, cb) {
    var port = params.port;
    var host = params.host;
    this.socket = net.connect(port, host);

    var self = this;
    this.socket.on('connect', function () {
        console.log('[bleachclient.socket.connect] tcp-socket connected!');

        if (cb) {
            cb();
        }
    });

    this.socket.on('data', function (data) {
        self.dataChunks.push(data);
        processMessage(self);
        processPackage(self);
    });

    this.socket.on('error', function (error) {
        console.log('[bleachclient.socket.error] tcp-socket code: %s!', error.code);
    });

    this.socket.on('close', function (result) {
        console.log('[bleachclient.socket.close] tcp-socket closeed!');
    })
}

Bleach.prototype.register = function (EProtoId, callback) {
    if (EProtoId === undefined || callback == undefined)
        return;

    this.callbacks[EProtoId] = callback;
}

Bleach.prototype.request = function (EProtoId, EProtoBody) {
    if (EProtoId === undefined)
        return;

    var args = Array.prototype.slice.apply(arguments);

    if (args.length == 4) {
        this.callbacks[args[2]] = args[3];
    }

    var sg = Protocol.encode(EProtoId, EProtoBody);
    this.socket.write(sg);
};

Bleach.prototype.close = function () {
    if (this.socket) {
        console.log('[bleachclient.close] Active disconnect!');
        this.socket.destroy();
        this.socket = null;
    }
};

var processMessage = function (self) {
    var buf = Buffer.concat(self.dataChunks);
    var len = buf.length;
    //console.log(len, buf)
    if (len >= 4) {
        var package = Protocol.decode(buf.slice(0, 4));
        if (len >= package.EProtoLen + 4) {
            self.packageList.push(buf.slice(0, package.EProtoLen + 4));
            self.dataChunks = [buf.slice(package.EProtoLen + 4, len)];

            processMessage(self);
        }
    }
};

var processPackage = function (self) {
    while (self.packageList.length) {
        var msg = self.packageList.shift();
        var package = Protocol.decode(msg);
        var cb = self.callbacks[package.EProtoId];

        if (cb) {
            cb(package.EProtoBody);
        }
    }
};