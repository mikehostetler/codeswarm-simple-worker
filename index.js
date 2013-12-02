#!/usr/bin/env node

var Worker = require('./worker');

var worker = Worker.create();

worker.work();