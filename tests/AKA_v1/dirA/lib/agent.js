'use strict';
var util = require('util');
var https = require('https');
var debug;
var OriginalAgent = require('./_http_agent').Agent;
var OriginalHttpsAgent = https.Agent;
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
module.exports = Agent;
function Agent(options) {
    if (!(this instanceof Agent)) {
        return new Agent(options);
    }
    options = options || {};
    options.keepAlive = options.keepAlive !== false;
    if (options.keepAliveTimeout === undefined) {
        options.keepAliveTimeout = 15000;
    }
    if (options.timeout === undefined) {
        options.timeout = options.keepAliveTimeout * 2;
    }
    OriginalAgent.call(this, options);
    var self = this;
    self.createSocketCount = 0;
    self.closeSocketCount = 0;
    self.requestCount = 0;
    self.timeoutSocketCount = 0;
    self.on('free', function () {
        self.requestCount++;
    });
    self.on('timeout', function () {
        self.timeoutSocketCount++;
    });
    self.on('close', function () {
        self.closeSocketCount++;
    });
}
util.inherits(Agent, OriginalAgent);
Agent.prototype.createSocket = function (req, options) {
    var socket = OriginalAgent.prototype.createSocket.call(this, req, options);
    if (this.keepAlive) {
        socket.setNoDelay(true);
    }
    this.createSocketCount++;
    return socket;
};
Agent.prototype.getCurrentStatus = function () {
    return {
        createSocketCount: this.createSocketCount,
        closeSocketCount: this.closeSocketCount,
        timeoutSocketCount: this.timeoutSocketCount,
        requestCount: this.requestCount,
        freeSockets: inspect(this.freeSockets),
        sockets: inspect(this.sockets),
        requests: inspect(this.requests)
    };
};
function inspect(obj) {
    var res = {};
    for (var key in obj) {
        res[key] = obj[key].length;
    }
    return res;
}
function HttpsAgent(options) {
    Agent.call(this, options);
    this.defaultPort = 443;
    this.protocol = 'https:';
}
util.inherits(HttpsAgent, Agent);
if (node10) {
    HttpsAgent.prototype.createConnection = https.globalAgent.createConnection;
    HttpsAgent.prototype.getName = function (options) {
        var name = Agent.prototype.getName.call(this, options);
        name += ':';
        if (options.ca)
            name += options.ca;
        name += ':';
        if (options.cert)
            name += options.cert;
        name += ':';
        if (options.ciphers)
            name += options.ciphers;
        name += ':';
        if (options.key)
            name += options.key;
        name += ':';
        if (options.pfx)
            name += options.pfx;
        name += ':';
        if (options.rejectUnauthorized !== undefined)
            name += options.rejectUnauthorized;
        return name;
    };
} else {
    HttpsAgent.prototype.createConnection = OriginalHttpsAgent.prototype.createConnection;
    HttpsAgent.prototype.getName = OriginalHttpsAgent.prototype.getName;
}
Agent.HttpsAgent = HttpsAgent;