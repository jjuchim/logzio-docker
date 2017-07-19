#! /usr/bin/env node

'use strict';

var through = require('through2');
var allContainers = require('docker-allcontainers');
var statsFactory = require('docker-stats');
var logFactory = require('docker-loghose');
var eventsFactory = require('./docker-event-log');
var winston = require('winston');
var winstonLogstash = require('./winston-logstash.js');
var isJSON = require('is-json');

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

  var log = through.obj(function (log, _, callback) {
    logger.log('info', JSON.stringify(log))
    callback()
  });

  // Docker Logs
  loghose = logFactory({events: events});
  loghose
    .pipe(through.obj(function(message, _, callback) {
      if(isJSON(message.line)) {
        message.body = JSON.parse(message.line);
        delete message.line;
      }
      message.source = 'docker-logs';
      message.version = '1.0';
      return callback(null, message);
    }))
    .pipe(log);

  // Docker Stats
  dockerStatsSource = statsFactory({events: events, statsinterval: 30});
  dockerStatsSource
    .pipe(through.obj(function(message, _, callback) {
      message.source = 'docker-stats';
      message.version = '1.0';
      return callback(null, message);
    }))
    .pipe(log);

  // Docker Events
  dockerEventSource = eventsFactory({});
  dockerEventSource
    .pipe(through.obj(function(message, _, callback) {
      message.source = 'docker-events';
      message.version = '1.0';
      return callback(null, message);
    }))
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
