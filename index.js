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
      }),
    ]
  })

  var log = through.obj(function (log, _, callback) {
    if(typeof log == 'object'){
      logger.log('info', JSON.stringify(log))
    } else {
      logger.log('info', log)
    }
    callback()
  });

  // Docker Logs
  loghose = logFactory({events: events});
  loghose.pipe(log);

  // Docker Stats
  dockerStatsSource = statsFactory({events: events, statsinterval: 30});
  dockerStatsSource.pipe(log);

  // Docker Events
  dockerEventSource = eventsFactory({});
  dockerEventSource.pipe(log);

  return loghose;
};

module.exports = start;

if (require.main === module) { start(); }
