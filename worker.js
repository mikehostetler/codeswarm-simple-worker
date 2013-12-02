require('colors');

var async         = require('async');
var net           = require('net');
var DuplexEmitter = require('duplex-emitter');
var spawn         = require('child_process').spawn;
var reconnect     = require('reconnect');

exports.create = create;


/// Config

var dispatcherPort = 8632; /// TODO: make this configurable

function create() {
  return new Worker;
}


function Worker() {
  this.child  = undefined;
  this.socket = undefined;
  this.server = undefined;
}

var W = Worker.prototype;


/// work

W.work = function work() {
  this.connect();
}


/// connect

W.connect = function connect() {
  var self = this;
  if (this.child) {
    /// if we have a pending child kill it first
    this.child.once('close', function() {
      self.child = undefined;
      startReconnect.call(self);
    })
    this.child.kill();
  } else startReconnect.call(this);
}


/// startReconnect

function startReconnect() {
  this.reconnect = reconnect(onConnect.bind(this)).connect(dispatcherPort);

  this.reconnect.on('disconnect', function() {
    console.log('Disconnected from dispatcher'.red);
  });

  this.reconnect.on('reconnect', function() {
    console.log('Attempting to reconnect to dispatcher...'.yellow);
  });
}


/// onConnect

function onConnect(socket) {
  console.log('Connected to dispatcher'.green);
  this.socket = socket;
  this.server = DuplexEmitter(socket);

  this.server.on('spawn', onSpawn.bind(this));

}


/// onSpawn

function onSpawn(command, args, options) {
  if (this.child) return this.fatalError.call(this, 'Still have child process working');
  console.log('Spawning command: %j ARGS: %j, OPTIONS: %j'.yellow, command, args, options);
  this.child = spawn(command, args, options);
  this.child.stdout.setEncoding('utf8');
  this.child.stdout.on('data', onChildStdout.bind(this));
  this.child.stderr.setEncoding('utf8');
  this.child.stderr.on('data', onChildStderr.bind(this));
  this.child.once('close', onChildClose.bind(this));
}


/// onChildtdout

function onChildStdout(buf) {
  console.log('[CHILD STDOUT]', buf);
  this.server.emit('stdout', buf);
}


/// onChildStderr

function onChildStderr(buf) {
  console.log('[CHILD STDERR]', buf);
  this.server.emit('stderr', buf);
}


/// onChildClose

function onChildClose(code) {
  console.log('Command closed, status code = %d', code);
  this.server.emit('close', code);
  this.child = undefined;
}


/// fatalError

function fatalError(msg) {
  error.call(this, msg);
}


/// disconnect

function disconnect() {
  this.server.emit('close');
  this.socket.end();
}


/// error

function error(msg) {
  this.server.emit('stderr', msg + '\n');
}
