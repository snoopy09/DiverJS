'use strict';
var net = require('net');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var debug;
var node10 = process.version.indexOf('v0.10.') === 0;
if (node10) {
    debug = function () {
        if (process.env.NODE_DEBUG && /agentkeepalive/.test(process.env.NODE_DEBUG)) {
            console.log.apply(console.log, arguments);
        }
    };
} else {
    debug = util.debuglog('agentkeepalive');
}
debug = console.log;
function Agent(options) {
    if (!(this instanceof Agent))
        return new Agent(options);
    EventEmitter.call(this);
    var self = this;
    self.defaultPort = 80;
    self.protocol = 'http:';
    self.options = util._extend({}, options);
    self.options.path = null;
    self.requests = {};
    self.sockets = {};
    self.freeSockets = {};
    self.keepAliveMsecs = self.options.keepAliveMsecs || 1000;
    self.keepAlive = self.options.keepAlive || false;
    self.keepAliveTimeout = self.options.keepAliveTimeout || 0;
    self.maxSockets = self.options.maxSockets || Agent.defaultMaxSockets;
    self.maxFreeSockets = self.options.maxFreeSockets || 256;
    self.on('free', function (socket, options) {
        var name = self.getName(options);
        debug('agent.on(free)', name);
        if (!socket.destroyed && self.requests[name] && self.requests[name].length) {
            self.requests[name].shift().onSocket(socket);
            if (self.requests[name].length === 0) {
                delete self.requests[name];
            }
            debug('continue handle next request');
        } else {
            var req = socket._httpMessage;
            if (req && req.shouldKeepAlive && !socket.destroyed && self.options.keepAlive) {
                var freeSockets = self.freeSockets[name];
                var freeLen = freeSockets ? freeSockets.length : 0;
                var count = freeLen;
                if (self.sockets[name])
                    count += self.sockets[name].length;
                if (count > self.maxSockets || freeLen >= self.maxFreeSockets) {
                    self.removeSocket(socket, options);
                    socket.destroy();
                } else {
                    freeSockets = freeSockets || [];
                    self.freeSockets[name] = freeSockets;
                    socket.setKeepAlive(true, self.keepAliveMsecs);
                    socket.unref && socket.unref();
                    socket._httpMessage = null;
                    self.removeSocket(socket, options);
                    freeSockets.push(socket);
                    if (self.keepAliveTimeout) {
                        if (!socket._onKeepAliveTimeout) {
                            socket._onKeepAliveTimeout = function () {
                                this.destroy();
                                self.emit('timeout');
                            };
                        }
                        debug('enable free socket timer');
                        socket.setTimeout(self.keepAliveTimeout, socket._onKeepAliveTimeout);
                    }
                }
            } else {
                self.removeSocket(socket, options);
                socket.destroy();
            }
        }
    });
}
util.inherits(Agent, EventEmitter);
exports.Agent = Agent;
Agent.defaultMaxSockets = Infinity;
Agent.prototype.createConnection = net.createConnection;
Agent.prototype.getName = function (options) {
    var name = '';
    if (options.host)
        name += options.host;
    else
        name += 'localhost';
    name += ':';
    if (options.port)
        name += options.port;
    name += ':';
    if (options.localAddress)
        name += options.localAddress;
    name += ':';
    return name;
};
Agent.prototype.addRequest = function (req, options) {
    if (typeof options === 'string') {
        options = {
            host: options,
            port: arguments[2],
            path: arguments[3]
        };
    }
    var name = this.getName(options);
    if (!this.sockets[name]) {
        this.sockets[name] = [];
    }
    var freeLen = this.freeSockets[name] ? this.freeSockets[name].length : 0;
    var sockLen = freeLen + this.sockets[name].length;
    if (freeLen) {
        var socket = this.freeSockets[name].shift();
        debug('have free socket');
        if (socket._onKeepAliveTimeout) {
            debug('disable free socket timer');
            socket.setTimeout(0, socket._onKeepAliveTimeout);
        }
        if (!this.freeSockets[name].length)
            delete this.freeSockets[name];
        socket.ref && socket.ref();
        req.onSocket(socket);
        this.sockets[name].push(socket);
    } else if (sockLen < this.maxSockets) {
        debug('call onSocket', sockLen, freeLen);
        req.onSocket(this.createSocket(req, options));
    } else {
        debug('wait for socket');
        if (!this.requests[name]) {
            this.requests[name] = [];
        }
        this.requests[name].push(req);
    }
};
Agent.prototype.createSocket = function (req, options) {
    var self = this;
    options = util._extend({}, options);
    options = util._extend(options, self.options);
    if (!options.servername) {
        options.servername = options.host;
        if (req) {
            var hostHeader = req.getHeader('host');
            if (hostHeader) {
                options.servername = hostHeader.replace(/:.*$/, '');
            }
        }
    }
    var name = self.getName(options);
    debug('createConnection', name, options);
    options.encoding = null;
    var s = self.createConnection(options);
    function onFree() {
        self.emit('free', s, options);
    }
    s.on('free', onFree);
    function onClose(err) {
        debug('CLIENT socket onClose');
        if (typeof s.destroyed !== 'boolean') {
            s.destroyed = true;
        }
        self.removeSocket(s, options);
        self.emit('close');
    }
    s.on('close', onClose);
    s.setTimeout(self.timeout);
    function onRemove() {
        debug('CLIENT socket onRemove');
        self.removeSocket(s, options);
        s.removeListener('close', onClose);
        s.removeListener('free', onFree);
        s.removeListener('agentRemove', onRemove);
    }
    s.on('agentRemove', onRemove);
    return s;
};
Agent.prototype.removeSocket = function (s, options) {
    var name = this.getName(options);
    debug('removeSocket', name, 'destroyed:', s.destroyed);
    var sets = [this.sockets];
    if (s.destroyed)
        sets.push(this.freeSockets);
    for (var sk = 0; sk < sets.length; sk++) {
        var sockets = sets[sk];
        if (sockets[name]) {
            var index = sockets[name].indexOf(s);
            if (index !== -1) {
                sockets[name].splice(index, 1);
                if (sockets[name].length === 0)
                    delete sockets[name];
            }
        }
    }
    if (this.requests[name] && this.requests[name].length) {
        debug('removeSocket, have a request, make a socket');
        var req = this.requests[name][0];
        this.createSocket(req, options).emit('free');
    }
};
Agent.prototype.destroy = function () {
    var sets = [
        this.freeSockets,
        this.sockets
    ];
    for (var s = 0; s < sets.length; s++) {
        var set = sets[s];
        var keys = Object.keys(set);
        for (var v = 0; v < keys.length; v++) {
            var setName = set[keys[v]];
            for (var n = 0; n < setName.length; n++) {
                setName[n].destroy();
            }
        }
    }
};
exports.globalAgent = new Agent();