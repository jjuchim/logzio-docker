#! /usr/bin/env node

'use strict';

var through = require('through2');
var minimist = require('minimist');
var allContainers = require('docker-allcontainers');
var statsFactory = require('docker-stats');
var logFactory = require('docker-loghose');
var eventsFactory = require('./docker-event-log');
var winston = require('winston');
var winstonLogstash = require('winston-logstash');
var isJSON = require('is-json');

function start() {
  var events = allContainers({});
  var loghose;
  var dockerStatsSource;
  var dockerEventSource;

  var logger = new (winston.Logger) ({
    transports: [
      new (winston.transports.Console)({
        level: 'debug',
        formatter: function(options) { return options.message; }
      }),
      new (winston.transports.Logstash)({
        port: process.env.LOGSTASH_PORT,
        host: process.env.LOGSTASH_HOST
      })
    ]
  })

  var logFunctionGenerator = function (parseFunction) {
    return through.obj(function (log, _, callback) {
      if(parseFunction) { log = parseFunction(log); }

      logger.log('info', JSON.stringify(log))
      callback()
    })
  };

  // Docker Logs
  var parseLog = function (log) {
   if(isJSON(log.line)){
      log.line = JSON.parse(log.line)
      log = parseMessage(log)
    }else{
      log.message = log.line;
      delete log.line;
    }
    return log;
  };

  loghose = logFactory({events: events});
  loghose.pipe(logFunctionGenerator(parseLog));

  // Docker Stats
  dockerStatsSource = statsFactory({events: events, statsinterval: 30});
  dockerStatsSource.pipe(logFunctionGenerator());

  // Docker Events
  dockerEventSource = eventsFactory({});
  dockerEventSource.pipe(logFunctionGenerator());

  return loghose;
};

function parseMessage(msg) {
  var renameField = function(obj, oldName, newName) {
    obj[newName] = obj[oldName];
    delete obj[oldName];
    return obj
  };

  var log = renameField(msg, 'line', 'message')
  log.message = renameField(log.message, '_request.body', 'request_body')
  log.message = renameField(log.message, '_request.status', 'status')
  log.message = renameField(log.message, '_request.response-body', 'response_body')
  log.message = renameField(log.message, '_request.method', 'method')
  log.message = renameField(log.message, '_request.path', 'path')
  log.message = renameField(log.message, '_request.params', 'params')
  log.message = renameField(log.message, '_request.request_id', 'request_id')
  log.message = renameField(log.message, '_request.request_ip', 'request_ip')
  log.message = renameField(log.message, '_request.user_agent', 'user_agent')
  log.message = renameField(log.message, '_request.duration', 'duration')
  return log;
};

module.exports = start;

if (require.main === module) { start(); }
