#! /usr/bin/env node

'use strict';

var through = require('through2');
var allContainers = require('docker-allcontainers');
var statsFactory = require('docker-stats');
var logFactory = require('docker-loghose');
var eventsFactory = require('./docker-event-log');
var winston = require('winston');

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
    ]
  })

  var log = through.obj(function (log, _, callback) {
    logger.log('info', log)
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
