var events = require('events'), util = require('util'), assert = require('assert-plus'), os = require('os');
var emitter = new events.EventEmitter();
var endpoints = [];
var fullOrigin = false;
function Endpoint(debug, info, error, critical) {
    assert.bool(debug, 'debug');
    assert.bool(info, 'info');
    assert.bool(error, 'error');
    assert.bool(critical, 'critical');
    events.EventEmitter.call(this);
    this.levels = {
        debug: debug,
        info: info,
        error: error,
        critical: critical
    };
    this.logErrCount = 0;
}
util.inherits(Endpoint, events.EventEmitter);
function getFullOrigin() {
    var depth = 5;
    var e = new Error();
    var stack = e.stack.split('\n');
    var call;
    if (stack.length < depth) {
        call = stack[stack.length - 1];
    } else {
        call = stack[depth];
    }
    call = call.replace('    at ', '');
    var i = call.indexOf('(');
    var j = call.indexOf(':');
    var fn = call.substring(0, i - 1);
    var file = call.substring(i + 1, j).replace(__dirname + '/', '');
    var line = call.substring(j + 1);
    line = line.substring(0, line.indexOf(':'));
    return {
        file: file,
        line: line,
        fn: fn
    };
}
function getData(level, args) {
    var data = {
        level: level,
        date: new Date(),
        pid: process.pid,
        hostname: os.hostname()
    };
    if (args.length >= 3) {
        if (typeof args[0] === 'string' && typeof args[1] === 'string') {
            data.origin = args[0];
            data.message = args[1];
            data.metadata = args[2];
        } else {
            throw new Error('1. and 2. parameter must be a string');
        }
    } else if (args.length >= 2) {
        if (typeof args[0] === 'string' && typeof args[1] === 'string') {
            data.origin = args[0];
            data.message = args[1];
            data.metadata = undefined;
        } else if (typeof args[0] === 'string') {
            data.origin = undefined;
            data.message = args[0];
            data.metadata = args[1];
        } else {
            throw new Error('1. parameter must be a string');
        }
    } else if (args.length >= 1) {
        data.origin = undefined;
        data.message = args[0];
        data.metadata = undefined;
    } else {
        throw new Error('Only 1, 2, 3 or 4 parameters are allowed');
    }
    if (fullOrigin) {
        data.fullOrigin = getFullOrigin();
    }
    return data;
}
function log(level, args) {
    if (endpoints.length === 0) {
        throw new Error('No endpoints appended');
    }
    var data = getData(level, args);
    var callback = undefined;
    if (typeof args[args.length - 1] === 'function') {
        callback = args[args.length - 1];
    }
    var endpointCallbacks = 0, endpointError = undefined;
    endpoints.forEach(function (endpoint) {
        if (endpoint.levels[data.level] === true) {
            endpoint.log(data, function (err) {
                if (err) {
                    endpoint.logErrCount += 1;
                    endpointError = err;
                }
                endpointCallbacks += 1;
                if (endpointCallbacks === endpoints.length) {
                    try {
                        if (callback) {
                            callback(endpointError);
                        }
                    } finally {
                        emitter.emit('level:' + data.level, data);
                    }
                }
            });
        }
    });
}
exports.debug = function (origin, message, metadata, callback) {
    log('debug', arguments);
};
exports.info = function (origin, message, metadata, callback) {
    log('info', arguments);
};
exports.error = function (origin, message, metadata, callback) {
    log('error', arguments);
};
exports.critical = function (origin, message, metadata, callback) {
    log('critical', arguments);
};
exports.exception = function (origin, message, err, callback) {
    var i;
    for (i = 0; i < arguments.length; i += 1) {
        var arg = arguments[i];
        if (arg instanceof Error) {
            var stack = typeof arg.stack === 'string' ? arg.stack.replace(/    at /g, '').split('\n') : [];
            arguments[i] = {
                message: arg.message,
                type: stack.length > 0 ? stack[0].split(':')[0] : '',
                fileName: arg.fileName,
                lineNumber: arg.lineNumber,
                stack: stack.slice(1)
            };
        }
    }
    log('error', arguments);
};
exports.on = function (level, listener) {
    assert.string(level, 'level');
    assert.func(listener, 'listener');
    emitter.on('level:' + level, listener);
};
exports.addListener = function (level, listener) {
    assert.string(level, 'level');
    assert.func(listener, 'listener');
    emitter.addListener('level:' + level, listener);
};
exports.once = function (level, listener) {
    assert.string(level, 'level');
    assert.func(listener, 'listener');
    emitter.once('level:' + level, listener);
};
exports.removeListener = function (level, listener) {
    assert.string(level, 'level');
    assert.func(listener, 'listener');
    emitter.removeListener('level:' + level, listener);
};
exports.removeAllListeners = function (level) {
    assert.optionalString(level, 'level');
    if (level) {
        emitter.removeAllListeners('level:' + level);
    } else {
        emitter.removeAllListeners();
    }
};
exports.append = function (endpoint) {
    assert.ok(endpoint instanceof Endpoint, 'endpoint');
    assert.func(endpoint.log, 'endpoint.log');
    assert.func(endpoint.stop, 'endpoint.stop');
    endpoint.on('error', function () {
        endpoint.logErrCount += 1;
    });
    endpoints.push(endpoint);
};
exports.remove = function (endpoint, errCallback) {
    assert.ok(endpoint instanceof Endpoint, 'endpoint');
    assert.func(endpoint.log, 'endpoint.log');
    assert.func(endpoint.stop, 'endpoint.stop');
    assert.func(errCallback, 'errCallback');
    var idx = endpoints.indexOf(endpoint);
    endpoints.splice(idx, 1);
    endpoint.stop(function (err) {
        if (err) {
            errCallback(err);
        } else {
            errCallback();
        }
    });
};
exports.stop = function (errCallback) {
    assert.func(errCallback, 'errCallback');
    var endpointCallbacks = 0, endpointError = undefined, n = endpoints.length;
    endpoints.forEach(function (endpoint) {
        endpoint.stop(function (err) {
            if (err) {
                endpointError = err;
            }
            endpointCallbacks += 1;
            if (endpointCallbacks === n) {
                errCallback(endpointError);
            }
        });
    });
    endpoints = [];
    emitter.removeAllListeners();
};
exports.Endpoint = Endpoint;
exports.fullOrigin = function () {
    fullOrigin = true;
};