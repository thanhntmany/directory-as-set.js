/*!
 * directory-as-set.js
 * Copyright(c) 2023 Thanhntmany
 */

'use strict';

const process = require('process');
const path = require('path');
const fs = require('fs');


/**
 * base operations:
 * - self
 * - intersect
 * - minus
 * - union
 * 
 */

/**
 * File system IO Handler (helper)
 */
var _join = path.join,
  _isAbsolute = path.isAbsolute,
  _relative = path.relative,
  _dirname = path.dirname,
  _resolve = path.resolve,
  _lstatSync = fs.lstatSync,
  _mkdirSync = fs.mkdirSync,
  _rmdirSync = fs.rmdirSync,
  _readdirSync = fs.readdirSync,
  _readFileSync = fs.readFileSync,
  _writeFileSync = fs.writeFileSync,
  _existsSync = fs.existsSync,
  _isDirectory = function (dirPath) { return _lstatSync(dirPath).isDirectory() };


function _tree(dirPath) {
  var out = [], curPath;
  _readdirSync(dirPath, { withFileTypes: true }).forEach(function (dirent) {
    out.push(curPath = _join(dirPath, dirent.name));
    if (dirent.isDirectory()) out = out.concat(_tree(curPath))
  });
  return out;
};

function _treeIntersect(baseDir, partnerDir) {
  var out = [], baseCurPath, partnerCurPath;

  if (!_existsSync(baseDir)) return [];
  _readdirSync(baseDir, { withFileTypes: true }).forEach(function (dirent) {
    if (_existsSync(partnerCurPath = _join(partnerDir, dirent.name))) {
      out.push(baseCurPath = _join(baseDir, dirent.name));
      if (dirent.isDirectory() && _isDirectory(partnerCurPath))
        out = out.concat(_treeIntersect(baseCurPath, partnerCurPath));
    }
  });
  return out;
};

function _treeExcept(baseDir, partnerDir) {
  var out = [], baseCurPath, partnerCurPath;
  if (!_existsSync(baseDir)) return [];
  _readdirSync(baseDir, { withFileTypes: true }).forEach(function (dirent) {
    if (!_existsSync(partnerCurPath = _join(partnerDir, dirent.name))) {
      out.push(baseCurPath = _join(baseDir, dirent.name));
      if (dirent.isDirectory()) out = out.concat(_tree(baseCurPath))
    }
    else {
      if (!_isDirectory(partnerCurPath)) return;
      out = out.concat(_treeExcept(_join(baseDir, dirent.name), partnerCurPath));
    };
  });
  return out;
};


function _joinMass(fromPath, toPaths) {
  return toPaths.map(function (filePath) {
    return _join(fromPath, filePath);
  });
};

function _relativeMass(fromPath, toPaths) {
  return toPaths.map(function (filePath) {
    return _relative(fromPath, filePath);
  });
};

function _treeInDir(dirPath, relativePath) {
  if (!_existsSync(_join(dirPath, relativePath || "."))) return [];
  return _relativeMass(dirPath, _tree(_join(dirPath, relativePath || ".")))
};

function _findFileInAncestor(findPath, dirPath) {
  dirPath = dirPath !== undefined ? _resolve(dirPath) : process.cwd();
  var _dirPath;

  do {
    if (_existsSync(_join(dirPath, findPath))) return dirPath;
    dirPath = _dirname(_dirPath = dirPath);
  }
  while (dirPath !== _dirPath)

  return undefined;
};

function _dirContains(dir, toPath) {
  var relative = _relative(dir, toPath);
  return relative === "" || relative && !relative.startsWith('..') && !path.isAbsolute(relative);
};

/**
 * Arrary as set Helper
 */
// optimized
const ArrayAsSetHelper = {

  select: function (arr, value) {
    if (!arr.includes(value)) arr.push(value)
    return arr;
  },

  deselect: function (arr, value) {
    var idx;
    if ((idx = arr.indexOf(value)) >= 0) arr.splice(idx, 1);
    return arr;
  },

  distinct: function (arr) {
    var out = [], listed = {}, l = 0, value;
    for (value of arr) if (listed[value] !== 1) listed[out[l++] = value] = 1;

    return out;
  },

  union: function () {
    return this.distinct(Array.from(arguments).flat())
  },

  intersect: function (arr1, arr2) {
    var out = [], l = 0, A, B, value;
    if (arr1.length < arr2.length) { A = arr1; B = arr2 }
    else { A = arr2; B = arr1 };

    for (value of A) if (B.includes(value)) out[l++] = value;
    return out;
  },

  except: function (arrB, arrP) {
    var out = [], l = 0, value;
    for (value of arrB) if (!arrP.includes(value)) out[l++] = value;
    return out;
  },

  //#TODO: have not tested yet
  keepMatchRegex: function (arr, pattern, flags) {
    return arr.filter((new RegExp(pattern, flags || "g")).test)
  },

  //#TODO: have not tested yet
  removeMatchRegex: function (arr, pattern, flags) {
    var test = (new RegExp(pattern, flags || "g")).test
    return arr.filter(function (el) { return !test(el) });
  },

};
const AAS = ArrayAsSetHelper;


/**
 * DASdirectory
 */
function DASdirectory(uriToDirectory) {
  if (!uriToDirectory) uriToDirectory = process.cwd();
  // #TODO:
  uriToDirectory = _resolve(uriToDirectory);
  this.uri = uriToDirectory;
  this.type = 'directory-as-set';
  this.path = _resolve(uriToDirectory);
};
const DASdirectory_proto = DASdirectory.prototype;

DASdirectory_proto.toJSON = function () {
  return this.uri;
};

DASdirectory_proto.toString = function () {
  return this.path;
};

DASdirectory_proto.ls = function (relativePath) {
  return _readdirSync(_join(this.path, relativePath || "."));
};

DASdirectory_proto.treeDir = function (relativePath) {
  return _treeInDir(this.path, relativePath);
};

DASdirectory_proto.treeDirIntersect = function (partner, relativePath) {
  if (relativePath === undefined) relativePath = ".";
  return _relativeMass(
    this.path,
    _treeIntersect(
      _join(this.path, relativePath),
      _join(partner.path, relativePath),
    )
  );
};

DASdirectory_proto.treeDirExcept = function (partner, relativePath) {
  if (relativePath === undefined) relativePath = ".";
  return _relativeMass(
    this.path,
    _treeExcept(
      _join(this.path, relativePath),
      _join(partner.path, relativePath),
    )
  );
};

/**
 * DASApp
 */
function DASApp(data) {
  if (data === undefined) data = {};

  this.isDryrun = data.isDryrun || false;
  this.anchorDir = data.anchorDir || undefined;

  this.selectedSet = data.selectedSet || [];
  this.stashSet = data.stashSet || {};

  this.alias = data.alias || {};
  this.setBase(data.base); // this.base = new DASdirectory(data.base);
  this.setPartner(data.partner); // this.partner = new DASdirectory(data.partner);

  this.relativePath = null;
};
const DASApp_proto = DASApp.prototype;

DASApp_proto.toJSON = function () {
  return {
    isDryrun: this.isDryrun,
    anchorDir: this.anchorDir,

    selectedSet: this.selectedSet,
    stashSet: this.stashSet,

    alias: this.alias,
    base: this.base.toJSON(),
    partner: this.partner.toJSON(),
  };
};

DASApp_proto.toString = function () {
  return JSON.stringify(this, null, 4);
};

// State handling
DASApp_proto.ANCHOR = ".das";
DASApp_proto.STATEFILE = "state.json";

DASApp_proto.findAnchor = function (dirPath) {
  return this.anchorDir = _findFileInAncestor(this.ANCHOR, dirPath || process.cwd()) || process.cwd();
};

DASApp_proto.getStateFilePath = function (anchorDir) {
  return _join(anchorDir || this.anchorDir, this.ANCHOR, this.STATEFILE);
};

DASApp_proto.init = function (anchorDir) {
  this.anchorDir = anchorDir || process.cwd();
  var stateFile = this.getStateFilePath(this.anchorDir);
  _mkdirSync(_dirname(stateFile), { recursive: true });
  return this;
};

DASApp_proto.clean = function () {
  var stateFile = this.getStateFilePath(this.anchorDir);
  _rmdirSync(_dirname(stateFile), { force: true, recursive: true });
  this.anchorDir = undefined;
  return this;
};

DASApp_proto.loadState = function (anchorDir) {
  if (!anchorDir) anchorDir = this.findAnchor();
  if (!_existsSync(anchorDir)) return process.cwd();

  var stateFile = this.getStateFilePath(anchorDir);
  if (!_existsSync(stateFile)) return;

  anchorDir = _dirname(_dirname(stateFile));

  var data = JSON.parse(_readFileSync(stateFile, 'utf8'));
  data.anchorDir = anchorDir;

  // #TODO: make sure every case work properly.
  var _alias = data.alias, alia;

  for (alia in _alias) _alias[alia] = _join(anchorDir, _alias[alia]);
  data.base = _join(anchorDir, data.base);
  data.partner = _join(anchorDir, data.partner);

  var cwd = process.cwd();
  if (!_dirContains(data.base, cwd)) {
    var curBasePath = data.base;

    if (_dirContains(data.partner, cwd)) {
      data.base = data.partner;
      data.partner = curBasePath;
    }
    else {
      for (alia in _alias) if (_dirContains((curBasePath = _alias[alia]), cwd)) {
        data.base = curBasePath;
        break;
      };
    };
  };

  this.constructor.call(this, data);
  this.relativePath = _relative(this.base.path, cwd);
};


DASApp_proto.saveState = function (anchorDir) {
  if (anchorDir !== undefined) this.anchorDir = anchorDir;

  var _anchorDir = this.anchorDir;
  var stateFile = this.getStateFilePath(_anchorDir);
  if (!_existsSync(_dirname(stateFile))) return;


  var data = this.toJSON();
  data.base = _relative(_anchorDir, data.base);
  data.partner = _relative(_anchorDir, data.partner);

  var _alias = data.alias, alia;
  for (alia in _alias) _alias[alia] = _relative(_anchorDir, _alias[alia]);

  delete data.anchorDir;
  _mkdirSync(_dirname(stateFile), { recursive: true });
  _writeFileSync(stateFile, JSON.stringify(data, null, 4));
};

DASApp_proto.showState = function () {
  var out = '';

  out += "Anchor Directory : " + this.anchorDir + path.sep + "\n";

  if (Object.keys(this.alias).length > 0) {
    out += "Alias :\n";
    var pad = Math.max.apply(null, Object.keys(this.alias).map(function (a) { return a.length }));
    for (var alia in this.alias) {
      out += "  (" + alia.padEnd(pad, " ") + ") " + _relative(this.anchorDir, this.alias[alia]) + path.sep + "\n";
    };
    out += "\n";
  };

  out += "Base      : (" + this.getAliasOf(this.base.path) + ") " + _relative(this.anchorDir, this.base.path) + path.sep + "\n";
  out += "⑅ Partner : (" + this.getAliasOf(this.partner.path) + ") " + _relative(this.anchorDir, this.partner.path) + path.sep + "\n";
  out += "\n";

  if (this.relativePath === null) return out;

  var _relativePath = this.relativePath;
  var cwd = process.cwd();
  var selectedArray = this.selectedSet;
  var selectedInCurDirArray = selectedArray.filter(function (rPath) {
    return _dirContains(cwd, _join(this.base.path, rPath))
  }, this)

  out += "Selected  : " + selectedArray.length + "\n";
  out += "[ " + (selectedArray.length - selectedInCurDirArray.length) + " ] : ...\n";
  out += "[ " + selectedInCurDirArray.length + " ] : " + _relativePath + path.sep + "\n";

  var baseOwnSection = this.getBaseOwnSection(_relativePath);
  var partnerOwnSection = this.getPartnerOwnSection(_relativePath);
  var lsSet = AAS.union(selectedInCurDirArray, baseOwnSection, partnerOwnSection);

  var intersectSection = this.getInterSection(_relativePath);
  var baseSection = this.getBaseSection(_relativePath);
  var partnerSection = this.getPartnerSection(_relativePath);


  out += lsSet.sort()
    .map(function (rPath) {
      return ""
        + (selectedInCurDirArray.includes(rPath) ? "X" : " ") + "  "
        + (baseSection.includes(rPath) ? "b" : " ") + "  "
        + (intersectSection.includes(rPath) ? "i" : " ") + "  "
        + (partnerSection.includes(rPath) ? "p" : " ") + "  "
        + _relative(_relativePath, rPath)
    })
    .join("\n");

  return out;
};

// debug XXXXXXXXXXXXXXXXXXXXXX
DASApp_proto.xxx = function () {
  console.log("base:", this.base.path);
  console.log("relativePath:", this.relativePath);
  return this;
};

// Base
DASApp_proto.setBase = function (inputString) {
  this.base = new DASdirectory(this.realia(inputString));
  return this.base;
};

DASApp_proto.getBase = function (inputString) {
  return this.base;
};

// Partner
DASApp_proto.setPartner = function (inputString) {
  this.partner = new DASdirectory(this.realia(inputString));
  return this.partner;
};

DASApp_proto.getPartner = function (inputString) {
  return this.partner;
};

// Partner Alias
DASApp_proto.setAlias = function (inputString) {
  return this.alias[inputString] = this.partner.uri;
};

DASApp_proto.realia = function (inputString) {
  return this.alias.hasOwnProperty(inputString)
    ? this.alias[inputString]
    : inputString;
};

DASApp_proto.getAliasOf = function (targetPath) {
  if (targetPath === undefined) targetPath = process.cwd();

  var _alias = this.alias, alia;
  for (alia in _alias) if (_dirContains(_alias[alia], targetPath)) return alia;
  return "";
};

DASApp_proto.clearAlias = function () {
  this.alias = {};
};

// Intersection Sections operations 
DASApp_proto.getBaseOwnSection = function (relativePath) {
  return this.base.treeDir(relativePath || this.relativePath);
};

DASApp_proto.getPartnerOwnSection = function (relativePath) {
  return this.partner.treeDir(relativePath || this.relativePath);
};

DASApp_proto.getBaseSection = function (relativePath) {
  return this.base.treeDirExcept(this.partner, relativePath || this.relativePath);
};

DASApp_proto.getInterSection = function (relativePath) {
  return this.base.treeDirIntersect(this.partner, relativePath || this.relativePath);
};

DASApp_proto.getPartnerSection = function (relativePath) {
  return this.partner.treeDirExcept(this.base, relativePath || this.relativePath);
};

// Selection
DASApp_proto.normalizePath = function (filePath) {
  return _isAbsolute(filePath)
    ? _relative(_join(this.base.path, this.relativePath), filePath)
    : _join(this.relativePath, filePath);
};

DASApp_proto.select = function () {
  return this.selectedSet = AAS.union(this.selectedSet, Array.from(arguments).map(this.normalizePath, this))
};
DASApp_proto.select.expectedLength = -1;

DASApp_proto.selectSet = function (rpSet) {
  return this.selectedSet = AAS.union(this.selectedSet, rpSet)
};

DASApp_proto.selectBase = function () {
  return this.selectSet(this.getBaseSection());
};

DASApp_proto.selectInter = function () {
  return this.selectSet(this.getInterSection());
};

DASApp_proto.selectPartner = function () {
  return this.selectSet(this.getPartnerSection());
};

DASApp_proto.deselect = function () {
  return this.selectedSet = AAS.except(this.selectedSet, Array.from(arguments).map(this.normalizePath, this))
};
DASApp_proto.deselect.expectedLength = -1;

DASApp_proto.deselectSet = function (rpSet) {
  return this.selectedSet = AAS.except(this.selectedSet, rpSet)
};

DASApp_proto.deselectBase = function () {
  return this.deselectSet(this.getBaseSection());
};

DASApp_proto.deselectInter = function () {
  return this.deselectSet(this.getInterSection());
};

DASApp_proto.deselectPartner = function () {
  return this.deselectSet(this.getPartnerSection());
};

DASApp_proto.getSelectedSet = function () {
  return this.selectedSet;
};

//#TODO: have not tested yet
DASApp_proto.keepMatchRegex = function (pattern, flags) {
  return this.selectedSet = AAS.keepMatchRegex(this.selectedSet, pattern, flags);
};

//#TODO: have not tested yet
DASApp_proto.removeMatchRegex = function (pattern, flags) {
  return this.selectedSet = AAS.removeMatchRegex(this.selectedSet, pattern, flags);
};

DASApp_proto.clearSelectedSet = function () {
  return this.selectedSet = [];
};

DASApp_proto.stashSelectedSet = function (key) {
  if (key === undefined) key = Object.keys(this.stashSet).length;
  this.stashSet[key] = this.selectedSet.slice();
  return key
};

DASApp_proto.unstashSelectedSet = function (key) {
  this.selectedSet = this.stashSet[key];
  delete this.stashSet[key];
  return this.selectedSet
};

//#TODO: have not tested yet
DASApp_proto.unionStash = function (key) {
  return this.selectedSet = AAS.union(this.selectedSet, this.stashSet[key])
};

//#TODO: have not tested yet
DASApp_proto.intersectStash = function (key) {
  return this.selectedSet = AAS.intersect(this.selectedSet, this.stashSet[key])
};

//#TODO: have not tested yet
DASApp_proto.exceptStash = function (key) {
  return this.selectedSet = AAS.except(this.selectedSet, this.stashSet[key])
};

DASApp_proto.clearStashSet = function () {
  this.stashSet = {};
};

// Operating with selected set of relative-path
//#TODO:
DASApp_proto.copyFrom = function (key) {

};

//#TODO:
DASApp_proto.copyTo = function (key) {
};

//#TODO:
DASApp_proto.moveFrom = function (key) {
};

//#TODO:
DASApp_proto.moveTo = function (key) {
};

//#TODO:
DASApp_proto.remove = function (key) {
};

//#TODO:
DASApp_proto.removeAt = function (key) {
};

//#TODO:
DASApp_proto.touch = function (key) {
};

//#TODO:
DASApp_proto.touchAt = function (key) {
};

DASApp_proto.nop = function (key) {
  // Do nothing
};

DASApp_proto.setDryrunMode = function (isDryrun) {
  this.isDryrun = (isDryrun.toLowerCase() === "on");
};

//#TODO:
DASApp_proto.complete = function () {
};


/**
 * DASCmdRunner - Executing commandline 
 */

DASApp_proto.cmd = function (args) {
  return new DASCmdRunner(this, args);
};

DASApp_proto.exec = function (args) {
  return this.cmd(args).exec();
};

function DASCmdRunner(app, args) {
  this.app = app;
  this.restArgs = args;
  this.curCmdName = null;
  this.queue = [];
  this.lastOutput = null;
};
const DASCmdRunner_proto = DASCmdRunner.prototype;

/* DASApp command alias */
DASCmdRunner_proto.cmdAlias = {
  "constructor": "nop",
  "cmd": "nop",
  "cmdAlias": "nop",
  "getCmd": "nop",
  "exec": "nop",

  "a": "setAlias",
  "ra": "realia",
  "cas": "clearAlias",

  "b": "setBase",
  "base": "setBase",
  "gb": "getBase",
  "p": "setPartner",
  "partner": "setPartner",
  "gp": "getPartner",

  "s": "select",
  "s-": "select",
  "sb": "selectBase",
  "si": "selectInter",
  "sio": "selectInterOlder",
  "sin": "selectInterNewer",
  "sp": "selectPartner",

  "d": "deselect",
  "d-": "deselect",
  "db": "deselectBase",
  "di": "deselectInter",
  "dio": "deselectInterOlder",
  "din": "deselectInterNewer",
  "dp": "deselectPartner",

  "kmr": "keepMatchRegex",
  "rmr": "removeMatchRegex",
  "ls": "getSelectedSet",
  "cls": "clearSelectedSet",

  "cpf": "copyFrom",
  "cpt": "copyTo",
  "mvf": "moveFrom",
  "mvr": "moveTo",
  "rmf": "remove",
  "rmt": "removeAt",
  "tof": "touch",
  "tot": "touchAt",

  "older": "selectInterOlder",
  "newer": "selectInterNewer",

  "state": "showState",
  "status": "showState",

  "pull": "copyFrom",
  "push": "copyTo",
  "take": "moveFrom",
  "give": "moveTo",
  "dryrun": "setDryrunMode",

  "stash": "stashSelectedSet",
  "unstash": "unstashSelectedSet",
  "us": "unionStash",
  "is": "intersectStash",
  "es": "exceptStash",
  "clearstash": "clearStashSet",
  "clss": "clearStashSet",
};

DASCmdRunner_proto.cmdParsersMap = {

};

// Helper
function camelize(str) {
  return str.toLowerCase().replace(/(\-\w)/g, function () {
    return arguments[arguments.length - 3].replace("-", "").toUpperCase();
  });
};

DASCmdRunner_proto.normalizeCmd = function (cmd) {
  cmd = camelize(cmd);
  if (cmd.toLowerCase() in this.cmdAlias) cmd = this.cmdAlias[cmd.toLowerCase()];
  if (cmd in this.app && this.app[cmd] instanceof Function) return cmd;

  // #TODO: Adress undefined command here
  return "nop";
};

DASCmdRunner_proto.nextArg = function () {
  return this.restArgs.shift();
};

DASCmdRunner_proto.giveBackArg = function () {
  var _ = this.restArgs;
  return _.unshift.apply(_, arguments);
};

DASCmdRunner_proto.getCmdMaxNoParams = function (cmd) {
  var fn = this.app[cmd]
  if (typeof fn === 'function') {
    return fn.expectedLength !== undefined
      ? fn.expectedLength
      : fn.length;
  };

  return 0;
};

DASCmdRunner_proto.parseNext = function (maxNoParams) {

  var args = [], arg;
  if (maxNoParams < 0) {
    while ((arg = this.nextArg()) !== undefined && arg !== "--")
      args.push(arg);
  }
  else if (maxNoParams > 0) {
    while (args.length < maxNoParams && (arg = this.nextArg()) !== undefined && arg !== "--")
      args.push(arg);
  };

  this.queue.push({
    cmd: this.curCmdName,
    args: args,
  });

};

DASCmdRunner_proto.parse = function () {
  var cmdName, parseType;
  while ((cmdName = this.nextArg()) !== undefined) {
    if (cmdName === "--") continue;

    this.curCmdName = this.normalizeCmd(cmdName);
    this.parseNext(this.getCmdMaxNoParams(this.curCmdName));
  };

};

DASCmdRunner_proto.exec = function () {
  this.parse();

  var app = this.app, queue = this.queue, curCmd;
  while ((curCmd = queue.shift()) !== undefined) {
    this.lastOutput = app[curCmd.cmd].apply(app, curCmd.args)
  };

  return this.lastOutput;
};

/**
 * Expose `createApp()` + Core classes
 */
function createApp() {
  return new DASApp();
};

exports = module.exports = DASApp;
exports.createApp = createApp;
exports.DASApp = DASApp;
exports.DASdirectory = DASdirectory;


/**
 * Run module as an independent application.
 */
// Check if this module is being run directly or without entry script.
if (require.main === module || require.main === undefined || require.main.id === '.') {
  var args = process.argv.slice(2);

  const app = createApp();
  app.loadState();

  if (args.length === 0) args.push("status");
  var out = app.cmd(args).exec();
  console.log(
    out
      ? (
        Array.isArray(out)
          ? out.sort().join("\n")
          : out.toString
            ? out.toString()
            : out.toJSON
              ? out.toJSON()
              : out
      )
      : out
  );

  if (app.anchorDir) app.saveState();
};
