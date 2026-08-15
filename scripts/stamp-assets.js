#!/usr/bin/env node
"use strict";

var fs = require("fs");
var path = require("path");

var version = (
  process.env.GITHUB_SHA ||
  process.env.ASSET_VERSION ||
  Date.now().toString(36)
).slice(0, 12);

var publicDir = path.join(__dirname, "..", "public");
var files = ["index.html", "session.html"];

files.forEach(function (file) {
  var filePath = path.join(publicDir, file);
  if (!fs.existsSync(filePath)) return;

  var html = fs.readFileSync(filePath, "utf8");
  var next = html
    .replace(/(assets\/[^"'?\s]+)\?v=[^"'&\s]*/g, "$1?v=" + version)
    .replace(/(assets\/[^"'?\s]+)(?=["'])/g, "$1?v=" + version);
  fs.writeFileSync(filePath, next);
  console.log("stamped " + file + " -> v=" + version);
});
