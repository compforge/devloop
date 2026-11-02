#!/usr/bin/env node
import { createRequire } from "node:module"; const require = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/graceful-fs/polyfills.js
var require_polyfills = __commonJS({
  "node_modules/graceful-fs/polyfills.js"(exports, module) {
    var constants3 = __require("constants");
    var origCwd = process.cwd;
    var cwd2 = null;
    var platform = process.env.GRACEFUL_FS_PLATFORM || process.platform;
    process.cwd = function() {
      if (!cwd2)
        cwd2 = origCwd.call(process);
      return cwd2;
    };
    try {
      process.cwd();
    } catch (er) {
    }
    if (typeof process.chdir === "function") {
      chdir = process.chdir;
      process.chdir = function(d) {
        cwd2 = null;
        chdir.call(process, d);
      };
      if (Object.setPrototypeOf) Object.setPrototypeOf(process.chdir, chdir);
    }
    var chdir;
    module.exports = patch;
    function patch(fs) {
      if (constants3.hasOwnProperty("O_SYMLINK") && process.version.match(/^v0\.6\.[0-2]|^v0\.5\./)) {
        patchLchmod(fs);
      }
      if (!fs.lutimes) {
        patchLutimes(fs);
      }
      fs.chown = chownFix(fs.chown);
      fs.fchown = chownFix(fs.fchown);
      fs.lchown = chownFix(fs.lchown);
      fs.chmod = chmodFix(fs.chmod);
      fs.fchmod = chmodFix(fs.fchmod);
      fs.lchmod = chmodFix(fs.lchmod);
      fs.chownSync = chownFixSync(fs.chownSync);
      fs.fchownSync = chownFixSync(fs.fchownSync);
      fs.lchownSync = chownFixSync(fs.lchownSync);
      fs.chmodSync = chmodFixSync(fs.chmodSync);
      fs.fchmodSync = chmodFixSync(fs.fchmodSync);
      fs.lchmodSync = chmodFixSync(fs.lchmodSync);
      fs.stat = statFix(fs.stat);
      fs.fstat = statFix(fs.fstat);
      fs.lstat = statFix(fs.lstat);
      fs.statSync = statFixSync(fs.statSync);
      fs.fstatSync = statFixSync(fs.fstatSync);
      fs.lstatSync = statFixSync(fs.lstatSync);
      if (fs.chmod && !fs.lchmod) {
        fs.lchmod = function(path, mode, cb) {
          if (cb) process.nextTick(cb);
        };
        fs.lchmodSync = function() {
        };
      }
      if (fs.chown && !fs.lchown) {
        fs.lchown = function(path, uid, gid, cb) {
          if (cb) process.nextTick(cb);
        };
        fs.lchownSync = function() {
        };
      }
      if (platform === "win32") {
        fs.rename = typeof fs.rename !== "function" ? fs.rename : (function(fs$rename) {
          function rename2(from, to, cb) {
            var start = Date.now();
            var backoff = 0;
            fs$rename(from, to, function CB(er) {
              if (er && (er.code === "EACCES" || er.code === "EPERM" || er.code === "EBUSY") && Date.now() - start < 6e4) {
                setTimeout(function() {
                  fs.stat(to, function(stater, st) {
                    if (stater && stater.code === "ENOENT")
                      fs$rename(from, to, CB);
                    else
                      cb(er);
                  });
                }, backoff);
                if (backoff < 100)
                  backoff += 10;
                return;
              }
              if (cb) cb(er);
            });
          }
          if (Object.setPrototypeOf) Object.setPrototypeOf(rename2, fs$rename);
          return rename2;
        })(fs.rename);
      }
      fs.read = typeof fs.read !== "function" ? fs.read : (function(fs$read) {
        function read2(fd, buffer, offset, length, position, callback_) {
          var callback;
          if (callback_ && typeof callback_ === "function") {
            var eagCounter = 0;
            callback = function(er, _, __) {
              if (er && er.code === "EAGAIN" && eagCounter < 10) {
                eagCounter++;
                return fs$read.call(fs, fd, buffer, offset, length, position, callback);
              }
              callback_.apply(this, arguments);
            };
          }
          return fs$read.call(fs, fd, buffer, offset, length, position, callback);
        }
        if (Object.setPrototypeOf) Object.setPrototypeOf(read2, fs$read);
        return read2;
      })(fs.read);
      fs.readSync = typeof fs.readSync !== "function" ? fs.readSync : /* @__PURE__ */ (function(fs$readSync) {
        return function(fd, buffer, offset, length, position) {
          var eagCounter = 0;
          while (true) {
            try {
              return fs$readSync.call(fs, fd, buffer, offset, length, position);
            } catch (er) {
              if (er.code === "EAGAIN" && eagCounter < 10) {
                eagCounter++;
                continue;
              }
              throw er;
            }
          }
        };
      })(fs.readSync);
      function patchLchmod(fs2) {
        fs2.lchmod = function(path, mode, callback) {
          fs2.open(
            path,
            constants3.O_WRONLY | constants3.O_SYMLINK,
            mode,
            function(err, fd) {
              if (err) {
                if (callback) callback(err);
                return;
              }
              fs2.fchmod(fd, mode, function(err2) {
                fs2.close(fd, function(err22) {
                  if (callback) callback(err2 || err22);
                });
              });
            }
          );
        };
        fs2.lchmodSync = function(path, mode) {
          var fd = fs2.openSync(path, constants3.O_WRONLY | constants3.O_SYMLINK, mode);
          var threw = true;
          var ret;
          try {
            ret = fs2.fchmodSync(fd, mode);
            threw = false;
          } finally {
            if (threw) {
              try {
                fs2.closeSync(fd);
              } catch (er) {
              }
            } else {
              fs2.closeSync(fd);
            }
          }
          return ret;
        };
      }
      function patchLutimes(fs2) {
        if (constants3.hasOwnProperty("O_SYMLINK") && fs2.futimes) {
          fs2.lutimes = function(path, at, mt, cb) {
            fs2.open(path, constants3.O_SYMLINK, function(er, fd) {
              if (er) {
                if (cb) cb(er);
                return;
              }
              fs2.futimes(fd, at, mt, function(er2) {
                fs2.close(fd, function(er22) {
                  if (cb) cb(er2 || er22);
                });
              });
            });
          };
          fs2.lutimesSync = function(path, at, mt) {
            var fd = fs2.openSync(path, constants3.O_SYMLINK);
            var ret;
            var threw = true;
            try {
              ret = fs2.futimesSync(fd, at, mt);
              threw = false;
            } finally {
              if (threw) {
                try {
                  fs2.closeSync(fd);
                } catch (er) {
                }
              } else {
                fs2.closeSync(fd);
              }
            }
            return ret;
          };
        } else if (fs2.futimes) {
          fs2.lutimes = function(_a, _b, _c, cb) {
            if (cb) process.nextTick(cb);
          };
          fs2.lutimesSync = function() {
          };
        }
      }
      function chmodFix(orig) {
        if (!orig) return orig;
        return function(target, mode, cb) {
          return orig.call(fs, target, mode, function(er) {
            if (chownErOk(er)) er = null;
            if (cb) cb.apply(this, arguments);
          });
        };
      }
      function chmodFixSync(orig) {
        if (!orig) return orig;
        return function(target, mode) {
          try {
            return orig.call(fs, target, mode);
          } catch (er) {
            if (!chownErOk(er)) throw er;
          }
        };
      }
      function chownFix(orig) {
        if (!orig) return orig;
        return function(target, uid, gid, cb) {
          return orig.call(fs, target, uid, gid, function(er) {
            if (chownErOk(er)) er = null;
            if (cb) cb.apply(this, arguments);
          });
        };
      }
      function chownFixSync(orig) {
        if (!orig) return orig;
        return function(target, uid, gid) {
          try {
            return orig.call(fs, target, uid, gid);
          } catch (er) {
            if (!chownErOk(er)) throw er;
          }
        };
      }
      function statFix(orig) {
        if (!orig) return orig;
        return function(target, options, cb) {
          if (typeof options === "function") {
            cb = options;
            options = null;
          }
          function callback(er, stats) {
            if (stats) {
              if (stats.uid < 0) stats.uid += 4294967296;
              if (stats.gid < 0) stats.gid += 4294967296;
            }
            if (cb) cb.apply(this, arguments);
          }
          return options ? orig.call(fs, target, options, callback) : orig.call(fs, target, callback);
        };
      }
      function statFixSync(orig) {
        if (!orig) return orig;
        return function(target, options) {
          var stats = options ? orig.call(fs, target, options) : orig.call(fs, target);
          if (stats) {
            if (stats.uid < 0) stats.uid += 4294967296;
            if (stats.gid < 0) stats.gid += 4294967296;
          }
          return stats;
        };
      }
      function chownErOk(er) {
        if (!er)
          return true;
        if (er.code === "ENOSYS")
          return true;
        var nonroot = !process.getuid || process.getuid() !== 0;
        if (nonroot) {
          if (er.code === "EINVAL" || er.code === "EPERM")
            return true;
        }
        return false;
      }
    }
  }
});

// node_modules/graceful-fs/legacy-streams.js
var require_legacy_streams = __commonJS({
  "node_modules/graceful-fs/legacy-streams.js"(exports, module) {
    var Stream = __require("stream").Stream;
    module.exports = legacy;
    function legacy(fs) {
      return {
        ReadStream,
        WriteStream
      };
      function ReadStream(path, options) {
        if (!(this instanceof ReadStream)) return new ReadStream(path, options);
        Stream.call(this);
        var self = this;
        this.path = path;
        this.fd = null;
        this.readable = true;
        this.paused = false;
        this.flags = "r";
        this.mode = 438;
        this.bufferSize = 64 * 1024;
        options = options || {};
        var keys = Object.keys(options);
        for (var index = 0, length = keys.length; index < length; index++) {
          var key = keys[index];
          this[key] = options[key];
        }
        if (this.encoding) this.setEncoding(this.encoding);
        if (this.start !== void 0) {
          if ("number" !== typeof this.start) {
            throw TypeError("start must be a Number");
          }
          if (this.end === void 0) {
            this.end = Infinity;
          } else if ("number" !== typeof this.end) {
            throw TypeError("end must be a Number");
          }
          if (this.start > this.end) {
            throw new Error("start must be <= end");
          }
          this.pos = this.start;
        }
        if (this.fd !== null) {
          process.nextTick(function() {
            self._read();
          });
          return;
        }
        fs.open(this.path, this.flags, this.mode, function(err, fd) {
          if (err) {
            self.emit("error", err);
            self.readable = false;
            return;
          }
          self.fd = fd;
          self.emit("open", fd);
          self._read();
        });
      }
      function WriteStream(path, options) {
        if (!(this instanceof WriteStream)) return new WriteStream(path, options);
        Stream.call(this);
        this.path = path;
        this.fd = null;
        this.writable = true;
        this.flags = "w";
        this.encoding = "binary";
        this.mode = 438;
        this.bytesWritten = 0;
        options = options || {};
        var keys = Object.keys(options);
        for (var index = 0, length = keys.length; index < length; index++) {
          var key = keys[index];
          this[key] = options[key];
        }
        if (this.start !== void 0) {
          if ("number" !== typeof this.start) {
            throw TypeError("start must be a Number");
          }
          if (this.start < 0) {
            throw new Error("start must be >= zero");
          }
          this.pos = this.start;
        }
        this.busy = false;
        this._queue = [];
        if (this.fd === null) {
          this._open = fs.open;
          this._queue.push([this._open, this.path, this.flags, this.mode, void 0]);
          this.flush();
        }
      }
    }
  }
});

// node_modules/graceful-fs/clone.js
var require_clone = __commonJS({
  "node_modules/graceful-fs/clone.js"(exports, module) {
    "use strict";
    module.exports = clone;
    var getPrototypeOf = Object.getPrototypeOf || function(obj) {
      return obj.__proto__;
    };
    function clone(obj) {
      if (obj === null || typeof obj !== "object")
        return obj;
      if (obj instanceof Object)
        var copy = { __proto__: getPrototypeOf(obj) };
      else
        var copy = /* @__PURE__ */ Object.create(null);
      Object.getOwnPropertyNames(obj).forEach(function(key) {
        Object.defineProperty(copy, key, Object.getOwnPropertyDescriptor(obj, key));
      });
      return copy;
    }
  }
});

// node_modules/graceful-fs/graceful-fs.js
var require_graceful_fs = __commonJS({
  "node_modules/graceful-fs/graceful-fs.js"(exports, module) {
    var fs = __require("fs");
    var polyfills = require_polyfills();
    var legacy = require_legacy_streams();
    var clone = require_clone();
    var util = __require("util");
    var gracefulQueue;
    var previousSymbol;
    if (typeof Symbol === "function" && typeof Symbol.for === "function") {
      gracefulQueue = /* @__PURE__ */ Symbol.for("graceful-fs.queue");
      previousSymbol = /* @__PURE__ */ Symbol.for("graceful-fs.previous");
    } else {
      gracefulQueue = "___graceful-fs.queue";
      previousSymbol = "___graceful-fs.previous";
    }
    function noop() {
    }
    function publishQueue(context, queue2) {
      Object.defineProperty(context, gracefulQueue, {
        get: function() {
          return queue2;
        }
      });
    }
    var debug = noop;
    if (util.debuglog)
      debug = util.debuglog("gfs4");
    else if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || ""))
      debug = function() {
        var m = util.format.apply(util, arguments);
        m = "GFS4: " + m.split(/\n/).join("\nGFS4: ");
        console.error(m);
      };
    if (!fs[gracefulQueue]) {
      queue = global[gracefulQueue] || [];
      publishQueue(fs, queue);
      fs.close = (function(fs$close) {
        function close(fd, cb) {
          return fs$close.call(fs, fd, function(err) {
            if (!err) {
              resetQueue();
            }
            if (typeof cb === "function")
              cb.apply(this, arguments);
          });
        }
        Object.defineProperty(close, previousSymbol, {
          value: fs$close
        });
        return close;
      })(fs.close);
      fs.closeSync = (function(fs$closeSync) {
        function closeSync3(fd) {
          fs$closeSync.apply(fs, arguments);
          resetQueue();
        }
        Object.defineProperty(closeSync3, previousSymbol, {
          value: fs$closeSync
        });
        return closeSync3;
      })(fs.closeSync);
      if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || "")) {
        process.on("exit", function() {
          debug(fs[gracefulQueue]);
          __require("assert").equal(fs[gracefulQueue].length, 0);
        });
      }
    }
    var queue;
    if (!global[gracefulQueue]) {
      publishQueue(global, fs[gracefulQueue]);
    }
    module.exports = patch(clone(fs));
    if (process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !fs.__patched) {
      module.exports = patch(fs);
      fs.__patched = true;
    }
    function patch(fs2) {
      polyfills(fs2);
      fs2.gracefulify = patch;
      fs2.createReadStream = createReadStream;
      fs2.createWriteStream = createWriteStream;
      var fs$readFile = fs2.readFile;
      fs2.readFile = readFile2;
      function readFile2(path, options, cb) {
        if (typeof options === "function")
          cb = options, options = null;
        return go$readFile(path, options, cb);
        function go$readFile(path2, options2, cb2, startTime) {
          return fs$readFile(path2, options2, function(err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$readFile, [path2, options2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$writeFile = fs2.writeFile;
      fs2.writeFile = writeFile;
      function writeFile(path, data, options, cb) {
        if (typeof options === "function")
          cb = options, options = null;
        return go$writeFile(path, data, options, cb);
        function go$writeFile(path2, data2, options2, cb2, startTime) {
          return fs$writeFile(path2, data2, options2, function(err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$writeFile, [path2, data2, options2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$appendFile = fs2.appendFile;
      if (fs$appendFile)
        fs2.appendFile = appendFile;
      function appendFile(path, data, options, cb) {
        if (typeof options === "function")
          cb = options, options = null;
        return go$appendFile(path, data, options, cb);
        function go$appendFile(path2, data2, options2, cb2, startTime) {
          return fs$appendFile(path2, data2, options2, function(err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$appendFile, [path2, data2, options2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$copyFile = fs2.copyFile;
      if (fs$copyFile)
        fs2.copyFile = copyFile;
      function copyFile(src, dest, flags, cb) {
        if (typeof flags === "function") {
          cb = flags;
          flags = 0;
        }
        return go$copyFile(src, dest, flags, cb);
        function go$copyFile(src2, dest2, flags2, cb2, startTime) {
          return fs$copyFile(src2, dest2, flags2, function(err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$copyFile, [src2, dest2, flags2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$readdir = fs2.readdir;
      fs2.readdir = readdir2;
      var noReaddirOptionVersions = /^v[0-5]\./;
      function readdir2(path, options, cb) {
        if (typeof options === "function")
          cb = options, options = null;
        var go$readdir = noReaddirOptionVersions.test(process.version) ? function go$readdir2(path2, options2, cb2, startTime) {
          return fs$readdir(path2, fs$readdirCallback(
            path2,
            options2,
            cb2,
            startTime
          ));
        } : function go$readdir2(path2, options2, cb2, startTime) {
          return fs$readdir(path2, options2, fs$readdirCallback(
            path2,
            options2,
            cb2,
            startTime
          ));
        };
        return go$readdir(path, options, cb);
        function fs$readdirCallback(path2, options2, cb2, startTime) {
          return function(err, files) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([
                go$readdir,
                [path2, options2, cb2],
                err,
                startTime || Date.now(),
                Date.now()
              ]);
            else {
              if (files && files.sort)
                files.sort();
              if (typeof cb2 === "function")
                cb2.call(this, err, files);
            }
          };
        }
      }
      if (process.version.substr(0, 4) === "v0.8") {
        var legStreams = legacy(fs2);
        ReadStream = legStreams.ReadStream;
        WriteStream = legStreams.WriteStream;
      }
      var fs$ReadStream = fs2.ReadStream;
      if (fs$ReadStream) {
        ReadStream.prototype = Object.create(fs$ReadStream.prototype);
        ReadStream.prototype.open = ReadStream$open;
      }
      var fs$WriteStream = fs2.WriteStream;
      if (fs$WriteStream) {
        WriteStream.prototype = Object.create(fs$WriteStream.prototype);
        WriteStream.prototype.open = WriteStream$open;
      }
      Object.defineProperty(fs2, "ReadStream", {
        get: function() {
          return ReadStream;
        },
        set: function(val) {
          ReadStream = val;
        },
        enumerable: true,
        configurable: true
      });
      Object.defineProperty(fs2, "WriteStream", {
        get: function() {
          return WriteStream;
        },
        set: function(val) {
          WriteStream = val;
        },
        enumerable: true,
        configurable: true
      });
      var FileReadStream = ReadStream;
      Object.defineProperty(fs2, "FileReadStream", {
        get: function() {
          return FileReadStream;
        },
        set: function(val) {
          FileReadStream = val;
        },
        enumerable: true,
        configurable: true
      });
      var FileWriteStream = WriteStream;
      Object.defineProperty(fs2, "FileWriteStream", {
        get: function() {
          return FileWriteStream;
        },
        set: function(val) {
          FileWriteStream = val;
        },
        enumerable: true,
        configurable: true
      });
      function ReadStream(path, options) {
        if (this instanceof ReadStream)
          return fs$ReadStream.apply(this, arguments), this;
        else
          return ReadStream.apply(Object.create(ReadStream.prototype), arguments);
      }
      function ReadStream$open() {
        var that = this;
        open4(that.path, that.flags, that.mode, function(err, fd) {
          if (err) {
            if (that.autoClose)
              that.destroy();
            that.emit("error", err);
          } else {
            that.fd = fd;
            that.emit("open", fd);
            that.read();
          }
        });
      }
      function WriteStream(path, options) {
        if (this instanceof WriteStream)
          return fs$WriteStream.apply(this, arguments), this;
        else
          return WriteStream.apply(Object.create(WriteStream.prototype), arguments);
      }
      function WriteStream$open() {
        var that = this;
        open4(that.path, that.flags, that.mode, function(err, fd) {
          if (err) {
            that.destroy();
            that.emit("error", err);
          } else {
            that.fd = fd;
            that.emit("open", fd);
          }
        });
      }
      function createReadStream(path, options) {
        return new fs2.ReadStream(path, options);
      }
      function createWriteStream(path, options) {
        return new fs2.WriteStream(path, options);
      }
      var fs$open = fs2.open;
      fs2.open = open4;
      function open4(path, flags, mode, cb) {
        if (typeof mode === "function")
          cb = mode, mode = null;
        return go$open(path, flags, mode, cb);
        function go$open(path2, flags2, mode2, cb2, startTime) {
          return fs$open(path2, flags2, mode2, function(err, fd) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$open, [path2, flags2, mode2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      return fs2;
    }
    function enqueue(elem) {
      debug("ENQUEUE", elem[0].name, elem[1]);
      fs[gracefulQueue].push(elem);
      retry();
    }
    var retryTimer;
    function resetQueue() {
      var now2 = Date.now();
      for (var i = 0; i < fs[gracefulQueue].length; ++i) {
        if (fs[gracefulQueue][i].length > 2) {
          fs[gracefulQueue][i][3] = now2;
          fs[gracefulQueue][i][4] = now2;
        }
      }
      retry();
    }
    function retry() {
      clearTimeout(retryTimer);
      retryTimer = void 0;
      if (fs[gracefulQueue].length === 0)
        return;
      var elem = fs[gracefulQueue].shift();
      var fn = elem[0];
      var args = elem[1];
      var err = elem[2];
      var startTime = elem[3];
      var lastTime = elem[4];
      if (startTime === void 0) {
        debug("RETRY", fn.name, args);
        fn.apply(null, args);
      } else if (Date.now() - startTime >= 6e4) {
        debug("TIMEOUT", fn.name, args);
        var cb = args.pop();
        if (typeof cb === "function")
          cb.call(null, err);
      } else {
        var sinceAttempt = Date.now() - lastTime;
        var sinceStart = Math.max(lastTime - startTime, 1);
        var desiredDelay = Math.min(sinceStart * 1.2, 100);
        if (sinceAttempt >= desiredDelay) {
          debug("RETRY", fn.name, args);
          fn.apply(null, args.concat([startTime]));
        } else {
          fs[gracefulQueue].push(elem);
        }
      }
      if (retryTimer === void 0) {
        retryTimer = setTimeout(retry, 0);
      }
    }
  }
});

// node_modules/retry/lib/retry_operation.js
var require_retry_operation = __commonJS({
  "node_modules/retry/lib/retry_operation.js"(exports, module) {
    function RetryOperation(timeouts, options) {
      if (typeof options === "boolean") {
        options = { forever: options };
      }
      this._originalTimeouts = JSON.parse(JSON.stringify(timeouts));
      this._timeouts = timeouts;
      this._options = options || {};
      this._maxRetryTime = options && options.maxRetryTime || Infinity;
      this._fn = null;
      this._errors = [];
      this._attempts = 1;
      this._operationTimeout = null;
      this._operationTimeoutCb = null;
      this._timeout = null;
      this._operationStart = null;
      if (this._options.forever) {
        this._cachedTimeouts = this._timeouts.slice(0);
      }
    }
    module.exports = RetryOperation;
    RetryOperation.prototype.reset = function() {
      this._attempts = 1;
      this._timeouts = this._originalTimeouts;
    };
    RetryOperation.prototype.stop = function() {
      if (this._timeout) {
        clearTimeout(this._timeout);
      }
      this._timeouts = [];
      this._cachedTimeouts = null;
    };
    RetryOperation.prototype.retry = function(err) {
      if (this._timeout) {
        clearTimeout(this._timeout);
      }
      if (!err) {
        return false;
      }
      var currentTime = (/* @__PURE__ */ new Date()).getTime();
      if (err && currentTime - this._operationStart >= this._maxRetryTime) {
        this._errors.unshift(new Error("RetryOperation timeout occurred"));
        return false;
      }
      this._errors.push(err);
      var timeout = this._timeouts.shift();
      if (timeout === void 0) {
        if (this._cachedTimeouts) {
          this._errors.splice(this._errors.length - 1, this._errors.length);
          this._timeouts = this._cachedTimeouts.slice(0);
          timeout = this._timeouts.shift();
        } else {
          return false;
        }
      }
      var self = this;
      var timer = setTimeout(function() {
        self._attempts++;
        if (self._operationTimeoutCb) {
          self._timeout = setTimeout(function() {
            self._operationTimeoutCb(self._attempts);
          }, self._operationTimeout);
          if (self._options.unref) {
            self._timeout.unref();
          }
        }
        self._fn(self._attempts);
      }, timeout);
      if (this._options.unref) {
        timer.unref();
      }
      return true;
    };
    RetryOperation.prototype.attempt = function(fn, timeoutOps) {
      this._fn = fn;
      if (timeoutOps) {
        if (timeoutOps.timeout) {
          this._operationTimeout = timeoutOps.timeout;
        }
        if (timeoutOps.cb) {
          this._operationTimeoutCb = timeoutOps.cb;
        }
      }
      var self = this;
      if (this._operationTimeoutCb) {
        this._timeout = setTimeout(function() {
          self._operationTimeoutCb();
        }, self._operationTimeout);
      }
      this._operationStart = (/* @__PURE__ */ new Date()).getTime();
      this._fn(this._attempts);
    };
    RetryOperation.prototype.try = function(fn) {
      console.log("Using RetryOperation.try() is deprecated");
      this.attempt(fn);
    };
    RetryOperation.prototype.start = function(fn) {
      console.log("Using RetryOperation.start() is deprecated");
      this.attempt(fn);
    };
    RetryOperation.prototype.start = RetryOperation.prototype.try;
    RetryOperation.prototype.errors = function() {
      return this._errors;
    };
    RetryOperation.prototype.attempts = function() {
      return this._attempts;
    };
    RetryOperation.prototype.mainError = function() {
      if (this._errors.length === 0) {
        return null;
      }
      var counts = {};
      var mainError = null;
      var mainErrorCount = 0;
      for (var i = 0; i < this._errors.length; i++) {
        var error = this._errors[i];
        var message = error.message;
        var count = (counts[message] || 0) + 1;
        counts[message] = count;
        if (count >= mainErrorCount) {
          mainError = error;
          mainErrorCount = count;
        }
      }
      return mainError;
    };
  }
});

// node_modules/retry/lib/retry.js
var require_retry = __commonJS({
  "node_modules/retry/lib/retry.js"(exports) {
    var RetryOperation = require_retry_operation();
    exports.operation = function(options) {
      var timeouts = exports.timeouts(options);
      return new RetryOperation(timeouts, {
        forever: options && options.forever,
        unref: options && options.unref,
        maxRetryTime: options && options.maxRetryTime
      });
    };
    exports.timeouts = function(options) {
      if (options instanceof Array) {
        return [].concat(options);
      }
      var opts = {
        retries: 10,
        factor: 2,
        minTimeout: 1 * 1e3,
        maxTimeout: Infinity,
        randomize: false
      };
      for (var key in options) {
        opts[key] = options[key];
      }
      if (opts.minTimeout > opts.maxTimeout) {
        throw new Error("minTimeout is greater than maxTimeout");
      }
      var timeouts = [];
      for (var i = 0; i < opts.retries; i++) {
        timeouts.push(this.createTimeout(i, opts));
      }
      if (options && options.forever && !timeouts.length) {
        timeouts.push(this.createTimeout(i, opts));
      }
      timeouts.sort(function(a, b) {
        return a - b;
      });
      return timeouts;
    };
    exports.createTimeout = function(attempt, opts) {
      var random = opts.randomize ? Math.random() + 1 : 1;
      var timeout = Math.round(random * opts.minTimeout * Math.pow(opts.factor, attempt));
      timeout = Math.min(timeout, opts.maxTimeout);
      return timeout;
    };
    exports.wrap = function(obj, options, methods) {
      if (options instanceof Array) {
        methods = options;
        options = null;
      }
      if (!methods) {
        methods = [];
        for (var key in obj) {
          if (typeof obj[key] === "function") {
            methods.push(key);
          }
        }
      }
      for (var i = 0; i < methods.length; i++) {
        var method = methods[i];
        var original = obj[method];
        obj[method] = function retryWrapper(original2) {
          var op = exports.operation(options);
          var args = Array.prototype.slice.call(arguments, 1);
          var callback = args.pop();
          args.push(function(err) {
            if (op.retry(err)) {
              return;
            }
            if (err) {
              arguments[0] = op.mainError();
            }
            callback.apply(this, arguments);
          });
          op.attempt(function() {
            original2.apply(obj, args);
          });
        }.bind(obj, original);
        obj[method].options = options;
      }
    };
  }
});

// node_modules/retry/index.js
var require_retry2 = __commonJS({
  "node_modules/retry/index.js"(exports, module) {
    module.exports = require_retry();
  }
});

// node_modules/signal-exit/signals.js
var require_signals = __commonJS({
  "node_modules/signal-exit/signals.js"(exports, module) {
    module.exports = [
      "SIGABRT",
      "SIGALRM",
      "SIGHUP",
      "SIGINT",
      "SIGTERM"
    ];
    if (process.platform !== "win32") {
      module.exports.push(
        "SIGVTALRM",
        "SIGXCPU",
        "SIGXFSZ",
        "SIGUSR2",
        "SIGTRAP",
        "SIGSYS",
        "SIGQUIT",
        "SIGIOT"
        // should detect profiler and enable/disable accordingly.
        // see #21
        // 'SIGPROF'
      );
    }
    if (process.platform === "linux") {
      module.exports.push(
        "SIGIO",
        "SIGPOLL",
        "SIGPWR",
        "SIGSTKFLT",
        "SIGUNUSED"
      );
    }
  }
});

// node_modules/signal-exit/index.js
var require_signal_exit = __commonJS({
  "node_modules/signal-exit/index.js"(exports, module) {
    var process2 = global.process;
    var processOk = function(process3) {
      return process3 && typeof process3 === "object" && typeof process3.removeListener === "function" && typeof process3.emit === "function" && typeof process3.reallyExit === "function" && typeof process3.listeners === "function" && typeof process3.kill === "function" && typeof process3.pid === "number" && typeof process3.on === "function";
    };
    if (!processOk(process2)) {
      module.exports = function() {
        return function() {
        };
      };
    } else {
      assert = __require("assert");
      signals = require_signals();
      isWin = /^win/i.test(process2.platform);
      EE = __require("events");
      if (typeof EE !== "function") {
        EE = EE.EventEmitter;
      }
      if (process2.__signal_exit_emitter__) {
        emitter = process2.__signal_exit_emitter__;
      } else {
        emitter = process2.__signal_exit_emitter__ = new EE();
        emitter.count = 0;
        emitter.emitted = {};
      }
      if (!emitter.infinite) {
        emitter.setMaxListeners(Infinity);
        emitter.infinite = true;
      }
      module.exports = function(cb, opts) {
        if (!processOk(global.process)) {
          return function() {
          };
        }
        assert.equal(typeof cb, "function", "a callback must be provided for exit handler");
        if (loaded === false) {
          load2();
        }
        var ev = "exit";
        if (opts && opts.alwaysLast) {
          ev = "afterexit";
        }
        var remove = function() {
          emitter.removeListener(ev, cb);
          if (emitter.listeners("exit").length === 0 && emitter.listeners("afterexit").length === 0) {
            unload();
          }
        };
        emitter.on(ev, cb);
        return remove;
      };
      unload = function unload2() {
        if (!loaded || !processOk(global.process)) {
          return;
        }
        loaded = false;
        signals.forEach(function(sig) {
          try {
            process2.removeListener(sig, sigListeners[sig]);
          } catch (er) {
          }
        });
        process2.emit = originalProcessEmit;
        process2.reallyExit = originalProcessReallyExit;
        emitter.count -= 1;
      };
      module.exports.unload = unload;
      emit = function emit2(event, code, signal) {
        if (emitter.emitted[event]) {
          return;
        }
        emitter.emitted[event] = true;
        emitter.emit(event, code, signal);
      };
      sigListeners = {};
      signals.forEach(function(sig) {
        sigListeners[sig] = function listener() {
          if (!processOk(global.process)) {
            return;
          }
          var listeners = process2.listeners(sig);
          if (listeners.length === emitter.count) {
            unload();
            emit("exit", null, sig);
            emit("afterexit", null, sig);
            if (isWin && sig === "SIGHUP") {
              sig = "SIGINT";
            }
            process2.kill(process2.pid, sig);
          }
        };
      });
      module.exports.signals = function() {
        return signals;
      };
      loaded = false;
      load2 = function load3() {
        if (loaded || !processOk(global.process)) {
          return;
        }
        loaded = true;
        emitter.count += 1;
        signals = signals.filter(function(sig) {
          try {
            process2.on(sig, sigListeners[sig]);
            return true;
          } catch (er) {
            return false;
          }
        });
        process2.emit = processEmit;
        process2.reallyExit = processReallyExit;
      };
      module.exports.load = load2;
      originalProcessReallyExit = process2.reallyExit;
      processReallyExit = function processReallyExit2(code) {
        if (!processOk(global.process)) {
          return;
        }
        process2.exitCode = code || /* istanbul ignore next */
        0;
        emit("exit", process2.exitCode, null);
        emit("afterexit", process2.exitCode, null);
        originalProcessReallyExit.call(process2, process2.exitCode);
      };
      originalProcessEmit = process2.emit;
      processEmit = function processEmit2(ev, arg) {
        if (ev === "exit" && processOk(global.process)) {
          if (arg !== void 0) {
            process2.exitCode = arg;
          }
          var ret = originalProcessEmit.apply(this, arguments);
          emit("exit", process2.exitCode, null);
          emit("afterexit", process2.exitCode, null);
          return ret;
        } else {
          return originalProcessEmit.apply(this, arguments);
        }
      };
    }
    var assert;
    var signals;
    var isWin;
    var EE;
    var emitter;
    var unload;
    var emit;
    var sigListeners;
    var loaded;
    var load2;
    var originalProcessReallyExit;
    var processReallyExit;
    var originalProcessEmit;
    var processEmit;
  }
});

// node_modules/proper-lockfile/lib/mtime-precision.js
var require_mtime_precision = __commonJS({
  "node_modules/proper-lockfile/lib/mtime-precision.js"(exports, module) {
    "use strict";
    var cacheSymbol = /* @__PURE__ */ Symbol();
    function probe(file2, fs, callback) {
      const cachedPrecision = fs[cacheSymbol];
      if (cachedPrecision) {
        return fs.stat(file2, (err, stat) => {
          if (err) {
            return callback(err);
          }
          callback(null, stat.mtime, cachedPrecision);
        });
      }
      const mtime = new Date(Math.ceil(Date.now() / 1e3) * 1e3 + 5);
      fs.utimes(file2, mtime, mtime, (err) => {
        if (err) {
          return callback(err);
        }
        fs.stat(file2, (err2, stat) => {
          if (err2) {
            return callback(err2);
          }
          const precision = stat.mtime.getTime() % 1e3 === 0 ? "s" : "ms";
          Object.defineProperty(fs, cacheSymbol, { value: precision });
          callback(null, stat.mtime, precision);
        });
      });
    }
    function getMtime(precision) {
      let now2 = Date.now();
      if (precision === "s") {
        now2 = Math.ceil(now2 / 1e3) * 1e3;
      }
      return new Date(now2);
    }
    module.exports.probe = probe;
    module.exports.getMtime = getMtime;
  }
});

// node_modules/proper-lockfile/lib/lockfile.js
var require_lockfile = __commonJS({
  "node_modules/proper-lockfile/lib/lockfile.js"(exports, module) {
    "use strict";
    var path = __require("path");
    var fs = require_graceful_fs();
    var retry = require_retry2();
    var onExit = require_signal_exit();
    var mtimePrecision = require_mtime_precision();
    var locks = {};
    function getLockFile(file2, options) {
      return options.lockfilePath || `${file2}.lock`;
    }
    function resolveCanonicalPath(file2, options, callback) {
      if (!options.realpath) {
        return callback(null, path.resolve(file2));
      }
      options.fs.realpath(file2, callback);
    }
    function acquireLock(file2, options, callback) {
      const lockfilePath = getLockFile(file2, options);
      options.fs.mkdir(lockfilePath, (err) => {
        if (!err) {
          return mtimePrecision.probe(lockfilePath, options.fs, (err2, mtime, mtimePrecision2) => {
            if (err2) {
              options.fs.rmdir(lockfilePath, () => {
              });
              return callback(err2);
            }
            callback(null, mtime, mtimePrecision2);
          });
        }
        if (err.code !== "EEXIST") {
          return callback(err);
        }
        if (options.stale <= 0) {
          return callback(Object.assign(new Error("Lock file is already being held"), { code: "ELOCKED", file: file2 }));
        }
        options.fs.stat(lockfilePath, (err2, stat) => {
          if (err2) {
            if (err2.code === "ENOENT") {
              return acquireLock(file2, { ...options, stale: 0 }, callback);
            }
            return callback(err2);
          }
          if (!isLockStale(stat, options)) {
            return callback(Object.assign(new Error("Lock file is already being held"), { code: "ELOCKED", file: file2 }));
          }
          removeLock(file2, options, (err3) => {
            if (err3) {
              return callback(err3);
            }
            acquireLock(file2, { ...options, stale: 0 }, callback);
          });
        });
      });
    }
    function isLockStale(stat, options) {
      return stat.mtime.getTime() < Date.now() - options.stale;
    }
    function removeLock(file2, options, callback) {
      options.fs.rmdir(getLockFile(file2, options), (err) => {
        if (err && err.code !== "ENOENT") {
          return callback(err);
        }
        callback();
      });
    }
    function updateLock(file2, options) {
      const lock2 = locks[file2];
      if (lock2.updateTimeout) {
        return;
      }
      lock2.updateDelay = lock2.updateDelay || options.update;
      lock2.updateTimeout = setTimeout(() => {
        lock2.updateTimeout = null;
        options.fs.stat(lock2.lockfilePath, (err, stat) => {
          const isOverThreshold = lock2.lastUpdate + options.stale < Date.now();
          if (err) {
            if (err.code === "ENOENT" || isOverThreshold) {
              return setLockAsCompromised(file2, lock2, Object.assign(err, { code: "ECOMPROMISED" }));
            }
            lock2.updateDelay = 1e3;
            return updateLock(file2, options);
          }
          const isMtimeOurs = lock2.mtime.getTime() === stat.mtime.getTime();
          if (!isMtimeOurs) {
            return setLockAsCompromised(
              file2,
              lock2,
              Object.assign(
                new Error("Unable to update lock within the stale threshold"),
                { code: "ECOMPROMISED" }
              )
            );
          }
          const mtime = mtimePrecision.getMtime(lock2.mtimePrecision);
          options.fs.utimes(lock2.lockfilePath, mtime, mtime, (err2) => {
            const isOverThreshold2 = lock2.lastUpdate + options.stale < Date.now();
            if (lock2.released) {
              return;
            }
            if (err2) {
              if (err2.code === "ENOENT" || isOverThreshold2) {
                return setLockAsCompromised(file2, lock2, Object.assign(err2, { code: "ECOMPROMISED" }));
              }
              lock2.updateDelay = 1e3;
              return updateLock(file2, options);
            }
            lock2.mtime = mtime;
            lock2.lastUpdate = Date.now();
            lock2.updateDelay = null;
            updateLock(file2, options);
          });
        });
      }, lock2.updateDelay);
      if (lock2.updateTimeout.unref) {
        lock2.updateTimeout.unref();
      }
    }
    function setLockAsCompromised(file2, lock2, err) {
      lock2.released = true;
      if (lock2.updateTimeout) {
        clearTimeout(lock2.updateTimeout);
      }
      if (locks[file2] === lock2) {
        delete locks[file2];
      }
      lock2.options.onCompromised(err);
    }
    function lock(file2, options, callback) {
      options = {
        stale: 1e4,
        update: null,
        realpath: true,
        retries: 0,
        fs,
        onCompromised: (err) => {
          throw err;
        },
        ...options
      };
      options.retries = options.retries || 0;
      options.retries = typeof options.retries === "number" ? { retries: options.retries } : options.retries;
      options.stale = Math.max(options.stale || 0, 2e3);
      options.update = options.update == null ? options.stale / 2 : options.update || 0;
      options.update = Math.max(Math.min(options.update, options.stale / 2), 1e3);
      resolveCanonicalPath(file2, options, (err, file3) => {
        if (err) {
          return callback(err);
        }
        const operation = retry.operation(options.retries);
        operation.attempt(() => {
          acquireLock(file3, options, (err2, mtime, mtimePrecision2) => {
            if (operation.retry(err2)) {
              return;
            }
            if (err2) {
              return callback(operation.mainError());
            }
            const lock2 = locks[file3] = {
              lockfilePath: getLockFile(file3, options),
              mtime,
              mtimePrecision: mtimePrecision2,
              options,
              lastUpdate: Date.now()
            };
            updateLock(file3, options);
            callback(null, (releasedCallback) => {
              if (lock2.released) {
                return releasedCallback && releasedCallback(Object.assign(new Error("Lock is already released"), { code: "ERELEASED" }));
              }
              unlock(file3, { ...options, realpath: false }, releasedCallback);
            });
          });
        });
      });
    }
    function unlock(file2, options, callback) {
      options = {
        fs,
        realpath: true,
        ...options
      };
      resolveCanonicalPath(file2, options, (err, file3) => {
        if (err) {
          return callback(err);
        }
        const lock2 = locks[file3];
        if (!lock2) {
          return callback(Object.assign(new Error("Lock is not acquired/owned by you"), { code: "ENOTACQUIRED" }));
        }
        lock2.updateTimeout && clearTimeout(lock2.updateTimeout);
        lock2.released = true;
        delete locks[file3];
        removeLock(file3, options, callback);
      });
    }
    function check(file2, options, callback) {
      options = {
        stale: 1e4,
        realpath: true,
        fs,
        ...options
      };
      options.stale = Math.max(options.stale || 0, 2e3);
      resolveCanonicalPath(file2, options, (err, file3) => {
        if (err) {
          return callback(err);
        }
        options.fs.stat(getLockFile(file3, options), (err2, stat) => {
          if (err2) {
            return err2.code === "ENOENT" ? callback(null, false) : callback(err2);
          }
          return callback(null, !isLockStale(stat, options));
        });
      });
    }
    function getLocks() {
      return locks;
    }
    onExit(() => {
      for (const file2 in locks) {
        const options = locks[file2].options;
        try {
          options.fs.rmdirSync(getLockFile(file2, options));
        } catch (e) {
        }
      }
    });
    module.exports.lock = lock;
    module.exports.unlock = unlock;
    module.exports.check = check;
    module.exports.getLocks = getLocks;
  }
});

// node_modules/proper-lockfile/lib/adapter.js
var require_adapter = __commonJS({
  "node_modules/proper-lockfile/lib/adapter.js"(exports, module) {
    "use strict";
    var fs = require_graceful_fs();
    function createSyncFs(fs2) {
      const methods = ["mkdir", "realpath", "stat", "rmdir", "utimes"];
      const newFs = { ...fs2 };
      methods.forEach((method) => {
        newFs[method] = (...args) => {
          const callback = args.pop();
          let ret;
          try {
            ret = fs2[`${method}Sync`](...args);
          } catch (err) {
            return callback(err);
          }
          callback(null, ret);
        };
      });
      return newFs;
    }
    function toPromise(method) {
      return (...args) => new Promise((resolve14, reject) => {
        args.push((err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve14(result);
          }
        });
        method(...args);
      });
    }
    function toSync(method) {
      return (...args) => {
        let err;
        let result;
        args.push((_err, _result) => {
          err = _err;
          result = _result;
        });
        method(...args);
        if (err) {
          throw err;
        }
        return result;
      };
    }
    function toSyncOptions(options) {
      options = { ...options };
      options.fs = createSyncFs(options.fs || fs);
      if (typeof options.retries === "number" && options.retries > 0 || options.retries && typeof options.retries.retries === "number" && options.retries.retries > 0) {
        throw Object.assign(new Error("Cannot use retries with the sync api"), { code: "ESYNC" });
      }
      return options;
    }
    module.exports = {
      toPromise,
      toSync,
      toSyncOptions
    };
  }
});

// node_modules/proper-lockfile/index.js
var require_proper_lockfile = __commonJS({
  "node_modules/proper-lockfile/index.js"(exports, module) {
    "use strict";
    var lockfile2 = require_lockfile();
    var { toPromise, toSync, toSyncOptions } = require_adapter();
    async function lock(file2, options) {
      const release = await toPromise(lockfile2.lock)(file2, options);
      return toPromise(release);
    }
    function lockSync(file2, options) {
      const release = toSync(lockfile2.lock)(file2, toSyncOptions(options));
      return toSync(release);
    }
    function unlock(file2, options) {
      return toPromise(lockfile2.unlock)(file2, options);
    }
    function unlockSync(file2, options) {
      return toSync(lockfile2.unlock)(file2, toSyncOptions(options));
    }
    function check(file2, options) {
      return toPromise(lockfile2.check)(file2, options);
    }
    function checkSync(file2, options) {
      return toSync(lockfile2.check)(file2, toSyncOptions(options));
    }
    module.exports = lock;
    module.exports.lock = lock;
    module.exports.unlock = unlock;
    module.exports.lockSync = lockSync;
    module.exports.unlockSync = unlockSync;
    module.exports.check = check;
    module.exports.checkSync = checkSync;
  }
});

// hooks/runtime.ts
import { readFileSync as readFileSync10 } from "node:fs";

// domain/task-trigger.ts
import { spawn } from "node:child_process";
import { closeSync, existsSync as existsSync3, mkdirSync as mkdirSync2, openSync, readFileSync as readFileSync2, statSync as statSync3, unlinkSync, writeFileSync as writeFileSync2 } from "node:fs";
import { join as join6 } from "node:path";
import { fileURLToPath } from "node:url";

// node_modules/@compforge/repocli/dist/inspect.js
import { realpath as realpath2 } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

// node_modules/@compforge/repocli/dist/git.js
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { dirname, join } from "node:path";

// node_modules/@compforge/harness-common/dist/system/repository.js
function repositoryId(repository2) {
  return `${repository2.forge.name}/${repository2.path}`;
}

// node_modules/@compforge/harness-common/dist/system/pull-request.js
function pullRequestId(pr) {
  return `${repositoryId(pr.repository)}#${pr.number}`;
}

// node_modules/@compforge/repocli/dist/model.js
function owner(layout, path) {
  let found;
  for (const component of layout.components) {
    const root = component.root;
    if (root === "." || path === root || path.startsWith(root + "/")) {
      if (!found || found.root === "." || root.length > found.root.length)
        found = component;
    }
  }
  return found;
}
function repository(forge, path) {
  const value = { forge: { name: forge }, path };
  return Object.defineProperty(value, "id", { value: () => repositoryId(value) });
}

// node_modules/@compforge/repocli/dist/operations.js
import { spawnSync } from "node:child_process";
function runGit(repo, args, timeoutMs = 5e3, raw = false) {
  const result = spawnSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 16 << 20
  });
  const code = result.status ?? -1;
  return {
    code,
    stdout: raw || result.stdout?.includes("\0") ? result.stdout ?? "" : (result.stdout ?? "").trim(),
    stderr: (result.stderr || result.error?.message || "").trim(),
    ok: code === 0,
    uncertain: result.error?.code === "ETIMEDOUT"
  };
}
function changedPaths(repo) {
  const tracked = runGit(repo, ["diff", "--no-renames", "--name-only", "-z", "HEAD", "--"]);
  const untracked = runGit(repo, ["ls-files", "--others", "--exclude-standard", "-z"]);
  if (!tracked.ok || !untracked.ok)
    throw new Error(tracked.stderr || untracked.stderr);
  return [...new Set((tracked.stdout + untracked.stdout).split("\0").filter((p) => p && !p.endsWith("/")))];
}

// node_modules/@compforge/repocli/dist/remote.js
function parseRemoteUrl(value) {
  let host, path;
  if (value.includes("://")) {
    try {
      const url = new URL(value);
      if (url.protocol === "file:")
        return void 0;
      host = url.hostname;
      path = decodeURIComponent(url.pathname).replace(/^\//, "");
    } catch {
      return void 0;
    }
  } else {
    const colon = value.indexOf(":");
    if (colon < 0)
      return void 0;
    host = value.slice(0, colon).replace(/^[^@]*@/, "");
    if (host.includes("/") || host.includes("\\"))
      return void 0;
    path = value.slice(colon + 1);
  }
  path = path.replace(/\/$/, "").replace(/\.git$/, "");
  return host && path ? { host: host.toLowerCase(), path } : void 0;
}
function remote(repo, name = "origin") {
  const result = runGit(repo, ["remote", "get-url", "--", name]);
  return result.ok ? parseRemoteUrl(result.stdout) : void 0;
}

// node_modules/@compforge/repocli/dist/layout.js
import { posix } from "node:path";
var compare = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
var needsContent = (name) => posix.basename(name) === "package.json";
var validPath = (name) => name !== "" && name !== "." && name !== ".." && !name.includes("\0") && !name.includes("\\") && !name.startsWith("/") && !name.startsWith("../") && posix.normalize(name) === name && !name.endsWith("/");
function fromOrigin(origin) {
  const remote2 = parseRemoteUrl(origin);
  if (!remote2)
    return null;
  const { host, path } = remote2;
  return repository(host === "github.com" ? "github" : host === "gitlab.com" ? "gitlab" : host, path);
}
var excluded = /* @__PURE__ */ new Set(["node_modules", "vendor", "venv", "env", "dist", "build", "target", "__pycache__", "testdata"]);
var skip = (name) => name.split("/").slice(0, -1).some((p) => p.startsWith(".") || excluded.has(p));
var markers = [["python", "pyproject.toml", "setup.py"], ["go", "go.mod"], ["node", "package.json"], ["rust", "Cargo.toml"]];
function detectLanguage(files, root) {
  for (const [ecosystem, ...manifests] of markers) {
    for (const manifest of manifests) {
      const name = posix.join(root, manifest);
      if (!files.has(name))
        continue;
      if (ecosystem !== "node")
        return ecosystem;
      const text3 = files.get(name)?.toString().toLowerCase() ?? "";
      return text3.includes("typescript") || text3.includes("@types/") || files.has(posix.join(root, "tsconfig.json")) ? "typescript" : "javascript";
    }
  }
  return "";
}
function discover(files) {
  const candidates = /* @__PURE__ */ new Set();
  for (const name of files.keys()) {
    if (skip(name))
      continue;
    if (manifestEcosystem(name) || posix.basename(name) === "Makefile")
      candidates.add(posix.dirname(name));
  }
  return [...candidates].sort(compare);
}
function packageTools(files, root) {
  const found = /* @__PURE__ */ new Map();
  const add = (name, version, evidence) => {
    const tool = found.get(name) ?? { name, evidence: [] };
    if (version)
      tool.version = version;
    tool.evidence.push(evidence);
    found.set(name, tool);
  };
  const manifest = posix.join(root, "package.json");
  const data = files.get(manifest);
  if (data) {
    try {
      const metadata = object(JSON.parse(data.toString()));
      const manager = string(field(metadata, "packageManager"));
      const at = manager.indexOf("@");
      const name = at < 0 ? manager : manager.slice(0, at);
      if (["npm", "pnpm", "yarn", "bun"].includes(name))
        add(name, at < 0 ? "" : manager.slice(at + 1), manifest + "#packageManager");
    } catch {
    }
  }
  for (const [file2, tool] of [
    ["go.mod", "go"],
    ["uv.lock", "uv"],
    ["poetry.lock", "poetry"],
    ["Pipfile.lock", "pipenv"],
    ["package-lock.json", "npm"],
    ["npm-shrinkwrap.json", "npm"],
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lock", "bun"],
    ["bun.lockb", "bun"]
  ]) {
    const name = posix.join(root, file2);
    if (files.has(name))
      add(tool, "", name);
  }
  return [...found.values()].sort((a, b) => compare(a.name, b.name)).map((tool) => ({ ...tool, evidence: tool.evidence.sort(compare) }));
}
function object(value) {
  if (value == null)
    return {};
  if (typeof value !== "object" || Array.isArray(value))
    throw new Error("expected an object");
  return value;
}
function field(value, name) {
  return Object.entries(value).filter(([key]) => key.toLowerCase() === name.toLowerCase()).at(-1)?.[1];
}
function string(value) {
  if (value == null)
    return "";
  if (typeof value !== "string")
    throw new Error("expected a string");
  return value;
}
function load(files, origin) {
  const repo = fromOrigin(origin);
  const bindings = discover(files).map((root) => {
    const language = detectLanguage(files, root);
    const tools = packageTools(files, root);
    const manifests = [...files.keys()].filter((name) => posix.dirname(name) === root && manifestEcosystem(name)).sort(compare);
    const binding = {
      repository: repo ?? repository("", ""),
      name: root,
      root,
      products: [],
      ...language ? { language } : {},
      ...manifests.length ? { manifests } : {},
      ...tools.length ? { packageTools: tools } : {}
    };
    return binding;
  });
  return { repository: repo, components: bindings };
}
function manifestEcosystem(path) {
  return markers.find(([, ...names]) => names.includes(posix.basename(path)))?.[0] ?? "";
}

// node_modules/@compforge/repocli/dist/git.js
var maxFileBytes = 2 << 20;
var maxTotalBytes = 128 << 20;
var Git = class _Git {
  root;
  signal;
  constructor(root, signal) {
    this.root = root;
    this.signal = signal;
  }
  run(args, input, allowMissing = false, maxBuffer = 16 << 20) {
    this.signal.throwIfAborted();
    return new Promise((resolve14, reject) => {
      const child = execFile("git", ["-C", this.root, ...args], {
        encoding: "buffer",
        signal: this.signal,
        maxBuffer,
        killSignal: "SIGKILL"
      }, (error, stdout) => {
        if (error && !(allowMissing && error.code === 1))
          reject(error);
        else
          resolve14(stdout);
      });
      child.stdin?.on("error", () => {
      });
      child.stdin?.end(input);
    });
  }
  async gitlinkOID(name, oid) {
    const path = join(this.root, name);
    try {
      await lstat(join(path, ".git"));
    } catch (error) {
      if (error.code === "ENOENT")
        return oid;
      throw error;
    }
    if (await realpath(path) !== path)
      throw new Error(`symlinked gitlink checkout: ${name}`);
    const child = new _Git(path, this.signal);
    const root = (await child.run(["rev-parse", "--show-toplevel"])).toString().replace(/\n$/, "");
    if (root !== path)
      throw new Error(`invalid gitlink checkout: ${name}`);
    return (await child.run(["rev-parse", "--verify", "HEAD"])).toString().trim();
  }
  async catalog(head, staged) {
    const committed = head !== "" || staged;
    const output = await this.run(head ? ["ls-tree", "-r", "-z", "--full-tree", head] : ["ls-files", "--stage", "-z"]);
    const entries = /* @__PURE__ */ new Map();
    for (const entry of output.toString().split("\0")) {
      if (!entry)
        continue;
      const tab = entry.indexOf("	");
      const name = entry.slice(tab + 1);
      const fields = entry.slice(0, tab).split(/\s+/);
      if (tab < 0 || fields.length !== 3 || !validPath(name))
        throw new Error("invalid Git catalog entry");
      if (!head && fields[2] !== "0")
        throw new Error(`unmerged index entry: ${name}`);
      if (fields[0] === "160000")
        continue;
      if (fields[0] === "120000" && committed) {
        if (needsContent(name))
          throw new Error(`metadata ${name} is a symlink`);
        continue;
      }
      if (!["100644", "100755", "120000"].includes(fields[0]))
        throw new Error(`unsupported Git entry mode for ${name}`);
      entries.set(name, fields[head ? 2 : 1]);
    }
    if (!committed) {
      const others = await this.run(["ls-files", "-z", "--others", "--exclude-standard"]);
      for (const name of others.toString().split("\0")) {
        if (!name || name.endsWith("/"))
          continue;
        if (!validPath(name))
          throw new Error("unsafe repository path");
        entries.set(name, "");
      }
    }
    if (entries.size > 1e4)
      throw new Error("repository exceeds 10000 files");
    const files = /* @__PURE__ */ new Map();
    const selected = [];
    let total = 0;
    for (const name of [...entries.keys()].sort(compare)) {
      this.signal.throwIfAborted();
      if (committed) {
        files.set(name, null);
        if (needsContent(name))
          selected.push([name, entries.get(name)]);
        continue;
      }
      const full = join(this.root, name);
      let info;
      try {
        info = await lstat(full);
      } catch (error) {
        if (error.code === "ENOENT")
          continue;
        throw error;
      }
      if (!info.isFile()) {
        if (needsContent(name))
          throw new Error(`metadata ${name} is not a regular file`);
        continue;
      }
      if (await realpath(dirname(full)) !== dirname(full)) {
        if (needsContent(name))
          throw new Error(`metadata ${name} has a symlinked directory`);
        continue;
      }
      files.set(name, null);
      if (!needsContent(name))
        continue;
      if (info.size > maxFileBytes)
        throw new Error(`metadata ${name} exceeds ${maxFileBytes} bytes`);
      const file2 = await open(full, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        if (!(await file2.stat()).isFile())
          throw new Error(`metadata ${name} is not a regular file`);
        const buffer = Buffer.alloc(maxFileBytes + 1);
        let used = 0;
        while (used < buffer.length) {
          this.signal.throwIfAborted();
          const { bytesRead } = await file2.read(buffer, used, buffer.length - used, null);
          if (!bytesRead)
            break;
          used += bytesRead;
        }
        if (used > maxFileBytes)
          throw new Error(`metadata ${name} exceeds ${maxFileBytes} bytes`);
        total += used;
        if (total > maxTotalBytes)
          throw new Error("metadata exceeds 128 MiB");
        files.set(name, Buffer.from(buffer.subarray(0, used)));
      } finally {
        await file2.close();
      }
    }
    if (selected.length)
      await this.readBlobs(selected, files);
    return files;
  }
  async readBlobs(selected, files) {
    const input = selected.map(([, oid]) => oid).join("\n") + "\n";
    const checked = (await this.run(["cat-file", "--batch-check"], input)).toString().trimEnd().split("\n");
    if (checked.length !== selected.length)
      throw new Error("invalid Git blob batch");
    let total = 0;
    const sizes = checked.map((line, i) => {
      const [oid, type, sizeText] = line.split(" ");
      const size = Number(sizeText);
      if (oid !== selected[i][1] || type !== "blob" || !Number.isSafeInteger(size) || size < 0)
        throw new Error("invalid Git blob");
      if (size > maxFileBytes)
        throw new Error(`metadata ${selected[i][0]} exceeds ${maxFileBytes} bytes`);
      total += size;
      if (total > maxTotalBytes)
        throw new Error("metadata exceeds 128 MiB");
      return size;
    });
    const data = await this.run(["cat-file", "--batch"], input, false, total + selected.length * 128);
    let offset = 0;
    selected.forEach(([name, oid], i) => {
      const end = data.indexOf(10, offset);
      if (end < 0 || data.subarray(offset, end).toString() !== `${oid} blob ${sizes[i]}`)
        throw new Error("invalid Git blob header");
      offset = end + 1;
      if (data[offset + sizes[i]] !== 10)
        throw new Error("truncated Git blob");
      files.set(name, Buffer.from(data.subarray(offset, offset + sizes[i])));
      offset += sizes[i] + 1;
    });
    if (offset !== data.length)
      throw new Error("unexpected Git blob bytes");
  }
};

// node_modules/@compforge/repocli/dist/inspect.js
async function inspect(options = {}) {
  if (options.head && options.staged)
    throw new Error("head and staged are mutually exclusive");
  const timeout = options.timeoutMs ?? 5e3;
  if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > 2147483647)
    throw new Error("timeoutMs must be a positive 32-bit integer");
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new Error("inspection timed out")), timeout);
  timer.unref();
  const signal = options.signal ? AbortSignal.any([options.signal, deadline.signal]) : deadline.signal;
  try {
    signal.throwIfAborted();
    const initial = new Git(options.repository || process.cwd(), signal);
    const root = await realpath2((await initial.run(["rev-parse", "--show-toplevel"])).toString().replace(/\n$/, ""));
    const git = new Git(root, signal);
    const head = options.head ? (await git.run(["rev-parse", "--verify", "--end-of-options", options.head + "^{commit}"])).toString().trim() : "";
    const files = await git.catalog(head, options.staged ?? false);
    const origin = (await git.run(["config", "--get", "remote.origin.url"], void 0, true)).toString().trimEnd();
    const layout = load(files, origin);
    const complete = head !== "" || isDeepStrictEqual(files, await git.catalog(head, options.staged ?? false));
    signal.throwIfAborted();
    return {
      ...layout,
      schemaVersion: 1,
      checkout: root,
      input: head ? "commit" : options.staged ? "index" : "working_tree",
      ...head ? { head } : {},
      complete,
      diagnostics: complete ? [] : [{ code: "inspection_changed", message: "repository paths or layout metadata changed during inspection" }]
    };
  } finally {
    clearTimeout(timer);
  }
}

// node_modules/@compforge/repocli/dist/git-state.js
import { existsSync, realpathSync, lstatSync, statSync } from "node:fs";
import { join as join2, dirname as dirname2, basename } from "node:path";
function gitPath(repo, name) {
  const result = runGit(repo, ["rev-parse", "--path-format=absolute", "--git-path", name], 5e3, true);
  if (!result.ok || !result.stdout)
    throw new Error(`cannot resolve Git metadata path ${JSON.stringify(name)}: ${result.stderr}`);
  return result.stdout.replace(/\n$/, "");
}
function currentBranch(repo) {
  const result = runGit(repo, ["branch", "--show-current"]);
  if (!result.ok)
    throw new Error(`cannot read current branch: ${result.stderr}`);
  return result.stdout || void 0;
}
function divergence(repo, target) {
  const head = revParse(repo, "HEAD");
  const other = revParse(repo, target);
  if (!head || !other)
    return void 0;
  const result = runGit(repo, ["rev-list", "--count", "--left-right", `${head}...${other}`]);
  const values = result.stdout.split(/\s+/);
  if (!result.ok || values.length !== 2 || !values.every((v) => /^\d+$/.test(v))) {
    throw new Error(`cannot count divergence from ${target}: ${result.stderr || result.stdout}`);
  }
  return [Number(values[0]), Number(values[1])];
}
function aheadBehind(repo, target = "main") {
  return divergence(repo, `refs/remotes/origin/${target}`);
}
function workspaceStatus(repo) {
  const result = runGit(repo, ["status", "--porcelain"]);
  if (!result.ok)
    return { dirty: false, complete: false, modifiedCount: 0, untrackedCount: 0 };
  const lines = result.stdout.split("\n").filter(Boolean);
  return {
    dirty: lines.length > 0,
    complete: true,
    modifiedCount: lines.filter((line) => !line.startsWith("??")).length,
    untrackedCount: lines.filter((line) => line.startsWith("??")).length
  };
}
function revParse(repo, ref) {
  const result = runGit(repo, ["rev-parse", "--verify", "--quiet", "--end-of-options", ref]);
  if (result.ok && result.stdout)
    return result.stdout;
  if (result.code === 1 && !result.stderr)
    return "";
  throw new Error(`cannot resolve revision ${ref}: ${result.stderr || result.stdout}`);
}
function headSha(repo) {
  return revParse(repo, "HEAD");
}
function targetExists(repo, target = "main") {
  return revParse(repo, `refs/remotes/origin/${target}`) !== "";
}
function isAncestor(repo, ancestor, descendant) {
  if (!ancestor || !descendant)
    throw new Error("ancestry requires two revisions");
  const result = runGit(repo, ["merge-base", "--is-ancestor", "--", ancestor, descendant]);
  if (result.code === 0 || result.code === 1)
    return result.code === 0;
  throw new Error(`cannot compare ancestry ${ancestor} -> ${descendant}: ${result.stderr}`);
}
function listWorktrees(repo) {
  const result = runGit(repo, ["worktree", "list", "--porcelain", "-z"]);
  if (!result.ok)
    throw new Error(result.stderr || "cannot list worktrees");
  const entries = [];
  for (const block of result.stdout.split("\0\0")) {
    const fields = new Map(block.split("\0").filter((line) => line.includes(" ")).map((line) => {
      const space = line.indexOf(" ");
      return [line.slice(0, space), line.slice(space + 1)];
    }));
    const path = fields.get("worktree");
    const branch = fields.get("branch")?.replace(/^refs\/heads\//, "");
    if (path)
      entries.push({ path, sha: fields.get("HEAD") ?? "", ...branch ? { branch } : {} });
  }
  return entries;
}
function checkoutInfo(repo) {
  const query = (path, flag) => {
    const result = runGit(path, ["rev-parse", "--path-format=absolute", flag], 5e3, true);
    if (!result.ok || !result.stdout)
      throw new Error(result.stderr || `cannot resolve ${flag}`);
    return realpathSync(result.stdout.replace(/\n$/, ""));
  };
  const root = query(repo, "--show-toplevel");
  if (!existsSync(join2(root, ".git")))
    throw new Error("Git metadata directory is not a checkout");
  const gitDir = query(repo, "--git-dir");
  const commonDir = query(repo, "--git-common-dir");
  const first = listWorktrees(repo)[0];
  let mainRoot;
  if (first) {
    try {
      const candidate = query(first.path, "--show-toplevel");
      if (existsSync(join2(candidate, ".git")) && query(candidate, "--git-common-dir") === commonDir)
        mainRoot = candidate;
    } catch {
    }
  }
  return { root, gitDir, commonDir, linked: gitDir !== commonDir, ...mainRoot ? { mainRoot } : {} };
}
function listCheckouts(repo) {
  const info = checkoutInfo(repo);
  const main = info.linked ? info.mainRoot : info.root;
  return listWorktrees(repo).flatMap((entry, index) => {
    if (!entry.sha)
      return [];
    const path = index === 0 ? main : entry.path;
    return [{
      ...path === void 0 ? {} : { path },
      sha: entry.sha,
      ...entry.branch ? { branch: entry.branch } : {},
      primary: index === 0
    }];
  });
}
function mainRepoRoot(repo) {
  return checkoutInfo(repo).mainRoot;
}
function localBranches(repo) {
  const result = runGit(repo, ["for-each-ref", "--sort=refname", "--format=%(refname:short)%00%(objectname)", "refs/heads"]);
  const branches = /* @__PURE__ */ new Map();
  if (!result.ok)
    throw new Error(result.stderr || "cannot list local branches");
  for (const line of result.stdout.split("\n")) {
    const [name, sha] = line.split("\0");
    if (name && sha)
      branches.set(name, sha);
  }
  return branches;
}
function findCheckout(directory) {
  const start = realpathSync(directory);
  if (!statSync(start).isDirectory())
    throw new Error(`not a directory: ${directory}`);
  for (let candidate = start; ; candidate = dirname2(candidate)) {
    if (basename(candidate) === ".git")
      return void 0;
    let present = true;
    try {
      lstatSync(join2(candidate, ".git"));
    } catch (error) {
      if (error.code === "ENOENT")
        present = false;
      else
        throw error;
    }
    if (present) {
      const result = runGit(candidate, ["rev-parse", "--show-toplevel"], 5e3, true);
      if (!result.ok || !result.stdout)
        throw new Error(result.stderr || "cannot discover checkout");
      const root = result.stdout.replace(/\n$/, "");
      if (realpathSync(root) !== candidate)
        throw new Error("Git environment does not match discovered checkout");
      return root;
    }
    if (dirname2(candidate) === candidate)
      return void 0;
  }
}

// node_modules/@compforge/repocli/dist/snapshot.js
import { createHash } from "node:crypto";
import { constants as constants2 } from "node:fs";
import { lstat as lstat2, open as open2, readlink, realpath as realpath3 } from "node:fs/promises";
import { dirname as dirname3, join as join3, posix as posix2 } from "node:path";
async function snapshot(repository2, options = {}) {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 3e4);
  const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
  const root = await realpath3((await new Git(repository2, signal).run(["rev-parse", "--show-toplevel"])).toString().replace(/\n$/, ""));
  const first = await capture(root, signal);
  const second = await capture(root, signal);
  return first.digest === second.digest ? second : { ...second, complete: false, diagnostics: [...second.diagnostics, "snapshot_changed"] };
}
function frame(name, data) {
  return Buffer.concat([Buffer.from(`${Buffer.byteLength(name)}:${name}${data.length}:`), data]);
}
function sorted(names) {
  return [...names].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
}
async function capture(root, signal) {
  const git = new Git(root, signal);
  const entries = /* @__PURE__ */ new Map();
  for (const record2 of (await git.run(["ls-files", "--stage", "-z"])).toString().split("\0")) {
    if (!record2)
      continue;
    const tab = record2.indexOf("	");
    const [mode, oid, stage] = record2.slice(0, tab).split(" ");
    if (tab < 0 || stage !== "0")
      throw new Error("unmerged or invalid index");
    entries.set(record2.slice(tab + 1), [mode, oid]);
  }
  for (const name of (await git.run(["ls-files", "--others", "--exclude-standard", "-z"])).toString().split("\0")) {
    if (name && !name.endsWith("/") && !entries.has(name))
      entries.set(name, ["", ""]);
  }
  if (entries.size > 1e4)
    throw new Error("repository exceeds 10000 files");
  const digest2 = createHash("sha256").update("repocli-snapshot-v2\0");
  const files = /* @__PURE__ */ new Set();
  const links = /* @__PURE__ */ new Map();
  const modules = /* @__PURE__ */ new Map();
  const large = /* @__PURE__ */ new Map();
  const issues = [];
  let total = 0;
  for (const name of sorted(entries.keys())) {
    signal.throwIfAborted();
    const path = join3(root, name);
    if (entries.get(name)[0] === "160000") {
      modules.set(name, await git.gitlinkOID(name, entries.get(name)[1]));
      continue;
    }
    let info;
    try {
      info = await lstat2(path);
      if (await realpath3(dirname3(path)) !== dirname3(path)) {
        issues.push(`${name}: symlinked parent`);
        continue;
      }
    } catch (error) {
      if (error.code === "ENOENT")
        continue;
      throw error;
    }
    if (info.isSymbolicLink())
      links.set(name, await readlink(path));
    else if (info.isFile()) {
      const file2 = await open2(path, constants2.O_RDONLY | constants2.O_NOFOLLOW | constants2.O_NONBLOCK);
      try {
        if (!(await file2.stat()).isFile())
          throw new Error("file changed kind during snapshot");
        const chunks = [];
        const h = createHash("sha256");
        const buffer = Buffer.alloc(65536);
        let size = 0;
        while (true) {
          signal.throwIfAborted();
          const { bytesRead } = await file2.read(buffer, 0, buffer.length, null);
          if (!bytesRead)
            break;
          size += bytesRead;
          if (info.size > 2 << 20)
            h.update(buffer.subarray(0, bytesRead));
          else {
            if (size > 2 << 20)
              throw new Error("file grew during snapshot");
            chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
          }
        }
        if (info.size > 2 << 20)
          large.set(name, `${size}:sha256:${h.digest("hex")}`);
        else {
          total += size;
          if (total > 128 << 20)
            throw new Error("snapshot exceeds 128 MiB");
          digest2.update(frame(name, Buffer.concat(chunks)));
        }
        files.add(name);
      } finally {
        await file2.close();
      }
    } else
      issues.push(`${name}: unsupported file kind`);
  }
  for (const name of links.keys()) {
    let current = name;
    const seen = /* @__PURE__ */ new Set();
    while (links.has(current)) {
      const target = links.get(current);
      if (seen.has(current) || posix2.isAbsolute(target)) {
        current = "";
        break;
      }
      seen.add(current);
      current = posix2.normalize(posix2.join(posix2.dirname(current), target));
      if (current === ".." || current.startsWith("../")) {
        current = "";
        break;
      }
    }
    const captured = files.has(current) || modules.has(current) || current !== "" && [...files].some((f) => current === "." || f.startsWith(current + "/"));
    if (!captured)
      issues.push(`${name}: symlink target is outside captured contents or cyclic/missing`);
  }
  for (const [kind, values] of [["symlink", links], ["gitlink", modules], ["large_file", large]]) {
    for (const name of sorted(values.keys()))
      digest2.update(Buffer.concat([Buffer.from(kind + ":"), frame(name, Buffer.from(values.get(name)))]));
  }
  for (const issue of sorted(issues))
    digest2.update(`issue:${Buffer.byteLength(issue)}:${issue}`);
  return { checkout: root, digest: `sha256:${digest2.digest("hex")}`, fileCount: files.size, complete: issues.length === 0, diagnostics: issues };
}

// node_modules/@compforge/repocli/dist/forge/model.js
var ForgeError = class extends Error {
};
var ForgeCoverageError = class extends ForgeError {
};
var ForgeAuthError = class extends ForgeError {
};
var ForgeNotFound = class extends ForgeError {
};
var ForgeRateLimitError = class extends ForgeError {
  retryAfterMs;
  constructor(message, retryAfterMs2) {
    super(message);
    this.retryAfterMs = retryAfterMs2;
    this.name = "ForgeRateLimitError";
  }
};

// node_modules/@compforge/repocli/dist/forge/key.js
function pullRequestKey(forge, path, number3) {
  return { repository: { forge: { name: forge }, path }, number: number3 };
}
function assertPullRequestKey(value, forge) {
  if (value.repository.forge.name !== forge)
    throw new Error(`PullRequest forge ${value.repository.forge.name} does not match ${forge}`);
  if (!Number.isSafeInteger(value.number) || value.number < 1)
    throw new Error("PullRequest number must be a positive safe integer");
  if (!value.repository.path || value.repository.path.split("/").some((p) => !p || p === "." || p === ".."))
    throw new Error("Invalid PullRequest repository path");
}

// node_modules/@compforge/repocli/dist/forge/query.js
import { createHash as createHash2 } from "node:crypto";
function connectionKey(provider, forge, endpoint, token) {
  return createHash2("sha256").update(JSON.stringify([provider, forge, endpoint, token])).digest("hex");
}
function scopeKey(scope, forge) {
  if (!scope || scope.kind !== "account" && scope.kind !== "repository")
    throw new Error("Invalid PullRequest query scope");
  if (scope.kind === "repository")
    assertPullRequestKey({ repository: scope.repository, number: 1 }, forge);
  if ((scope.kind === "account" || scope.author !== void 0) && !/^[a-zA-Z0-9_.-]+$/.test(scope.author ?? "")) {
    throw new Error("PullRequest author requires a platform username");
  }
  return JSON.stringify([scope.kind, scope.kind === "repository" ? scope.repository.path : null, scope.author?.toLowerCase() ?? null]);
}
function queryKey(query, forge) {
  const scope = scopeKey(query.scope, forge);
  if (!["all", "open", "closed", "merged"].includes(query.state ?? "all"))
    throw new Error("Invalid PullRequest query state");
  const start = query.updatedAfter === void 0 ? void 0 : Date.parse(query.updatedAfter);
  const end = query.updatedBefore === void 0 ? void 0 : Date.parse(query.updatedBefore);
  if (start !== void 0 && !Number.isFinite(start) || end !== void 0 && !Number.isFinite(end) || start !== void 0 && end !== void 0 && start > end)
    throw new Error("Invalid PullRequest time window");
  if (query.sourceBranch !== void 0 && (!query.sourceBranch || /[\s"\\]/.test(query.sourceBranch)))
    throw new Error("Invalid source branch");
  return JSON.stringify([scope, query.state ?? "all", start ?? null, end ?? null, query.sourceBranch ?? null]);
}
function authorMatches(value, field2, expected) {
  if (expected === void 0)
    return true;
  if (!value || typeof value !== "object" || Array.isArray(value))
    return false;
  const actual = value[field2];
  return typeof actual === "string" && actual.toLowerCase() === expected.toLowerCase();
}
function nextPage(headers, page, provider) {
  if (provider === "github")
    return headers.get("link")?.split(",").some((link) => /;\s*rel="next"/.test(link)) ? page + 1 : void 0;
  const next = headers.get("x-next-page");
  if (!next)
    return void 0;
  if (!/^\d+$/.test(next) || !Number.isSafeInteger(Number(next)) || Number(next) <= page)
    throw new Error("Forge pagination did not advance");
  return Number(next);
}

// node_modules/@compforge/repocli/dist/forge/issues.js
function readIssue(error, stage, subject = {}) {
  return {
    ...subject,
    stage,
    message: error instanceof Error ? error.message : String(error),
    kind: error instanceof ForgeRateLimitError ? "rate_limit" : error instanceof ForgeAuthError ? "auth" : error instanceof ForgeNotFound ? "not_found" : error instanceof ForgeCoverageError ? "coverage" : error instanceof ForgeError ? "transport" : "invalid_data",
    ...error instanceof ForgeRateLimitError ? { retryAfterMs: error.retryAfterMs } : {}
  };
}

// node_modules/@compforge/repocli/dist/forge/scan.js
var SECOND = 1e3;
var INITIAL_LOOKBACK_MS = 7 * 24 * 60 * 60 * SECOND;
var OVERLAP_MS = 60 * SECOND;
var PAGE_SIZE = 50;
var MAX_DISCOVERY_REQUESTS_PER_BATCH = 4;
var MAX_DISCOVERED_READS_PER_BATCH = 5;
var MAX_TRACKED_READS_PER_BATCH = 5;
var MAX_RETRIES_PER_BATCH = 2;
var MAX_FAILED_READS = 500;
var iso = (time) => new Date(time).toISOString();
var finiteTime = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
var validWindow = (value) => Boolean(value && ["open", "all"].includes(value.state) && finiteTime(value.from) && finiteTime(value.to) && value.from <= value.to);
function decode(query, binding, now2, forge) {
  if (query.cursor === void 0) {
    const initialSince = query.initialSince === void 0 ? Math.max(0, now2 - INITIAL_LOOKBACK_MS) : Date.parse(query.initialSince);
    if (!finiteTime(initialSince) || initialSince > now2)
      throw new Error("Invalid PullRequest initialSince");
    return {
      version: 3,
      binding,
      initialSince: Math.floor(initialSince / SECOND) * SECOND,
      openInventoryEnumerated: false,
      failedReads: [],
      refreshFailures: [],
      gaps: []
    };
  }
  let cursor;
  try {
    cursor = JSON.parse(query.cursor);
  } catch {
    throw new Error("Invalid PullRequest scan cursor");
  }
  const pass = cursor?.pass;
  if (!cursor || cursor.version !== 3 || cursor.binding !== binding || !finiteTime(cursor.initialSince) || typeof cursor.openInventoryEnumerated !== "boolean" || cursor.enumeratedThrough !== void 0 && !finiteTime(cursor.enumeratedThrough) || cursor.scannedThrough !== void 0 && !finiteTime(cursor.scannedThrough) || !Array.isArray(cursor.failedReads) || cursor.failedReads.length > MAX_FAILED_READS || cursor.refreshAfter !== void 0 && typeof cursor.refreshAfter !== "string" || !Array.isArray(cursor.refreshFailures) || !Array.isArray(cursor.gaps) || cursor.gaps.length > 2 || cursor.gaps.some((gap) => !gap || !validWindow(gap.window) || !gap.issue) || pass && (!["open", "all"].includes(pass.state) || !finiteTime(pass.end) || !Array.isArray(pass.windows) || !pass.windows.every(validWindow) || pass.bufferedPage && (!pass.windows.length || !Array.isArray(pass.bufferedPage.items) || pass.bufferedPage.items.length > PAGE_SIZE || !Number.isSafeInteger(pass.bufferedPage.offset) || pass.bufferedPage.offset < 0 || pass.bufferedPage.offset > pass.bufferedPage.items.length || !Array.isArray(pass.bufferedPage.issues)))) {
    throw new Error("PullRequest scan cursor version, scope or connection is invalid; start a new scan with initialSince and tracked keys");
  }
  for (const failure of [...cursor.failedReads, ...cursor.refreshFailures]) {
    if (!failure?.issue)
      throw new Error("Invalid failed read in scan cursor");
    assertPullRequestKey(failure.key, forge);
  }
  for (const key of pass?.bufferedPage?.items ?? [])
    assertPullRequestKey(key, forge);
  return cursor;
}
async function scanPullRequests(reader, query, date, withinDeadline, connection) {
  const now2 = Math.floor(date.getTime() / SECOND) * SECOND;
  if (!finiteTime(now2))
    throw new Error("Invalid PullRequest scan clock");
  const binding = JSON.stringify([connection, scopeKey(query.scope, reader.forge)]);
  const cursor = decode(query, binding, now2, reader.forge);
  const normalize = (keys) => [...new Map(keys.map((key) => {
    assertPullRequestKey(key, reader.forge);
    if (query.scope.kind === "repository" && key.repository.path !== query.scope.repository.path)
      throw new Error("Tracked PullRequest is outside scan repository");
    return [pullRequestId(key), pullRequestKey(reader.forge, key.repository.path, key.number)];
  })).values()];
  const trackedKeys = normalize(query.tracked ?? []).sort((a, b) => pullRequestId(a) < pullRequestId(b) ? -1 : 1);
  const trackedIds = new Set(trackedKeys.map(pullRequestId));
  const refreshFailures = new Map(cursor.refreshFailures.filter((f) => trackedIds.has(pullRequestId(f.key))).map((f) => [pullRequestId(f.key), f]));
  if (!cursor.pass) {
    const state = cursor.openInventoryEnumerated ? "all" : "open";
    const from = state === "open" ? 0 : cursor.enumeratedThrough === void 0 ? cursor.initialSince : Math.max(0, cursor.enumeratedThrough - OVERLAP_MS);
    if (from > now2)
      throw new Error("PullRequest scan clock precedes its cursor");
    cursor.pass = { state, end: now2, windows: [...cursor.gaps.map((gap) => gap.window), { state, from, to: now2 }] };
    cursor.gaps = [];
  }
  const pass = cursor.pass;
  const items = /* @__PURE__ */ new Map();
  const attempted = /* @__PURE__ */ new Set();
  const batchIssues = [];
  const failures = new Map(cursor.failedReads.map((failure) => [pullRequestId(failure.key), failure]));
  const read2 = async (key, stage) => {
    const id = pullRequestId(key);
    if (attempted.has(id))
      return;
    attempted.add(id);
    try {
      const snapshot2 = await reader.getPullRequest(key);
      if (pullRequestId(snapshot2) !== id)
        throw new Error("Forge returned another PullRequest identity");
      items.set(id, snapshot2);
      failures.delete(id);
      refreshFailures.delete(id);
    } catch (error) {
      const issue = readIssue(error, stage, { key });
      if (stage !== "refresh" || failures.has(id)) {
        failures.delete(id);
        failures.set(id, { key, issue });
      }
      if (stage === "refresh")
        refreshFailures.set(id, { key, issue });
      batchIssues.push(issue);
    }
  };
  const retainGap = (window, issue) => {
    const previous = cursor.gaps.find((gap2) => gap2.window.state === window.state);
    const retained = previous ? { state: window.state, from: Math.min(previous.window.from, window.from), to: Math.max(previous.window.to, window.to) } : window;
    const gap = { window: retained, issue: {
      ...issue,
      scope: query.scope,
      window: { state: retained.state, updatedAfter: iso(retained.from), updatedBefore: iso(retained.to) }
    } };
    cursor.gaps = [...cursor.gaps.filter((value) => value.window.state !== window.state), gap];
  };
  await withinDeadline(async () => {
    const pending2 = cursor.failedReads;
    for (let i = 0; i < Math.min(MAX_RETRIES_PER_BATCH, pending2.length); i++) {
      await read2(pending2[i].key, "retry");
    }
  });
  await withinDeadline(async () => {
    let requests = 0, reads = 0;
    while (pass.windows.length && reads < MAX_DISCOVERED_READS_PER_BATCH) {
      const window = pass.windows[0];
      if (!pass.bufferedPage) {
        if (requests++ >= MAX_DISCOVERY_REQUESTS_PER_BATCH)
          break;
        try {
          let split = false;
          try {
            const page2 = await reader.listPullRequests({ scope: query.scope, state: window.state, updatedAfter: iso(window.from), updatedBefore: iso(window.to), pageSize: PAGE_SIZE });
            split = page2.nextCursor !== void 0 || page2.items.length >= PAGE_SIZE;
            if (!split)
              pass.bufferedPage = { items: page2.items, offset: 0, issues: page2.issues ?? [] };
          } catch (error) {
            if (!(error instanceof ForgeCoverageError))
              throw error;
            split = true;
          }
          if (split) {
            if (window.to - window.from <= SECOND)
              throw new ForgeCoverageError(`Cannot prove PullRequest coverage within ${iso(window.from)}..${iso(window.to)}`);
            const middle = Math.floor((window.from + window.to) / (2 * SECOND)) * SECOND;
            pass.windows.splice(0, 1, { ...window, to: middle }, { ...window, from: middle });
            continue;
          }
        } catch (error) {
          retainGap(window, readIssue(error, "list", { scope: query.scope }));
          pass.windows.shift();
          continue;
        }
      }
      const page = pass.bufferedPage;
      while (page.offset < page.items.length && reads < MAX_DISCOVERED_READS_PER_BATCH) {
        const key = page.items[page.offset];
        if (failures.size >= MAX_FAILED_READS && !failures.has(pullRequestId(key)))
          break;
        await read2(key, "get");
        page.offset++;
        reads++;
      }
      if (page.offset < page.items.length)
        break;
      for (const issue of page.issues)
        retainGap(window, issue);
      pass.bufferedPage = void 0;
      pass.windows.shift();
    }
  });
  let refreshIndex = cursor.refreshAfter === void 0 ? 0 : trackedKeys.findIndex((key) => pullRequestId(key) > cursor.refreshAfter);
  if (refreshIndex < 0)
    refreshIndex = trackedKeys.length;
  await withinDeadline(async () => {
    const end = Math.min(trackedKeys.length, refreshIndex + MAX_TRACKED_READS_PER_BATCH);
    while (refreshIndex < end) {
      const key = trackedKeys[refreshIndex++];
      await read2(key, "refresh");
      cursor.refreshAfter = pullRequestId(key);
    }
  });
  const refreshPending = refreshIndex < trackedKeys.length;
  if (!refreshPending)
    cursor.refreshAfter = void 0;
  cursor.refreshFailures = [...refreshFailures.values()];
  cursor.failedReads = [...failures.values()];
  if (!pass.windows.length) {
    if (pass.state === "open")
      cursor.openInventoryEnumerated = true;
    else
      cursor.enumeratedThrough = pass.end;
    cursor.pass = void 0;
    if (!cursor.gaps.length && !cursor.failedReads.length && cursor.enumeratedThrough !== void 0)
      cursor.scannedThrough = cursor.enumeratedThrough;
  }
  const issues = [...new Map([...cursor.refreshFailures.map((f) => f.issue), ...cursor.failedReads.map((f) => f.issue), ...cursor.gaps.map((g) => g.issue), ...batchIssues].map((issue) => [JSON.stringify(issue), issue])).values()];
  if (failures.size >= MAX_FAILED_READS)
    issues.push({ stage: "get", kind: "coverage", message: "PullRequest retry backlog is full; enumeration paused until failed reads recover", scope: query.scope });
  const pending = refreshPending || Boolean(cursor.pass) || cursor.enumeratedThrough === void 0;
  return {
    items: [...items.values()],
    cursor: JSON.stringify(cursor),
    pending,
    complete: !pending && issues.length === 0,
    issues
  };
}
function createPullRequestScanner(reader, options) {
  if (!options.connection.trim())
    throw new Error("PullRequest scanner connection identity must not be empty");
  return (query) => scanPullRequests(reader, query, (options.now ?? (() => /* @__PURE__ */ new Date()))(), options.withinDeadline ?? ((operation) => operation()), options.connection);
}

// node_modules/@compforge/repocli/dist/forge/page.js
function pagePosition(scope, query) {
  let position = { version: 2, scope, page: 1, pageSize: query.pageSize ?? 50 };
  if (query.cursor !== void 0) {
    try {
      position = JSON.parse(query.cursor);
    } catch {
      throw new Error("Invalid page cursor");
    }
    if (!position || position.version !== 2 || position.scope !== scope || query.pageSize !== void 0 && query.pageSize !== position.pageSize)
      throw new Error("Page cursor does not match this query or connection");
  }
  if (!Number.isSafeInteger(position.page) || position.page < 1 || !Number.isSafeInteger(position.pageSize) || position.pageSize < 1 || position.pageSize > 100) {
    throw new Error("Page requires a positive page and pageSize between 1 and 100");
  }
  return position;
}
function pageContinuation(position, next) {
  return next === void 0 ? void 0 : JSON.stringify({ ...position, page: next });
}

// node_modules/@compforge/repocli/dist/forge/http.js
import { AsyncLocalStorage } from "node:async_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { createHash as createHash3 } from "node:crypto";
var DEFAULT_RATE_LIMIT_BACKOFF_MS = 6e4;
var ForgeHttpClient = class {
  #fetch;
  #timeoutMs;
  #maxResponseBytes;
  #minIntervalMs;
  #signal;
  #abort = new AbortController();
  #calls = new AsyncLocalStorage();
  #deadline = new AsyncLocalStorage();
  #nextStart = 0;
  #blockedUntil = 0;
  constructor(options = {}) {
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#timeoutMs = options.timeoutMs ?? 1e4;
    this.#maxResponseBytes = options.maxResponseBytes ?? 4 * 1024 * 1024;
    this.#minIntervalMs = options.minIntervalMs ?? 0;
    this.#signal = options.signal;
    if (!Number.isSafeInteger(this.#timeoutMs) || this.#timeoutMs < 1 || this.#timeoutMs > 2147483647)
      throw new Error("Forge timeoutMs must be a positive timer-safe integer");
    if (!Number.isSafeInteger(this.#maxResponseBytes) || this.#maxResponseBytes < 1)
      throw new Error("Forge maxResponseBytes must be a positive safe integer");
    if (!Number.isSafeInteger(this.#minIntervalMs) || this.#minIntervalMs < 0 || this.#minIntervalMs > 2147483647)
      throw new Error("Forge minIntervalMs must be a nonnegative timer-safe integer");
  }
  withinDeadline(timeoutMs, operation) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1)
      throw new Error("Forge aggregate timeout must be a positive safe integer");
    return this.#deadline.run(Math.min(this.#deadline.getStore() ?? Infinity, Date.now() + timeoutMs), operation);
  }
  withSignal(signal, operation) {
    const parent = this.#calls.getStore();
    return this.#calls.run(parent ? AbortSignal.any([parent, signal]) : signal, operation);
  }
  close() {
    this.#abort.abort(new ForgeError("Forge client closed"));
  }
  async request(method, url, init = {}) {
    const destination = new URL(url);
    const label = `${method} ${destination.origin}${destination.pathname}`;
    const now2 = Date.now();
    const remaining = (this.#deadline.getStore() ?? Infinity) - now2;
    if (remaining <= 0)
      throw new ForgeError(`Forge read deadline exceeded before ${label}`);
    if (this.#blockedUntil > now2)
      throw new ForgeRateLimitError("Forge requests paused after rate limiting", this.#blockedUntil - now2);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(this.#timeoutMs, remaining));
    const signal = AbortSignal.any([controller.signal, this.#abort.signal, ...this.#signal ? [this.#signal] : [], ...this.#calls.getStore() ? [this.#calls.getStore()] : []]);
    const start = Math.max(now2, this.#nextStart);
    this.#nextStart = start + this.#minIntervalMs;
    try {
      if (signal.aborted)
        throw new ForgeError(`${label}: cancelled`);
      if (start > now2)
        await delay(start - now2, void 0, { signal });
      if (this.#blockedUntil > Date.now())
        throw new ForgeRateLimitError("Forge requests paused after rate limiting", this.#blockedUntil - Date.now());
      const response = await this.#fetch(url, { ...init, method, signal });
      const body = await this.#readBody(response);
      if (!response.ok) {
        if (rateLimited(response, body))
          throw this.rateLimit(`${label} returned ${response.status}`, retryAfterMs(response.headers));
        const ErrorType = response.status === 401 || response.status === 403 ? ForgeAuthError : response.status === 404 ? ForgeNotFound : ForgeError;
        throw new ErrorType(`${label} returned ${response.status}`);
      }
      try {
        return { data: body ? JSON.parse(body) : void 0, headers: response.headers };
      } catch {
        throw new ForgeError(`${label} returned invalid JSON`);
      }
    } catch (error) {
      if (error instanceof ForgeError)
        throw error;
      throw new ForgeError(`${label}: ${signal.aborted ? "cancelled or timed out" : "transport failure"}`);
    } finally {
      clearTimeout(timer);
    }
  }
  rateLimit(detail, delayMs = DEFAULT_RATE_LIMIT_BACKOFF_MS) {
    const boundedDelay = Number.isFinite(delayMs) ? Math.max(1, delayMs) : DEFAULT_RATE_LIMIT_BACKOFF_MS;
    this.#blockedUntil = Math.max(this.#blockedUntil, Date.now() + boundedDelay);
    return new ForgeRateLimitError(detail, boundedDelay);
  }
  async #readBody(response) {
    if (Number(response.headers.get("content-length")) > this.#maxResponseBytes) {
      await response.body?.cancel();
      throw new ForgeError(`exceeded ${this.#maxResponseBytes} response bytes`);
    }
    if (!response.body)
      return "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let size = 0, text3 = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done)
          break;
        size += value.byteLength;
        if (size > this.#maxResponseBytes)
          throw new ForgeError(`exceeded ${this.#maxResponseBytes} response bytes`);
        text3 += decoder.decode(value, { stream: true });
      }
      return text3 + decoder.decode();
    } finally {
      await reader.cancel().catch(() => {
      });
      reader.releaseLock();
    }
  }
};
function rateLimited(response, body) {
  return response.status === 429 || response.status === 403 && (response.headers.get("x-ratelimit-remaining") === "0" || /rate.?limit/i.test(body));
}
function retryAfterMs(headers) {
  const retryAfter = headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0)
      return seconds * 1e3;
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date))
      return Math.max(1, date - Date.now());
  }
  const reset = Number(headers.get("x-ratelimit-reset"));
  if (Number.isFinite(reset) && reset > 0) {
    return Math.max(1, reset * 1e3 - Date.now());
  }
  return DEFAULT_RATE_LIMIT_BACKOFF_MS;
}
function record(name, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value;
}
function records(name, value) {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }
  return value.map((item, index) => record(`${name}[${index}]`, item));
}
function nonEmptyString(name, value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}
function reviewActivityFingerprint(provider, tokens) {
  return createHash3("sha256").update(JSON.stringify([provider, [...tokens].sort()])).digest("hex");
}

// node_modules/@compforge/repocli/dist/forge/github.js
var MAX_REVIEW_THREAD_PAGES = 20;
var MAX_COMMENT_PAGES = 20;
function repositoryPath(repository2) {
  const parts = repository2.split("/");
  if (parts.length !== 2 || parts.some((part) => !/^[a-zA-Z0-9_.-]+$/.test(part) || part === "." || part === "..")) {
    throw new Error(`GitHub repository must be owner/repo, got ${repository2}`);
  }
  return parts.map(encodeURIComponent).join("/");
}
function lifecycle(pullRequest) {
  if (pullRequest.merged === true || pullRequest.merged_at)
    return "merged";
  if (pullRequest.state === "open")
    return "open";
  if (pullRequest.state === "closed")
    return "closed";
  throw new Error(`unknown GitHub PullRequest state: ${pullRequest.state}`);
}
function conflictState(pr) {
  return pr.mergeable === true ? "none" : pr.mergeable === false ? "conflicted" : "unknown";
}
function mergeReadiness(pr) {
  if (pr.isDraft === true)
    return "draft";
  switch (pr.mergeStateStatus) {
    case "CLEAN":
      return "ready";
    case "DIRTY":
      return "conflict";
    case "BLOCKED":
      return "blocked";
    case "BEHIND":
      return "behind";
    case "UNSTABLE":
      return "ci_blocked";
    case "DRAFT":
      return "draft";
    default:
      return "unknown";
  }
}
var GitHubForgeReader = class {
  forge;
  provider = "github";
  #token;
  #restBase;
  #graphqlUrl;
  #http;
  #now;
  #connection;
  constructor(config, options = {}) {
    if (config.provider !== "github") {
      throw new Error("GitHubForgeReader requires a github config");
    }
    if (!config.token)
      throw new Error(`GitHub token missing for ${config.host}`);
    this.forge = config.forge;
    this.#token = config.token;
    const restBase = config.host === "github.com" ? "https://api.github.com" : `https://${config.host}/api/v3`;
    this.#restBase = restBase;
    this.#graphqlUrl = restBase.endsWith("/api/v3") ? `${restBase.slice(0, -"/api/v3".length)}/api/graphql` : `${restBase}/graphql`;
    this.#connection = connectionKey("github", this.forge, this.#restBase, config.token);
    this.#http = new ForgeHttpClient(options);
    this.#now = options.now ?? (() => /* @__PURE__ */ new Date());
  }
  withSignal(signal, operation) {
    return this.#http.withSignal(signal, operation);
  }
  close() {
    this.#http.close();
  }
  async listRepositories(query = {}) {
    const position = pagePosition(`${this.#connection}:repositories`, query);
    const parameters = new URLSearchParams({
      sort: "full_name",
      direction: "asc",
      per_page: String(position.pageSize),
      page: String(position.page)
    });
    const { data, headers } = await this.#http.request("GET", `${this.#restBase}/user/repos?${parameters}`, { headers: this.#headers() });
    const items = records("GitHub repositories", data).map((row) => {
      const path = nonEmptyString("GitHub repository full_name", row.full_name);
      repositoryPath(path);
      return { forge: { name: this.forge }, path };
    });
    if (items.length > position.pageSize)
      throw new Error("Repository response exceeds requested page size");
    const nextCursor = pageContinuation(position, nextPage(headers, position.page, "github") ?? (items.length >= position.pageSize ? position.page + 1 : void 0));
    return { items, ...nextCursor ? { nextCursor } : {} };
  }
  scanPullRequests(query) {
    return scanPullRequests(this, query, this.#now(), (operation) => this.#http.withinDeadline(2e4, operation), this.#connection);
  }
  async listPullRequests(query) {
    const position = pagePosition(`${this.#connection}:pullRequests:${queryKey(query, this.forge)}`, query);
    if ((position.page - 1) * position.pageSize >= 1e3)
      throw new ForgeCoverageError("GitHub search exceeds the 1000-result window");
    const terms = ["is:pr"];
    if (query.sourceBranch)
      terms.push(`head:${JSON.stringify(query.sourceBranch)}`);
    if (query.scope.kind === "repository") {
      repositoryPath(query.scope.repository.path);
      terms.push(`repo:${query.scope.repository.path}`);
    }
    if (query.scope.author)
      terms.push(`author:${query.scope.author}`);
    if (query.updatedAfter || query.updatedBefore) {
      const from = query.updatedAfter ? new Date(query.updatedAfter).toISOString() : void 0;
      const to = query.updatedBefore ? new Date(query.updatedBefore).toISOString() : void 0;
      terms.push(`updated:${from && to ? `${from}..${to}` : from ? `>=${from}` : `<=${to}`}`);
    }
    if (query.state === "open")
      terms.push("is:open");
    if (query.state === "merged")
      terms.push("is:merged");
    if (query.state === "closed")
      terms.push("is:closed", "is:unmerged");
    const { data, headers } = await this.#http.request("GET", `${this.#restBase}/search/issues?${new URLSearchParams({
      q: terms.join(" "),
      sort: "updated",
      order: "asc",
      per_page: String(position.pageSize),
      page: String(position.page)
    })}`, { headers: this.#headers() });
    const result = record("GitHub PullRequest search", data);
    if (result.incomplete_results !== false || !Number.isSafeInteger(result.total_count) || Number(result.total_count) < 0 || Number(result.total_count) > 1e3) {
      throw new ForgeCoverageError("GitHub PullRequest search incomplete or exceeds 1000 results");
    }
    if (!Array.isArray(result.items) || result.items.length > position.pageSize)
      throw new Error("Invalid GitHub PullRequest page");
    const items = [], issues = [];
    for (const [index, value] of result.items.entries())
      try {
        const row = record(`GitHub PullRequest row ${index}`, value);
        const repository2 = nonEmptyString("GitHub repository_url", row.repository_url);
        const prefix = `${this.#restBase}/repos/`;
        if (!repository2.startsWith(prefix) || !row.pull_request)
          throw new Error("Invalid GitHub PullRequest repository");
        const path = repository2.slice(prefix.length);
        repositoryPath(path);
        if (query.scope.kind === "repository" && path.toLowerCase() !== query.scope.repository.path.toLowerCase())
          throw new Error("GitHub returned another repository");
        if (!authorMatches(row.user, "login", query.scope.author))
          throw new Error("GitHub returned another author");
        const key = pullRequestKey(this.forge, query.scope.kind === "repository" ? query.scope.repository.path : path, row.number);
        assertPullRequestKey(key, this.forge);
        items.push(key);
      } catch (error) {
        issues.push(readIssue(error, "list", { scope: query.scope }));
      }
    const next = nextPage(headers, position.page, "github") ?? (position.page * position.pageSize < Number(result.total_count) ? position.page + 1 : void 0);
    const nextCursor = pageContinuation(position, next);
    return { items, ...nextCursor ? { nextCursor } : {}, ...issues.length ? { issues } : {} };
  }
  async getPullRequest(key) {
    this.#assertPullRequestKey(key);
    const repository2 = pullRequestKey(this.forge, key.repository.path, key.number).repository;
    const { data } = await this.#http.request("GET", `${this.#restBase}/repos/${repositoryPath(key.repository.path)}/pulls/${key.number}`, { headers: this.#headers() });
    const pullRequest = record("GitHub PullRequest", data);
    const head = pullRequest.head && typeof pullRequest.head === "object" ? pullRequest.head : {};
    const base = pullRequest.base && typeof pullRequest.base === "object" ? pullRequest.base : {};
    const source = head.repo && typeof head.repo === "object" ? head.repo : {};
    return {
      ...typeof source.full_name === "string" ? { sourceRepository: pullRequestKey(this.forge, source.full_name, key.number).repository } : {},
      ...typeof head.ref === "string" ? { sourceBranch: head.ref } : {},
      ...typeof base.ref === "string" ? { targetBranch: base.ref } : {},
      repository: repository2,
      number: key.number,
      title: nonEmptyString("GitHub PullRequest.title", pullRequest.title),
      url: nonEmptyString("GitHub PullRequest.html_url", pullRequest.html_url),
      state: lifecycle(pullRequest),
      conflictState: conflictState(pullRequest),
      ...pullRequest.draft === true ? { mergeReadiness: "draft" } : {},
      ...typeof pullRequest.head?.sha === "string" ? { headSha: pullRequest.head.sha } : {},
      ...typeof pullRequest.base?.sha === "string" ? { baseSha: pullRequest.base.sha } : {},
      ...typeof pullRequest.updated_at === "string" ? { updatedAt: pullRequest.updated_at } : {},
      ...typeof pullRequest.merged_at === "string" ? { mergedAt: pullRequest.merged_at } : {}
    };
  }
  async getPullRequestReview(key) {
    this.#assertPullRequestKey(key);
    const review = await this.#reviewThreads(key);
    return {
      key: pullRequestKey(this.forge, key.repository.path, key.number),
      reviewThreadState: review.state,
      ...review.activityFingerprint ? { reviewActivityFingerprint: review.activityFingerprint } : {},
      mergeReadiness: review.readiness,
      observedAt: this.#now().toISOString()
    };
  }
  async listPullRequestComments(key) {
    this.#assertPullRequestKey(key);
    const base = `${this.#restBase}/repos/${repositoryPath(key.repository.path)}`;
    const [conversation, review] = await Promise.all([
      this.#commentRows(`${base}/issues/${key.number}/comments`),
      this.#commentRows(`${base}/pulls/${key.number}/comments`)
    ]);
    const toComment = (row, anchored, index) => {
      const id = row.id;
      if (typeof id !== "number" && typeof id !== "string" || id === "") {
        throw new Error(`GitHub comments[${index}].id is invalid`);
      }
      const createdAt = nonEmptyString(`GitHub comments[${index}].created_at`, row.created_at);
      return {
        id: String(id),
        body: typeof row.body === "string" ? row.body : "",
        ...typeof row.user?.login === "string" ? {
          author: row.user.login
        } : {},
        replyable: false,
        replies: [],
        ...anchored && typeof row.path === "string" ? { path: row.path } : {},
        ...anchored && Number.isSafeInteger(row.line ?? row.original_line) ? { line: row.line ?? row.original_line } : {},
        createdAt
      };
    };
    const comments = conversation.map((row, index) => toComment(row, false, index));
    const replies = /* @__PURE__ */ new Map();
    const roots = [];
    for (const [index, row] of review.entries()) {
      const comment = toComment(row, true, conversation.length + index);
      const parent = row.in_reply_to_id;
      if (parent !== void 0 && parent !== null) {
        const parentId = String(parent);
        const siblings = replies.get(parentId);
        if (siblings) {
          siblings.push(comment);
        } else {
          replies.set(parentId, [comment]);
        }
      } else {
        roots.push(comment);
      }
    }
    comments.push(...roots.map((root) => ({
      ...root,
      replyable: true,
      replies: (replies.get(root.id) ?? []).sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    })));
    return comments.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }
  #headers() {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.#token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }
  #assertPullRequestKey(key) {
    assertPullRequestKey(key, this.forge);
    repositoryPath(key.repository.path);
  }
  async #commentRows(endpoint) {
    const result = [];
    for (let page = 1; page <= MAX_COMMENT_PAGES; page += 1) {
      const separator = endpoint.includes("?") ? "&" : "?";
      const { data, headers } = await this.#http.request("GET", `${endpoint}${separator}per_page=100&page=${page}`, { headers: this.#headers() });
      result.push(...records("GitHub comments", data));
      const hasNextPage = headers.get("link")?.split(",").some((link) => /;\s*rel="next"/.test(link)) ?? false;
      if (!hasNextPage)
        return result;
    }
    throw new Error("GitHub comment pagination limit exceeded");
  }
  /**
   * @spec Review activity includes thread resolution and every comment's id and edit time.
   * @why The newest reply does not reflect edits to earlier comments; REST pagination covers all threads.
   * @case id=review_comment_history,desc=`Edit an older comment on another page`,expect=`Activity fingerprint changes`
   * @see {@link ../../tests/forge.test.mjs}
   */
  async #reviewThreads(key) {
    const [owner2, name] = key.repository.path.split("/");
    let cursor;
    const activityTokens = [];
    let unresolved = false;
    for (let page = 0; page < MAX_REVIEW_THREAD_PAGES; page += 1) {
      const { data } = await this.#http.request("POST", this.#graphqlUrl, {
        headers: this.#headers(),
        body: JSON.stringify({
          query: `query($owner:String!,$name:String!,$number:Int!,$after:String){
              repository(owner:$owner,name:$name){
                pullRequest(number:$number){
                  isDraft
                  mergeStateStatus
                  reviewThreads(first:100,after:$after){
                    nodes{
                      id
                      isResolved
                    }
                    pageInfo{hasNextPage endCursor}
                  }
                }
              }
            }`,
          variables: {
            owner: owner2,
            name,
            number: key.number,
            after: cursor ?? null
          }
        })
      });
      const root = record("GitHub GraphQL response", data);
      if (Array.isArray(root.errors) && root.errors.length > 0) {
        const detail = JSON.stringify(root.errors);
        if (/rate.?limit/i.test(detail)) {
          throw this.#http.rateLimit("GitHub GraphQL rate limit exceeded");
        }
        throw new Error("GitHub GraphQL returned errors");
      }
      const graph = record("GitHub GraphQL data", root.data);
      const repository2 = record("GitHub GraphQL repository", graph.repository);
      const pullRequest = record("GitHub GraphQL PullRequest", repository2.pullRequest);
      const reviewThreads = record("GitHub GraphQL reviewThreads", pullRequest.reviewThreads);
      const nodes = records("GitHub GraphQL reviewThreads.nodes", reviewThreads.nodes);
      for (const thread of nodes) {
        if (typeof thread.id !== "string" || !thread.id) {
          throw new Error("GitHub review thread has no id");
        }
        if (typeof thread.isResolved !== "boolean") {
          throw new Error("GitHub review thread has no resolution state");
        }
        unresolved ||= thread.isResolved === false;
        activityTokens.push(JSON.stringify([
          thread.id,
          thread.isResolved
        ]));
      }
      const pageInfo = record("GitHub GraphQL reviewThreads.pageInfo", reviewThreads.pageInfo);
      if (pageInfo.hasNextPage !== true) {
        if (activityTokens.length === 0)
          return { state: "none", readiness: mergeReadiness(pullRequest) };
        const comments = await this.#commentRows(`${this.#restBase}/repos/${repositoryPath(key.repository.path)}/pulls/${key.number}/comments`);
        for (const comment of comments) {
          if (typeof comment.id !== "string" && typeof comment.id !== "number" || !String(comment.id)) {
            throw new Error("GitHub review comment has no id");
          }
          if (comment.updated_at !== void 0 && typeof comment.updated_at !== "string") {
            throw new Error("GitHub review comment updated_at is invalid");
          }
          activityTokens.push(JSON.stringify([
            String(comment.id),
            comment.updated_at ?? null
          ]));
        }
        return {
          readiness: mergeReadiness(pullRequest),
          state: unresolved ? "unresolved" : "resolved",
          activityFingerprint: reviewActivityFingerprint("github", activityTokens)
        };
      }
      if (typeof pageInfo.endCursor !== "string" || !pageInfo.endCursor) {
        throw new Error("GitHub review thread cursor missing");
      }
      cursor = pageInfo.endCursor;
    }
    throw new Error("GitHub review thread pagination limit exceeded");
  }
};

// node_modules/@compforge/repocli/dist/forge/gitlab.js
var MAX_DISCUSSION_PAGES = 20;
function lifecycle2(mergeRequest) {
  switch (mergeRequest.state) {
    case "opened":
    case "open":
      return "open";
    case "merged":
      return "merged";
    case "closed":
    case "locked":
      return "closed";
    default:
      throw new Error(`unknown GitLab MergeRequest state: ${mergeRequest.state}`);
  }
}
function conflictState2(pr) {
  if (pr.has_conflicts === true || pr.detailed_merge_status === "conflict")
    return "conflicted";
  if (pr.merge_status === "can_be_merged" || pr.detailed_merge_status === "mergeable")
    return "none";
  return "unknown";
}
function mergeReadiness2(pr) {
  if (pr.draft === true || pr.work_in_progress === true)
    return "draft";
  switch (pr.detailed_merge_status) {
    case "mergeable":
      return "ready";
    case "conflict":
      return "conflict";
    case "discussions_not_resolved":
      return "discussions_unresolved";
    case "ci_must_pass":
    case "ci_still_running":
      return "ci_blocked";
    case "not_approved":
      return "needs_approval";
    case "draft_status":
      return "draft";
    case "need_rebase":
      return "behind";
    case "blocked_status":
    case "requested_changes":
    case "external_status_checks":
    case "locked_paths":
    case "locked_lfs_files":
    case "security_policy_pipeline_check":
    case "security_policies_violations":
    case "jira_association":
    case "title_not_matching":
    case "merge_time":
    case "not_open":
      return "blocked";
    default:
      return pr.has_conflicts === true ? "conflict" : "unknown";
  }
}
function encodedProject(repository2) {
  if (!repository2.trim()) {
    throw new Error("GitLab repository must not be empty");
  }
  return encodeURIComponent(repository2);
}
var GitLabForgeReader = class {
  forge;
  provider = "gitlab";
  #token;
  #apiBase;
  #http;
  #now;
  #connection;
  constructor(config, options = {}) {
    if (config.provider !== "gitlab") {
      throw new Error("GitLabForgeReader requires a gitlab config");
    }
    if (!config.token)
      throw new Error(`GitLab token missing for ${config.host}`);
    this.forge = config.forge;
    this.#token = config.token;
    this.#apiBase = `https://${config.host}/api/v4`;
    this.#connection = connectionKey("gitlab", this.forge, this.#apiBase, config.token);
    this.#http = new ForgeHttpClient(options);
    this.#now = options.now ?? (() => /* @__PURE__ */ new Date());
  }
  withSignal(signal, operation) {
    return this.#http.withSignal(signal, operation);
  }
  close() {
    this.#http.close();
  }
  async listRepositories(query = {}) {
    const position = pagePosition(`${this.#connection}:repositories`, query);
    const parameters = new URLSearchParams({
      membership: "true",
      simple: "true",
      order_by: "id",
      sort: "asc",
      per_page: String(position.pageSize),
      page: String(position.page)
    });
    const { data, headers } = await this.#http.request("GET", `${this.#apiBase}/projects?${parameters}`, { headers: this.#headers() });
    const items = records("GitLab repositories", data).map((row) => {
      const path = nonEmptyString("GitLab repository path_with_namespace", row.path_with_namespace);
      if (path.split("/").some((part) => !part || part === "." || part === ".."))
        throw new Error("Invalid GitLab repository path");
      return { forge: { name: this.forge }, path };
    });
    if (items.length > position.pageSize)
      throw new Error("Repository response exceeds requested page size");
    const nextCursor = pageContinuation(position, nextPage(headers, position.page, "gitlab") ?? (items.length >= position.pageSize ? position.page + 1 : void 0));
    return { items, ...nextCursor ? { nextCursor } : {} };
  }
  scanPullRequests(query) {
    return scanPullRequests(this, query, this.#now(), (operation) => this.#http.withinDeadline(2e4, operation), this.#connection);
  }
  async listPullRequests(query) {
    const position = pagePosition(`${this.#connection}:pullRequests:${queryKey(query, this.forge)}`, query);
    const parameters = new URLSearchParams({
      scope: "all",
      state: query.state === "open" ? "opened" : query.state ?? "all",
      order_by: "updated_at",
      sort: "asc",
      per_page: String(position.pageSize),
      page: String(position.page)
    });
    if (query.sourceBranch)
      parameters.set("source_branch", query.sourceBranch);
    if (query.scope.author)
      parameters.set("author_username", query.scope.author);
    if (query.updatedAfter)
      parameters.set("updated_after", query.updatedAfter);
    if (query.updatedBefore)
      parameters.set("updated_before", query.updatedBefore);
    const project = query.scope.kind === "repository" ? query.scope.repository.path : void 0;
    const endpoint = project ? this.#projectBase(project) : this.#apiBase;
    const { data, headers } = await this.#http.request("GET", `${endpoint}/merge_requests?${parameters}`, { headers: this.#headers() });
    if (!Array.isArray(data) || data.length > position.pageSize)
      throw new Error("Invalid GitLab PullRequest page");
    const items = [], issues = [];
    for (const [index, value] of data.entries())
      try {
        const row = record(`GitLab PullRequest row ${index}`, value);
        if (!authorMatches(row.author, "username", query.scope.author))
          throw new Error("GitLab returned another author");
        let path = project;
        if (!path) {
          const url = new URL(nonEmptyString("GitLab web_url", row.web_url));
          const match = url.pathname.match(/^\/(.+?)\/(?:-\/)?merge_requests\/([1-9]\d*)\/?$/);
          if (url.origin !== new URL(this.#apiBase).origin || !match || Number(match[2]) !== row.iid)
            throw new Error("Invalid GitLab PullRequest identity URL");
          path = decodeURIComponent(match[1]);
          if (path.split("/").length < 2)
            throw new Error("GitLab repository path requires a namespace");
        }
        const key = pullRequestKey(this.forge, path, row.iid);
        assertPullRequestKey(key, this.forge);
        items.push(key);
      } catch (error) {
        issues.push(readIssue(error, "list", { scope: query.scope }));
      }
    const next = nextPage(headers, position.page, "gitlab") ?? (data.length >= position.pageSize ? position.page + 1 : void 0);
    const nextCursor = pageContinuation(position, next);
    return { items, ...nextCursor ? { nextCursor } : {}, ...issues.length ? { issues } : {} };
  }
  async getPullRequest(key) {
    this.#assertPullRequestKey(key);
    const repository2 = pullRequestKey(this.forge, key.repository.path, key.number).repository;
    const { data } = await this.#http.request("GET", `${this.#projectBase(key.repository.path)}/merge_requests/${key.number}`, { headers: this.#headers() });
    const mergeRequest = record("GitLab MergeRequest", data);
    let sourceRepository = mergeRequest.source_project_id === mergeRequest.target_project_id ? repository2 : void 0;
    if (!sourceRepository && Number.isSafeInteger(mergeRequest.source_project_id) && Number(mergeRequest.source_project_id) > 0) {
      try {
        const source = await this.#http.request("GET", `${this.#apiBase}/projects/${mergeRequest.source_project_id}`, { headers: this.#headers() });
        const project = record("GitLab source project", source.data);
        sourceRepository = { forge: repository2.forge, path: nonEmptyString("GitLab source path", project.path_with_namespace) };
      } catch (error) {
        if (!(error instanceof ForgeNotFound))
          throw error;
      }
    }
    return {
      ...typeof mergeRequest.source_branch === "string" ? { sourceBranch: mergeRequest.source_branch } : {},
      ...typeof mergeRequest.target_branch === "string" ? { targetBranch: mergeRequest.target_branch } : {},
      ...sourceRepository ? { sourceRepository } : {},
      repository: repository2,
      number: key.number,
      title: nonEmptyString("GitLab MergeRequest.title", mergeRequest.title),
      url: nonEmptyString("GitLab MergeRequest.web_url", mergeRequest.web_url),
      state: lifecycle2(mergeRequest),
      conflictState: conflictState2(mergeRequest),
      mergeReadiness: mergeReadiness2(mergeRequest),
      ...typeof mergeRequest.sha === "string" ? { headSha: mergeRequest.sha } : {},
      ...typeof mergeRequest.diff_refs?.base_sha === "string" ? { baseSha: mergeRequest.diff_refs.base_sha } : {},
      ...typeof mergeRequest.updated_at === "string" ? { updatedAt: mergeRequest.updated_at } : {},
      ...typeof mergeRequest.merged_at === "string" ? { mergedAt: mergeRequest.merged_at } : {}
    };
  }
  async getPullRequestReview(key) {
    this.#assertPullRequestKey(key);
    const review = await this.#reviewThreads(key);
    return {
      key: pullRequestKey(this.forge, key.repository.path, key.number),
      reviewThreadState: review.state,
      ...review.activityFingerprint ? { reviewActivityFingerprint: review.activityFingerprint } : {},
      observedAt: this.#now().toISOString()
    };
  }
  async listPullRequestComments(key) {
    this.#assertPullRequestKey(key);
    const result = [];
    let page = 1;
    for (let count = 0; count < MAX_DISCUSSION_PAGES; count += 1) {
      const { data, headers } = await this.#http.request("GET", `${this.#projectBase(key.repository.path)}/merge_requests/${key.number}/discussions?per_page=100&page=${page}`, { headers: this.#headers() });
      const discussions = records("GitLab discussions", data);
      for (const discussion of discussions) {
        const notes = records("GitLab discussion notes", discussion.notes).filter((note) => note.system !== true);
        const toComment = (note, index) => {
          const id = note.id;
          if (typeof id !== "number" && typeof id !== "string" || id === "") {
            throw new Error(`GitLab comment ${index} has no id`);
          }
          const position = note.position && typeof note.position === "object" && !Array.isArray(note.position) ? note.position : void 0;
          const author = note.author && typeof note.author === "object" && !Array.isArray(note.author) ? note.author : void 0;
          return {
            id: String(id),
            body: typeof note.body === "string" ? note.body : "",
            ...typeof author?.username === "string" ? { author: author.username } : {},
            replyable: false,
            replies: [],
            ...typeof position?.new_path === "string" ? { path: position.new_path } : {},
            ...Number.isSafeInteger(position?.new_line) ? { line: position.new_line } : {},
            createdAt: nonEmptyString(`GitLab comment ${id} created_at`, note.created_at)
          };
        };
        if (discussion.individual_note === true) {
          result.push(...notes.map(toComment));
          continue;
        }
        const [root, ...replies] = notes.map(toComment);
        if (!root)
          continue;
        result.push({
          ...root,
          replyable: true,
          replies: replies.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        });
      }
      const nextPage2 = headers.get("x-next-page");
      if (!nextPage2) {
        return result.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      }
      const parsed = Number(nextPage2);
      if (!Number.isSafeInteger(parsed) || parsed <= page) {
        throw new Error("GitLab comment pagination is invalid");
      }
      page = parsed;
    }
    throw new Error("GitLab comment pagination limit exceeded");
  }
  #headers() {
    return {
      Accept: "application/json",
      "PRIVATE-TOKEN": this.#token
    };
  }
  #projectBase(repository2) {
    return `${this.#apiBase}/projects/${encodedProject(repository2)}`;
  }
  #assertPullRequestKey(key) {
    assertPullRequestKey(key, this.forge);
  }
  async #reviewThreads(key) {
    let page = 1;
    const activityTokens = [];
    let unresolved = false;
    for (let count = 0; count < MAX_DISCUSSION_PAGES; count += 1) {
      const { data, headers } = await this.#http.request("GET", `${this.#projectBase(key.repository.path)}/merge_requests/${key.number}/discussions?per_page=100&page=${page}`, { headers: this.#headers() });
      const discussions = records("GitLab discussions", data);
      for (const discussion of discussions) {
        const notes = records("GitLab discussion notes", discussion.notes);
        const resolvable = notes.filter((note) => note.resolvable === true);
        if (resolvable.length === 0)
          continue;
        if (typeof discussion.id !== "string" || !discussion.id) {
          throw new Error("GitLab review discussion has no id");
        }
        unresolved ||= resolvable.some((note) => note.resolved !== true);
        const noteTokens = notes.map((note) => {
          if (typeof note.id !== "number" && typeof note.id !== "string" || note.id === "") {
            throw new Error("GitLab review discussion note has no id");
          }
          if (note.updated_at !== void 0 && typeof note.updated_at !== "string") {
            throw new Error("GitLab review discussion note updated_at is invalid");
          }
          return [
            String(note.id),
            note.updated_at ?? null,
            note.resolvable === true,
            note.resolved === true
          ];
        });
        activityTokens.push(JSON.stringify([discussion.id, noteTokens]));
      }
      const nextPage2 = headers.get("x-next-page");
      if (!nextPage2) {
        if (activityTokens.length === 0)
          return { state: "none" };
        return {
          state: unresolved ? "unresolved" : "resolved",
          activityFingerprint: reviewActivityFingerprint("gitlab", activityTokens)
        };
      }
      const parsed = Number(nextPage2);
      if (!Number.isSafeInteger(parsed) || parsed <= page) {
        throw new Error("GitLab discussion pagination is invalid");
      }
      page = parsed;
    }
    throw new Error("GitLab discussion pagination limit exceeded");
  }
};

// node_modules/@compforge/repocli/dist/forge/create.js
function createForgeReader(config, options = {}) {
  return config.provider === "github" ? new GitHubForgeReader(config, options) : new GitLabForgeReader(config, options);
}

// node_modules/@compforge/repocli/dist/forge/observation/engine.js
import { setTimeout as delay3 } from "node:timers/promises";

// node_modules/@compforge/repocli/dist/forge/observation/store.js
var import_proper_lockfile = __toESM(require_proper_lockfile(), 1);
import { createHash as createHash4, randomUUID } from "node:crypto";
import { mkdir, open as open3, readFile, readdir, rename, rm } from "node:fs/promises";
import { dirname as dirname4, join as join4, resolve } from "node:path";
import { setTimeout as delay2 } from "node:timers/promises";
var digest = (value) => createHash4("sha256").update(JSON.stringify(value)).digest("hex");
var ObservationStorageError = class extends Error {
};
var missing = (error) => error.code === "ENOENT";
var ObservationStore = class {
  root;
  constructor(root) {
    if (!root.trim())
      throw new Error("PR observation stateDir must be explicit and nonempty");
    this.root = resolve(root);
  }
  path(...parts) {
    return join4(this.root, ...parts);
  }
  async read(path) {
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      if (missing(error))
        return void 0;
      throw new ObservationStorageError(`Cannot read PR state ${path}`, { cause: error });
    }
  }
  async write(path, value, assertOwned) {
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await mkdir(dirname4(path), { recursive: true, mode: 448 });
      const file2 = await open3(temporary, "wx", 384);
      try {
        await file2.writeFile(JSON.stringify(value));
        await file2.sync();
      } finally {
        await file2.close();
      }
      assertOwned();
      await rename(temporary, path);
      const directory = await open3(dirname4(path), "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    } catch (error) {
      throw new ObservationStorageError(`Cannot persist PR state ${path}`, { cause: error });
    } finally {
      await rm(temporary, { force: true }).catch(() => {
      });
    }
  }
  async locked(path, signal, operation) {
    await mkdir(dirname4(path), { recursive: true, mode: 448 });
    let release, compromised;
    const deadline = Date.now() + 3e4;
    while (!release) {
      signal.throwIfAborted();
      try {
        release = await import_proper_lockfile.default.lock(path, {
          realpath: false,
          stale: 3e4,
          update: 1e4,
          retries: 0,
          onCompromised: (error) => {
            compromised = error;
          }
        });
      } catch (error) {
        if (error.code !== "ELOCKED" || Date.now() >= deadline) {
          throw new ObservationStorageError(`Cannot acquire PR state lock ${path}`, { cause: error });
        }
        await delay2(25, void 0, { signal });
      }
    }
    const assertOwned = () => {
      signal.throwIfAborted();
      if (compromised)
        throw compromised;
    };
    try {
      assertOwned();
      return await operation(assertOwned);
    } finally {
      await release();
    }
  }
  async observations() {
    const directories = async (path) => {
      try {
        return (await readdir(path, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
      } catch (error) {
        if (missing(error))
          return [];
        throw error;
      }
    };
    const paths = [];
    for (const repo of await directories(this.path("repositories"))) {
      for (const number3 of await directories(this.path("repositories", repo, "prs"))) {
        if (/^[1-9][0-9]*$/.test(number3))
          paths.push(this.path("repositories", repo, "prs", number3, "observation.json"));
      }
    }
    return paths;
  }
};

// node_modules/@compforge/repocli/dist/forge/observation/engine.js
var positive = (name, value) => {
  if (!Number.isSafeInteger(value) || value < 1 || value > 2147483647)
    throw new Error(`${name} must be a positive timer-safe integer`);
  return value;
};
var ObservationEngine = class {
  reader;
  #store;
  #connection;
  #now;
  #open;
  #closed;
  #retry;
  #timeout;
  constructor(reader, options) {
    this.reader = reader;
    if (!options.connection.trim())
      throw new Error("PR observation connection must be nonempty");
    this.#store = new ObservationStore(options.stateDir);
    this.#connection = digest([reader.forge, options.connection]);
    this.#now = options.now ?? (() => /* @__PURE__ */ new Date());
    this.#open = positive("openIntervalMs", options.openIntervalMs ?? 6e4);
    this.#closed = positive("closedIntervalMs", options.closedIntervalMs ?? 6e5);
    this.#retry = positive("retryIntervalMs", options.retryIntervalMs ?? 3e4);
    this.#timeout = positive("requestTimeoutMs", options.requestTimeoutMs ?? 2e4);
  }
  #time() {
    const time = this.#now().getTime();
    if (!Number.isSafeInteger(time) || time < 0)
      throw new Error("Invalid observation clock");
    return time;
  }
  #repo(key) {
    return digest([key.repository.forge.name, key.repository.path]);
  }
  #path(key) {
    return this.#store.path("repositories", this.#repo(key), "prs", String(key.number), "observation.json");
  }
  #scope(scope) {
    return digest([this.#connection, scopeKey(scope, this.reader.forge)]);
  }
  async #stored(path) {
    const record2 = await this.#store.read(path);
    if (record2 && (record2.version !== 1 || !record2.observation || !Array.isArray(record2.scopeIds) || !Number.isSafeInteger(record2.failures))) {
      throw new ObservationStorageError(`Invalid PR observation ${path}`);
    }
    return record2?.connection === this.#connection ? record2 : void 0;
  }
  #fresh(record2, age) {
    const observation = record2.observation;
    return observation.snapshot?.state === "merged" || Boolean(observation.snapshot && observation.observedAt && !observation.lastError && this.#time() - Date.parse(observation.observedAt) <= age);
  }
  async #request(operation, signal) {
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(this.#timeout)]);
    requestSignal.throwIfAborted();
    let abort = () => {
    };
    const cancelled = new Promise((_, reject) => {
      abort = () => reject(new ForgeError("PR read cancelled or timed out"));
      requestSignal.addEventListener("abort", abort, { once: true });
    });
    try {
      return await Promise.race([cancelled, this.reader.withSignal ? this.reader.withSignal(requestSignal, operation) : operation()]);
    } finally {
      requestSignal.removeEventListener("abort", abort);
    }
  }
  async get(key, query = {}) {
    return this.#get(key, query);
  }
  async #get(key, query, scopeId) {
    assertPullRequestKey(key, this.reader.forge);
    key = pullRequestKey(this.reader.forge, key.repository.path, key.number);
    const age = query.maxAgeMs ?? this.#open;
    if (!Number.isSafeInteger(age) || age < 0)
      throw new Error("maxAgeMs must be a nonnegative safe integer");
    const signal = query.signal ?? new AbortController().signal;
    const path = this.#path(key);
    return this.#store.locked(path, signal, async (assertOwned) => {
      const previous = await this.#stored(path);
      if (previous && pullRequestId(previous.observation.key) !== pullRequestId(key))
        throw new ObservationStorageError(`PR identity mismatch at ${path}`);
      const scopeIds = [.../* @__PURE__ */ new Set([...previous?.scopeIds ?? [], ...scopeId ? [scopeId] : []])];
      if (previous && !query.refresh && (this.#fresh(previous, age) || previous.observation.lastError && Date.parse(previous.observation.nextRefreshAt ?? "") > this.#time())) {
        if (scopeIds.length !== previous.scopeIds.length)
          await this.#store.write(path, { ...previous, scopeIds }, assertOwned);
        return { ...previous.observation, fresh: this.#fresh(previous, age), source: "cache" };
      }
      const attemptedAt = new Date(this.#time()).toISOString();
      let record2;
      try {
        const snapshot2 = await this.#request(() => this.reader.getPullRequest(key), signal);
        if (pullRequestId(snapshot2) !== pullRequestId(key) || !["open", "closed", "merged"].includes(snapshot2.state ?? ""))
          throw new Error("Forge returned invalid PR identity or lifecycle");
        if (previous?.observation.snapshot?.state === "merged" && snapshot2.state !== "merged")
          throw new Error("Forge contradicted a confirmed merged lifecycle");
        const now2 = this.#time();
        record2 = { version: 1, connection: this.#connection, scopeIds, failures: 0, observation: {
          key,
          snapshot: snapshot2,
          attemptedAt,
          observedAt: new Date(now2).toISOString(),
          ...snapshot2.state === "merged" ? {} : {
            nextRefreshAt: new Date(now2 + (snapshot2.state === "closed" ? this.#closed : this.#open)).toISOString()
          }
        } };
      } catch (error) {
        signal.throwIfAborted();
        const issue = readIssue(error, "refresh", { key });
        const failures = (previous?.failures ?? 0) + 1;
        const backoff = Math.max(issue.retryAfterMs ?? 0, Math.min(36e5, this.#retry * 2 ** Math.min(failures - 1, 10)));
        record2 = {
          version: 1,
          connection: this.#connection,
          scopeIds,
          failures,
          observation: {
            ...previous?.observation,
            key,
            attemptedAt,
            lastError: issue,
            nextRefreshAt: new Date(this.#time() + backoff).toISOString()
          }
        };
      }
      const metadata = this.#store.path("repositories", this.#repo(key), "repository.json");
      await this.#store.write(metadata, key.repository, assertOwned);
      await this.#store.write(path, record2, assertOwned);
      return { ...record2.observation, fresh: this.#fresh(record2, age), source: "remote" };
    });
  }
  /** One bounded refresh/discovery round. Callers can inspect issues or drive run() explicitly. */
  async poll(watch = {}) {
    const signal = watch.signal ?? new AbortController().signal;
    signal.throwIfAborted();
    const scopes = watch.scopes ?? [];
    const scopeIds = new Set(scopes.map((scope) => this.#scope(scope)));
    const keys = new Map((watch.keys ?? []).map((key) => {
      assertPullRequestKey(key, this.reader.forge);
      return [pullRequestId(key), key];
    }));
    const due = /* @__PURE__ */ new Map();
    for (const key of keys.values())
      due.set(pullRequestId(key), { key, at: 0 });
    for (const path of await this.#store.observations()) {
      const record2 = await this.#stored(path);
      if (!record2)
        continue;
      const observation = record2.observation, id = pullRequestId(observation.key);
      const selected = keys.has(id) || record2.scopeIds.some((id2) => scopeIds.has(id2)) || watch.keys === void 0 && watch.scopes === void 0;
      if (!selected)
        continue;
      if (observation.snapshot?.state === "merged") {
        due.delete(id);
        continue;
      }
      const at = Date.parse(observation.nextRefreshAt ?? "") || 0;
      if (at <= this.#time())
        due.set(id, { key: observation.key, at });
      else
        due.delete(id);
    }
    const pendingKeys = (watch.refresh === false ? [] : [...due.values()]).sort((a, b) => a.at - b.at || pullRequestId(a.key).localeCompare(pullRequestId(b.key)));
    const observations = [], issues = [];
    for (const { key } of pendingKeys.slice(0, 5)) {
      const result = await this.get(key, { signal });
      observations.push(result);
      if (result.lastError)
        issues.push(result.lastError);
    }
    let pending = pendingKeys.length > 5;
    for (const scope of scopes) {
      const id = this.#scope(scope), path = this.#store.path("scans", `${id}.json`);
      const result = await this.#store.locked(path, signal, async (assertOwned) => {
        const state = await this.#store.read(path);
        if (state && state.version !== 1)
          throw new ObservationStorageError(`Invalid PR scan state ${path}`);
        let storageFailure;
        const scanner = createPullRequestScanner({
          forge: this.reader.forge,
          listPullRequests: (query) => this.#request(() => this.reader.listPullRequests(query), signal),
          getPullRequest: async (key) => {
            let result3;
            try {
              result3 = await this.#get(key, { signal }, id);
            } catch (error) {
              storageFailure = error;
              throw error;
            }
            observations.push(result3);
            if (!result3.snapshot || !result3.fresh || result3.lastError)
              throw new ForgeError(result3.lastError?.message ?? "PR observation unavailable");
            return result3.snapshot;
          }
        }, { connection: this.#connection, now: this.#now });
        const operation = () => scanner({ scope, cursor: state?.cursor, initialSince: watch.initialSince });
        const result2 = this.reader.withSignal ? await this.reader.withSignal(signal, operation) : await operation();
        if (storageFailure)
          throw storageFailure;
        assertOwned();
        await this.#store.write(path, { version: 1, cursor: result2.cursor }, assertOwned);
        return result2;
      });
      pending ||= result.pending;
      issues.push(...result.issues);
    }
    for (const path of await this.#store.observations()) {
      const record2 = await this.#stored(path);
      if (record2?.observation.lastError && (keys.has(pullRequestId(record2.observation.key)) || record2.scopeIds.some((id) => scopeIds.has(id)) || watch.keys === void 0 && watch.scopes === void 0))
        issues.push(record2.observation.lastError);
    }
    const uniqueIssues = [...new Map(issues.map((issue) => [JSON.stringify(issue), issue])).values()];
    return { observations, issues: uniqueIssues, pending, complete: !pending && uniqueIssues.length === 0 };
  }
  /** Explicit lifecycle: abort stops polling and in-flight cooperative provider work. */
  async *run(watch) {
    const interval = positive("pollIntervalMs", watch.pollIntervalMs ?? this.#open);
    try {
      while (!watch.signal.aborted) {
        const batch = await this.poll(watch);
        yield batch;
        await delay3(batch.pending ? Math.min(interval, 1e3) : interval, void 0, { signal: watch.signal });
      }
    } catch (error) {
      if (!watch.signal.aborted)
        throw error;
    }
  }
};

// node_modules/@compforge/repocli/dist/forge/observation/context.js
var sameRepository = (a, b) => a?.forge.name === b.forge.name && a.path === b.path;
var PullRequestContext = class {
  reader;
  options;
  #engine;
  #remote;
  #store;
  #controller = new AbortController();
  #now;
  constructor(reader, options) {
    this.reader = reader;
    this.options = options;
    if (!options.targets.length || [options.source, ...options.targets].some((repo) => repo.forge.name !== reader.forge))
      throw new Error("Invalid PR association repository scope");
    this.#remote = remote(options.checkout);
    this.#engine = new ObservationEngine(reader, options);
    this.#store = new ObservationStore(options.stateDir);
    this.#now = options.now ?? (() => /* @__PURE__ */ new Date());
  }
  #path(branch) {
    const clean = (repo) => ({ forge: { name: repo.forge.name }, path: repo.path });
    return this.#store.path("associations", `${digest([digest([this.reader.forge, this.options.connection]), clean(this.options.source), branch, this.options.targets.map(clean)])}.json`);
  }
  async #keys(branch, verify, signal) {
    const { targets } = this.options;
    const path = this.#path(branch);
    return this.#store.locked(path, signal, async (owned) => {
      const record2 = await this.#store.read(path);
      if (record2 && (record2.version !== 1 || !Number.isFinite(Date.parse(record2.nextRefreshAt)) || !record2.error && !Array.isArray(record2.keys)))
        throw new ForgeError("Invalid PR association record");
      if (!verify && record2 && Date.parse(record2.nextRefreshAt) > this.#now().getTime()) {
        if (record2.error)
          throw new ForgeError(record2.error);
        return record2.keys ?? [];
      }
      const keys = [];
      try {
        for (const target of targets) {
          let cursor;
          const seen = /* @__PURE__ */ new Set();
          do {
            signal.throwIfAborted();
            const query = () => this.reader.listPullRequests({ scope: { kind: "repository", repository: target }, state: "all", sourceBranch: branch, cursor });
            let aborted = () => {
            };
            const cancelled = new Promise((_, reject) => {
              aborted = () => reject(signal.reason);
              signal.addEventListener("abort", aborted, { once: true });
            });
            const page = await Promise.race([this.reader.withSignal ? this.reader.withSignal(signal, query) : query(), cancelled]).finally(() => signal.removeEventListener("abort", aborted));
            if (page.issues?.length)
              throw new ForgeError(page.issues.map((issue) => issue.message).join("; "));
            keys.push(...page.items);
            cursor = page.nextCursor;
            if (cursor && seen.has(cursor))
              throw new ForgeError("PR association pagination repeated");
            if (cursor)
              seen.add(cursor);
          } while (cursor);
        }
      } catch (error) {
        signal.throwIfAborted();
        await this.#store.write(path, { version: 1, error: String(error), nextRefreshAt: new Date(this.#now().getTime() + (this.options.retryIntervalMs ?? 3e4)).toISOString() }, owned);
        throw error;
      }
      const unique = [...new Map(keys.map((key) => [JSON.stringify([key.repository.forge.name, key.repository.path, key.number]), key])).values()];
      await this.#store.write(path, { version: 1, keys: unique, nextRefreshAt: new Date(this.#now().getTime() + (this.options.openIntervalMs ?? 6e4)).toISOString() }, owned);
      return unique;
    });
  }
  async #branch(branch, verify, external) {
    const signal = AbortSignal.any([this.#controller.signal, AbortSignal.timeout(this.options.requestTimeoutMs ?? 2e4), ...external ? [external] : []]);
    signal.throwIfAborted();
    const head = localBranches(this.options.checkout).get(branch);
    if (!head)
      throw new Error(`Local branch does not exist: ${branch}`);
    const checkouts = listCheckouts(this.options.checkout).filter((entry) => entry.branch === branch);
    const candidates = [], errors = [];
    try {
      for (const key of await this.#keys(branch, verify, signal)) {
        try {
          let observed = await this.#engine.get(key, { signal });
          if (verify && observed.snapshot?.state !== "merged" && observed.source !== "remote")
            observed = await this.#engine.get(key, { signal, refresh: true });
          if (!observed.fresh || !observed.snapshot)
            throw new ForgeError(observed.lastError?.message ?? "PR unavailable");
          const pr = observed.snapshot;
          if (!pr.sourceRepository || !pr.sourceBranch)
            throw new ForgeError("Observed PR source is unknown");
          if (pr.sourceBranch === branch && sameRepository(pr.sourceRepository, this.options.source))
            candidates.push(pr);
        } catch (error) {
          signal.throwIfAborted();
          errors.push(String(error));
        }
      }
    } catch (error) {
      signal.throwIfAborted();
      errors.push(String(error));
    }
    const opens = candidates.filter((pr) => pr.state === "open");
    const matching = opens.length ? opens : candidates.filter((pr) => pr.headSha && isAncestor(this.options.checkout, pr.headSha, head));
    return {
      repository: this.options.source,
      branch,
      head,
      candidates,
      checkouts,
      ambiguous: matching.length > 1,
      ...matching.length === 1 && !errors.length ? { selected: matching[0] } : {},
      ...errors.length ? { error: errors.join("; ") } : {}
    };
  }
  getBranch(branch, options = {}) {
    return this.#branch(branch, false, options.signal);
  }
  async getCheckout(options = {}) {
    const branch = currentBranch(this.options.checkout);
    return branch ? this.getBranch(branch, options) : void 0;
  }
  async localBranches(options = {}) {
    const limit = options.limit ?? 20;
    if (!Number.isSafeInteger(limit) || limit < 1)
      throw new Error("Invalid discovery limit");
    const branches = localBranches(this.options.checkout), checkouts = listCheckouts(this.options.checkout);
    const due = /* @__PURE__ */ new Map(), unavailable = /* @__PURE__ */ new Map();
    for (const [branch] of branches) {
      try {
        const record2 = await this.#store.read(this.#path(branch));
        due.set(branch, record2 ? Date.parse(record2.nextRefreshAt) : 0);
      } catch (error) {
        unavailable.set(branch, String(error));
      }
    }
    const selected = new Set([...due].filter(([, at]) => at <= this.#now().getTime()).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([branch]) => branch));
    const signal = AbortSignal.timeout(this.options.requestTimeoutMs ?? 2e4);
    const results = [];
    for (const [branch, head] of branches) {
      let error = unavailable.get(branch) ?? "association discovery pending";
      try {
        if (selected.has(branch) || due.get(branch) > this.#now().getTime()) {
          results.push(await this.getBranch(branch, { signal }));
          continue;
        }
      } catch (failure) {
        this.#controller.signal.throwIfAborted();
        error = String(failure);
      }
      results.push({ repository: this.options.source, branch, head, checkouts: checkouts.filter((entry) => entry.branch === branch), candidates: [], ambiguous: false, error });
    }
    return results;
  }
  async forPullRequest(key) {
    const observed = await this.#engine.get(key, { signal: this.#controller.signal });
    const pr = observed.snapshot;
    if (!observed.fresh || !pr)
      throw new ForgeError("PR unavailable");
    if (!sameRepository(pr.sourceRepository, this.options.source) || !pr.sourceBranch || !localBranches(this.options.checkout).has(pr.sourceBranch))
      return [];
    const branch = await this.getBranch(pr.sourceBranch);
    return branch.candidates.some((pr2) => pr2.number === key.number && sameRepository(pr2.repository, key.repository)) ? [branch] : [];
  }
  async verify(previous) {
    if (JSON.stringify(remote(this.options.checkout)) !== JSON.stringify(this.#remote))
      throw new ForgeError("Source repository remote changed during PR decision");
    const current = await this.#branch(previous.branch, true);
    if (current.head !== previous.head || JSON.stringify(current.checkouts) !== JSON.stringify(previous.checkouts))
      throw new ForgeError("Local branch or checkout changed during PR decision");
    return current;
  }
  close() {
    this.#controller.abort();
  }
};

// domain/context/store.ts
import { appendFileSync, existsSync as existsSync2, mkdirSync, readFileSync, renameSync, statSync as statSync2, writeFileSync } from "node:fs";
import { dirname as dirname5, join as join5, parse, resolve as resolve2 } from "node:path";
var STATE_DIRECTORY_NAME = ".devloop";
var WORKSPACE_STATE_FILE = "context.json";
var stateRoots = /* @__PURE__ */ new Map();
function sharedStateRoot(root) {
  const path = join5(root, ".git");
  if (!existsSync2(path)) return root;
  const metadata = statSync2(path);
  const marker = `${metadata.dev}:${metadata.ino}:${metadata.mtimeMs}`;
  const cached = stateRoots.get(root);
  if (cached?.marker === marker) return cached.home;
  const info = checkoutInfo(root);
  const home = info.mainRoot ?? info.commonDir;
  if (stateRoots.size >= 64) stateRoots.delete(stateRoots.keys().next().value);
  stateRoots.set(root, { marker, home });
  return home;
}
function stateDirectory(root) {
  return join5(sharedStateRoot(resolve2(root)), STATE_DIRECTORY_NAME);
}
function workingTreeStateDirectory(root) {
  return join5(resolve2(root), STATE_DIRECTORY_NAME);
}
function temporaryDirectory(root) {
  return join5(stateDirectory(root), "tmp");
}
function branchSegment(branch, name) {
  return `branches/${branch ?? "@detached"}/${name}`;
}
function workspaceStateFile(root) {
  return join5(stateDirectory(root), WORKSPACE_STATE_FILE);
}
function segmentFile(root, name) {
  return join5(stateDirectory(root), `${name}.json`);
}
function atomicWrite(path, data) {
  try {
    mkdirSync(dirname5(path), { recursive: true });
    const temporary = join5(dirname5(path), `${parse(path).base}.${process.pid}.tmp`);
    writeFileSync(temporary, JSON.stringify(data, null, 2), "utf8");
    renameSync(temporary, path);
  } catch {
  }
}
function readJson(path) {
  if (!existsSync2(path)) return void 0;
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
  } catch {
    return void 0;
  }
}
function loadWorkspace(root) {
  return readJson(workspaceStateFile(root));
}
function saveWorkspace(root, data) {
  atomicWrite(workspaceStateFile(root), data);
}
function loadSegment(root, name) {
  return readJson(segmentFile(root, name));
}
function saveSegment(root, name, data) {
  atomicWrite(segmentFile(root, name), data);
}
function appendLedger(root, name, record2) {
  try {
    const path = join5(stateDirectory(root), `${name}.jsonl`);
    mkdirSync(dirname5(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(record2)}
`, "utf8");
  } catch {
  }
}

// domain/task-trigger.ts
var TASK = "pr-lifecycle-reconcile";
function running(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
  }
}
function triggerReconciliation(repo) {
  let control = repo;
  let claim;
  let claimed = false;
  let log;
  try {
    const info = checkoutInfo(repo);
    control = info.mainRoot ?? info.root;
    if (!remote(control)) return false;
    const plugin = process.env.PLUGIN_ROOT ?? process.env.CLAUDE_PLUGIN_ROOT ?? fileURLToPath(new URL("../../", import.meta.url));
    const catalog = JSON.parse(readFileSync2(join6(plugin, "tasks/tasks.json"), "utf8"));
    const task = catalog.find((entry) => entry.name === TASK);
    if (!task) throw new Error(`missing task definition: ${TASK}`);
    const runner = join6(plugin, "scripts/run_task.py");
    const launcher = join6(plugin, "scripts/python");
    if (!existsSync3(runner) || !existsSync3(launcher)) throw new Error(`missing task entrypoint: ${runner}`);
    const home = temporaryDirectory(control);
    mkdirSync2(home, { recursive: true });
    const stamp = join6(home, `${TASK}.opportunistic`);
    if (existsSync3(stamp) && Date.now() - statSync3(stamp).mtimeMs < task.interval_seconds * 1e3) return false;
    claim = join6(home, `${TASK}.claim`);
    if (existsSync3(claim)) {
      try {
        const pid = Number(readFileSync2(claim, "utf8"));
        if (Number.isInteger(pid) && pid > 0 && running(pid)) return false;
        if ((!Number.isInteger(pid) || pid <= 0) && Date.now() - statSync3(claim).mtimeMs < 6e4) return false;
        unlinkSync(claim);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    let fd;
    try {
      fd = openSync(claim, "wx", 384);
    } catch (error) {
      if (error.code === "EEXIST") return false;
      throw error;
    }
    claimed = true;
    try {
      writeFileSync2(fd, String(process.pid));
    } finally {
      closeSync(fd);
    }
    if (existsSync3(stamp) && Date.now() - statSync3(stamp).mtimeMs < task.interval_seconds * 1e3) {
      unlinkSync(claim);
      claimed = false;
      return false;
    }
    log = openSync(join6(home, `${TASK}.log`), "w", 384);
    const child = spawn(launcher, [runner, "run", TASK, control, "--repo-only", "--report"], {
      cwd: control,
      detached: true,
      stdio: ["ignore", log, log]
    });
    child.on("error", (error) => {
      appendLedger(control, "tasks", { task: TASK, event: "launch_failed", error: error.message, ts: Date.now() / 1e3 });
    });
    if (!child.pid) throw new Error(`could not launch ${TASK}`);
    writeFileSync2(claim, String(child.pid));
    writeFileSync2(stamp, "");
    appendLedger(control, "tasks", { task: TASK, event: "started", pid: child.pid, ts: Date.now() / 1e3 });
    child.unref();
    claimed = false;
    return true;
  } catch (error) {
    appendLedger(control, "tasks", { task: TASK, event: "launch_failed", error: error instanceof Error ? error.message : String(error), ts: Date.now() / 1e3 });
    return false;
  } finally {
    if (log !== void 0) closeSync(log);
    if (claimed && claim) {
      try {
        unlinkSync(claim);
      } catch {
      }
    }
  }
}

// adapters/process-hooks.ts
import { basename as basename9, dirname as dirname13, isAbsolute as isAbsolute5, resolve as resolve13 } from "node:path";

// domain/repo-layout.ts
import { existsSync as existsSync5, realpathSync as realpathSync3 } from "node:fs";
import { basename as basename2, join as join8, relative, resolve as resolve3 } from "node:path";

// lib/repocli.ts
import { realpathSync as realpathSync2, existsSync as existsSync4 } from "node:fs";
import { dirname as dirname6, join as join7, sep } from "node:path";
var InspectionError = class extends Error {
};
async function inspectRepository(repo) {
  try {
    const report = await inspect({ repository: repo, timeoutMs: 5e3 });
    if (!report.complete || report.diagnostics.length > 0) throw new Error("repository inspection incomplete");
    const checkout = realpathSync2(repo);
    for (const component of report.components) {
      let ancestor = join7(checkout, component.root);
      while (!existsSync4(ancestor)) ancestor = dirname6(ancestor);
      const resolved = realpathSync2(ancestor);
      if (resolved !== checkout && !resolved.startsWith(checkout + sep)) throw new Error("component root escapes checkout");
    }
    return report;
  } catch (error) {
    throw new InspectionError(`repository inspection unavailable: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

// domain/repo-layout.ts
var Component = class _Component {
  constructor(path, id, language, name = "", packageTools2 = []) {
    this.name = name;
    this.packageTools = packageTools2;
    this.path = path;
    this.id = id;
    this.language = language;
  }
  name;
  packageTools;
  path;
  id;
  language;
  static at(pathValue, gitRoot) {
    const path = realpathSync3(pathValue);
    const root = realpathSync3(gitRoot);
    const id = relative(root, path).replaceAll("\\", "/") || ".";
    return new _Component(pathValue, id.startsWith("../") ? path.replaceAll("\\", "/") : id, void 0);
  }
  static fromInfo(root, info) {
    return new _Component(join8(root, info.root), info.root, info.language, info.name, info.packageTools ?? []);
  }
};
function findGitRoot(path) {
  return findCheckout(path);
}
var ComponentCatalog = class {
  constructor(root, report) {
    this.root = root;
    this.report = report;
    this.components = report.components.map((info) => Component.fromInfo(root, info));
  }
  root;
  report;
  components;
  owner(target) {
    const path = relative(this.root, resolve3(target)).replaceAll("\\", "/");
    if (path === ".." || path.startsWith("../")) return void 0;
    const binding = owner(this.report, path || ".");
    return binding ? this.components.find((component) => component.id === binding.root) : void 0;
  }
  default() {
    for (const preferred of ["server", "backend", "."]) {
      const component = this.components.find((c) => c.id === preferred);
      if (component) return component;
    }
    if (this.components.length === 1) return this.components[0];
    throw new InspectionError("no default Component; select a discovered component explicitly");
  }
};
async function inspectCatalog(root) {
  const checkout = realpathSync3(root);
  return new ComponentCatalog(checkout, await inspectRepository(checkout));
}
function enclosingComponent(target, catalog) {
  return catalog.owner(target) ?? catalog.default();
}
function findAgentsDocument(repo, component) {
  return [component ? join8(component, "AGENTS.md") : "", join8(repo, "AGENTS.md")].find((path) => path && existsSync5(path));
}

// domain/context/workspace.ts
import { existsSync as existsSync8, lstatSync as lstatSync2, readdirSync, realpathSync as realpathSync4 } from "node:fs";
import { join as join9, resolve as resolve5 } from "node:path";

// lib/git-state.ts
import { appendFileSync as appendFileSync2, existsSync as existsSync6, mkdirSync as mkdirSync3, readFileSync as readFileSync3 } from "node:fs";
import { dirname as dirname7 } from "node:path";
var PROTECTED_BRANCHES = [/^main$/, /^master$/, /^release$/, /^release.*/, /.*release$/];
function isProtectedBranch(branch) {
  return branch !== void 0 && PROTECTED_BRANCHES.some((pattern) => pattern.test(branch));
}
function localDefaultTarget(repo) {
  const result = runGit(repo, ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"]);
  if (!result.ok && result.code !== 1) throw new Error(`cannot read default branch reference: ${result.stderr}`);
  const prefix = "refs/remotes/origin/";
  if (result.ok && result.stdout.startsWith(prefix)) return result.stdout.slice(prefix.length);
  if (targetExists(repo, "main")) return "main";
  if (targetExists(repo, "master")) return "master";
  return "main";
}
function ensureGitExclude(repo, pattern = "/.devloop/") {
  try {
    const path = gitPath(repo, "info/exclude");
    mkdirSync3(dirname7(path), { recursive: true });
    const existing = existsSync6(path) ? readFileSync3(path, "utf8") : "";
    if (existing.split("\n").some((line) => line.trim() === pattern.trim())) return;
    appendFileSync2(path, `${existing && !existing.endsWith("\n") ? "\n" : ""}${pattern}
`, "utf8");
  } catch {
  }
}

// lib/parsers.ts
import { existsSync as existsSync7, readFileSync as readFileSync4 } from "node:fs";
import { basename as basename3, dirname as dirname8, isAbsolute, resolve as resolve4 } from "node:path";
function read(path) {
  if (!existsSync7(path)) return void 0;
  try {
    return readFileSync4(path, "utf8");
  } catch {
    return void 0;
  }
}
function concretePath(value, base) {
  if (value.includes("<") || value.includes(">")) return value;
  const expanded = value.startsWith("~") ? `${process.env.HOME ?? ""}${value.slice(1)}` : value;
  return isAbsolute(expanded) ? expanded : resolve4(base, expanded);
}
function parseReferencesSection(path) {
  const content = read(path);
  if (content === void 0) return [];
  const match = /^##\s+References?\s*$/im.exec(content);
  if (!match?.index && match?.index !== 0) return [];
  const tail = content.slice(match.index + match[0].length);
  const block = tail.slice(0, /^##\s+/m.exec(tail)?.index ?? tail.length);
  const entries = [];
  for (const raw of block.split("\n")) {
    const body = raw.trim();
    if (!body.startsWith("-")) continue;
    const value = body.replace(/^-\s*/, "");
    const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(value);
    if (link?.[1] && link[2]) {
      const before = value.slice(0, link.index).replace(/[:：—-]+$/, "").trim();
      const after = value.slice(link.index + link[0].length).replace(/^[:：—-]+/, "").trim();
      const title = before || link[1].trim();
      const description = before ? [link[1] !== link[2] ? link[1] : "", after].filter(Boolean).join(" ") : after || link[1];
      entries.push({ title, path: concretePath(link[2].trim(), dirname8(path)), description });
      continue;
    }
    const bare = /`([^`]+\.md)`/.exec(value);
    if (bare?.[1]) {
      const description = `${value.slice(0, bare.index)} ${value.slice(bare.index + bare[0].length)}`.replace(/[:：—-]+/g, " ").trim();
      entries.push({ title: basename3(bare[1]), path: concretePath(bare[1], dirname8(path)), description: description || basename3(bare[1]) });
    }
  }
  return entries;
}
function parseSubprojectsSection(path) {
  const content = read(path);
  if (content === void 0) return [];
  const header = /^(#{2,4})\s+(?:子项目清单|Subprojects?)\s*$/im.exec(content);
  if (!header?.[1]) return [];
  const tail = content.slice((header.index ?? 0) + header[0].length);
  const next = new RegExp(`^#{2,${header[1].length}}\\s+`, "m").exec(tail);
  const lines = tail.slice(0, next?.index ?? tail.length).split("\n").filter((line) => line.trim().startsWith("|"));
  if (lines.length < 3 || lines[0] === void 0) return [];
  const headers = lines[0].trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
  return lines.slice(2).flatMap((line) => {
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim().replace(/^`|`$/g, ""));
    if (cells.length < headers.length || !cells[0]) return [];
    const names = cells[0].replace(/`/g, "").split("/").map((name) => name.trim()).filter(Boolean);
    const entry = {
      name: names[0],
      path: names[0],
      aliases: names.slice(1)
    };
    headers.forEach((name, index) => {
      const value = cells[index] ?? "";
      const lower = name.toLowerCase();
      if ((name.includes("\u7B80\u79F0") || lower.includes("alias")) && value) entry.aliases.push(...value.split("/").map((part) => part.trim()).filter(Boolean));
      else if (name.includes("\u8BED\u8A00") || lower.includes("language")) entry.language = value;
      else if (name.includes("\u89D2\u8272") || lower.includes("role")) entry.role = value;
      else if (name.includes("\u5907\u6CE8") || lower.includes("note")) entry.note = value;
    });
    if (!entry.role && entry.note) entry.role = entry.note;
    entry.aliases = [...new Set(entry.aliases.filter((alias) => alias !== entry.name))];
    return [entry];
  });
}

// domain/context/base.ts
var WORKSPACE_STALE_SECONDS = 600;
var TURN_TTL_SECONDS = 1800;
var SESSION_TTL_SECONDS = 14400;
var ACTIVE_REPO_TTL_SECONDS = 21600;
var REVIEW_STALE_SECONDS = 1800;
var REVIEW_FINDING_NUDGE_CAP = 3;
var REVIEW_NUDGE_CAP = 1;
function referenceFrom(entry) {
  return { title: entry.title, path: entry.path, ...entry.description ? { hook: entry.description } : {} };
}
function now() {
  return Date.now() / 1e3;
}
function stale(timestamp, ttl, at = now()) {
  return timestamp === void 0 || at - timestamp >= ttl;
}
function formatTimestamp(timestamp) {
  if (!timestamp) return "never";
  const date = new Date(timestamp * 1e3);
  if (Number.isNaN(date.valueOf())) return "never";
  const fields = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()];
  const [year, month, day, hour, minute] = fields.map((value, index) => index === 0 ? String(value) : String(value).padStart(2, "0"));
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

// domain/context/workspace.ts
var DISCOVERY_SKIP = /* @__PURE__ */ new Set(["docs", "worktrees", "worktree", "node_modules"]);
function isGitRepository(path) {
  return existsSync8(join9(path, ".git"));
}
function discoverSubprojectNames(root) {
  try {
    return readdirSync(root).filter((name) => {
      if (name.startsWith(".") || DISCOVERY_SKIP.has(name)) return false;
      const path = join9(root, name);
      try {
        return (lstatSync2(path).isDirectory() || lstatSync2(path).isSymbolicLink()) && isGitRepository(path);
      } catch {
        return false;
      }
    }).sort();
  } catch {
    return [];
  }
}
function mergeSubprojects(root, declared) {
  const byName = new Map(declared.map((entry) => [entry.name, entry]));
  return discoverSubprojectNames(root).map((name) => {
    const entry = byName.get(name);
    const path = join9(root, name);
    let canonical;
    try {
      const real = realpathSync4(path);
      if (real !== resolve5(path)) canonical = real;
    } catch {
    }
    return {
      name,
      path,
      aliases: entry?.aliases ?? [],
      ...entry?.language ? { language: entry.language } : {},
      ...entry?.role ? { role: entry.role } : {},
      ...canonical ? { canonical } : {}
    };
  });
}
var WorkspaceContext = class _WorkspaceContext {
  constructor(workspaceRoot2, agentsDocument, subprojects, parsedAt) {
    this.workspaceRoot = workspaceRoot2;
    this.agentsDocument = agentsDocument;
    this.subprojects = subprojects;
    this.parsedAt = parsedAt;
  }
  workspaceRoot;
  agentsDocument;
  subprojects;
  parsedAt;
  static load(root) {
    const record2 = loadWorkspace(root);
    if (!record2) return void 0;
    const references = (record2.agents_md?.references ?? []).map((reference2) => ({
      title: reference2.title ?? "",
      path: reference2.path ?? "",
      ...reference2.hook ? { hook: reference2.hook } : {}
    }));
    return new _WorkspaceContext(
      record2.workspace_root || resolve5(root),
      { ...record2.agents_md?.path ? { path: record2.agents_md.path } : {}, references },
      record2.subprojects.map((entry) => ({
        name: entry.name ?? "",
        path: entry.path ?? "",
        aliases: entry.aliases ?? [],
        ...entry.language ? { language: entry.language } : {},
        ...entry.role ? { role: entry.role } : {},
        ...entry.canonical ? { canonical: entry.canonical } : {}
      })),
      record2.parsed_at || 0
    );
  }
  static refresh(rootValue) {
    const root = resolve5(rootValue);
    const agentsPath = join9(root, "AGENTS.md");
    const hasAgents = existsSync8(agentsPath);
    const context = new _WorkspaceContext(
      root,
      { ...hasAgents ? { path: agentsPath } : {}, references: hasAgents ? parseReferencesSection(agentsPath).map(referenceFrom) : [] },
      mergeSubprojects(root, hasAgents ? parseSubprojectsSection(agentsPath) : []),
      now()
    );
    context.save();
    return context;
  }
  save() {
    saveWorkspace(this.workspaceRoot, {
      workspace_root: this.workspaceRoot,
      agents_md: {
        ...this.agentsDocument.path ? { path: this.agentsDocument.path } : {},
        references: this.agentsDocument.references.map((reference2) => ({
          title: reference2.title,
          path: reference2.path,
          ...reference2.hook ? { hook: reference2.hook } : {}
        }))
      },
      subprojects: this.subprojects.map((item) => ({
        name: item.name,
        path: item.path,
        aliases: [...item.aliases],
        ...item.language ? { language: item.language } : {},
        ...item.role ? { role: item.role } : {},
        ...item.canonical ? { canonical: item.canonical } : {}
      })),
      parsed_at: this.parsedAt
    });
    if (existsSync8(join9(this.workspaceRoot, ".git"))) ensureGitExclude(this.workspaceRoot);
  }
  isStale(ttl = WORKSPACE_STALE_SECONDS) {
    return stale(this.parsedAt || void 0, ttl);
  }
};

// domain/context/session.ts
import { closeSync as closeSync2, existsSync as existsSync9, mkdirSync as mkdirSync4, openSync as openSync2, readFileSync as readFileSync5, readdirSync as readdirSync2, renameSync as renameSync2, statSync as statSync4, unlinkSync as unlinkSync2, writeFileSync as writeFileSync3 } from "node:fs";
import { basename as basename4, dirname as dirname9, join as join10, resolve as resolve6 } from "node:path";
var OWNER_TTL_SECONDS = 1800;
function identityFromEnvironment() {
  const codex = process.env.CODEX_THREAD_ID ?? process.env.CODEX_SESSION_ID;
  if (codex) return { harness: "codex", sessionId: codex };
  if (process.env.CLAUDE_CODE_SESSION_ID) return { harness: "claude", sessionId: process.env.CLAUDE_CODE_SESSION_ID };
  return { harness: "unknown", sessionId: "" };
}
function safeHarness(harness) {
  return harness.trim().toLowerCase().replace(/[^A-Za-z0-9._-]/g, "-") || "unknown";
}
function lockFile(repo) {
  return join10(workingTreeStateDirectory(repo), "owner.lock");
}
function legacyLockFile(repo, harness) {
  return join10(workingTreeStateDirectory(repo), `${safeHarness(harness)}.owner.lock`);
}
function readOwnerFile(path) {
  try {
    const value = JSON.parse(readFileSync5(path, "utf8"));
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
  } catch {
    return void 0;
  }
}
function readOwner(repo) {
  return readOwnerFile(lockFile(repo));
}
function pidAlive(pid) {
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}
function active(owner2, at) {
  return owner2 !== void 0 && (pidAlive(owner2.pid) || at - owner2.acquired_at < OWNER_TTL_SECONDS);
}
function foreignOwner(repo, sessionId2, harness = "claude", at = now()) {
  const owner2 = anyActiveOwner(repo, at);
  return owner2 && (owner2.session_id !== sessionId2 || owner2.harness !== safeHarness(harness)) ? owner2 : void 0;
}
function anyActiveOwner(repo, at = now()) {
  const current = readOwner(repo);
  if (active(current, at)) return current;
  try {
    for (const name of readdirSync2(workingTreeStateDirectory(repo))) {
      if (!name.endsWith(".owner.lock")) continue;
      const owner2 = readOwnerFile(join10(workingTreeStateDirectory(repo), name));
      if (active(owner2, at)) return owner2;
    }
  } catch {
  }
  return void 0;
}
function acquireOwner(repo, identity2, branch = currentBranch(repo) ?? "", at = now(), pid = process.ppid) {
  if (!identity2.sessionId) return true;
  const harness = safeHarness(identity2.harness);
  const path = lockFile(repo);
  const record2 = { harness, session_id: identity2.sessionId, pid, branch, acquired_at: at };
  const owner2 = anyActiveOwner(repo, at);
  if (owner2?.session_id === identity2.sessionId && owner2.harness === harness) {
    try {
      const temporary = `${path}.${process.pid}.tmp`;
      writeFileSync3(temporary, JSON.stringify(record2));
      renameSync2(temporary, path);
      try {
        unlinkSync2(legacyLockFile(repo, harness));
      } catch {
      }
    } catch {
    }
    return true;
  }
  if (owner2) return false;
  try {
    ensureGitExclude(repo);
    mkdirSync4(workingTreeStateDirectory(repo), { recursive: true });
    if (existsSync9(path)) unlinkSync2(path);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const descriptor = openSync2(path, "wx", 420);
        writeFileSync3(descriptor, JSON.stringify(record2));
        closeSync2(descriptor);
        return true;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        const current = readOwner(repo);
        if (current) return current.session_id === identity2.sessionId && current.harness === harness;
        try {
          unlinkSync2(path);
        } catch {
        }
      }
    }
    return false;
  } catch {
    return true;
  }
}
function releaseOwner(repo, identity2) {
  if (!identity2.sessionId) return false;
  const harness = safeHarness(identity2.harness);
  let released = false;
  const current = readOwner(repo);
  if (current?.session_id === identity2.sessionId && current.harness === harness) {
    try {
      unlinkSync2(lockFile(repo));
      released = true;
    } catch {
    }
  }
  const legacy = readOwnerFile(legacyLockFile(repo, harness));
  if (legacy?.session_id === identity2.sessionId) {
    try {
      unlinkSync2(legacyLockFile(repo, harness));
      released = true;
    } catch {
    }
  }
  return released;
}
function ownerDescription(owner2) {
  return `branch '${owner2.branch || "?"}', session ${owner2.session_id.slice(0, 8)}...`;
}
function repositoryName(repo) {
  return basename4(repo);
}
function sessionName(sessionId2) {
  return (sessionId2 ?? identityFromEnvironment().sessionId).replace(/[^A-Za-z0-9._-]/g, "-") || "anon";
}
function activeRepoFile(workspaceRoot2, sessionId2) {
  return join10(stateDirectory(workspaceRoot2), "active", `${sessionName(sessionId2)}.json`);
}
function activeBinding(path, enforceTtl) {
  try {
    const value = JSON.parse(readFileSync5(path, "utf8"));
    if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
    const row = value;
    if (typeof row.repo_dir !== "string" || !existsSync9(row.repo_dir)) return void 0;
    const timestamp = typeof row.ts === "number" ? row.ts : statSync4(path).mtimeMs / 1e3;
    const age = Math.max(0, now() - timestamp);
    return enforceTtl && age >= ACTIVE_REPO_TTL_SECONDS ? void 0 : { repo: row.repo_dir, age };
  } catch {
    return void 0;
  }
}
function recordActiveRepo(workspaceRoot2, repo, sessionId2) {
  const path = activeRepoFile(workspaceRoot2, sessionId2);
  try {
    mkdirSync4(dirname9(path), { recursive: true });
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync3(temporary, JSON.stringify({ repo_dir: resolve6(repo), ts: now() }));
    renameSync2(temporary, path);
  } catch {
  }
}
function loadActiveRepo(workspaceRoot2, sessionId2) {
  return activeBinding(activeRepoFile(workspaceRoot2, sessionId2), true)?.repo;
}
function loadActiveRepoLenient(workspaceRoot2, sessionId2) {
  return activeBinding(activeRepoFile(workspaceRoot2, sessionId2), false);
}
function clearActiveRepo(workspaceRoot2, sessionId2) {
  try {
    unlinkSync2(activeRepoFile(workspaceRoot2, sessionId2));
  } catch {
  }
}
function recordSessionEvent(repo, sessionId2, kind, fields = {}) {
  appendLedger(repo, `sessions/${sessionName(sessionId2)}`, { ts: Math.round(now() * 10) / 10, kind, ...fields });
}

// domain/context/tool-calls.ts
import { existsSync as existsSync10, mkdirSync as mkdirSync5, readFileSync as readFileSync6, renameSync as renameSync3, statSync as statSync5, utimesSync, writeFileSync as writeFileSync4 } from "node:fs";
import { join as join11 } from "node:path";
var TOOL_CALL_SCHEMA = "devloop.tool-call/v1";
var FILE_NAME = "tool-calls.jsonl";
var WINDOW_SECONDS = 3600;
var COMPACT_INTERVAL_SECONDS = 60;
function appendToolCall(root, record2, at = Date.now() / 1e3) {
  const directory = stateDirectory(root);
  const path = join11(directory, FILE_NAME);
  const marker = join11(directory, "tool-calls.compact");
  try {
    mkdirSync5(directory, { recursive: true });
    const due = !existsSync10(marker) || at - statSync5(marker).mtimeMs / 1e3 >= COMPACT_INTERVAL_SECONDS;
    if (due) {
      compact(path, at - WINDOW_SECONDS);
      writeFileSync4(marker, "", { flag: "a" });
      utimesSync(marker, at, at);
    }
    appendLedger(root, "tool-calls", record2);
  } catch {
  }
}
function toolCallStartedAt(root, callId, at = Date.now() / 1e3) {
  if (!callId) return void 0;
  try {
    const rows2 = readFileSync6(join11(stateDirectory(root), FILE_NAME), "utf8").trimEnd().split("\n").reverse();
    for (const row of rows2) {
      let value;
      try {
        value = JSON.parse(row);
      } catch {
        continue;
      }
      if (value === null || typeof value !== "object" || Array.isArray(value)) continue;
      const record2 = value;
      if (typeof record2.ts !== "number") continue;
      if (record2.ts < at - WINDOW_SECONDS) break;
      if (record2.schema === TOOL_CALL_SCHEMA && record2.phase === "started" && record2.call_id === callId) return record2.ts;
    }
  } catch {
  }
  return void 0;
}
function compact(path, cutoff) {
  if (!existsSync10(path)) return;
  try {
    const retained = readFileSync6(path, "utf8").split("\n").flatMap((line) => {
      try {
        const record2 = JSON.parse(line);
        return record2 !== null && typeof record2 === "object" && !Array.isArray(record2) && typeof record2.ts === "number" && record2.ts >= cutoff ? [JSON.stringify(record2)] : [];
      } catch {
        return [];
      }
    });
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync4(temporary, retained.map((line) => `${line}
`).join(""), "utf8");
    renameSync3(temporary, path);
  } catch {
  }
}

// domain/workspace.ts
import { existsSync as existsSync12, statSync as statSync6 } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { join as join13, resolve as resolve8 } from "node:path";

// lib/config.ts
import { existsSync as existsSync11, mkdirSync as mkdirSync6, readFileSync as readFileSync7, renameSync as renameSync4, writeFileSync as writeFileSync5 } from "node:fs";
import { homedir } from "node:os";
import { dirname as dirname10, isAbsolute as isAbsolute2, join as join12, resolve as resolve7 } from "node:path";
var DEFAULTS = {
  workspaces: [],
  forges: {},
  lifecycle: { default: { pre_commit: [], post_commit: [], pre_mr: [], post_mr: [] }, repos: {} },
  arch: {
    default: {
      enabled: false,
      layers: { "/api/": "api", "/service/": "service", "/dao/": "dao", "/model/": "model" },
      order: ["api", "service", "dao", "model"]
    },
    repos: {}
  }
};
function object2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function expandPath(value) {
  let expanded = value.startsWith("~") ? join12(homedir(), value.slice(1)) : value;
  expanded = expanded.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, braced, bare) => process.env[braced || bare] ?? "");
  return expanded;
}
function configDirectory() {
  return process.env.DEVLOOP_CONFIG_DIR ? expandPath(process.env.DEVLOOP_CONFIG_DIR) : join12(homedir(), ".devloop");
}
function configFile() {
  return join12(configDirectory(), "config.json");
}
function deepMerge(base, override) {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    result[key] = value !== null && typeof value === "object" && !Array.isArray(value) && current !== null && typeof current === "object" && !Array.isArray(current) ? deepMerge(current, value) : value;
  }
  return result;
}
function readJson2(path) {
  if (!existsSync11(path)) return void 0;
  try {
    const parsed = JSON.parse(readFileSync7(path, "utf8"));
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : void 0;
  } catch {
    return void 0;
  }
}
function ancestorFiles(root) {
  const global2 = resolve7(configFile());
  const home = resolve7(homedir());
  const found = [];
  let current = root;
  while (true) {
    const candidate = join12(current, ".devloop", "config.json");
    if (resolve7(candidate) !== global2 && existsSync11(candidate)) found.push(candidate);
    if (current === home || current === dirname10(current)) break;
    current = dirname10(current);
  }
  return found.reverse();
}
function resolveLayer(layer, repoKeys) {
  const result = { ...layer };
  for (const name of ["lifecycle", "arch"]) {
    if (!(name in layer)) continue;
    const section = object2(layer[name]);
    let policy = object2(section.default);
    for (const key of repoKeys) policy = deepMerge(policy, object2(object2(section.repos)[key]));
    result[name] = { ...section, default: policy };
  }
  return result;
}
function loadConfig(repo) {
  const checkout = repo ? resolve7(expandPath(repo)) : void 0;
  let main;
  try {
    main = checkout ? mainRepoRoot(checkout) : void 0;
  } catch {
    main = void 0;
  }
  const repoKeys = [...new Set([main, checkout].filter((path) => path !== void 0))];
  const files = [...new Set(repoKeys.flatMap(ancestorFiles))];
  const global2 = deepMerge(DEFAULTS, readJson2(configFile()) ?? {});
  let result = resolveLayer(global2, repoKeys);
  for (const path of files) result = deepMerge(result, resolveLayer(readJson2(path) ?? {}, repoKeys));
  result.workspaces = global2.workspaces ?? [];
  return result;
}
function saveConfig(data) {
  const path = configFile();
  mkdirSync6(dirname10(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync5(temporary, `${JSON.stringify(data, null, 2)}
`, "utf8");
  renameSync4(temporary, path);
}
function updateConfig(mutate) {
  const data = deepMerge(DEFAULTS, readJson2(configFile()) ?? {});
  mutate(data);
  saveConfig(data);
  return data;
}
function workspaces() {
  const values = deepMerge(DEFAULTS, readJson2(configFile()) ?? {}).workspaces;
  return Array.isArray(values) ? values.filter((value) => typeof value === "string").map(expandPath) : [];
}
function setWorkspaces(paths) {
  updateConfig((data) => {
    data.workspaces = [...paths];
  });
}
function forgeEntry(host, repo) {
  return object2(object2(loadConfig(repo).forges)[host]);
}
function forgeToken(host, provider, repo) {
  const variables = provider === "github" ? ["GITHUB_TOKEN", "GH_TOKEN"] : provider === "gitlab" ? ["GITLAB_TOKEN"] : [];
  for (const variable of variables) {
    const token = process.env[variable]?.trim();
    if (token) return token;
  }
  const configured = forgeEntry(host, repo).token;
  return typeof configured === "string" && configured.trim() ? configured.trim() : void 0;
}
function lifecycleConfig(repo) {
  return object2(object2(loadConfig(repo).lifecycle).default);
}
function architectureConfig(repo) {
  return object2(object2(loadConfig(repo).arch).default);
}

// domain/workspace.ts
function reserved(path) {
  const root = resolve8(path);
  return [
    process.env.CODEX_HOME ?? join13(homedir2(), ".codex"),
    process.env.CLAUDE_HOME ?? join13(homedir2(), ".claude")
  ].some((candidate) => resolve8(expandPath(candidate)) === root);
}
function registeredWorkspaces() {
  return workspaces().map((path) => resolve8(path)).filter((path) => !reserved(path));
}
function registerWorkspace(path) {
  const root = resolve8(expandPath(path));
  if (reserved(root)) return;
  const current = [...registeredWorkspaces()];
  if (!current.includes(root)) setWorkspaces([...current, root]);
}
function maybeRegisterWorkspace(path) {
  const root = resolve8(path);
  if (reserved(root) || !existsSync12(root) || !statSync6(root).isDirectory() || existsSync12(join13(root, ".git"))) return void 0;
  const agents = join13(root, "AGENTS.md");
  if (!existsSync12(agents)) return void 0;
  if (discoverSubprojectNames(root).length === 0 && parseSubprojectsSection(agents).length === 0) return void 0;
  registerWorkspace(root);
  return root;
}
function findContainingWorkspace(path) {
  const target = resolve8(path);
  return registeredWorkspaces().find((root) => target === root || target.startsWith(`${root}/`));
}

// domain/board/delivery.ts
import { unlinkSync as unlinkSync3 } from "node:fs";

// domain/forge.ts
function pullRequestInactive(pr) {
  return pr.state === "merged" || pr.state === "closed";
}
function pullRequestOpen(pr) {
  return pr.state === "open";
}
function vocabulary(provider) {
  return provider === "gitlab" ? ["MR", "!"] : ["PR", "#"];
}
function pullRequestLabel(provider, number3) {
  const [noun, sigil] = vocabulary(provider);
  return `${noun} ${sigil}${number3}`;
}

// domain/board/render.ts
import { basename as basename5 } from "node:path";
function rows(value) {
  return Array.isArray(value) ? value.filter((item) => item !== null && typeof item === "object" && !Array.isArray(item)) : [];
}
function text(value) {
  return typeof value === "string" ? value : "";
}
function number(value) {
  return typeof value === "number" ? value : 0;
}
function reference(item) {
  const title = text(item.title) || "?";
  const path = text(item.path);
  const description = text(item.description).trim();
  const base = basename5(path);
  return description && description !== base && description !== path ? `${title} \u2014 ${description}  \u2190 ${base}` : `${title}  \u2190 ${base}`;
}
function renderItem(item) {
  const payload = item.payload;
  if (item.type === "workspace") {
    const lines = [`[Workspace: ${text(payload.root)}]`];
    const references = rows(payload.references);
    if (references.length) lines.push("AGENTS.md references (Read when the task touches these topics):", ...references.map((row) => `  - ${reference(row)}`));
    const projects = rows(payload.subprojects);
    if (projects.length) lines.push("Subprojects:", ...projects.slice(0, 12).map((project) => {
      const aliases = Array.isArray(project.aliases) && project.aliases.length ? ` (${project.aliases.join(", ")})` : "";
      const note = [text(project.language), text(project.role)].filter(Boolean).join(" \xB7 ");
      return `  - ${text(project.name)}${aliases}: ${note}${text(project.canonical) ? ` \u2192 ${text(project.canonical)}` : ""}`;
    }));
    return lines.join("\n");
  }
  if (item.type === "repo.references") return ["Repo AGENTS.md references (Read when the task touches these topics):", ...rows(payload.references).map((row) => `  - ${reference(row)}`)].join("\n");
  if (item.type === "repo.identity") {
    const dirty = payload.workspaceDirty ? `dirty(${number(payload.modifiedCount)} modified, ${number(payload.untrackedCount)} untracked)` : payload.workspaceDirty === null ? "unknown" : "clean";
    const warnings = [payload.protected ? "PROTECTED" : "", typeof payload.staleBindingHours === "number" ? `repo binding is ${payload.staleBindingHours.toFixed(1)}h old; confirm the repo with cd` : ""].filter(Boolean);
    if (payload.inspectionProblem) warnings.push(text(payload.inspectionProblem));
    return `[Current repo: ${text(payload.codeDir) || text(payload.repoRoot)} (${text(payload.language) || "?"})] | Branch: ${text(payload.branch) || "?"}${payload.linkedWorktree === null ? " (checkout unknown)" : payload.linkedWorktree ? " (worktree)" : ""} (ahead ${typeof payload.ahead === "number" ? payload.ahead : "?"}, behind ${typeof payload.behind === "number" ? payload.behind : "?"} vs ${text(payload.baseBranch)}, target=${text(payload.targetBranch)}) | Workspace: ${dirty}${warnings.length ? ` \u26A0\uFE0F ${warnings.join("; ")}` : ""}`;
  }
  if (item.type === "repo.pull-request") {
    if (payload.error) return `PR status unavailable: ${text(payload.error)}`;
    if (payload.ambiguous) return `Branch '${text(payload.branch)}' matches multiple PRs; select a proposal explicitly.`;
    return `${pullRequestLabel(text(payload.provider), number(payload.number))} ${text(payload.state)} (${text(payload.repository)})`;
  }
  if (item.type === "repo.validation") {
    const components = rows(payload.components);
    const history = components.length === 0 ? "Validation history: no recorded runs" : `Validation: ${components.map((row) => `${text(row.component)}: lint=${formatTimestamp(typeof row.lintAt === "number" ? row.lintAt : void 0)}, test=${formatTimestamp(typeof row.testAt === "number" ? row.testAt : void 0)}`).join(" | ")}`;
    const analysis = payload.analysis;
    const scopes = rows(analysis?.checks).map((row) => `${text(row.component)} ${text(row.check)}=${text(row.scope)} (${text(row.reason)})`);
    const unavailable = Array.isArray(payload.unavailableLintComponents) ? payload.unavailableLintComponents.filter((value) => typeof value === "string") : [];
    const availability = unavailable.length ? [`Lint unavailable: ${unavailable.join(", ")} \u2014 no make lint/lint-ci entry (non-blocking)`] : [];
    const unavailableTests = Array.isArray(payload.unavailableTestComponents) ? payload.unavailableTestComponents.filter((value) => typeof value === "string") : [];
    if (unavailableTests.length) availability.push(`Test unavailable: ${unavailableTests.join(", ")} \u2014 no make test/test-ci/test-local entry (non-blocking)`);
    return [history, ...availability, ...scopes.length ? [`Latest validation scope: ${scopes.join(" | ")}`] : []].join("\n");
  }
  if (item.type === "repo.review") return renderReview(payload);
  return "";
}
function renderPrompt(items) {
  return items.map(renderItem).filter(Boolean).join("\n\n");
}
function renderReview(payload) {
  const status = text(payload.status);
  const sha = text(payload.reviewedSha).slice(0, 9);
  const artifact = text(payload.artifactPath);
  if (status === "running" || status === "stale") return `Review: ${status} on ${sha}; see ${artifact}`;
  const parts = [];
  const findings = number(payload.findings);
  const failed = number(payload.failedFiles);
  if (findings) parts.push(`${findings} finding(s)`);
  if (failed) parts.push(`${failed} file(s) failed`);
  if (status === "error" || status === "failed") parts.push("review errored");
  else if (status === "completed_with_errors") parts.push("review incomplete");
  else if (status === "completed_with_warnings") parts.push("review warnings");
  else if (status !== "success") parts.push(`review ${status}`);
  const message = text(payload.message).trim();
  const reason = status !== "success" && message ? ` \u2014 ${message}` : "";
  return `Review: ${parts.length ? parts.join(", ") : "clean (no findings)"} on ${sha}${reason}; see ${artifact}`;
}

// domain/board/delivery.ts
var RULES = {
  workspace: { channels: ["prompt", "ui"], promptScope: "session", replayAfterCompact: true },
  "repo.references": { channels: ["prompt", "ui"], promptScope: "session", replayAfterCompact: true },
  "repo.pull-request": { channels: ["prompt", "ui"], promptScope: "turn", replayAfterCompact: true },
  "repo.identity": { channels: ["prompt", "ui"], promptScope: "turn", replayAfterCompact: true },
  "repo.validation": { channels: ["prompt", "ui"], promptScope: "turn", replayAfterCompact: true },
  "repo.pr-blocked": { channels: ["prompt", "ui"], promptScope: "turn", maxDeliveries: 1, replayAfterCompact: false },
  "repo.review": { channels: ["prompt", "ui"], promptScope: "turn", maxDeliveries: REVIEW_NUDGE_CAP, replayAfterCompact: false },
  "repo.review-findings": { channels: ["prompt", "ui"], promptScope: "turn", maxDeliveries: REVIEW_FINDING_NUDGE_CAP, replayAfterCompact: false },
  "repo.pr-history": { channels: ["ui"], replayAfterCompact: true }
};
function itemsFor(view, channel) {
  return view.items.filter((item) => RULES[item.type].channels.includes(channel));
}
var PromptDelivery = class {
  constructor(root, sessionId2) {
    this.root = root;
    this.sessionId = sessionId2;
  }
  root;
  sessionId;
  segment() {
    return `board/sessions/${sessionName(this.sessionId)}`;
  }
  load() {
    const raw = loadSegment(this.root, this.segment())?.items;
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw).flatMap(([key, value]) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
      const row = value;
      return [[key, { item_type: text2(row.item_type ?? row.item_key), signature: text2(row.signature), count: number2(row.count), ...typeof row.last_emit_at === "number" ? { last_emit_at: row.last_emit_at } : {} }]];
    }));
  }
  deliver(view, trigger = "user_prompt") {
    const receipt = this.load();
    const at = now();
    const due = view.items.filter((item) => {
      const rule = RULES[item.type];
      if (!rule.channels.includes("prompt") || trigger === "session_start" && rule.promptScope !== "session") return false;
      const mark = receipt[item.id];
      if (!mark || mark.signature !== item.signature) return true;
      if (rule.maxDeliveries !== void 0) return mark.count < rule.maxDeliveries;
      const ttl = rule.promptScope === "session" ? SESSION_TTL_SECONDS : TURN_TTL_SECONDS;
      return mark.last_emit_at === void 0 || at - mark.last_emit_at >= ttl;
    });
    if (due.length === 0) return void 0;
    for (const item of due) {
      const previous = receipt[item.id];
      const same = previous?.signature === item.signature;
      receipt[item.id] = { item_type: item.type, signature: item.signature, count: same ? previous.count + 1 : 1, last_emit_at: at };
    }
    saveSegment(this.root, this.segment(), { items: receipt });
    return renderPrompt(due);
  }
  afterCompact() {
    const receipt = this.load();
    let changed = false;
    for (const mark of Object.values(receipt)) {
      const type = mark.item_type;
      const rule = RULES[type];
      if (rule?.replayAfterCompact) {
        mark.signature = "";
        mark.count = 0;
        delete mark.last_emit_at;
        changed = true;
      }
    }
    if (changed) saveSegment(this.root, this.segment(), { items: receipt });
  }
  clear() {
    try {
      unlinkSync3(segmentFile(this.root, this.segment()));
    } catch {
    }
  }
};
function text2(value) {
  return typeof value === "string" ? value : "";
}
function number2(value) {
  return typeof value === "number" ? value : 0;
}

// lib/forge.ts
import { createHash as createHash5 } from "node:crypto";
import { homedir as homedir3 } from "node:os";
import { join as join14 } from "node:path";
async function prContextForRepo(repo) {
  const origin = await remote(repo);
  if (!origin) return void 0;
  const entry = forgeEntry(origin.host, repo);
  const provider = entry.type === "github" || entry.type === "gitlab" ? entry.type : origin.host === "github.com" || origin.host.startsWith("github.") ? "github" : "gitlab";
  const token = forgeToken(origin.host, provider, repo);
  if (!token) return void 0;
  const forge = origin.host === "github.com" ? "github" : origin.host === "gitlab.com" ? "gitlab" : origin.host;
  const host = typeof entry.api_host === "string" && entry.api_host ? entry.api_host : origin.host;
  const source = { forge: { name: forge }, path: origin.path };
  const target = { forge: source.forge, path: typeof entry.target_repository === "string" && entry.target_repository ? entry.target_repository : source.path };
  const reader = createForgeReader({ forge, provider, host, token });
  const connection = createHash5("sha256").update(JSON.stringify([provider, forge, host, token])).digest("hex");
  return new PullRequestContext(reader, { checkout: repo, source, targets: [target], stateDir: join14(homedir3(), ".repocli"), connection });
}

// domain/validation-evidence.ts
import { createHash as createHash6 } from "node:crypto";
import { readFileSync as readFileSync8, realpathSync as realpathSync5 } from "node:fs";
function evidenceSegment(repo, component, check) {
  return "validation_results/" + createHash6("sha256").update(`${realpathSync5(repo)}\0${component}\0${check}`).digest("hex");
}
function object3(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function fullEvidence(repo, component, check, reference2) {
  const ref = object3(reference2);
  const segment = evidenceSegment(repo, component, check);
  if (ref.evidence !== segment) return void 0;
  const record2 = loadSegment(repo, segment) ?? {};
  const report = object3(record2.report);
  if (record2.eligible !== true || report.schemaVersion !== 1 || report.inputsConsistent !== true || report.checkout !== realpathSync5(repo) || typeof report.snapshot !== "string" || !report.snapshot || typeof record2.checked_at !== "string" || record2.checked_at !== ref.checked_at) return void 0;
  for (const raw of Array.isArray(report.components) ? report.components : []) {
    const group = object3(raw);
    for (const rawCheck of Array.isArray(group.checks) ? group.checks : []) {
      const result = object3(rawCheck);
      if (object3(group.component).root !== component && !(Array.isArray(result.requestedComponents) && result.requestedComponents.includes(component))) continue;
      if (result.check === check && result.scope === "full" && result.status === "passed" && result.checkedAt === record2.checked_at) return record2;
    }
  }
  return void 0;
}
function fullProjection(repo, branch, check) {
  const refs = loadSegment(repo, branchSegment(branch, check)) ?? {};
  return Object.fromEntries(Object.entries(refs).flatMap(([component, reference2]) => {
    const record2 = fullEvidence(repo, component, check, reference2);
    return record2 ? [[component, { passed_at: Date.parse(String(record2.checked_at)) / 1e3, fingerprint: object3(record2.report).snapshot ?? null }]] : [];
  }));
}
function reusableFullEvidence(record2, fingerprint) {
  if (!record2 || !fingerprint) return false;
  const report = object3(record2.report);
  if (report.snapshot !== fingerprint) return false;
  try {
    return (Array.isArray(report.components) ? report.components : []).every((raw) => {
      const group = object3(raw);
      return (Array.isArray(group.checks) ? group.checks : []).every((rawCheck) => {
        const check = object3(rawCheck);
        if (object3(check.inputs).disableReuse === true) return false;
        return Object.entries(object3(check.witnesses)).every(([path, digest2]) => createHash6("sha256").update(readFileSync8(path)).digest("hex") === digest2);
      });
    });
  } catch {
    return false;
  }
}
function observedCheck(repo, component, check) {
  const report = object3((loadSegment(repo, evidenceSegment(repo, component, check)) ?? {}).report);
  if (report.schemaVersion !== 1 || report.checkout !== realpathSync5(repo)) return void 0;
  for (const raw of Array.isArray(report.components) ? report.components : []) {
    const group = object3(raw);
    for (const rawCheck of Array.isArray(group.checks) ? group.checks : []) {
      const result = object3(rawCheck);
      if (object3(group.component).root !== component && !(Array.isArray(result.requestedComponents) && result.requestedComponents.includes(component))) continue;
      if (result.check === check) return result;
    }
  }
  return void 0;
}

// domain/board/model.ts
import { createHash as createHash7 } from "node:crypto";
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stable(item)]));
  }
  return value;
}
function boardItem(type, kind, scope, payload) {
  const owner2 = scope.repoRoot ?? scope.workspaceRoot;
  const identity2 = { type, kind, scope, payload };
  return {
    id: `${owner2}:${type}`,
    type,
    kind,
    scope,
    payload,
    signature: createHash7("sha1").update(JSON.stringify(stable(identity2))).digest("hex")
  };
}
var BoardView = class _BoardView {
  constructor(root, focus, items) {
    this.root = root;
    this.focus = focus;
    this.items = items;
  }
  root;
  focus;
  items;
  select(items) {
    return new _BoardView(this.root, this.focus, items);
  }
  toJSON() {
    return {
      root: this.root,
      focus: this.focus ?? null,
      items: this.items.map(({ signature: _signature, ...item }) => item)
    };
  }
};
var Board = class {
  constructor(root, items) {
    this.root = root;
    this.items = items;
  }
  root;
  items;
  view(focus) {
    const items = !focus?.repoRoot ? this.items : this.items.filter((item) => !item.scope.repoRoot || item.scope.repoRoot === focus.repoRoot);
    return new BoardView(this.root, focus, items);
  }
};

// domain/board/projection.ts
async function projectBoard(root, workspace, repo, staleBindingHours) {
  const items = [];
  if (workspace && (workspace.agentsDocument.references.length > 0 || workspace.subprojects.length > 0)) {
    items.push(boardItem("workspace", "state", { workspaceRoot: root }, {
      root: workspace.workspaceRoot,
      references: workspace.agentsDocument.references.map((item) => ({ title: item.title, path: item.path, description: item.hook ?? "" })),
      subprojects: workspace.subprojects.map((item) => ({
        name: item.name,
        aliases: item.aliases,
        language: item.language ?? "",
        role: item.role ?? "",
        canonical: item.canonical ?? ""
      }))
    }));
  }
  if (!repo) return new Board(root, items);
  const scope = { workspaceRoot: root, repoRoot: repo };
  let component, inspectionProblem = "";
  let unavailableLintComponents = [];
  let unavailableTestComponents = [];
  try {
    const catalog = await inspectCatalog(repo);
    unavailableLintComponents = catalog.components.filter((item) => observedCheck(repo, item.id, "lint")?.status === "unavailable").map((item) => item.id);
    unavailableTestComponents = catalog.components.filter((item) => observedCheck(repo, item.id, "test")?.status === "unavailable").map((item) => item.id);
    if (catalog.components.length > 0) component = catalog.default();
  } catch (error) {
    if (!(error instanceof InspectionError)) throw error;
    inspectionProblem = error.message;
  }
  const agents = findAgentsDocument(repo, component?.path);
  const references = agents ? parseReferencesSection(agents) : [];
  if (references.length > 0) {
    items.push(boardItem("repo.references", "state", scope, {
      references: references.map((item) => ({ title: item.title, path: item.path, description: item.description }))
    }));
  }
  let branch;
  let base = "?";
  try {
    branch = currentBranch(repo) ?? "";
  } catch {
  }
  try {
    base = localDefaultTarget(repo);
  } catch {
  }
  let divergence2;
  try {
    if (base !== "?") divergence2 = aheadBehind(repo, base);
  } catch {
  }
  const [ahead, behind] = divergence2 ?? [null, null];
  const status = workspaceStatus(repo);
  const codeDir = component?.path ?? "";
  let linkedWorktree;
  try {
    linkedWorktree = checkoutInfo(repo).linked;
  } catch {
    linkedWorktree = null;
  }
  items.push(boardItem("repo.identity", "state", scope, {
    codeDir,
    repoRoot: repo,
    language: component?.language ?? "",
    inspectionProblem,
    branch,
    linkedWorktree,
    ahead,
    behind,
    baseBranch: base,
    targetBranch: base,
    workspaceDirty: status.complete ? status.dirty : null,
    modifiedCount: status.modifiedCount,
    untrackedCount: status.untrackedCount,
    protected: isProtectedBranch(branch),
    ...staleBindingHours === void 0 ? {} : { staleBindingHours }
  }));
  if (branch === void 0) return new Board(root, items);
  const prContext = branch ? await prContextForRepo(repo) : void 0;
  if (prContext) {
    try {
      const view = await prContext.getCheckout();
      if (view?.selected || view?.error || view?.ambiguous) items.push(boardItem("repo.pull-request", "state", scope, {
        branch: view.branch,
        provider: prContext.reader.provider,
        ...view.selected ? { repository: view.selected.repository.path, number: view.selected.number, state: view.selected.state, url: view.selected.url } : {},
        ...view.error ? { error: view.error } : {},
        ambiguous: view.ambiguous
      }));
    } catch (error) {
      items.push(boardItem("repo.pull-request", "state", scope, { branch, error: String(error) }));
    } finally {
      prContext.close();
    }
  }
  const lint = fullProjection(repo, branch || void 0, "lint");
  const test = fullProjection(repo, branch || void 0, "test");
  const componentIds = [.../* @__PURE__ */ new Set([...Object.keys(lint), ...Object.keys(test)])].sort();
  items.push(boardItem("repo.validation", "state", scope, {
    analysis: loadSegment(repo, branchSegment(branch || void 0, "validation_scope")) ?? {},
    unavailableLintComponents,
    unavailableTestComponents,
    components: componentIds.map((component2) => ({
      component: component2,
      lintAt: typeof lint[component2] === "object" && lint[component2] !== null && !Array.isArray(lint[component2]) ? lint[component2].passed_at ?? null : null,
      testAt: typeof test[component2] === "object" && test[component2] !== null && !Array.isArray(test[component2]) ? test[component2].passed_at ?? null : null
    }))
  }));
  const reviewSegment = branchSegment(branch || void 0, "review");
  const review = loadSegment(repo, reviewSegment);
  if (review && typeof review.status === "string" && review.status && review.status !== "skipped" && typeof review.reviewed_sha === "string" && review.reviewed_sha) {
    const generatedAt = typeof review.generated_at === "number" ? review.generated_at : 0;
    const reviewStatus = review.status === "running" && now() - generatedAt > REVIEW_STALE_SECONDS ? "stale" : review.status;
    items.push(boardItem("repo.review", "event", scope, {
      status: reviewStatus,
      reviewedSha: review.reviewed_sha,
      findings: typeof review.count === "number" ? review.count : 0,
      failedFiles: typeof review.failed === "number" ? review.failed : 0,
      message: typeof review.message === "string" ? review.message : "",
      artifactPath: segmentFile(repo, reviewSegment)
    }));
  }
  return new Board(root, items);
}

// domain/board/runtime.ts
var BoardRuntime = class _BoardRuntime {
  constructor(root, sessionId2, board, view, repo) {
    this.root = root;
    this.sessionId = sessionId2;
    this.board = board;
    this.view = view;
    this.repo = repo;
  }
  root;
  sessionId;
  board;
  view;
  repo;
  static async resolve(cwd2, sessionId2) {
    let workspaceRoot2 = findContainingWorkspace(cwd2);
    let repo = findGitRoot(cwd2);
    let staleHours;
    if (!workspaceRoot2 && repo) workspaceRoot2 = findContainingWorkspace(repo);
    const workspace = workspaceRoot2 ? WorkspaceContext.load(workspaceRoot2) : void 0;
    if (!repo && workspaceRoot2) {
      repo = loadActiveRepo(workspaceRoot2, sessionId2);
      if (!repo) {
        const lenient = loadActiveRepoLenient(workspaceRoot2, sessionId2);
        repo = lenient?.repo;
        staleHours = lenient ? lenient.age / 3600 : void 0;
      }
    }
    const root = workspaceRoot2 ?? repo;
    if (!root) return void 0;
    const board = await projectBoard(root, workspace, repo, staleHours);
    return new _BoardRuntime(root, sessionId2, board, board.view({ workspaceRoot: root, ...repo ? { repoRoot: repo } : {} }), repo);
  }
  deliverPrompt(trigger = "user_prompt") {
    const result = new PromptDelivery(this.root, this.sessionId).deliver(this.view, trigger);
    if (result && this.repo) recordSessionEvent(this.repo, this.sessionId, "inject", { text: result });
    return result;
  }
  snapshot() {
    return this.view.select(itemsFor(this.view, "ui")).toJSON();
  }
  afterCompact() {
    new PromptDelivery(this.root, this.sessionId).afterCompact();
  }
  close() {
    new PromptDelivery(this.root, this.sessionId).clear();
  }
};

// hooks/core/project.ts
import { basename as basename6, isAbsolute as isAbsolute3, resolve as resolve9 } from "node:path";
var FILE_TOOLS = /* @__PURE__ */ new Set(["Edit", "Write", "MultiEdit", "NotebookEdit", "write", "edit", "str_replace_editor", "apply_patch"]);
function splitShell(command2) {
  const parts = [];
  let current = "";
  let quote = "";
  let escaped = false;
  let depth = 0;
  for (let index = 0; index < command2.length; index += 1) {
    const char = command2[index];
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      current += char;
      escaped = true;
      continue;
    }
    if (quote) {
      current += char;
      if (char === quote) quote = "";
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    const pair = command2.slice(index, index + 2);
    if (depth === 0 && (pair === "&&" || pair === "||")) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      index += 1;
      continue;
    }
    if (depth === 0 && (char === ";" || char === "\n" || char === "|")) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}
function shellWords(command2) {
  const words = [];
  let current = "";
  let quote = "";
  let escaped = false;
  for (const char of command2.trim()) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = "";
      else current += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char) || "(){}".includes(char)) {
      if (current) {
        words.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (!quote && current) words.push(current);
  return quote ? [] : words;
}
function commandTarget(words, base) {
  const environment = [];
  let offset = 0;
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[offset] ?? "")) environment.push(words[offset++]);
  let argv = words.slice(offset);
  if (argv.length === 0) return void 0;
  let workingDirectory = base;
  let dashC;
  if (["git", "go", "make"].includes(basename6(argv[0]))) {
    const index = argv.indexOf("-C");
    if (index >= 0 && argv[index + 1]) {
      const configuredPath = argv[index + 1];
      dashC = configuredPath;
      const path = isAbsolute3(configuredPath) ? configuredPath : base.path ? resolve9(base.path, configuredPath) : void 0;
      workingDirectory = { ...path ? { path } : {}, source: "git -C" };
      if (basename6(argv[0]) === "git") argv = [...argv.slice(0, index), ...argv.slice(index + 2)];
    }
  }
  let subcommand;
  let args = argv.slice(1);
  if (basename6(argv[0]) === "git") {
    let index = 1;
    while (index < argv.length && argv[index].startsWith("-")) {
      if (["-c", "--git-dir", "--work-tree", "--namespace", "--config-env"].includes(argv[index])) index += 2;
      else index += 1;
    }
    subcommand = argv[index];
    args = argv.slice(index + 1);
  }
  return { kind: "command", argv, workingDirectory, environment, ...subcommand ? { subcommand } : {}, args, ...dashC ? { dashC } : {} };
}
function commandTargets(command2, base) {
  const targets = [];
  let current = base;
  for (const part of splitShell(command2)) {
    const trimmed = part.trim();
    if (trimmed.startsWith("(") && matchingParen(trimmed, 0) === trimmed.length - 1) {
      targets.push(...commandTargets(trimmed.slice(1, -1), current));
      continue;
    }
    for (const nested of commandSubstitutions(trimmed)) targets.push(...commandTargets(nested, current));
    const words = shellWords(part);
    if (words[0] === "cd" && words[1]) {
      const path = isAbsolute3(words[1]) ? words[1] : current.path ? resolve9(current.path, words[1]) : void 0;
      current = { ...path ? { path } : {}, source: "command cd" };
      continue;
    }
    const wrapped = wrappedCommand(words);
    if (wrapped) {
      targets.push(...commandTargets(wrapped, current));
      continue;
    }
    const target = commandTarget(words, current);
    if (target) targets.push(target);
  }
  const heredoc = /(?:^|(?:&&|\|\||;)\s*)(?:\S*\/)?apply_patch\s+<<-?\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?\s*\n([\s\S]*?)\n\s*\1\s*(?=\n|$)/gm;
  for (const match of command2.matchAll(heredoc)) {
    for (const target of patchFileChanges(match[2])) {
      targets.push({
        ...target,
        path: isAbsolute3(target.path) || !current.path ? target.path : resolve9(current.path, target.path)
      });
    }
  }
  return targets;
}
function wrappedCommand(words) {
  const executable = basename6(words[0] ?? "");
  if (["bash", "sh", "zsh"].includes(executable)) {
    const commandIndex = words.findIndex((word, index) => index > 0 && /^-[^-]*c/.test(word));
    return commandIndex >= 0 ? words[commandIndex + 1] : void 0;
  }
  if (executable === "env") {
    let index = 1;
    while (index < words.length && (words[index].startsWith("-") || /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[index]))) index += 1;
    return index < words.length ? words.slice(index).join(" ") : void 0;
  }
  if (["command", "builtin", "exec"].includes(executable)) {
    let index = 1;
    while (index < words.length && words[index].startsWith("-")) index += 1;
    return index < words.length ? words.slice(index).join(" ") : void 0;
  }
  return void 0;
}
function matchingParen(source, start) {
  let quote = "";
  let escaped = false;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    else if (char === ")" && --depth === 0) return index;
  }
  return -1;
}
function commandSubstitutions(source) {
  const values = [];
  let quote = "";
  let escaped = false;
  for (let index = 0; index < source.length - 1; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "$" && source[index + 1] === "(") {
      const end = matchingParen(source, index + 1);
      if (end > index) {
        values.push(source.slice(index + 2, end));
        index = end;
      }
    }
  }
  return values;
}
function patchFileChanges(value) {
  if (typeof value !== "string") return [];
  return value.split("\n").flatMap((line) => {
    for (const [prefix, mode] of [["*** Add File: ", "write"], ["*** Update File: ", "edit"], ["*** Delete File: ", "edit"]]) {
      if (line.startsWith(prefix)) return [{ kind: "file_change", path: line.slice(prefix.length).trim(), mode }];
    }
    return [];
  });
}
function projectTool(input) {
  const { toolName, toolInput, cwd: cwd2 } = input;
  if (toolName === "Bash" || toolName === "bash" || toolName === "shell" || toolName === "exec_command") {
    const command2 = typeof toolInput.command === "string" ? toolInput.command : typeof toolInput.cmd === "string" ? toolInput.cmd : "";
    const configured = typeof toolInput.workdir === "string" && toolInput.workdir.trim() ? toolInput.workdir : void 0;
    const path = configured ? isAbsolute3(configured) ? configured : resolve9(cwd2, configured) : input.harness === "codex" && toolName === "Bash" ? void 0 : cwd2;
    return { targets: commandTargets(command2, { ...path ? { path } : {}, source: configured ? "tool workdir" : "hook cwd" }), cwd: cwd2, tool: toolName, command: command2 };
  }
  if (toolName === "apply_patch") {
    const patch = toolInput.patch ?? toolInput.input ?? toolInput.command;
    return { targets: patchFileChanges(patch), cwd: cwd2, tool: toolName, command: "" };
  }
  if (FILE_TOOLS.has(toolName)) {
    if (toolName === "str_replace_editor" && toolInput.command === "view") return { targets: [], cwd: cwd2, tool: toolName, command: "" };
    const path = typeof toolInput.file_path === "string" ? toolInput.file_path : typeof toolInput.notebook_path === "string" ? toolInput.notebook_path : typeof toolInput.path === "string" ? toolInput.path : "";
    const writing = toolName === "Write" || toolName === "write" || toolName === "str_replace_editor" && toolInput.command === "create";
    return { targets: path ? [{ kind: "file_change", path, mode: writing ? "write" : "edit", toolInput }] : [], cwd: cwd2, tool: toolName, command: "" };
  }
  return { targets: [], cwd: cwd2, tool: toolName, command: "" };
}

// hooks/core/domain.ts
function decision(findings) {
  return { action: findings.some((item) => item.severity === "deny") ? "deny" : findings.some((item) => item.severity === "warn") ? "warn" : "allow", findings };
}
function decisionMessage(value) {
  const severity = value.action === "deny" ? "deny" : "warn";
  return value.findings.filter((item) => item.severity === severity).map((item) => item.message).join("\n\n");
}

// hooks/core/engine.ts
async function evaluate(change, context, rules) {
  const findings = [];
  for (const target of change.targets) {
    const targetContext = context.forTarget(target);
    for (const rule of rules.filter((candidate) => candidate.targetKind === target.kind)) {
      try {
        if (rule.applies(target, targetContext)) findings.push(...await rule.check(target, targetContext));
      } catch (error) {
        if (error instanceof InspectionError) findings.push({ rule: rule.name, severity: rule.failurePolicy === "fail_closed" ? "deny" : "warn", message: error.message });
        else if (rule.failurePolicy === "fail_closed") findings.push({ rule: rule.name, severity: "deny", message: `${rule.name}: policy evaluation failed (fail-closed)` });
      }
    }
  }
  for (const rule of rules.filter((candidate) => candidate.targetKind === "change")) {
    try {
      if (rule.applies(change, context)) findings.push(...await rule.check(change, context));
    } catch {
      if (rule.failurePolicy === "fail_closed") findings.push({ rule: rule.name, severity: "deny", message: `${rule.name}: policy evaluation failed (fail-closed)` });
    }
  }
  return decision(findings);
}

// hooks/core/context.ts
import { dirname as dirname11, isAbsolute as isAbsolute4, resolve as resolve10 } from "node:path";
var PolicyContext = class _PolicyContext {
  constructor(cwd2, identity2, anchorPath = "", inspections = /* @__PURE__ */ new Map()) {
    this.inspections = inspections;
    this.cwd = cwd2;
    this.identity = identity2;
    this.anchorPath = anchorPath ? isAbsolute4(anchorPath) ? anchorPath : resolve10(cwd2, anchorPath) : "";
    this.anchorDirectory = this.anchorPath ? dirname11(this.anchorPath) : cwd2;
  }
  inspections;
  cwd;
  identity;
  anchorPath;
  anchorDirectory;
  forTarget(target) {
    if (target.kind === "file_change") return new _PolicyContext(this.cwd, this.identity, target.path, this.inspections);
    return target.workingDirectory.path ? new _PolicyContext(target.workingDirectory.path, this.identity, "", this.inspections) : this;
  }
  catalog(repo) {
    const key = resolve10(repo);
    if (!this.inspections.has(key)) this.inspections.set(key, inspectCatalog(key));
    return this.inspections.get(key);
  }
  get sessionId() {
    return this.identity.sessionId;
  }
  get harness() {
    return this.identity.harness;
  }
  get gitRoot() {
    return this.anchorDirectory ? findGitRoot(this.anchorDirectory) : void 0;
  }
  get architecture() {
    return architectureConfig(this.gitRoot);
  }
};

// hooks/rules/index.ts
import { existsSync as existsSync13, readFileSync as readFileSync9 } from "node:fs";
import { basename as basename8, dirname as dirname12, extname, join as join16, resolve as resolve12 } from "node:path";

// domain/context/gate.ts
async function evaluateGate(repo) {
  const branch = currentBranch(repo), head = headSha(repo), target = localDefaultTarget(repo);
  const context = branch ? await prContextForRepo(repo) : void 0;
  try {
    const view = branch && context ? await context.getBranch(branch) : void 0;
    if (view?.error || view?.ambiguous) throw new Error(view.error ?? "Multiple PRs match this branch; select a proposal explicitly");
    if (headSha(repo) !== head || currentBranch(repo) !== branch) throw new Error("Checkout changed during PR decision");
    const activePullRequest = view?.selected;
    return {
      ...branch ? { branch } : {},
      head,
      target,
      ...context ? { provider: context.reader.provider } : {},
      ...activePullRequest ? { activePullRequest } : {},
      protected: isProtectedBranch(branch),
      inactive: activePullRequest ? pullRequestInactive(activePullRequest) : false,
      inFlight: activePullRequest ? pullRequestOpen(activePullRequest) : false
    };
  } finally {
    context?.close();
  }
}

// domain/repo.ts
import { realpathSync as realpathSync6 } from "node:fs";
import { basename as basename7, join as join15, resolve as resolve11 } from "node:path";
function workingPaths(root) {
  try {
    return changedPaths(root);
  } catch {
    return void 0;
  }
}
function changedPaths2(root) {
  return workingPaths(root) ?? [];
}
function projectComponents(changed, catalog) {
  const byId = /* @__PURE__ */ new Map();
  for (const path of changed) {
    const owner2 = catalog.owner(join15(catalog.root, path));
    if (owner2) byId.set(owner2.id, owner2);
  }
  return [...byId.values()];
}
function selectComponents(rootValue, options) {
  const root = realpathSync6(rootValue);
  const catalog = options.catalog;
  if (catalog.components.length === 0) return { components: [], reason: "no recognized Components; validation not run" };
  if (options.explicit) {
    const explicit = resolve11(options.explicit);
    if (explicit !== root && explicit.startsWith(`${root}/`)) {
      const component = enclosingComponent(explicit, catalog);
      return { components: [component], reason: `explicit target ${basename7(explicit)} -> component ${basename7(component.path)}` };
    }
  }
  if (options.paths !== void 0) {
    const components = projectComponents(options.paths, catalog);
    return components.length === 0 ? { components: [], reason: "no changed files in scope" } : { components, reason: `changed files under: ${components.map((item) => basename7(item.path)).join(", ")}` };
  }
  const dirty = projectComponents(changedPaths2(root), catalog);
  if (dirty.length > 0) return { components: dirty, reason: `changed files under: ${dirty.map((item) => basename7(item.path)).join(", ")}` };
  const all = catalog.components;
  return { components: all, reason: `clean tree, all components: ${all.map((item) => basename7(item.path)).join(", ")}` };
}
async function componentFingerprint(root, _component, _catalog) {
  try {
    const observed = await snapshot(root);
    return observed.complete ? observed.digest : void 0;
  } catch {
    return void 0;
  }
}

// hooks/rules/index.ts
function command(target) {
  return target;
}
function file(target) {
  return target;
}
function finding(rule, message, locator = "") {
  return [{ rule, severity: "deny", message, ...locator ? { locator } : {} }];
}
function commandLine(target) {
  return target.argv.join(" ");
}
var addAll = {
  name: "add-all",
  targetKind: "command",
  applies: (target) => command(target).subcommand === "add",
  check: (target) => command(target).args.some((arg) => ["-A", "--all", ".", "./"].includes(arg)) ? finding("add-all", "Refusing broad `git add`. Stage explicit paths or use the devloop commit flow so unrelated and sensitive files cannot be captured.", commandLine(command(target))) : []
};
var worktreeAdd = {
  name: "worktree-add",
  targetKind: "command",
  applies: (target) => command(target).subcommand === "worktree" && command(target).args[0] === "add",
  check: (target) => {
    const runDirectory = command(target).workingDirectory.path;
    const repo = runDirectory ? findGitRoot(runDirectory) : void 0;
    let primary = repo ?? "<repo>";
    try {
      if (repo) primary = listCheckouts(repo).find((entry) => entry.primary)?.path ?? repo;
    } catch {
    }
    return finding("worktree-add", `Direct \`git worktree add\` bypasses devloop lifecycle policy. Use \`"<PLUGIN_ROOT>/scripts/python" "<PLUGIN_ROOT>/scripts/checkout.py" ${basename8(primary)} --worktree <tag>\`.`, commandLine(command(target)));
  }
};
function tagOnlyPush(args, repo) {
  if (args.some((arg) => ["--all", "--branches", "--mirror", "--follow-tags", "--delete", "-d"].includes(arg))) return false;
  if (args.includes("--tags")) return true;
  const positional = args.filter((arg) => !arg.startsWith("-"));
  const refspecs = positional.slice(1);
  return refspecs.length > 0 && refspecs.every((raw) => {
    const spec = raw.replace(/^\+/, "");
    if (spec.includes(":")) {
      const [source, destination] = spec.split(":");
      return Boolean(source) && destination?.startsWith("refs/tags/") === true;
    }
    if (spec.startsWith("refs/tags/")) return true;
    return runGit(repo, ["show-ref", "--verify", "--quiet", `refs/tags/${spec}`]).ok && !runGit(repo, ["show-ref", "--verify", "--quiet", `refs/heads/${spec}`]).ok;
  });
}
var protectBranch = {
  name: "protect-branch",
  failurePolicy: "fail_closed",
  targetKind: "command",
  applies: (target) => ["commit", "push"].includes(command(target).subcommand ?? ""),
  check: (target) => {
    const value = command(target);
    const runDirectory = value.workingDirectory.path;
    const repo = runDirectory ? findGitRoot(runDirectory) : void 0;
    if (!repo) return [];
    const branch = currentBranch(repo);
    const gate = { protected: isProtectedBranch(branch), branch };
    if (!gate.protected || value.subcommand === "push" && tagOnlyPush(value.args, repo)) return [];
    return finding("protect-branch", `Refusing \`git commit/push\` on protected branch '${gate.branch ?? "?"}'. Create a feature branch with the devloop branch command first.`, commandLine(value));
  }
};
var checkoutOwner = {
  name: "checkout-owner",
  failurePolicy: "fail_closed",
  targetKind: "command",
  applies: (target) => command(target).subcommand === "switch" || command(target).subcommand === "checkout" && !command(target).args.includes("--"),
  check: (target, context) => {
    if (!context.sessionId) return [];
    const runDirectory = command(target).workingDirectory.path;
    const repo = runDirectory ? findGitRoot(runDirectory) : void 0;
    if (!repo) return [];
    const owner2 = foreignOwner(repo, context.sessionId, context.harness);
    if (owner2) return finding("checkout-owner", `This checkout is owned by another devloop session (${ownerDescription(owner2)}). Use the managed-worktree helper for '${repositoryName(repo)}'.`, commandLine(command(target)));
    acquireOwner(repo, context.identity, currentBranch(repo) ?? "");
    return [];
  }
};
function pipInstallArgs(argv) {
  const base = basename8(argv[0] ?? "");
  const index = argv.indexOf("install");
  if ((base === "pip" || base === "pip3") && index > 0) return argv.slice(index + 1);
  if (base.startsWith("python") && argv[1] === "-m" && argv[2] === "pip" && index >= 3) return argv.slice(index + 1);
  return void 0;
}
var pipInstall = {
  name: "pip-install",
  targetKind: "command",
  applies: () => true,
  check: async (target, context) => {
    const value = command(target);
    const args = pipInstallArgs(value.argv);
    if (!args || args.includes("-e") && args.includes(".")) return [];
    const runDirectory = value.workingDirectory.path;
    const repo = runDirectory ? findGitRoot(runDirectory) : void 0;
    if (!repo) return [];
    const catalog = await context.catalog(repo);
    if (catalog.components.length === 0) return [];
    const component = enclosingComponent(runDirectory, catalog).path;
    if (!existsSync13(join16(component, "pyproject.toml")) || !existsSync13(join16(component, "uv.lock"))) return [];
    return finding("pip-install", "This component is uv-managed. Use `uv add` or `uv sync`; direct `pip install` bypasses pyproject.toml and uv.lock.", commandLine(value));
  }
};
function pytestInvocation(argv) {
  let args = [...argv];
  if (args[0] === "uv" && args[1] === "run") args = args.slice(2);
  const base = basename8(args[0] ?? "");
  return base === "pytest" || base.startsWith("python") && args[1] === "-m" && args[2] === "pytest";
}
var pytestNaked = {
  name: "pytest-naked",
  targetKind: "command",
  applies: (target) => command(target).environment.length === 0 && pytestInvocation(command(target).argv),
  check: async (target, context) => {
    const value = command(target);
    const runDirectory = value.workingDirectory.path;
    const repo = runDirectory ? findGitRoot(runDirectory) : void 0;
    if (!repo) return [];
    const catalog = await context.catalog(repo);
    if (catalog.components.length === 0) return [];
    const component = enclosingComponent(runDirectory, catalog);
    return observedCheck(repo, component.id, "test")?.scope === "full" ? finding("pytest-naked", `Use repocli test --repo ${repo} --component ${component.id} to run the project test contract`, commandLine(value)) : [];
  }
};
var PROJECT_COMMANDS = {
  npm: /* @__PURE__ */ new Set(["ci", "install", "run", "start", "test", "publish"]),
  pnpm: /* @__PURE__ */ new Set(["add", "build", "check", "install", "lint", "run", "test"]),
  yarn: /* @__PURE__ */ new Set(["add", "build", "install", "lint", "run", "test"]),
  uv: /* @__PURE__ */ new Set(["add", "build", "lock", "run", "sync", "tree", "venv"]),
  go: /* @__PURE__ */ new Set(["build", "fmt", "generate", "get", "list", "mod", "run", "test", "vet", "work"]),
  cargo: /* @__PURE__ */ new Set(["bench", "build", "check", "clippy", "fmt", "run", "test"])
};
function projectLocal(value) {
  const base = basename8(value.argv[0] ?? "");
  if (base === "pytest") return true;
  if (base === "make") return !value.args.every((arg) => ["-h", "--help", "-v", "--version", "help"].includes(arg));
  if (["npm", "pnpm"].includes(base) && value.argv.some((arg) => arg === "-g" || arg === "--global")) return false;
  const subcommand = value.argv.slice(1).find((arg) => !arg.startsWith("-"));
  return subcommand !== void 0 && PROJECT_COMMANDS[base]?.has(subcommand) === true;
}
function workspaceRoot(path) {
  return workspaces().some((root) => resolve12(root) === resolve12(path)) || WorkspaceContext.load(path) !== void 0 && !findGitRoot(path);
}
var workspaceCwd = {
  name: "workspace-cwd",
  targetKind: "command",
  applies: (target) => projectLocal(command(target)),
  check: (target) => {
    const path = command(target).workingDirectory.path;
    if (!path || !workspaceRoot(path)) return [];
    const names = WorkspaceContext.load(path)?.subprojects.slice(0, 10).map((item) => item.name).join(", ");
    return finding("workspace-cwd", `You're at aggregate workspace '${resolve12(path)}', not a subproject. Enter a repository or pass --repo explicitly.${names ? ` Subprojects: ${names}` : ""}`, commandLine(command(target)));
  }
};
var editOwner = {
  name: "edit-owner",
  failurePolicy: "fail_closed",
  targetKind: "file_change",
  applies: () => true,
  check: (target, context) => {
    if (!context.sessionId || !context.gitRoot) return [];
    const repo = context.gitRoot;
    const owner2 = foreignOwner(repo, context.sessionId, context.harness);
    if (owner2) {
      const path = context.anchorPath || file(target).path;
      if (runGit(repo, ["check-ignore", "-q", "--", path]).ok) return [];
      return finding("edit-owner", `Checkout '${repositoryName(repo)}' is owned by another devloop session (${ownerDescription(owner2)}). Use an isolated managed worktree.`, file(target).path);
    }
    acquireOwner(repo, context.identity, currentBranch(repo) ?? "");
    return [];
  }
};
var branchMerged = {
  name: "branch-merged",
  failurePolicy: "fail_closed",
  targetKind: "file_change",
  applies: () => true,
  check: async (target, context) => {
    if (!context.gitRoot) return [];
    const gate = await evaluateGate(context.gitRoot);
    const pr = gate.activePullRequest;
    return gate.inactive ? finding("branch-merged", `Branch '${gate.branch ?? "?"}' is inactive (${pr ? `${pullRequestLabel(gate.provider, pr.number)} ${pr.state}` : "PR/MR finished"}). Cut a new branch from origin/${gate.target} before editing.`, file(target).path) : [];
  }
};
var requirementsEdit = {
  name: "requirements-edit",
  targetKind: "file_change",
  applies: () => true,
  check: (target, context) => {
    const path = context.anchorPath || file(target).path;
    if (basename8(path) !== "requirements.txt") return [];
    const parent = dirname12(path);
    return existsSync13(join16(parent, "pyproject.toml")) || existsSync13(join16(dirname12(parent), "pyproject.toml")) ? finding("requirements-edit", `\`${path}\` is generated dependency output. Edit pyproject.toml, then regenerate it with uv.`, file(target).path) : [];
  }
};
function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function commitsExistingIndex(args) {
  const values = /* @__PURE__ */ new Set(["-m", "--message", "-F", "--file", "-C", "--reuse-message", "-c", "--reedit-message", "--author", "--date", "--cleanup"]);
  const flags = /* @__PURE__ */ new Set(["--amend", "--no-edit", "--edit", "-e", "--signoff", "-s", "--no-verify", "-n", "--quiet", "-q", "--verbose", "-v", "--allow-empty", "--allow-empty-message", "--no-gpg-sign", "--no-post-rewrite"]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (values.has(arg)) {
      if (++index >= args.length) return false;
      continue;
    }
    if (flags.has(arg) || [...values].some((option) => option.startsWith("--") && arg.startsWith(`${option}=`))) continue;
    return false;
  }
  return true;
}
var precommitGate = {
  name: "precommit-gate",
  targetKind: "command",
  failurePolicy: "fail_closed",
  applies: (target) => command(target).subcommand === "commit",
  check: async (target, context) => {
    const value = command(target);
    const directory = value.workingDirectory.path;
    const repo = directory ? findGitRoot(directory) : void 0;
    if (!repo || !stringArray(lifecycleConfig(repo).pre_commit).includes("lint")) return [];
    const branch = currentBranch(repo);
    const lint = loadSegment(repo, branchSegment(branch, "lint")) ?? {};
    const catalog = await context.catalog(repo);
    const required = selectComponents(repo, { catalog }).components;
    const fingerprint = required.length ? await componentFingerprint(repo, required[0], catalog) : void 0;
    const stale2 = required.flatMap((component) => {
      const evidence = fullEvidence(repo, component.id, "lint", lint[component.id]);
      if (!evidence) return [`  ${component.id}: lint has no full-check evidence for this branch.`];
      return reusableFullEvidence(evidence, fingerprint) ? [] : [`  ${component.id}: contents, command or dependency environment require validation.`];
    });
    const unstaged = runGit(repo, ["diff", "--quiet", "--ignore-submodules=dirty"]);
    const untracked = runGit(repo, ["ls-files", "--others", "--exclude-standard"]);
    if (!commitsExistingIndex(value.args) || !unstaged.ok || !untracked.ok || untracked.stdout) {
      stale2.push("  index differs from the checked working tree; use the devloop commit flow.");
    }
    return stale2.length === 0 ? [] : finding("precommit-gate", [
      "Refusing `git commit`: lint is in the pre_commit gate and is stale.",
      ...stale2,
      "Commit via gcam/gcampr instead, or run the validate skill, then retry.",
      "Adjust the gate under `lifecycle` in ~/.devloop/config.json."
    ].join("\n"), commandLine(value));
  }
};
function resultingText(target) {
  const input = target.toolInput;
  if (!input) return void 0;
  if (typeof input.content === "string") return input.content;
  if (typeof input.file_text === "string") return input.file_text;
  let current;
  try {
    current = readFileSync9(target.path, "utf8");
  } catch {
    current = "";
  }
  if (Array.isArray(input.edits)) {
    for (const raw of input.edits) {
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue;
      const edit = raw;
      if (typeof edit.old_string === "string") current = current.replace(edit.old_string, typeof edit.new_string === "string" ? edit.new_string : "");
    }
    return current;
  }
  const oldText = typeof input.old_string === "string" ? input.old_string : typeof input.old_str === "string" ? input.old_str : void 0;
  const newText = typeof input.new_string === "string" ? input.new_string : typeof input.new_str === "string" ? input.new_str : "";
  if (oldText === void 0) return current;
  return input.replace_all === true ? current.split(oldText).join(newText) : current.replace(oldText, newText);
}
function layerOf(value, layers) {
  for (const [fragment, layer] of Object.entries(layers)) if (typeof layer === "string" && value.includes(fragment)) return layer;
  return void 0;
}
function importedModules(source, extension) {
  const patterns = extension === ".py" ? [/^\s*import\s+([\w.]+)/gm, /^\s*from\s+([\w.]+)\s+import\s+/gm] : [/(?:import|export)\s+(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g, /require\(\s*["']([^"']+)["']\s*\)/g];
  return patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1] ?? "")).filter(Boolean);
}
function importLayer(module, order) {
  const segments = new Set(module.split(/[./\\]/));
  return order.find((layer) => segments.has(layer));
}
var layerDeps = {
  name: "layer-deps",
  targetKind: "file_change",
  applies: (_target, context) => context.architecture.enabled === true && stringArray(context.architecture.order).length > 0,
  check: (target, context) => {
    const value = file(target);
    const config = context.architecture;
    const layers = config.layers !== null && typeof config.layers === "object" && !Array.isArray(config.layers) ? config.layers : {};
    const order = stringArray(config.order);
    const ownLayer = layerOf(value.path, layers);
    const text3 = resultingText(value);
    if (!ownLayer || text3 === void 0 || !order.includes(ownLayer)) return [];
    const rank = new Map(order.map((layer, index) => [layer, index]));
    return importedModules(text3, extname(value.path).toLowerCase()).flatMap((module) => {
      const dependency = importLayer(module, order);
      return dependency && dependency !== ownLayer && rank.get(dependency) < rank.get(ownLayer) ? [{ rule: "layer-deps", severity: "deny", message: `Layer violation: ${ownLayer} file ${value.path} must not depend on higher layer ${dependency} (import: ${module}). Move cross-layer orchestration to ${dependency}.`, locator: value.path }] : [];
    });
  }
};
var RULES2 = [protectBranch, checkoutOwner, worktreeAdd, addAll, workspaceCwd, pytestNaked, pipInstall, precommitGate, editOwner, branchMerged, requirementsEdit, layerDeps];

// hooks/friction.ts
function recordDeniedDecision(root, decision2, input) {
  appendLedger(root, "friction", {
    kind: "friction",
    ts: Date.now() / 1e3,
    source: "guard",
    tool: input.tool,
    branch: input.branch ?? null,
    session_id: input.sessionId ?? "",
    cwd: input.cwd,
    findings: decision2.findings.filter((finding2) => finding2.severity === "deny").map((finding2) => ({
      rule: finding2.rule,
      locator: finding2.locator ?? ""
    }))
  });
}

// hooks/core/policy.ts
async function evaluateTool(input) {
  const change = projectTool(input);
  const identity2 = {
    harness: input.harness,
    sessionId: typeof input.toolInput.session_id === "string" ? input.toolInput.session_id : ""
  };
  const context = new PolicyContext(input.cwd, identity2);
  const result = await evaluate(change, context, RULES2);
  if (result.action === "deny" && context.gitRoot) {
    recordDeniedDecision(context.gitRoot, result, {
      tool: input.toolName,
      cwd: input.cwd,
      sessionId: identity2.sessionId
    });
  }
  return result;
}
async function deniedReason(input) {
  const result = await evaluateTool(input);
  return result.action === "deny" ? decisionMessage(result) : void 0;
}

// adapters/hook-payload.ts
async function preToolDecision(payload, configured) {
  const harness = configured ?? "claude";
  const rawInput = payload.tool_input;
  const toolInput = rawInput !== null && typeof rawInput === "object" && !Array.isArray(rawInput) ? { ...rawInput } : { input: String(rawInput ?? "") };
  if (typeof payload.session_id === "string") toolInput.session_id = payload.session_id;
  const reason = await deniedReason({
    harness,
    toolName: typeof payload.tool_name === "string" ? payload.tool_name : "",
    toolInput,
    cwd: typeof payload.cwd === "string" ? payload.cwd : process.cwd()
  });
  if (!reason) return {};
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason
    },
    systemMessage: reason
  };
}

// adapters/codex.ts
function evaluateCodexPreTool(payload) {
  return preToolDecision(payload, "codex");
}
function codexToolFailed(payload) {
  const response = payload.tool_response;
  if (typeof payload.tool_name === "string" && payload.tool_name.startsWith("mcp__")) {
    return response !== null && typeof response === "object" && !Array.isArray(response) && response.isError === true;
  }
  if (!["Bash", "apply_patch"].includes(String(payload.tool_name)) || typeof response !== "string") return false;
  const outputStart = response.indexOf("\nOutput:");
  if (outputStart < 0) return false;
  const header = response.slice(0, outputStart);
  const exitCode = /^(?:Exit code: |Process exited with code )(-?\d+)$/m.exec(header);
  return exitCode !== null && Number(exitCode[1]) !== 0;
}
var codexProcessAdapter = {
  harness: "codex",
  preTool: evaluateCodexPreTool
};

// adapters/process-hooks.ts
function string2(value) {
  return typeof value === "string" ? value : "";
}
function cwd(payload) {
  return string2(payload.cwd) || process.cwd();
}
function sessionId(payload) {
  return string2(payload.session_id);
}
function identity(payload, harness) {
  return { harness, sessionId: sessionId(payload) };
}
async function initializeBoard(payload) {
  const directory = cwd(payload);
  const workspaceRoot2 = findContainingWorkspace(directory) ?? maybeRegisterWorkspace(directory);
  const workspace = workspaceRoot2 ? WorkspaceContext.refresh(workspaceRoot2) : void 0;
  const repo = findGitRoot(directory);
  const root = workspaceRoot2 ?? repo;
  if (!root) return { watchPaths: [] };
  const board = await projectBoard(root, workspace, repo);
  const runtime = new BoardRuntime(root, sessionId(payload), board, board.view({ workspaceRoot: root, ...repo ? { repoRoot: repo } : {} }), repo);
  const watchPaths = /* @__PURE__ */ new Set();
  if (workspace?.agentsDocument.path) watchPaths.add(workspace.agentsDocument.path);
  for (const project of workspace?.subprojects ?? []) {
    const agents = findAgentsDocument(project.path);
    if (agents) watchPaths.add(agents);
  }
  if (repo) {
    const agents = findAgentsDocument(repo);
    if (agents) watchPaths.add(agents);
  }
  return { runtime, watchPaths: [...watchPaths] };
}
async function sessionStartOutput(payload, harness = "claude") {
  const repo = findGitRoot(cwd(payload));
  if (repo && harness === "codex") triggerReconciliation(repo);
  const { runtime, watchPaths } = await initializeBoard(payload);
  const content = runtime?.deliverPrompt("session_start");
  const deliveredWatches = harness === "claude" ? watchPaths : [];
  if (!content && deliveredWatches.length === 0) return {};
  return {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      ...content ? { additionalContext: content } : {},
      ...deliveredWatches.length ? { watchPaths: deliveredWatches } : {}
    }
  };
}
async function userPromptOutput(payload) {
  const content = (await BoardRuntime.resolve(cwd(payload), sessionId(payload)))?.deliverPrompt("user_prompt");
  return content ? { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: content } } : {};
}
async function afterCompact(payload) {
  (await BoardRuntime.resolve(cwd(payload), sessionId(payload)))?.afterCompact();
}
function afterCwdChanged(payload) {
  const directory = string2(payload.new_cwd) || cwd(payload);
  const repo = findGitRoot(directory);
  const workspace = findContainingWorkspace(directory);
  if (repo && workspace) recordActiveRepo(workspace, repo, sessionId(payload));
}
var STATE_SUBCOMMANDS = /* @__PURE__ */ new Set(["commit", "push", "checkout", "switch", "reset", "merge", "rebase", "pull", "fetch"]);
function afterTool(payload, harness) {
  const input = payload.tool_input;
  const toolInput = input !== null && typeof input === "object" && !Array.isArray(input) ? { ...input } : { input: string2(input) };
  if (sessionId(payload)) toolInput.session_id = sessionId(payload);
  const change = projectTool({ harness, toolName: string2(payload.tool_name), toolInput, cwd: cwd(payload) });
  const repositories = /* @__PURE__ */ new Set();
  const direct = findGitRoot(cwd(payload));
  if (direct) repositories.add(direct);
  for (const target of change.targets) {
    const directory = target.kind === "file_change" ? dirname13(resolve13(cwd(payload), target.path)) : target.workingDirectory.path;
    const affected = directory ? findGitRoot(directory) : void 0;
    if (affected) repositories.add(affected);
    if (target.kind !== "command" || !target.subcommand || !STATE_SUBCOMMANDS.has(target.subcommand) || !target.workingDirectory.path) continue;
    const repo = findGitRoot(target.workingDirectory.path);
    if (!repo) continue;
    const workspace = findContainingWorkspace(repo);
    if (workspace) recordActiveRepo(workspace, repo, sessionId(payload));
    if (target.subcommand !== "fetch") acquireOwner(repo, identity(payload, harness), currentBranch(repo) ?? "");
  }
  if (harness === "codex") for (const repo of repositories) triggerReconciliation(repo);
}
function afterFileChanged(payload) {
  const path = string2(payload.file_path);
  if (basename9(path) !== "AGENTS.md") return;
  const workspace = findContainingWorkspace(path);
  if (workspace) WorkspaceContext.refresh(workspace);
}
function recordToolCall(payload, harness) {
  const event = string2(payload.hook_event_name);
  if (!["PreToolUse", "PostToolUse", "PostToolUseFailure"].includes(event)) return;
  const rawInput = payload.tool_input;
  const toolInput = rawInput !== null && typeof rawInput === "object" && !Array.isArray(rawInput) ? rawInput : { input: String(rawInput ?? "") };
  const directory = cwd(payload);
  const change = projectTool({ harness, toolName: string2(payload.tool_name), toolInput, cwd: directory });
  const anchors = [];
  for (const target of change.targets) {
    if (target.kind === "file_change") {
      const path = isAbsolute5(target.path) ? target.path : resolve13(directory, target.path);
      anchors.push(dirname13(path));
    } else if (target.workingDirectory.path) anchors.push(target.workingDirectory.path);
  }
  for (const key of ["file_path", "notebook_path", "path"]) {
    const value = toolInput[key];
    if (typeof value !== "string" || !value.trim()) continue;
    const path = isAbsolute5(value) ? value : resolve13(directory, value);
    anchors.push(dirname13(path));
  }
  if (anchors.length === 0) anchors.push(directory);
  const timestamp = Date.now() / 1e3;
  const callId = string2(payload.tool_use_id);
  const phase = event === "PreToolUse" ? "started" : "finished";
  const roots = /* @__PURE__ */ new Set();
  for (const anchor of new Set(anchors)) {
    try {
      const root = findGitRoot(anchor);
      if (root) roots.add(root);
    } catch {
    }
  }
  for (const root of roots) {
    const record2 = {
      schema: TOOL_CALL_SCHEMA,
      kind: "tool_call",
      phase,
      ts: timestamp,
      call_id: callId,
      session_id: sessionId(payload),
      harness,
      tool: string2(payload.tool_name)
    };
    if (phase === "finished") {
      record2.outcome = event === "PostToolUseFailure" || harness === "codex" && codexToolFailed(payload) ? "failed" : "succeeded";
      const started = toolCallStartedAt(root, callId, timestamp);
      if (started !== void 0) record2.duration_ms = Math.max(0, Math.round((timestamp - started) * 1e3));
    }
    appendToolCall(root, record2, timestamp);
  }
}
function endSession(payload, harness) {
  const direct = findGitRoot(cwd(payload));
  const workspace = findContainingWorkspace(cwd(payload)) ?? (direct ? findContainingWorkspace(direct) : void 0);
  const root = workspace ?? direct;
  if (root) new PromptDelivery(root, sessionId(payload)).clear();
  if (workspace) clearActiveRepo(workspace, sessionId(payload));
  const candidates = /* @__PURE__ */ new Set();
  if (direct) candidates.add(direct);
  const workspaceContext = workspace ? WorkspaceContext.load(workspace) ?? WorkspaceContext.refresh(workspace) : void 0;
  for (const project of workspaceContext?.subprojects ?? []) {
    const repo = findGitRoot(project.path);
    if (repo) candidates.add(repo);
  }
  for (const repo of [...candidates]) {
    try {
      for (const checkout of listCheckouts(repo)) if (checkout.path) candidates.add(checkout.path);
    } catch {
    }
  }
  for (const repo of candidates) releaseOwner(repo, identity(payload, harness));
}

// adapters/claude.ts
function evaluateClaudePreTool(payload) {
  return preToolDecision(payload, "claude");
}
var claudeProcessAdapter = {
  harness: "claude",
  preTool: evaluateClaudePreTool
};

// hooks/runtime.ts
function readPayload() {
  try {
    const parsed = JSON.parse(readFileSync10(0, "utf8") || "{}");
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
async function run(payload, adapter) {
  const event = typeof payload.hook_event_name === "string" ? payload.hook_event_name : "";
  recordToolCall(payload, adapter.harness);
  if (event === "PreToolUse") return adapter.preTool(payload);
  if (event === "SessionStart") return sessionStartOutput(payload, adapter.harness);
  if (event === "UserPromptSubmit") return userPromptOutput(payload);
  if (event === "PostCompact") await afterCompact(payload);
  else if (event === "PostToolUse") afterTool(payload, adapter.harness);
  else if (event === "CwdChanged") afterCwdChanged(payload);
  else if (event === "FileChanged") afterFileChanged(payload);
  else if (event === "SessionEnd") endSession(payload, adapter.harness);
  return {};
}
try {
  const payload = readPayload();
  const adapter = process.env.DEVLOOP_HARNESS === "codex" ? codexProcessAdapter : claudeProcessAdapter;
  process.stdout.write(JSON.stringify(await run(payload, adapter)));
} catch {
  process.stdout.write("{}");
}
//# sourceMappingURL=runtime.js.map
