#! /usr/bin/env node

'use strict';

var through = require('through2');
var allContainers = require('docker-allcontainers');
var statsFactory = require('docker-stats');
var logFactory = require('docker-loghose');
var eventsFactory = require('./docker-event-log');
var winston = require('winston');
var winstonLogstash = require('./winston-logstash.js');

function start() {
  var events = allContainers({});
  var loghose;
  var dockerStatsSource;
  var dockerEventSource;

  var logger = new (winston.Logger) ({
    transports: [
      new (winston.transports.Logstash)({
        level: 'debug',
        formatter: function(options) { return options.message; },
        port: process.env.LOGSTASH_PORT,
        host: process.env.LOGSTASH_HOST
      })
      /*new (winston.transports.Console)({
        level: 'debug',
        formatter: function(options) { return options.message; }
      })*/
    ]
  })
  var parseLog = function(sourceType, version) {
    return through.obj(function (log, _, callback) {
      if(typeof log == 'object') {
        log.body = log.line
        delete log.line
      } else {
        log = { line: log }
      }

      log.source = sourceType;
      log.version = version;
      return callback(null, log);
    })
  }

  var log = through.obj(function (log, _, callback) {
    logger.log('info', JSON.stringify(log))
    callback()
  });

  // Docker Logs
  loghose = logFactory({events: events});
  loghose
    .pipe(parseLog('docker-events', '1.0'))
    .pipe(log);

  // Docker Stats
  dockerStatsSource = statsFactory({events: events, statsinterval: 30});
  dockerStatsSource
    .pipe(parseLog('docker-stats', '1.0'))
    .pipe(log);

  // Docker Events
  dockerEventSource = eventsFactory({});
  dockerEventSource
    .pipe(parseLog('docker-container-log', '1.0'))
    .pipe(log);

  return loghose;
};

module.exports = start;

process.on('SIGINT', function(){
  process.exit()
});

process.on('SIGTERM', function() {
  process.exit()
})

if (require.main === module) { start(); }
