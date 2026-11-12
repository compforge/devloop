#!/usr/bin/env node
import { createRequire as __devloopCreateRequire } from "node:module"; const require = __devloopCreateRequire(import.meta.url);
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

// node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
    var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
    var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
    var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
    var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
    var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
    var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar;
    exports.isSeq = isSeq;
  }
});

// node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    var identity2 = require_identity();
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity2.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path) {
      const ctrl = callVisitor(key, node, visitor, path);
      if (identity2.isNode(ctrl) || identity2.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity2.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity2.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = visit_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity2.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path) {
      const ctrl = await callVisitor(key, node, visitor, path);
      if (identity2.isNode(ctrl) || identity2.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity2.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity2.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path) {
      if (typeof visitor === "function")
        return visitor(key, node, path);
      if (identity2.isMap(node))
        return visitor.Map?.(key, node, path);
      if (identity2.isSeq(node))
        return visitor.Seq?.(key, node, path);
      if (identity2.isPair(node))
        return visitor.Pair?.(key, node, path);
      if (identity2.isScalar(node))
        return visitor.Scalar?.(key, node, path);
      if (identity2.isAlias(node))
        return visitor.Alias?.(key, node, path);
      return void 0;
    }
    function replaceNode(key, path, node) {
      const parent = path[path.length - 1];
      if (identity2.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity2.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity2.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity2.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    var identity2 = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml2, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml2);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity2.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity2.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    var identity2 = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity2.isScalar(ref.node) || identity2.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    var identity2 = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity2.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports.toJS = toJS;
  }
});

// node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity2 = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity2.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity2.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity2 = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity2.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity2.isAlias(node) || identity2.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        if (found && ctx) {
          const { anchors: anchors2, doc: doc2, maxAliasCount } = ctx;
          let data = anchors2.get(found);
          if (!data) {
            toJS.toJS(found, null, ctx);
            data = anchors2.get(found);
          }
          if (data?.res === void 0) {
            const msg = "This should not happen: Alias anchor was not resolved?";
            throw new ReferenceError(msg);
          }
          if (maxAliasCount >= 0) {
            data.count += 1;
            if (data.aliasCount === 0)
              data.aliasCount = getAliasCount(doc2, found, anchors2);
            if (data.count * data.aliasCount > maxAliasCount) {
              const msg = "Excessive alias count indicates a resource exhaustion attack";
              throw new ReferenceError(msg);
            }
          }
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const source = this.resolve(ctx.doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        return ctx.anchors.get(source).res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity2.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity2.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity2.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    var identity2 = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity2.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  }
});

// node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity2 = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match2 = tags.filter((t) => t.tag === tagName);
        const tagObj = match2.find((t) => !t.format) ?? match2[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity2.isDocument(value))
        value = value.contents;
      if (identity2.isNode(value))
        return value;
      if (identity2.isPair(value)) {
        const map = ctx.schema[identity2.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity2.MAP] : Symbol.iterator in Object(value) ? schema[identity2.SEQ] : schema[identity2.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var identity2 = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path, value) {
      let v = value;
      for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity2.isNode(it) || identity2.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path, value) {
        if (isEmptyPath(path))
          this.add(value);
        else {
          const [key, ...rest] = path;
          const node = this.get(key, true);
          if (identity2.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity2.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity2.isScalar(node) ? node.value : node;
        else
          return identity2.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity2.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity2.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity2.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity2.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text4, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text4;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text4.length <= endStep)
        return text4;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text4, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text4[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text4[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text4, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text4[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text4[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text4;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text4;
      if (onFold)
        onFold();
      let res = text4.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text4.length;
        if (fold === 0)
          res = `
${indent}${text4.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text4[fold]}\\`;
          res += `
${indent}${text4.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text4, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text4[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text4[++i];
        } else {
          do {
            ch = text4[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text4[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var identity2 = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match2 = tags.filter((t) => t.tag === item.tag);
        if (match2.length > 0)
          return match2.find((t) => t.format === item.format) ?? match2[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity2.isScalar(item)) {
        obj = item.value;
        let match2 = tags.filter((t) => t.identify?.(obj));
        if (match2.length > 1) {
          const testMatch = match2.filter((t) => t.test);
          if (testMatch.length > 0)
            match2 = testMatch;
        }
        tagObj = match2.find((t) => t.format === item.format) ?? match2.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity2.isScalar(node) || identity2.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify2(item, ctx, onComment, onChompKeep) {
      if (identity2.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity2.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity2.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity2.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity2.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify2;
  }
});

// node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    var identity2 = require_identity();
    var Scalar = require_Scalar();
    var stringify2 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity2.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity2.isCollection(key) || !identity2.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity2.isCollection(key) || (identity2.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify2.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity2.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity2.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity2.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify2.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity2.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    var identity2 = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity2.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity2.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity2.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity2.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge;
  }
});

// node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log = require_log();
    var merge = require_merge();
    var stringify2 = require_stringify();
    var identity2 = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity2.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity2.isNode(key) && ctx?.doc) {
        const strCtx = stringify2.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity2 = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity2.NODE_TYPE, { value: identity2.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity2.isNode(key))
          key = key.clone(schema);
        if (identity2.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    var identity2 = require_identity();
    var stringify2 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify3 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify3(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity2.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity2.isPair(item)) {
          const ik = identity2.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify2.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity2.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity2.isPair(item)) {
          const ik = identity2.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity2.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify2.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity2 = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity2.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity2.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity2.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity2.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity2.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity2.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity2.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity2.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  }
});

// node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    var identity2 = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity2.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports.map = map;
  }
});

// node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity2 = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity2.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity2.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity2.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity2.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq;
  }
});

// node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    var identity2 = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity2.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports.seq = seq;
  }
});

// node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string3 = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string3;
  }
});

// node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string3 = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string3.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    var node_buffer = __require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    var identity2 = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity2.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity2.isPair(item))
            continue;
          else if (identity2.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity2.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    var identity2 = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity2.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity2.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    var identity2 = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity2.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity2.isPair(pair) ? identity2.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity2.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match2 = str.match(timestamp.test);
        if (!match2)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match2.map(Number);
        const millisec = match2[7] ? Number((match2[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match2[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string3 = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string3.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string3 = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string3.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    var identity2 = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string3 = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity2.MAP, { value: map.map });
        Object.defineProperty(this, identity2.SCALAR, { value: string3.string });
        Object.defineProperty(this, identity2.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema;
  }
});

// node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    var identity2 = require_identity();
    var stringify2 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify2.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity2.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify2.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify2.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity2 = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity2.NODE_TYPE, { value: identity2.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity2.NODE_TYPE]: { value: identity2.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity2.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity2.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity2.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
          return !keepScalar && identity2.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity2.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity2.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path) {
        if (Collection.isEmptyPath(path))
          return this.contents !== void 0;
        return identity2.isCollection(this.contents) ? this.contents.hasIn(path) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity2.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document;
  }
});

// node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    var identity2 = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity2.isScalar(a) && identity2.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep: sep2, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep2?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep2) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep2 ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep2, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep2 = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep2 + cb;
              sep2 = "";
              break;
            }
            case "newline":
              if (comment)
                sep2 += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    var identity2 = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep: sep2, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep2?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep2 && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity2.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep2 && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep2, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep2 ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep2)
                for (const st of sep2) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep2, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    var identity2 = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity2.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep2 = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep2 + indent.slice(trimIndent) + content;
          sep2 = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep2 === " ")
            sep2 = "\n";
          else if (!prevMoreIndented && sep2 === "\n")
            sep2 = "\n\n";
          value += sep2 + indent.slice(trimIndent) + content;
          sep2 = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep2 === "\n")
            value += "\n";
          else
            sep2 = "\n";
        } else {
          value += sep2 + content;
          sep2 = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return unfoldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function unfoldLines(source) {
      const line = /(.*?)\r?\n/sy;
      let match2 = line.exec(source);
      if (!match2)
        return source;
      let trimEnd, trimBoth;
      try {
        trimEnd = new RegExp("(?<![ 	])[ 	]+$");
        trimBoth = new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
      } catch {
        trimEnd = /[ \t]+$/;
        trimBoth = /^[ \t]+|[ \t]+$/g;
      }
      let res = match2[1].replace(trimEnd, "");
      let sep2 = " ";
      let pos = line.lastIndex;
      while (match2 = line.exec(source)) {
        const lm = match2[1].replace(trimBoth, "");
        if (lm === "") {
          if (sep2 === "\n")
            res += sep2;
          else
            sep2 = "\n";
        } else {
          res += sep2 + lm;
          sep2 = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match2 = last.exec(source);
      return res + sep2 + (match2?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    var identity2 = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity2.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity2.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity2.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity2.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity2.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity2.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity2.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity2 = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity2.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  }
});

// node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity2 = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity2.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity2.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    var stringify2 = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep: sep2, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep2)
        for (const st of sep2)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify2;
  }
});

// node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path) => {
      let item = cst;
      for (const [field3, index] of path) {
        const tok = item?.[field3];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path) => {
      const parent = visit.itemAtPath(cst, path.slice(0, -1));
      const field3 = path[path.length - 1][0];
      const coll = parent?.[field3];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path, item, visitor) {
      let ctrl = visitor(item, path);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field3 of ["key", "value"]) {
        const token = item[field3];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field3, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field3 === "key")
            ctrl = ctrl(item, path);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
    }
    exports.visit = visit;
  }
});

// node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer;
  }
});

// node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter;
  }
});

// node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep2;
          if (scalar.end) {
            sep2 = scalar.end;
            sep2.push(this.sourceToken);
            delete scalar.end;
          } else
            sep2 = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep: sep2 }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep2 = it.sep;
                  sep2.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep: sep2 }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep2 = fc.end.splice(1, fc.end.length);
            sep2.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep: sep2 }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  }
});

// node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity2 = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse3(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify2(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity2.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse3;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument;
    exports.stringify = stringify2;
  }
});

// node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity2 = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity2.isAlias;
    exports.isCollection = identity2.isCollection;
    exports.isDocument = identity2.isDocument;
    exports.isMap = identity2.isMap;
    exports.isNode = identity2.isNode;
    exports.isPair = identity2.isPair;
    exports.isScalar = identity2.isScalar;
    exports.isSeq = identity2.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

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
        function closeSync2(fd) {
          fs$closeSync.apply(fs, arguments);
          resetQueue();
        }
        Object.defineProperty(closeSync2, previousSymbol, {
          value: fs$closeSync
        });
        return closeSync2;
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
      fs2.readFile = readFile4;
      function readFile4(path, options, cb) {
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
      fs2.readdir = readdir3;
      var noReaddirOptionVersions = /^v[0-5]\./;
      function readdir3(path, options, cb) {
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
        open6(that.path, that.flags, that.mode, function(err, fd) {
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
        open6(that.path, that.flags, that.mode, function(err, fd) {
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
      fs2.open = open6;
      function open6(path, flags, mode, cb) {
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
      return (...args) => new Promise((resolve15, reject) => {
        args.push((err, result2) => {
          if (err) {
            reject(err);
          } else {
            resolve15(result2);
          }
        });
        method(...args);
      });
    }
    function toSync(method) {
      return (...args) => {
        let err;
        let result2;
        args.push((_err, _result) => {
          err = _err;
          result2 = _result;
        });
        method(...args);
        if (err) {
          throw err;
        }
        return result2;
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
import { readFileSync as readFileSync8 } from "node:fs";

// adapters/process-hooks.ts
import { basename as basename9, dirname as dirname13, isAbsolute as isAbsolute5, resolve as resolve14 } from "node:path";

// domain/repo-layout.ts
import { existsSync as existsSync3, realpathSync as realpathSync3 } from "node:fs";
import { basename as basename3, join as join10, relative, resolve as resolve4 } from "node:path";

// node_modules/@compforge/repokit/dist/inspect.js
import { realpath as realpath2 } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

// node_modules/@compforge/repokit/dist/git/environment.js
var local = /* @__PURE__ */ new Set(["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_IMPLICIT_WORK_TREE", "GIT_GRAFT_FILE", "GIT_SHALLOW_FILE", "GIT_PREFIX", "GIT_NAMESPACE", "GIT_NO_REPLACE_OBJECTS", "GIT_REPLACE_REF_BASE", "GIT_CONFIG", "GIT_CONFIG_PARAMETERS", "GIT_CONFIG_COUNT", "GIT_CEILING_DIRECTORIES", "GIT_DISCOVERY_ACROSS_FILESYSTEM", "GIT_SUPER_PREFIX"]);
function checkoutEnvironment(source = process.env) {
  const result2 = Object.fromEntries(Object.entries(source).filter(([key]) => !local.has(key) && !key.startsWith("GIT_CONFIG_KEY_") && !key.startsWith("GIT_CONFIG_VALUE_")));
  const count = Number(source.GIT_CONFIG_COUNT ?? 0), pairs = [];
  for (let i = 0; Number.isInteger(count) && i < Math.min(count, Object.keys(source).length); i++) {
    const key = source[`GIT_CONFIG_KEY_${i}`], value = source[`GIT_CONFIG_VALUE_${i}`];
    if (key && value !== void 0 && portableConfig(key))
      pairs.push([key, value]);
  }
  if (pairs.length) {
    result2.GIT_CONFIG_COUNT = String(pairs.length);
    pairs.forEach(([key, value], i) => {
      result2[`GIT_CONFIG_KEY_${i}`] = key;
      result2[`GIT_CONFIG_VALUE_${i}`] = value;
    });
  }
  const parameters = splitParameters(source.GIT_CONFIG_PARAMETERS ?? "").filter((value) => portableConfig(value.split("=", 1)[0]));
  if (parameters.length)
    result2.GIT_CONFIG_PARAMETERS = parameters.map((value) => "'" + value.replaceAll("'", "'\\''") + "'").join(" ");
  return result2;
}
function portableConfig(key) {
  key = key.toLowerCase();
  return /^(http|https|credential|url|user|author|committer)\./.test(key) || ["core.sshcommand", "core.gitproxy", "core.askpass", "ssh.variant"].includes(key);
}
function splitParameters(input) {
  const words = [];
  let word = "", quote = "", escaped = false, started = false;
  for (const char of input) {
    if (escaped) {
      word += char;
      escaped = false;
      started = true;
    } else if (char === "\\" && quote !== "'")
      escaped = true;
    else if (quote) {
      if (char === quote)
        quote = "";
      else
        word += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) {
        words.push(word);
        word = "";
        started = false;
      }
    } else {
      word += char;
      started = true;
    }
  }
  if (quote || escaped)
    return [];
  if (started)
    words.push(word);
  return words;
}

// node_modules/@compforge/repokit/dist/git/catalog.js
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { dirname, join } from "node:path";

// node_modules/@compforge/repokit/dist/depot.js
import { posix } from "node:path";

// node_modules/smol-toml/dist/error.js
function getLineColFromPtr(string3, ptr) {
  let lines = string3.slice(0, ptr).split(/\r?\n/);
  return [lines.length, lines.pop().length + 1];
}
function makeCodeBlock(string3, line, column) {
  let lines = string3.split(/\r?\n/);
  let codeblock = "";
  let numberLen = (Math.log10(line + 1) | 0) + 1;
  for (let i = line - 1; i <= line + 1; i++) {
    let l = lines[i - 1];
    if (!l)
      continue;
    codeblock += i.toString().padEnd(numberLen, " ");
    codeblock += ":  ";
    codeblock += l;
    codeblock += "\n";
    if (i === line) {
      codeblock += " ".repeat(numberLen + column + 2);
      codeblock += "^\n";
    }
  }
  return codeblock;
}
var TomlError = class _TomlError extends Error {
  line;
  column;
  codeblock;
  constructor(message, options) {
    const [line, column] = getLineColFromPtr(options.toml, options.ptr);
    const codeblock = makeCodeBlock(options.toml, line, column);
    super(`Invalid TOML document: ${message}

${codeblock}`, options);
    this.line = line;
    this.column = column;
    this.codeblock = codeblock;
  }
  /** @internal */
  static x(message, ctx, ptr) {
    throw new _TomlError(message, { toml: ctx.s, ptr: ptr ?? ctx.p });
  }
};

// node_modules/smol-toml/dist/primitive.js
function parseString(ctx) {
  let startPtr = ctx.p;
  let c = ctx.s.charCodeAt(ctx.p++);
  let first = c;
  let isLiteral = c === 39;
  let isMultiline = c === ctx.s.charCodeAt(ctx.p) && c === ctx.s.charCodeAt(ctx.p + 1);
  if (isMultiline) {
    if ((c = ctx.s.charCodeAt(ctx.p += 2)) === 10)
      ctx.p++;
    else if (c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)
      ctx.p += 2;
  }
  let parsed = "";
  let sliceStart = ctx.p;
  let state = 0;
  for (; ctx.p < ctx.s.length; ctx.p++) {
    c = ctx.s.charCodeAt(ctx.p);
    if (isMultiline && (c === 10 || c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)) {
      state = state && 3;
    } else if (c < 32 && c !== 9 || c === 127) {
      TomlError.x("control characters are not allowed in strings", ctx);
    } else if ((!state || state === 3) && c === first && (!isMultiline || ctx.s.charCodeAt(ctx.p + 1) === first && ctx.s.charCodeAt(ctx.p + 2) === first)) {
      if (isMultiline) {
        if (ctx.s.charCodeAt(ctx.p + 3) === first)
          ctx.p++;
        if (ctx.s.charCodeAt(ctx.p + 3) === first)
          ctx.p++;
      }
      if (!state) {
        let s = ctx.s.slice(sliceStart, ctx.p);
        parsed = parsed ? parsed + s : s;
      }
      ctx.p += isMultiline ? 3 : 1;
      return parsed;
    } else if (!state) {
      if (!isLiteral && c === 92) {
        parsed += ctx.s.slice(sliceStart, sliceStart = ctx.p);
        state = 1;
      }
    } else if (state === 1) {
      if (c === 120 || c === 117 || c === 85) {
        let errPtr = ctx.p++ - 1;
        let value = 0;
        let len = c === 120 ? 2 : c === 117 ? 4 : 8;
        for (let j = 0; j < len; j++, ctx.p++) {
          let hex = ctx.s.charCodeAt(ctx.p);
          let digit = (
            /* 0-9 */
            hex >= 48 && hex <= 57 ? hex - 48 : (
              /* A-F */
              hex >= 65 && hex <= 70 ? hex - 65 + 10 : (
                /* a-f */
                hex >= 97 && hex <= 102 ? hex - 97 + 10 : -1
              )
            )
          );
          if (digit < 0)
            TomlError.x("invalid non-hex character in unicode escape", ctx);
          value = value << 4 | digit;
        }
        if (value < 0 || value > 1114111 || value >= 55296 && value <= 57343) {
          TomlError.x("invalid unicode escape", ctx, errPtr);
        }
        parsed += String.fromCodePoint(value);
        sliceStart = ctx.p--;
        state = 0;
      } else if (isMultiline && (c === 32 || c === 9)) {
        state = 2;
      } else {
        if (c === 98)
          parsed += "\b";
        else if (c === 116)
          parsed += "	";
        else if (c === 110)
          parsed += "\n";
        else if (c === 102)
          parsed += "\f";
        else if (c === 114)
          parsed += "\r";
        else if (c === 101)
          parsed += "\x1B";
        else if (c === 34)
          parsed += '"';
        else if (c === 92)
          parsed += "\\";
        else
          TomlError.x("unrecognised escape sequence", ctx);
        sliceStart = ctx.p + 1;
        state = 0;
      }
    } else if (c !== 32 && c !== 9) {
      if (state === 2)
        TomlError.x("invalid escape: only line-ending whitespace may be escaped", ctx, sliceStart);
      state = !isLiteral && c === 92 ? 1 : 0;
      sliceStart = ctx.p;
    }
  }
  TomlError.x("unfinished string", ctx, startPtr);
}

// node_modules/smol-toml/dist/date.js
var DATE_TIME_RE = /^(\d{4}-\d{2}-\d{2})?[Tt ]?(?:(\d{2}):\d{2}(?::\d{2}(?:\.\d+)?)?)?(Z|z|[-+]\d{2}:\d{2})?$/i;
var TomlDate = class _TomlDate extends Date {
  #hasDate = false;
  #hasTime = false;
  #offset = null;
  constructor(date, fasttype, unsafeDelim) {
    let hasDate = true;
    let hasTime = true;
    let offset = "Z";
    let c;
    if (typeof date === "string") {
      if (fasttype)
        prep: {
          if (fasttype < 3) {
            if (+date.slice(11, 13) > 23) {
              date = "";
              break prep;
            }
            if (fasttype === 2) {
              offset = null;
              date += "Z";
            } else if ((c = date.charCodeAt(date.length - 1)) !== 90 && c !== 122) {
              offset = date.slice(date.length - 6);
            }
            if (unsafeDelim)
              date = date.slice(0, 10) + "T" + date.slice(11);
          } else if (fasttype === 4) {
            date = +date.slice(0, 2) > 23 ? "" : `0000-01-01T${date}Z`;
          }
          hasDate = fasttype !== 4;
          hasTime = fasttype !== 3;
        }
      else {
        let match2 = date.match(DATE_TIME_RE);
        if (match2) {
          if (!match2[1]) {
            hasDate = false;
            date = `0000-01-01T${date}`;
          }
          hasTime = !!match2[2];
          hasTime && date[10] === " " && (date = date.replace(" ", "T"));
          if (match2[2] && +match2[2] > 23) {
            date = "";
          } else {
            offset = match2[3] || null;
            if (!offset && hasTime)
              date += "Z";
          }
        } else {
          date = "";
        }
      }
    }
    super(date);
    if (!isNaN(this.getTime())) {
      this.#hasDate = hasDate;
      this.#hasTime = hasTime;
      this.#offset = offset;
    }
  }
  isDateTime() {
    return this.#hasDate && this.#hasTime;
  }
  isLocal() {
    return !this.#hasDate || !this.#hasTime || !this.#offset;
  }
  isDate() {
    return this.#hasDate && !this.#hasTime;
  }
  isTime() {
    return this.#hasTime && !this.#hasDate;
  }
  isValid() {
    return this.#hasDate || this.#hasTime;
  }
  toISOString() {
    let iso2 = super.toISOString();
    if (this.isDate())
      return iso2.slice(0, 10);
    if (this.isTime())
      return iso2.slice(11, 23);
    if (this.#offset === null)
      return iso2.slice(0, -1);
    if (this.#offset === "Z" || this.#offset === "z")
      return iso2;
    let offset = +this.#offset.slice(1, 3) * 60 + +this.#offset.slice(4, 6);
    offset = this.#offset[0] === "-" ? offset : -offset;
    let offsetDate = new Date(this.getTime() - offset * 6e4);
    return offsetDate.toISOString().slice(0, -1) + this.#offset;
  }
  static wrapAsOffsetDateTime(jsDate, offset = "Z") {
    let date = new _TomlDate(jsDate);
    date.#offset = offset;
    return date;
  }
  static wrapAsLocalDateTime(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#offset = null;
    return date;
  }
  static wrapAsLocalDate(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#hasTime = false;
    date.#offset = null;
    return date;
  }
  static wrapAsLocalTime(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#hasDate = false;
    date.#offset = null;
    return date;
  }
};

// node_modules/smol-toml/dist/extract.js
function isDigit(char, base = 10) {
  return base === 16 ? char > 47 && char < 58 || char > 64 && char < 71 || char > 96 && char < 103 : char > 47 && char < 48 + base;
}
function isEndOfValue(char, delim) {
  return char === 32 || char === 9 || char === 10 || char === 13 || // Structure end or next value delimiter
  delim && (char === delim || char === 44) || // Comment
  char === 35;
}
function extractValue(ctx, end) {
  let errPtr = ctx.p;
  let c = ctx.s.charCodeAt(ctx.p);
  if (c === 91 || c === 123) {
    ctx.d-- || TomlError.x("document contains excessively nested structures. aborting.", ctx);
    let value = c === 91 ? parseArray(ctx) : parseInlineTable(ctx);
    ctx.d++;
    return value;
  }
  if (c === 34 || c === 39) {
    return parseString(ctx);
  }
  if (c === 116) {
    if (ctx.s.charCodeAt(++ctx.p) !== 114 || ctx.s.charCodeAt(++ctx.p) !== 117 || ctx.s.charCodeAt(++ctx.p) !== 101)
      TomlError.x("invalid value", ctx, errPtr);
    return ctx.p++, true;
  }
  if (c === 102) {
    if (ctx.s.charCodeAt(++ctx.p) !== 97 || ctx.s.charCodeAt(++ctx.p) !== 108 || ctx.s.charCodeAt(++ctx.p) !== 115 || ctx.s.charCodeAt(++ctx.p) !== 101)
      TomlError.x("invalid value", ctx, errPtr);
    return ctx.p++, false;
  }
  if (c === 43 || c === 45) {
    return parseNumber(ctx, ctx.p, ctx.s.charCodeAt(++ctx.p), 44 - c, end);
  }
  if (ctx.s.charCodeAt(ctx.p + 4) === 45 && ctx.s.charCodeAt(ctx.p + 7) === 45) {
    return parseDate(ctx, c, end);
  }
  if (ctx.s.charCodeAt(ctx.p + 2) === 58) {
    return parseTime(ctx, c, end);
  }
  return parseNumber(ctx, ctx.p, c, 0, end);
}
function parseNumber(ctx, startPtr, startChr, sign, endChr) {
  let c = startChr;
  let state = 0;
  let hasUnderscores = false;
  if (c === 105) {
    if (ctx.s.charCodeAt(++ctx.p) !== 110 || ctx.s.charCodeAt(++ctx.p) !== 102)
      TomlError.x("invalid value", ctx, startPtr);
    return ctx.p++, (sign || 1) / 0;
  }
  if (c === 110) {
    if (ctx.s.charCodeAt(++ctx.p) !== 97 || ctx.s.charCodeAt(++ctx.p) !== 110)
      TomlError.x("invalid value", ctx, startPtr);
    return ctx.p++, NaN;
  }
  if (c === 48) {
    if (++ctx.p >= ctx.s.length || isEndOfValue(c = ctx.s.charCodeAt(ctx.p), endChr))
      return ctx.bi === true ? 0n : 0;
    if (!sign) {
      if (c === 120)
        return parseIntegerBaseN(ctx, startPtr, 16, endChr);
      else if (c === 98)
        return parseIntegerBaseN(ctx, startPtr, 2, endChr);
      else if (c === 111)
        return parseIntegerBaseN(ctx, startPtr, 8, endChr);
    }
    if (c === 46)
      state = 2;
    else if (c === 101 || c === 69)
      state = 4;
    else
      TomlError.x("illegal leading zero", ctx, startPtr);
  } else if (!isDigit(c))
    TomlError.x("invalid value", ctx, startPtr);
  while (++ctx.p < ctx.s.length && (c = ctx.s.charCodeAt(ctx.p), !isEndOfValue(c, endChr))) {
    if (!state)
      state = 1;
    if (c === 95) {
      if (!(state & 1))
        TomlError.x("illegal underscore", ctx);
      state += 11;
      hasUnderscores = true;
    } else if (state === 1 && c === 46)
      state = 2;
    else if ((state === 1 || state === 3) && (c === 101 || c === 69))
      state = 4;
    else if (state === 4 && (c === 43 || c === 45)) {
      state = 6;
    } else if (!isDigit(c))
      TomlError.x(`illegal character in numeric literal`, ctx);
    else if (state > 9)
      state -= 11;
    else if (!(state & 1))
      state++;
  }
  if (!state) {
    let val = (startChr - 48) * (sign || 1);
    return ctx.bi === true ? BigInt(val) : val;
  }
  if (!(state & 1))
    TomlError.x("unfinished numeric value", ctx, startPtr);
  let str = ctx.s.slice(startPtr, ctx.p);
  if (hasUnderscores)
    str = str.replaceAll("_", "");
  return state > 1 ? parseFloat(str) : parseInteger(ctx, str, 10, startPtr);
}
function parseIntegerBaseN(ctx, startPtr, base, endChr) {
  let c, underscore = 1;
  while (++ctx.p < ctx.s.length && (c = ctx.s.charCodeAt(ctx.p), !isEndOfValue(c, endChr))) {
    if (c === 95) {
      if (underscore & 1)
        TomlError.x("illegal underscore", ctx);
      underscore = 3;
    } else if (!isDigit(c, base))
      TomlError.x(`illegal character in numeric literal`, ctx);
    else if (underscore & 1)
      underscore--;
  }
  if (underscore & 1)
    TomlError.x("unfinished numeric value", ctx);
  let str = ctx.s.slice(startPtr + 2, ctx.p);
  if (underscore)
    str = str.replaceAll("_", "");
  return parseInteger(ctx, str, base, startPtr);
}
function parseInteger(ctx, str, base, startPtr) {
  if (ctx.bi !== true)
    int: {
      let val = parseInt(str, base);
      if (!Number.isSafeInteger(val)) {
        if (ctx.bi)
          break int;
        TomlError.x("integer value cannot be represented losslessly", ctx, startPtr);
      }
      return val;
    }
  return base === 10 ? BigInt(str) : BigInt((base === 2 ? "0b" : base === 8 ? "0o" : "0x") + str);
}
function parseDate(ctx, c, endChr) {
  let startPtr = ctx.p++, unsafeSeparator;
  if (!isDigit(c) || !isDigit(ctx.s.charCodeAt(ctx.p++)) || !isDigit(ctx.s.charCodeAt(ctx.p++)) || !isDigit(ctx.s.charCodeAt(ctx.p++))) {
    return parseNumber(ctx, ctx.p = startPtr, c, 0, endChr);
  }
  ctx.p += 5;
  if (!isDigit(ctx.s.charCodeAt(ctx.p++)))
    TomlError.x("invalid date-time: date part is malformed", ctx, startPtr);
  if (ctx.p >= ctx.s.length || ((c = ctx.s.charCodeAt(ctx.p)) !== 32 || (unsafeSeparator = true, !isDigit(ctx.s.charCodeAt(ctx.p + 1)))) && c !== 84 && c !== 116) {
    let t2 = ctx.s.slice(startPtr, ctx.p);
    return readDate(ctx, t2, 3, false, startPtr);
  }
  if (ctx.s.charCodeAt(ctx.p += 3) !== 58)
    TomlError.x("invalid date-time: time part is malformed", ctx, startPtr);
  if (ctx.s.charCodeAt(ctx.p += 3) === 58)
    ctx.p += 3;
  if (ctx.s.charCodeAt(ctx.p) === 46)
    while (isDigit(ctx.s.charCodeAt(++ctx.p)))
      ;
  if (c = ctx.s.charCodeAt(ctx.p)) {
    if (c === 90 || c === 122) {
      let t2 = ctx.s.slice(startPtr, ++ctx.p);
      return readDate(ctx, t2, 1, unsafeSeparator, startPtr, "[+00:00]");
    }
    if (c === 43 || c === 45) {
      let t2 = ctx.s.slice(startPtr, ctx.p += 6);
      return readDate(ctx, t2, 1, unsafeSeparator, startPtr, !ctx.ld && "[" + ctx.s.slice(ctx.p - 6, ctx.p) + "]");
    }
  }
  let t = ctx.s.slice(startPtr, ctx.p);
  return readDate(ctx, t, 2, unsafeSeparator, startPtr);
}
function parseTime(ctx, c, endChr) {
  let start = ctx.p;
  if (!isDigit(c) || !isDigit(ctx.s.charCodeAt(++ctx.p))) {
    return parseNumber(ctx, --ctx.p, c, 0, endChr);
  }
  if (ctx.s.charCodeAt(ctx.p += 4) === 58)
    ctx.p += 3;
  if (ctx.s.charCodeAt(ctx.p) === 46)
    while (isDigit(ctx.s.charCodeAt(++ctx.p)))
      ;
  let t = ctx.s.slice(start, ctx.p);
  return readDate(ctx, t, 4, false, start);
}
function readDate(ctx, str, type, unsafeDelim, errPtr, temporalSuffix) {
  if (ctx.ld) {
    let date = new TomlDate(str, type, unsafeDelim);
    if (!date.isValid())
      TomlError.x("invalid date", ctx, errPtr);
    return date;
  }
  try {
    if (temporalSuffix)
      str += temporalSuffix;
    switch (type) {
      case 1:
        return Temporal.ZonedDateTime.from(str);
      case 2:
        return Temporal.PlainDateTime.from(str);
      case 3:
        return Temporal.PlainDate.from(str);
      case 4:
        return Temporal.PlainTime.from(str);
    }
  } catch (e) {
    TomlError.x(e instanceof Error ? e.message : "" + e, ctx, errPtr);
  }
}

// node_modules/smol-toml/dist/util.js
function skipComment(ctx) {
  for (; ctx.p < ctx.s.length; ctx.p++) {
    let c = ctx.s.charCodeAt(ctx.p);
    if (c === 10)
      break;
    if (c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10) {
      ctx.p++;
      break;
    }
    if (c < 32 && c !== 9 || c === 127) {
      TomlError.x("control characters are not allowed in comments", ctx);
    }
  }
}
function skipVoid(ctx, banNewLines, banComments) {
  let c;
  while (ctx.p < ctx.s.length) {
    while (ctx.p < ctx.s.length && ((c = ctx.s.charCodeAt(ctx.p)) === 32 || c === 9 || !banNewLines && (c === 10 || c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)))
      ctx.p++;
    if (banComments || c !== 35)
      break;
    skipComment(ctx);
  }
}

// node_modules/smol-toml/dist/struct.js
function parseKey(ctx, end = 61) {
  let startPtr;
  let state = 0;
  let parsed = [];
  let sliceStart;
  let c = ctx.s.charCodeAt(startPtr = ctx.p);
  do {
    if (c === end) {
      if (!state)
        TomlError.x("unexpected end of key", ctx);
      if (state === 1)
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
      return ctx.p++, parsed;
    } else if (c === 46) {
      if (!state)
        TomlError.x("illegal empty bare key", ctx);
      if (state === 1)
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
      state = 0;
    } else if (!state && (c === 34 || c === 39)) {
      if (c === ctx.s.charCodeAt(ctx.p + 1) && c === ctx.s.charCodeAt(ctx.p + 2))
        TomlError.x("illegal quoted key: multiline strings are not allowed", ctx);
      parsed.push(parseString(ctx));
      state = 2;
      ctx.p--;
    } else if (c === 32 || c === 9) {
      if (state === 1) {
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
        state = 2;
      }
    } else if (state === 2 || c < 48 && c !== 45 || c > 57 && c < 65 || c > 90 && c < 97 && c !== 95 || c > 122) {
      TomlError.x("illegal character in key", ctx);
    } else if (!state) {
      state = 1;
      sliceStart = ctx.p;
    }
  } while (c = ctx.s.charCodeAt(++ctx.p));
  TomlError.x("incomplete key-value: cannot find end of key", ctx, startPtr);
}
function parseInlineTable(ctx) {
  let startPtr = ctx.p++;
  let res = /* @__PURE__ */ Object.create(null);
  let seen = /* @__PURE__ */ new Set();
  let c;
  while (ctx.p < ctx.s.length) {
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p)) === 125) {
      ctx.p++;
      return res;
    }
    let k;
    let t = res;
    let hasOwn = false;
    let errPtr = ctx.p;
    let key = parseKey(ctx);
    for (let i = 0; i < key.length; i++) {
      if (i)
        t = hasOwn ? t[k] : t[k] = /* @__PURE__ */ Object.create(null);
      k = key[i];
      if ((hasOwn = Object.hasOwn(t, k)) && (typeof t[k] !== "object" || seen.has(t[k]))) {
        TomlError.x("trying to redefine an already defined value", ctx, errPtr);
      }
      let unsafe = k === "__proto__";
      if (ctx.uk && (unsafe || k === "constructor")) {
        t = ctx.uk !== 1 && TomlError.x("document contains an unsafe property", ctx, errPtr);
        break;
      }
      if (!hasOwn && unsafe) {
        Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
      }
    }
    if (hasOwn) {
      TomlError.x("trying to redefine an already defined value", ctx, errPtr);
    }
    skipVoid(ctx, true, true);
    let value = extractValue(
      ctx,
      125
      /* } */
    );
    if (t && typeof (t[k] = value) === "object")
      seen.add(value);
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p++)) === 125) {
      return res;
    }
    if (c !== 44)
      TomlError.x("expected comma or end of structure", ctx, ctx.p - 1);
  }
  TomlError.x("unfinished table", ctx, startPtr);
}
function parseArray(ctx) {
  let startPtr = ctx.p++;
  let res = [];
  let c;
  while (ctx.p < ctx.s.length) {
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p)) === 93) {
      ctx.p++;
      return res;
    }
    res.push(extractValue(
      ctx,
      93
      /* ] */
    ));
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p++)) === 93) {
      return res;
    }
    if (c !== 44)
      TomlError.x("expected comma or end of structure", ctx, ctx.p - 1);
  }
  TomlError.x("unfinished array", ctx, startPtr);
}

// node_modules/smol-toml/dist/parse.js
function peekTable(ctx, key, table, meta, type) {
  let t = table;
  let m = meta;
  let k;
  let hasOwn = false;
  let state;
  for (let i = 0; i < key.length; i++) {
    if (i) {
      t = hasOwn ? t[k] : t[k] = /* @__PURE__ */ Object.create(null);
      m = (state = m[k]).c;
      if (type === 0 && (state.t === 1 || state.t === 2)) {
        return null;
      }
      if (state.t === 2) {
        let l = t.length - 1;
        t = t[l];
        m = m[l].c;
      }
    }
    k = key[i];
    if ((hasOwn = Object.hasOwn(t, k)) && m[k]?.t === 0 && m[k]?.d) {
      return null;
    }
    if (!hasOwn) {
      let unsafe = k === "__proto__";
      if (ctx.uk && (unsafe || k === "constructor"))
        return false;
      if (unsafe) {
        Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
        Object.defineProperty(m, k, { enumerable: true, configurable: true, writable: true });
      }
      m[k] = {
        t: i < key.length - 1 && type === 2 ? 3 : type,
        d: false,
        i: 0,
        c: /* @__PURE__ */ Object.create(null)
      };
    }
  }
  state = m[k];
  if (state.t !== type && !(type === 1 && state.t === 3)) {
    return null;
  }
  if (type === 2) {
    if (!state.d) {
      state.d = true;
      t[k] = [];
    }
    t[k].push(t = /* @__PURE__ */ Object.create(null));
    state.c[state.i++] = state = { t: 1, d: false, i: 0, c: /* @__PURE__ */ Object.create(null) };
  }
  if (state.d) {
    return null;
  }
  state.d = true;
  if (type === 1) {
    t = hasOwn ? t[k] : t[k] = /* @__PURE__ */ Object.create(null);
  } else if (type === 0 && hasOwn) {
    return null;
  }
  return [k, t, state.c];
}
function validateTablePeek(ctx, peek, ptr) {
  if (peek === null || ctx.uk === 2)
    TomlError.x(peek === null ? "trying to redefine an already defined table or value" : "document contains an unsafe property", ctx, ptr);
}
function parse(toml, options = {}) {
  let ctx = {
    s: toml,
    p: 0,
    d: options.maxDepth ?? 1e3,
    bi: options.integersAsBigInt ?? false,
    ld: options.useLegacyDate ?? true,
    uk: options.unsafeKeyBehaviour === "throw" ? 2 : options.unsafeKeyBehaviour === "drop" ? 1 : 0
  };
  let res = /* @__PURE__ */ Object.create(null);
  let meta = /* @__PURE__ */ Object.create(null);
  let tmp;
  let skipping = false;
  let tbl = res;
  let m = meta;
  if (toml.charCodeAt(0) === 65279)
    ctx.p++;
  skipVoid(ctx);
  while (ctx.p < toml.length) {
    if (toml.charCodeAt(ctx.p) === 91) {
      let isTableArray = toml.charCodeAt(++ctx.p) === 91;
      tmp = ctx.p += +isTableArray;
      skipping = false;
      let k = parseKey(
        ctx,
        93
        /* ] */
      );
      if (isTableArray) {
        if (toml.charCodeAt(ctx.p) !== 93) {
          TomlError.x("expected end of table array declaration", ctx);
        }
        ctx.p++;
      }
      let p = peekTable(
        ctx,
        k,
        res,
        meta,
        isTableArray ? 2 : 1
        /* Type.EXPLICIT */
      );
      if (!p) {
        validateTablePeek(ctx, p, tmp);
        skipping = true;
      } else {
        m = p[2];
        tbl = p[1];
      }
    } else {
      tmp = ctx.p;
      let k = parseKey(ctx);
      let p = peekTable(
        ctx,
        k,
        tbl,
        m,
        0
        /* Type.DOTTED */
      );
      if (!p && !skipping)
        validateTablePeek(ctx, p, tmp);
      skipVoid(ctx, true, true);
      let v = extractValue(ctx, void 0);
      if (p && !skipping)
        p[1][p[0]] = v;
    }
    skipVoid(ctx, true);
    if (ctx.p < toml.length && (tmp = toml.charCodeAt(ctx.p)) !== 10 && (tmp !== 13 || toml.charCodeAt(ctx.p + 1) !== 10)) {
      TomlError.x("each key-value declaration must be followed by an end-of-line", ctx);
    }
    skipVoid(ctx);
  }
  return res;
}

// node_modules/smol-toml/dist/stringify.js
var HAS_WELLFORMED = !!"".isWellFormed;

// node_modules/@compforge/repokit/dist/depot.js
var import_yaml = __toESM(require_dist(), 1);
function object(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("expected an object");
  return value;
}
function strings(value) {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string"))
    throw new Error("expected workspace patterns");
  return value;
}
var field = (v, key) => Object.entries(v).filter(([k]) => k.toLowerCase() === key.toLowerCase()).at(-1)?.[1];
function patterns(files, root, python) {
  const data = (name) => files.get(posix.join(root, name))?.toString() ?? "";
  const exists = (name) => files.has(posix.join(root, name));
  let values = [];
  if (python) {
    if (exists("pyproject.toml")) {
      const metadata = parse(data("pyproject.toml"));
      const workspace = object(object(object(metadata.tool ?? {}).uv ?? {}).workspace ?? {});
      values = [...strings(workspace.members ?? []), ...strings(workspace.exclude ?? []).map((p) => "!" + p)];
    }
  } else if (exists("pnpm-workspace.yaml")) {
    values = strings(object((0, import_yaml.parse)(data("pnpm-workspace.yaml")) ?? {}).packages ?? []);
  } else if (exists("package.json")) {
    const metadata = object(JSON.parse(data("package.json")) ?? {});
    let workspaces2 = field(metadata, "workspaces") ?? [];
    if (!Array.isArray(workspaces2) && typeof workspaces2 === "object")
      workspaces2 = field(object(workspaces2), "packages") ?? [];
    values = strings(workspaces2);
  }
  for (const value of values) {
    const pattern = value.replace(/^!/, "");
    if (/[\\\x00?\[\]{}()]/.test(pattern) || pattern.split("/").some((p) => !p || p === "." || p === ".."))
      throw new Error("unsupported workspace pattern");
  }
  return values;
}
function match(pattern, name) {
  const parts = name.split("/");
  let states = [true, ...parts.map(() => false)];
  for (const segment of pattern.split("/")) {
    const next = states.map(() => false);
    const expression = new RegExp("^" + segment.split("*").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
    for (let i = 0; i < states.length; i++) {
      if (segment === "**")
        next[i] = states[i] || i > 0 && next[i - 1];
      else if (i > 0 && states[i - 1])
        next[i] = expression.test(parts[i - 1]);
    }
    states = next;
  }
  return states.at(-1);
}
function installationRoot(files, component, python) {
  let selected = component;
  for (let ancestor = component; ; ancestor = posix.dirname(ancestor)) {
    const globs = patterns(files, ancestor, python);
    const relative2 = posix.relative(ancestor, selected);
    if (ancestor !== selected && globs.some((p) => !p.startsWith("!") && match(p, relative2)) && !globs.some((p) => p.startsWith("!") && match(p.slice(1), relative2)))
      selected = ancestor;
    if (ancestor === ".")
      return selected;
  }
}
function discoverDepot(files, component) {
  const bins = [];
  for (const [python, manifest, directory] of [[false, "package.json", "node_modules"], [true, "pyproject.toml", ".venv"]]) {
    if (!files.has(posix.join(component, manifest)))
      continue;
    try {
      const root = installationRoot(files, component, python);
      if (python) {
        if (!files.has(posix.join(root, "uv.lock")))
          continue;
      } else {
        if (files.has(posix.join(root, ".pnp.cjs")))
          continue;
        if (files.has(posix.join(root, ".yarnrc.yml"))) {
          const config = object((0, import_yaml.parse)(files.get(posix.join(root, ".yarnrc.yml"))?.toString() ?? "") ?? {});
          if (config.nodeLinker === "pnp")
            continue;
        }
      }
      bins.push({ path: posix.join(root, directory), kind: "dependencies" });
    } catch {
    }
  }
  return bins.length ? { bins: bins.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path))) } : void 0;
}

// node_modules/@compforge/harness-common/dist/system/repository.js
function repositoryId(repository2) {
  return `${repository2.forge.name}/${repository2.path}`;
}

// node_modules/@compforge/harness-common/dist/system/pull-request.js
function pullRequestId(pr) {
  return `${repositoryId(pr.repository)}#${pr.number}`;
}

// node_modules/@compforge/repokit/dist/model.js
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

// node_modules/@compforge/repokit/dist/git/operations.js
import { spawnSync } from "node:child_process";
function runGit(repo, args, timeoutMs = 5e3, raw = false) {
  const result2 = spawnSync("git", ["-C", repo, ...args], {
    env: checkoutEnvironment(),
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 16 << 20
  });
  const code = result2.status ?? -1;
  return {
    code,
    stdout: raw || result2.stdout?.includes("\0") ? result2.stdout ?? "" : (result2.stdout ?? "").trim(),
    stderr: (result2.stderr || result2.error?.message || "").trim(),
    ok: code === 0,
    uncertain: result2.error?.code === "ETIMEDOUT"
  };
}

// node_modules/@compforge/repokit/dist/git/remote.js
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
  const result2 = runGit(repo, ["remote", "get-url", "--", name]);
  return result2.ok ? parseRemoteUrl(result2.stdout) : void 0;
}

// node_modules/@compforge/repokit/dist/layout.js
import { posix as posix2 } from "node:path";
var compare = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
var needsContent = (name) => ["package.json", "pyproject.toml", "pnpm-workspace.yaml", ".yarnrc.yml"].includes(posix2.basename(name));
var validPath = (name) => name !== "" && name !== "." && name !== ".." && !name.includes("\0") && !name.includes("\\") && !name.startsWith("/") && !name.startsWith("../") && posix2.normalize(name) === name && !name.endsWith("/");
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
      const name = posix2.join(root, manifest);
      if (!files.has(name))
        continue;
      if (ecosystem !== "node")
        return ecosystem;
      const text4 = files.get(name)?.toString().toLowerCase() ?? "";
      return text4.includes("typescript") || text4.includes("@types/") || files.has(posix2.join(root, "tsconfig.json")) ? "typescript" : "javascript";
    }
  }
  return "";
}
function discover(files) {
  const candidates = /* @__PURE__ */ new Set();
  for (const name of files.keys()) {
    if (skip(name))
      continue;
    if (manifestEcosystem(name) || posix2.basename(name) === "Makefile")
      candidates.add(posix2.dirname(name));
  }
  return [...candidates].sort(compare);
}
function toolObservations(files, root) {
  const found = /* @__PURE__ */ new Map();
  const add = (name, version, evidence) => {
    const tool = found.get(name) ?? { name, evidence: [] };
    if (version)
      tool.version = version;
    tool.evidence.push(evidence);
    found.set(name, tool);
  };
  const manifest = posix2.join(root, "package.json");
  const data = files.get(manifest);
  if (data) {
    try {
      const metadata = object2(JSON.parse(data.toString()));
      const manager = string(field2(metadata, "packageManager"));
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
    const name = posix2.join(root, file2);
    if (files.has(name))
      add(tool, "", name);
  }
  return [...found.values()].sort((a, b) => compare(a.name, b.name)).map((tool) => ({ ...tool, evidence: tool.evidence.sort(compare) }));
}
function object2(value) {
  if (value == null)
    return {};
  if (typeof value !== "object" || Array.isArray(value))
    throw new Error("expected an object");
  return value;
}
function field2(value, name) {
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
    const observed = toolObservations(files, root);
    const depot = discoverDepot(files, root);
    const manifests = [...files.keys()].filter((name) => posix2.dirname(name) === root && manifestEcosystem(name)).sort(compare);
    const binding = {
      repository: repo ?? repository("", ""),
      name: root,
      root,
      products: [],
      ...language ? { language } : {},
      ...depot ? { depot } : {},
      ...manifests.length ? { manifests } : {},
      ...observed.length ? { tools: observed.map(({ evidence, ...tool }) => tool), toolEvidence: Object.fromEntries(observed.map((tool) => [tool.name, tool.evidence])) } : {}
    };
    return binding;
  });
  return { repository: repo, components: bindings };
}
function manifestEcosystem(path) {
  return markers.find(([, ...names]) => names.includes(posix2.basename(path)))?.[0] ?? "";
}

// node_modules/@compforge/repokit/dist/git/catalog.js
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
    return new Promise((resolve15, reject) => {
      const child = execFile("git", ["-C", this.root, ...args], {
        env: checkoutEnvironment(),
        encoding: "buffer",
        signal: this.signal,
        maxBuffer,
        killSignal: "SIGKILL"
      }, (error, stdout) => {
        if (error && !(allowMissing && error.code === 1))
          reject(error);
        else
          resolve15(stdout);
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
    const output2 = await this.run(head ? ["ls-tree", "-r", "-z", "--full-tree", head] : ["ls-files", "--stage", "-z"]);
    const entries = /* @__PURE__ */ new Map();
    for (const entry of output2.toString().split("\0")) {
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

// node_modules/@compforge/repokit/dist/inspect.js
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

// node_modules/@compforge/repokit/dist/git/state.js
import { appendFileSync, mkdirSync, readFileSync, existsSync, realpathSync, lstatSync, statSync } from "node:fs";
import { join as join2, dirname as dirname2, basename } from "node:path";
function gitPath(repo, name) {
  const result2 = runGit(repo, ["rev-parse", "--path-format=absolute", "--git-path", name], 5e3, true);
  if (!result2.ok || !result2.stdout)
    throw new Error(`cannot resolve Git metadata path ${JSON.stringify(name)}: ${result2.stderr}`);
  return result2.stdout.replace(/\n$/, "");
}
function currentBranch(repo) {
  const result2 = runGit(repo, ["branch", "--show-current"]);
  if (!result2.ok)
    throw new Error(`cannot read current branch: ${result2.stderr}`);
  return result2.stdout || void 0;
}
function divergence(repo, target) {
  const head = revParse(repo, "HEAD");
  const other = revParse(repo, target);
  if (!head || !other)
    return void 0;
  const result2 = runGit(repo, ["rev-list", "--count", "--left-right", `${head}...${other}`]);
  const values = result2.stdout.split(/\s+/);
  if (!result2.ok || values.length !== 2 || !values.every((v) => /^\d+$/.test(v))) {
    throw new Error(`cannot count divergence from ${target}: ${result2.stderr || result2.stdout}`);
  }
  return [Number(values[0]), Number(values[1])];
}
function aheadBehind(repo, target = "main") {
  return divergence(repo, `refs/remotes/origin/${target}`);
}
function workspaceStatus(repo) {
  const result2 = runGit(repo, ["status", "--porcelain"]);
  if (!result2.ok)
    return { dirty: false, complete: false, modifiedCount: 0, untrackedCount: 0 };
  const lines = result2.stdout.split("\n").filter(Boolean);
  return {
    dirty: lines.length > 0,
    complete: true,
    modifiedCount: lines.filter((line) => !line.startsWith("??")).length,
    untrackedCount: lines.filter((line) => line.startsWith("??")).length
  };
}
function revParse(repo, ref) {
  const result2 = runGit(repo, ["rev-parse", "--verify", "--quiet", "--end-of-options", ref]);
  if (result2.ok && result2.stdout)
    return result2.stdout;
  if (result2.code === 1 && !result2.stderr)
    return "";
  throw new Error(`cannot resolve revision ${ref}: ${result2.stderr || result2.stdout}`);
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
  const result2 = runGit(repo, ["merge-base", "--is-ancestor", "--", ancestor, descendant]);
  if (result2.code === 0 || result2.code === 1)
    return result2.code === 0;
  throw new Error(`cannot compare ancestry ${ancestor} -> ${descendant}: ${result2.stderr}`);
}
function listWorktrees(repo) {
  const result2 = runGit(repo, ["worktree", "list", "--porcelain", "-z"]);
  if (!result2.ok)
    throw new Error(result2.stderr || "cannot list worktrees");
  const entries = [];
  for (const block of result2.stdout.split("\0\0")) {
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
  return checkoutWithEntries(repo, listWorktrees(repo));
}
function checkoutWithEntries(repo, entries) {
  const query = (path, flag) => {
    const result2 = runGit(path, ["rev-parse", "--path-format=absolute", flag], 5e3, true);
    if (!result2.ok || !result2.stdout)
      throw new Error(result2.stderr || `cannot resolve ${flag}`);
    return realpathSync(result2.stdout.replace(/\n$/, ""));
  };
  const root = query(repo, "--show-toplevel");
  if (!existsSync(join2(root, ".git")))
    throw new Error("Git metadata directory is not a checkout");
  const gitDir = query(repo, "--git-dir");
  const commonDir = query(repo, "--git-common-dir");
  const first = entries[0];
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
  const entries = listWorktrees(repo);
  const info = checkoutWithEntries(repo, entries);
  const main = info.linked ? info.mainRoot : info.root;
  return entries.flatMap((entry, index) => {
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
  const result2 = runGit(repo, ["for-each-ref", "--sort=refname", "--format=%(refname)%00%(objectname)", "refs/heads"]);
  const branches = /* @__PURE__ */ new Map();
  if (!result2.ok)
    throw new Error(result2.stderr || "cannot list local branches");
  for (const line of result2.stdout.split("\n")) {
    const [name, sha] = line.split("\0");
    if (!line)
      continue;
    if (!name?.startsWith("refs/heads/") || !sha)
      throw new Error("Invalid branch inventory");
    branches.set(name.slice("refs/heads/".length), sha);
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
      const result2 = runGit(candidate, ["rev-parse", "--show-toplevel"], 5e3, true);
      if (!result2.ok || !result2.stdout)
        throw new Error(result2.stderr || "cannot discover checkout");
      const root = result2.stdout.replace(/\n$/, "");
      if (realpathSync(root) !== candidate)
        throw new Error("Git environment does not match discovered checkout");
      return root;
    }
    if (dirname2(candidate) === candidate)
      return void 0;
  }
}
function localDefaultBranch(repo, remote2 = "origin") {
  const prefix = `refs/remotes/${remote2}/`;
  const result2 = runGit(repo, ["symbolic-ref", "--quiet", `${prefix}HEAD`]);
  if (result2.code === 1)
    return void 0;
  if (!result2.ok)
    throw new Error(`cannot read default branch for ${remote2}: ${result2.stderr}`);
  if (!result2.stdout.startsWith(prefix) || result2.stdout === prefix)
    throw new Error(`invalid remote HEAD: ${result2.stdout}`);
  return result2.stdout.slice(prefix.length);
}
function addExclude(repo, pattern) {
  if (!pattern || /[\r\n]/.test(pattern))
    throw new Error("exclude requires one nonempty pattern");
  const path = gitPath(repo, "info/exclude");
  let existing;
  try {
    existing = readFileSync(path);
  } catch (error) {
    if (error.code !== "ENOENT")
      throw error;
    existing = Buffer.alloc(0);
  }
  if (existing.toString("utf8").split("\n").includes(pattern))
    return false;
  mkdirSync(dirname2(path), { recursive: true });
  appendFileSync(path, `${existing.length && existing.at(-1) !== 10 ? "\n" : ""}${pattern}
`, "utf8");
  return true;
}
var checkoutCache = /* @__PURE__ */ new Map();
function checkoutAt(directory) {
  let metadata;
  try {
    metadata = statSync(join2(directory, ".git"));
  } catch (error) {
    if (error.code === "ENOENT")
      return void 0;
    throw error;
  }
  const marker = `${metadata.dev}:${metadata.ino}:${metadata.mtimeMs}`;
  const cached = checkoutCache.get(directory);
  if (cached?.marker === marker && cached.expires > performance.now())
    return cached.info;
  const info = checkoutInfo(directory);
  if (checkoutCache.size >= 64)
    checkoutCache.delete(checkoutCache.keys().next().value);
  checkoutCache.set(directory, { marker, expires: performance.now() + 1e3, info });
  return info;
}
function refExists(repo, ref) {
  if (!ref.startsWith("refs/"))
    throw new Error(`full reference required: ${ref}`);
  return Boolean(revParse(repo, ref));
}
function isIgnored(repo, path) {
  const result2 = runGit(repo, ["check-ignore", "-q", "--", path]);
  if (result2.code === 0 || result2.code === 1)
    return result2.code === 0;
  throw new Error(`cannot inspect ignore status: ${result2.stderr}`);
}

// node_modules/@compforge/repokit/dist/snapshot.js
import { createHash } from "node:crypto";
import { constants as constants2 } from "node:fs";
import { lstat as lstat2, open as open2, readlink, realpath as realpath3 } from "node:fs/promises";
import { dirname as dirname3, join as join3, posix as posix3 } from "node:path";
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
      if (seen.has(current) || posix3.isAbsolute(target)) {
        current = "";
        break;
      }
      seen.add(current);
      current = posix3.normalize(posix3.join(posix3.dirname(current), target));
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

// node_modules/@compforge/repokit/dist/forge/model.js
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

// node_modules/@compforge/repokit/dist/forge/key.js
function pullRequestKey(forge, path, number4) {
  return { repository: { forge: { name: forge }, path }, number: number4 };
}
function assertPullRequestKey(value, forge) {
  if (value.repository.forge.name !== forge)
    throw new Error(`PullRequest forge ${value.repository.forge.name} does not match ${forge}`);
  if (!Number.isSafeInteger(value.number) || value.number < 1)
    throw new Error("PullRequest number must be a positive safe integer");
  if (!value.repository.path || value.repository.path.split("/").some((p) => !p || p === "." || p === ".."))
    throw new Error("Invalid PullRequest repository path");
}

// node_modules/@compforge/repokit/dist/forge/query.js
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
function authorMatches(value, field3, expected) {
  if (expected === void 0)
    return true;
  if (!value || typeof value !== "object" || Array.isArray(value))
    return false;
  const actual = value[field3];
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

// node_modules/@compforge/repokit/dist/forge/issues.js
function readIssue(error, stage, subject = {}) {
  return {
    ...subject,
    stage,
    message: error instanceof Error ? error.message : String(error),
    kind: error instanceof ForgeRateLimitError ? "rate_limit" : error instanceof ForgeAuthError ? "auth" : error instanceof ForgeNotFound ? "not_found" : error instanceof ForgeCoverageError ? "coverage" : error instanceof ForgeError ? "transport" : "invalid_data",
    ...error instanceof ForgeRateLimitError ? { retryAfterMs: error.retryAfterMs } : {}
  };
}

// node_modules/@compforge/repokit/dist/forge/scan.js
var SECOND = 1e3;
var INITIAL_LOOKBACK_MS = 7 * 24 * 60 * 60 * SECOND;
var OVERLAP_MS = 60 * SECOND;
var PAGE_SIZE = 50;
var MAX_DISCOVERY_REQUESTS_PER_BATCH = 4;
var MAX_DISCOVERED_READS_PER_BATCH = 5;
var MAX_TRACKED_READS_PER_BATCH = 5;
var MAX_RETRIES_PER_BATCH = 2;
var MAX_FAILED_READS = 500;
var iso = (time2) => new Date(time2).toISOString();
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

// node_modules/@compforge/repokit/dist/forge/page.js
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

// node_modules/@compforge/repokit/dist/forge/http.js
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
    let size = 0, text4 = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done)
          break;
        size += value.byteLength;
        if (size > this.#maxResponseBytes)
          throw new ForgeError(`exceeded ${this.#maxResponseBytes} response bytes`);
        text4 += decoder.decode(value, { stream: true });
      }
      return text4 + decoder.decode();
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

// node_modules/@compforge/repokit/dist/forge/github.js
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
    const result2 = record("GitHub PullRequest search", data);
    if (result2.incomplete_results !== false || !Number.isSafeInteger(result2.total_count) || Number(result2.total_count) < 0 || Number(result2.total_count) > 1e3) {
      throw new ForgeCoverageError("GitHub PullRequest search incomplete or exceeds 1000 results");
    }
    if (!Array.isArray(result2.items) || result2.items.length > position.pageSize)
      throw new Error("Invalid GitHub PullRequest page");
    const items = [], issues = [];
    for (const [index, value] of result2.items.entries())
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
    const next = nextPage(headers, position.page, "github") ?? (position.page * position.pageSize < Number(result2.total_count) ? position.page + 1 : void 0);
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
    const result2 = [];
    for (let page = 1; page <= MAX_COMMENT_PAGES; page += 1) {
      const separator = endpoint.includes("?") ? "&" : "?";
      const { data, headers } = await this.#http.request("GET", `${endpoint}${separator}per_page=100&page=${page}`, { headers: this.#headers() });
      result2.push(...records("GitHub comments", data));
      const hasNextPage = headers.get("link")?.split(",").some((link) => /;\s*rel="next"/.test(link)) ?? false;
      if (!hasNextPage)
        return result2;
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

// node_modules/@compforge/repokit/dist/forge/gitlab.js
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
          const match2 = url.pathname.match(/^\/(.+?)\/(?:-\/)?merge_requests\/([1-9]\d*)\/?$/);
          if (url.origin !== new URL(this.#apiBase).origin || !match2 || Number(match2[2]) !== row.iid)
            throw new Error("Invalid GitLab PullRequest identity URL");
          path = decodeURIComponent(match2[1]);
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
    const result2 = [];
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
          result2.push(...notes.map(toComment));
          continue;
        }
        const [root, ...replies] = notes.map(toComment);
        if (!root)
          continue;
        result2.push({
          ...root,
          replyable: true,
          replies: replies.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        });
      }
      const nextPage2 = headers.get("x-next-page");
      if (!nextPage2) {
        return result2.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
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

// node_modules/@compforge/repokit/dist/forge/create.js
function createForgeReader(config, options = {}) {
  return config.provider === "github" ? new GitHubForgeReader(config, options) : new GitLabForgeReader(config, options);
}

// node_modules/@compforge/repokit/dist/state/identity.js
import { createHash as createHash4 } from "node:crypto";
import { basename as basename2, dirname as dirname4 } from "node:path";
var pathDigest = (value) => createHash4("sha256").update(value).digest("hex").slice(0, 32);
function namePart(value) {
  let name = [...Buffer.from(value)].map((c) => c >= 97 && c <= 122 || c >= 48 && c <= 57 || [95, 46, 126].includes(c) ? String.fromCharCode(c) : "%" + c.toString(16).toUpperCase().padStart(2, "0")).join("");
  if (["", ".", ".."].includes(name))
    name = name.replaceAll(".", "%2E") || "%00";
  return name.length <= 180 ? name : name.slice(0, 120) + "--" + pathDigest(value);
}
function repositoryKey(forge, path) {
  const name = [forge, ...path.split("/")].map(namePart).join("--");
  return name.length <= 240 ? name : name.slice(0, 160) + "--" + pathDigest(forge + "/" + path);
}
function localKey(common) {
  const label = basename2(common) === ".git" ? basename2(dirname4(common)) : basename2(common);
  return `local--${namePart(label)}--${createHash4("sha256").update(common).digest("hex").slice(0, 16)}`;
}

// node_modules/@compforge/repokit/dist/state/activity.js
async function recordAccess(store, key, signal, checkout) {
  await store.locked(store.path("locks", "activity", key), signal, async (owned) => {
    const path = store.path("repositories", key, "activity.json");
    const record2 = await store.read(path) ?? { version: 1, lastAccessAt: 0, checkouts: {} };
    if (record2.version !== 1 || !Number.isFinite(record2.lastAccessAt) || record2.lastAccessAt < 0 || !record2.checkouts || Array.isArray(record2.checkouts) || typeof record2.checkouts !== "object")
      throw new Error("Invalid repository activity record");
    const now2 = Date.now() / 1e3;
    record2.lastAccessAt = Math.max(record2.lastAccessAt, now2);
    if (checkout)
      record2.checkouts[pathDigest(checkout.root)] = { path: checkout.root, commonDir: checkout.commonDir, lastAccessAt: now2 };
    await store.write(path, record2, owned);
  });
}

// node_modules/@compforge/repokit/dist/state/home.js
import { homedir } from "node:os";
import { join as join4, resolve } from "node:path";
function resolveHome(home) {
  const value = home || process.env.REPOKIT_HOME || join4(homedir(), ".repokit");
  if (!value.trim())
    throw new Error("RepoKit home must be nonempty");
  return resolve(value);
}

// node_modules/@compforge/repokit/dist/forge/observation/engine.js
import { setTimeout as delay3 } from "node:timers/promises";

// node_modules/@compforge/repokit/dist/state/store.js
var import_proper_lockfile = __toESM(require_proper_lockfile(), 1);
import { createHash as createHash5, randomUUID } from "node:crypto";
import { mkdir, open as open3, readFile, readdir, rename, rm } from "node:fs/promises";
import { dirname as dirname5, join as join5, resolve as resolve2 } from "node:path";
import { setTimeout as delay2 } from "node:timers/promises";
var digest = (value) => createHash5("sha256").update(JSON.stringify(value)).digest("hex");
var ObservationStorageError = class extends Error {
};
var missing = (error) => error.code === "ENOENT";
var ObservationStore = class {
  root;
  constructor(root) {
    if (!root.trim())
      throw new Error("repository home must be explicit and nonempty");
    this.root = resolve2(root);
  }
  path(...parts) {
    return join5(this.root, ...parts);
  }
  async read(path) {
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      if (missing(error))
        return void 0;
      throw new ObservationStorageError(`Cannot read repository state ${path}`, { cause: error });
    }
  }
  async write(path, value, assertOwned) {
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await mkdir(dirname5(path), { recursive: true, mode: 448 });
      const file2 = await open3(temporary, "wx", 384);
      try {
        await file2.writeFile(JSON.stringify(value));
        await file2.sync();
      } finally {
        await file2.close();
      }
      assertOwned();
      await rename(temporary, path);
      const directory = await open3(dirname5(path), "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    } catch (error) {
      throw new ObservationStorageError(`Cannot persist repository state ${path}`, { cause: error });
    } finally {
      await rm(temporary, { force: true }).catch(() => {
      });
    }
  }
  async locked(path, signal, operation) {
    await mkdir(dirname5(path), { recursive: true, mode: 448 });
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
          throw new ObservationStorageError(`Cannot acquire repository state lock ${path}`, { cause: error });
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
  async observations(connection) {
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
      for (const number4 of await directories(this.path("repositories", repo, "prs"))) {
        if (/^[1-9][0-9]*$/.test(number4)) {
          paths.push(this.path("repositories", repo, "prs", number4, "observations", connection + ".json"));
        }
      }
    }
    return paths;
  }
};

// node_modules/@compforge/repokit/dist/forge/observation/engine.js
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
    this.#store = new ObservationStore(resolveHome(options.home));
    this.#connection = digest([reader.forge, options.connection]);
    this.#now = options.now ?? (() => /* @__PURE__ */ new Date());
    this.#open = positive("openIntervalMs", options.openIntervalMs ?? 6e4);
    this.#closed = positive("closedIntervalMs", options.closedIntervalMs ?? 6e5);
    this.#retry = positive("retryIntervalMs", options.retryIntervalMs ?? 3e4);
    this.#timeout = positive("requestTimeoutMs", options.requestTimeoutMs ?? 2e4);
  }
  #time() {
    const time2 = this.#now().getTime();
    if (!Number.isSafeInteger(time2) || time2 < 0)
      throw new Error("Invalid observation clock");
    return time2;
  }
  #repo(key) {
    return repositoryKey(key.repository.forge.name, key.repository.path);
  }
  #path(key) {
    return this.#store.path("repositories", this.#repo(key), "prs", String(key.number), "observations", this.#connection + ".json");
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
    return !observation.lastError && (observation.snapshot?.state === "merged" || Boolean(observation.snapshot && observation.observedAt && !observation.lastError && this.#time() - Date.parse(observation.observedAt) <= age));
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
    assertPullRequestKey(key, this.reader.forge);
    await recordAccess(this.#store, repositoryKey(key.repository.forge.name, key.repository.path), query.signal ?? new AbortController().signal);
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
    for (const path of await this.#store.observations(this.#connection)) {
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
      const result2 = await this.get(key, { signal });
      observations.push(result2);
      if (result2.lastError)
        issues.push(result2.lastError);
    }
    let pending = pendingKeys.length > 5;
    for (const scope of scopes) {
      const id = this.#scope(scope), path = this.#store.path("scans", `${id}.json`);
      const result2 = await this.#store.locked(path, signal, async (assertOwned) => {
        const state = await this.#store.read(path);
        if (state && state.version !== 1)
          throw new ObservationStorageError(`Invalid PR scan state ${path}`);
        let storageFailure;
        const scanner = createPullRequestScanner({
          forge: this.reader.forge,
          listPullRequests: (query) => this.#request(() => this.reader.listPullRequests(query), signal),
          getPullRequest: async (key) => {
            let result4;
            try {
              result4 = await this.#get(key, { signal }, id);
            } catch (error) {
              storageFailure = error;
              throw error;
            }
            observations.push(result4);
            if (!result4.snapshot || !result4.fresh || result4.lastError)
              throw new ForgeError(result4.lastError?.message ?? "PR observation unavailable");
            return result4.snapshot;
          }
        }, { connection: this.#connection, now: this.#now });
        const operation = () => scanner({ scope, cursor: state?.cursor, initialSince: watch.initialSince });
        const result3 = this.reader.withSignal ? await this.reader.withSignal(signal, operation) : await operation();
        if (storageFailure)
          throw storageFailure;
        assertOwned();
        await this.#store.write(path, { version: 1, cursor: result3.cursor }, assertOwned);
        return result3;
      });
      pending ||= result2.pending;
      issues.push(...result2.issues);
    }
    for (const path of await this.#store.observations(this.#connection)) {
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

// node_modules/@compforge/repokit/dist/forge/observation/context.js
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
    this.#store = new ObservationStore(resolveHome(options.home));
    this.#now = options.now ?? (() => /* @__PURE__ */ new Date());
  }
  #path(branch) {
    const clean = (repo) => ({ forge: { name: repo.forge.name }, path: repo.path });
    return this.#store.path("repositories", repositoryKey(this.options.source.forge.name, this.options.source.path), "branches", namePart(branch), "associations", `${digest([digest([this.reader.forge, this.options.connection]), clean(this.options.source), branch, this.options.targets.map(clean)])}.json`);
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
  async #branch(branch, verify, external, inventory) {
    const signal = AbortSignal.any([this.#controller.signal, AbortSignal.timeout(this.options.requestTimeoutMs ?? 2e4), ...external ? [external] : []]);
    signal.throwIfAborted();
    const head = (inventory?.branches ?? localBranches(this.options.checkout)).get(branch);
    if (!head)
      throw new Error(`Local branch does not exist: ${branch}`);
    const checkouts = (inventory?.checkouts ?? listCheckouts(this.options.checkout)).filter((entry) => entry.branch === branch);
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
  async getBranch(branch, options = {}) {
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
          results.push(await this.#branch(branch, false, signal, { branches, checkouts }));
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

// node_modules/@compforge/repokit/dist/forge/connection.js
import { createHash as createHash6 } from "node:crypto";
function detectProvider(host, explicitType) {
  if (explicitType === "github" || explicitType === "gitlab")
    return explicitType;
  const lower = host.toLowerCase();
  return lower === "github.com" || lower.startsWith("github.") ? "github" : "gitlab";
}
var ForgeConnection = class {
  host;
  provider;
  apiHost;
  home;
  timeoutMs;
  #token;
  constructor(config) {
    this.host = config.host.toLowerCase();
    this.provider = detectProvider(this.host, config.provider);
    this.apiHost = (config.apiHost || this.host).toLowerCase();
    this.home = resolveHome(config.home);
    this.timeoutMs = config.timeoutMs ?? 1e4;
    if (!this.host || !Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0)
      throw new Error("Forge host and positive timeout are required");
    if (!config.token.trim())
      throw new ForgeAuthError(`PR query unavailable: no credential for ${this.host}`);
    this.#token = config.token;
  }
  get name() {
    return this.host === "github.com" ? "github" : this.host === "gitlab.com" ? "gitlab" : this.host;
  }
  get identity() {
    return createHash6("sha256").update(JSON.stringify([this.provider, this.name, this.apiHost, this.#token])).digest("hex");
  }
  repository(path) {
    if (!path || path.startsWith("/") || path.endsWith("/"))
      throw new Error("nonempty repository path is required");
    return { forge: { name: this.name }, path };
  }
  reader(options = {}) {
    return createForgeReader({ forge: this.name, provider: this.provider, host: this.apiHost, token: this.#token }, { timeoutMs: this.timeoutMs, ...options });
  }
  pullRequestContext(checkout, options) {
    return new PullRequestContext(options.reader ?? this.reader(), {
      checkout,
      source: this.repository(options.source),
      targets: (options.targets ?? [options.source]).map((path) => this.repository(path)),
      home: this.home,
      connection: this.identity,
      requestTimeoutMs: this.timeoutMs
    });
  }
};

// node_modules/@compforge/repokit/dist/config.js
import { isIP } from "node:net";
import { open as open4 } from "node:fs/promises";
import { join as join6 } from "node:path";
var ConfigError = class extends Error {
};
function normalizeHost(value) {
  const name = value.toLowerCase();
  let host = name;
  if (name === "github")
    host = "github.com";
  else if (name === "gitlab")
    host = "gitlab.com";
  const invalid = () => new ConfigError("Invalid Forge host");
  let port = "", hasPort = false;
  if (host.startsWith("[")) {
    const end = host.indexOf("]"), name2 = host.slice(1, end);
    if (end < 0 || name2.includes("%") || isIP(name2) !== 6)
      throw invalid();
    const suffix = host.slice(end + 1);
    if (suffix && !suffix.startsWith(":"))
      throw invalid();
    port = suffix.slice(1);
    hasPort = !!suffix;
  } else {
    const colon = host.indexOf(":"), name2 = colon < 0 ? host : host.slice(0, colon);
    hasPort = colon >= 0;
    port = hasPort ? host.slice(colon + 1) : "";
    if (name2.length > 253 || name2.split(".").some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))
      throw invalid();
    if (/^[0-9.]+$/.test(name2) && isIP(name2) !== 4)
      throw invalid();
  }
  if (hasPort && (!/^[0-9]{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535))
    throw invalid();
  return host;
}
var RepoKitConfig = class {
  home;
  #forges;
  constructor(home, entries = /* @__PURE__ */ new Map()) {
    this.home = home;
    this.#forges = entries;
  }
  /**
   * Resolve access without network I/O.
   * @spec Credentials come only from the selected host in config.json. Environment variables
   * and caller configuration never supply or override credentials.
   * @see {@link component://docs/configuration.md}
   */
  forge(name, options = {}) {
    const host = normalizeHost(name);
    const entry = this.#forges.get(host) ?? {};
    const provider = entry.provider || { "github.com": "github", "gitlab.com": "gitlab" }[host];
    if (provider !== "github" && provider !== "gitlab")
      throw new ConfigError(`Configure a provider for Forge ${host} in ${join6(this.home, "config.json")}`);
    const token = (entry.token ?? "").trim();
    if (!token)
      throw new ForgeAuthError(`no ${provider} credential for ${host}; configure ${join6(this.home, "config.json")}`);
    return new ForgeConnection({ host, provider, token, apiHost: entry.apiHost || void 0, home: this.home, timeoutMs: options.timeoutMs });
  }
};
function object3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function loadConfig(home) {
  const root = resolveHome(home), path = join6(root, "config.json");
  let file2;
  try {
    file2 = await open4(path, "r");
  } catch (error) {
    if (error.code === "ENOENT")
      return new RepoKitConfig(root);
    throw error;
  }
  let document;
  try {
    const stat = await file2.stat();
    if (!stat.isFile() || stat.mode & 63)
      throw new ConfigError(`RepoKit config must be a private regular file (chmod 600): ${path}`);
    const contents = await file2.readFile("utf8");
    try {
      document = JSON.parse(contents);
    } catch {
      throw new ConfigError(`Invalid RepoKit JSON configuration: ${path}`);
    }
  } finally {
    await file2.close();
  }
  if (!object3(document) || Object.keys(document).some((k) => k !== "forges"))
    throw new ConfigError(`Expected a JSON object with a forges map: ${path}`);
  const raw = document.forges ?? {};
  if (!object3(raw))
    throw new ConfigError(`Expected a forges map: ${path}`);
  const entries = /* @__PURE__ */ new Map();
  for (const [key, rawEntry] of Object.entries(raw)) {
    const host = normalizeHost(key), value = rawEntry ?? {};
    if (entries.has(host))
      throw new ConfigError(`Duplicate normalized Forge host: ${path}`);
    if (!object3(value) || Object.keys(value).some((k) => !["provider", "apiHost", "token"].includes(k)))
      throw new ConfigError(`Invalid Forge configuration fields: ${path}`);
    if (Object.values(value).some((v) => v !== null && typeof v !== "string"))
      throw new ConfigError(`Forge configuration fields must be strings: ${path}`);
    const entry = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, v ?? ""]));
    if (entry.provider && !["github", "gitlab"].includes(entry.provider))
      throw new ConfigError(`Provider must be github or gitlab: ${path}`);
    if (entry.apiHost)
      entry.apiHost = normalizeHost(entry.apiHost);
    entries.set(host, entry);
  }
  return new RepoKitConfig(root, entries);
}

// node_modules/@compforge/repokit/dist/access.js
async function pullRequestContext(checkout, options = {}) {
  const origin = await remote(checkout);
  if (!origin)
    return void 0;
  const connection = (await loadConfig(options.home)).forge(origin.host, { timeoutMs: options.timeoutMs });
  return connection.pullRequestContext(checkout, { source: origin.path, targets: options.targets, reader: options.reader });
}

// node_modules/@compforge/repokit/dist/validation/history.js
import { readFile as readFile3, realpath as realpath4 } from "node:fs/promises";
import { join as join8, resolve as resolve3 } from "node:path";

// node_modules/@compforge/repokit/dist/validation/store.js
import { createRequire } from "node:module";
import { open as open5, lstat as lstat3, readdir as readdir2, readFile as readFile2 } from "node:fs/promises";
import { join as join7 } from "node:path";
import { setTimeout as delay4 } from "node:timers/promises";
var missing2 = (error) => error.code === "ENOENT";
function object4(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid validation history object");
  return value;
}
async function inspectHistory(directory, signal, read2) {
  signal.throwIfAborted();
  try {
    if (!(await lstat3(join7(directory, "history"))).isDirectory())
      throw new Error("Not a regular history directory");
  } catch (error) {
    if (missing2(error))
      return read2([]);
    throw error;
  }
  if (process.platform !== "darwin" && process.platform !== "linux")
    throw new Error("Validation history requires Linux or macOS file locking");
  const { flock } = createRequire(import.meta.url)("fs-ext");
  const lock = (fd, flags) => new Promise((resolve15, reject) => flock(fd, flags, (error) => error ? reject(error) : resolve15()));
  const file2 = await open5(join7(directory, "lock"), "a+", 384);
  let owned = false;
  try {
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(5e3)]);
    for (; ; ) {
      deadline.throwIfAborted();
      try {
        await lock(file2.fd, "exnb");
        owned = true;
        break;
      } catch (error) {
        if (!["EAGAIN", "EWOULDBLOCK"].includes(error.code ?? ""))
          throw error;
      }
      await delay4(10, void 0, { signal: deadline });
    }
    return await read2(await readEvents(join7(directory, "history"), signal));
  } finally {
    try {
      if (owned)
        await lock(file2.fd, "un");
    } finally {
      await file2.close();
    }
  }
}
async function readEvents(directory, signal) {
  let segments = (await readdir2(directory, { withFileTypes: true })).filter((entry) => !entry.isDirectory() && /^\d{20}(?:\.START|\.END)?$/.test(entry.name) && BigInt(entry.name.slice(0, 20)) > 0n).map((entry) => entry.name).sort();
  const starts = segments.filter((name) => name.endsWith(".START"));
  const ends = segments.filter((name) => name.endsWith(".END"));
  if (starts.length > 1 || ends.length > 1 || starts.length && ends.length)
    throw new Error("Corrupt validation history recovery segments");
  if (starts.length)
    segments = segments.slice(segments.indexOf(starts[0]));
  if (ends.length) {
    segments = segments.slice(0, segments.indexOf(ends[0]) + 1);
    if (segments.length > 1 && segments.at(-2).slice(0, 20) === ends[0].slice(0, 20))
      segments.splice(-2, 1);
  }
  const events = [];
  let expected;
  for (const name of segments) {
    signal.throwIfAborted();
    const first = BigInt(name.slice(0, 20));
    if (expected !== void 0 && expected !== first)
      throw new Error("Noncontiguous validation history segments");
    expected = first;
    const text4 = await readFile2(join7(directory, name), { encoding: "utf8", signal });
    if (text4 && !text4.endsWith("\n"))
      throw new Error("Incomplete validation history record");
    for (const line of text4.split("\n").slice(0, -1)) {
      signal.throwIfAborted();
      const record2 = object4(JSON.parse(line));
      if (typeof record2.data !== "string")
        throw new Error("Invalid validation WAL payload");
      let data;
      if (record2.data.startsWith("+"))
        data = record2.data.slice(1);
      else if (record2.data.startsWith("$") && /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2}==|[A-Za-z0-9_-]{3}=)?$/.test(record2.data.slice(1)))
        data = Buffer.from(record2.data.slice(1), "base64url").toString("utf8");
      else
        throw new Error("Invalid validation WAL encoding");
      events.push(object4(JSON.parse(data)));
      expected++;
    }
  }
  return events;
}

// node_modules/@compforge/repokit/dist/validation/history.js
function fail(message) {
  throw new Error(message);
}
function text(value) {
  if (value == null)
    return "";
  if (typeof value !== "string")
    fail("Expected string");
  return value;
}
function time(value) {
  const result2 = text(value);
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/.test(result2) || !Number.isFinite(Date.parse(result2)))
    fail("Invalid history timestamp");
  return result2;
}
function instant(value) {
  const fraction = /\.(\d+)(?:Z|[+-])/.exec(value)?.[1] ?? "";
  return BigInt(Date.parse(value.replace(/\.\d+/, ""))) * 1000000n + BigInt(fraction.padEnd(9, "0"));
}
function compareTime(a, b) {
  const left = instant(a), right = instant(b);
  if (left < right)
    return -1;
  return left > right ? 1 : 0;
}
function number(value) {
  if (value == null)
    return 0;
  if (typeof value !== "number" || !Number.isFinite(value))
    fail("Invalid history number");
  return value;
}
function replay(events) {
  const runs = /* @__PURE__ */ new Map();
  for (const event of events) {
    const check = object4(event.check), name = text(check.check), id = text(event.run), at = time(event.at);
    text(event.component);
    text(event.inputs);
    text(check.status);
    number(check.durationSeconds);
    number(check.lookupSeconds);
    if (check.checkedAt != null)
      time(check.checkedAt);
    if (event.schemaVersion !== 2 || !text(event.checkout) || !id || at.startsWith("0001-01-01T00:00:00") || !["lint", "test"].includes(name))
      fail("Invalid validation history event");
    const run2 = runs.get(id);
    if (event.type === "started") {
      if (run2)
        fail(`Duplicate run ${id}`);
      runs.set(id, { start: event, check: name, consistent: false, reuseCount: 0 });
    } else if (event.type === "finished") {
      if (!run2)
        continue;
      if (run2.result || run2.start.checkout !== event.checkout || run2.start.component !== event.component || run2.check !== name || run2.start.inputs !== event.inputs)
        fail(`Invalid completion for run ${id}`);
      if (event.inputsConsistent != null && typeof event.inputsConsistent !== "boolean")
        fail("Invalid input consistency");
      run2.result = check;
      run2.finishedAt = at;
      run2.consistent = event.inputsConsistent === true;
    } else if (event.type === "reused") {
      if (!run2)
        continue;
      if (!run2.result || !run2.consistent || run2.result.status !== "passed" || run2.start.checkout !== event.checkout || run2.start.component !== event.component || run2.check !== name)
        fail(`Invalid reuse of run ${id}`);
      run2.reuseCount++;
      if (!run2.lastReusedAt || compareTime(at, run2.lastReusedAt) > 0)
        run2.lastReusedAt = at;
    } else
      fail("Unknown validation history event");
  }
  return runs;
}
function result(run2) {
  const check = object4(run2.result ?? run2.start.check);
  if (check.runID !== run2.start.run || check.check !== run2.check)
    fail("History check identity does not match its Run");
  return { ...check, status: run2.result ? text(check.status) : "unfinished" };
}
function summary(run2) {
  const check = result(run2);
  return {
    runID: text(run2.start.run),
    checkout: text(run2.start.checkout),
    component: text(run2.start.component),
    check: run2.check,
    scope: text(check.scope),
    status: text(check.status),
    startedAt: text(run2.start.at),
    durationSeconds: number(check.durationSeconds),
    inputsConsistent: run2.result ? run2.consistent : null,
    inputID: text(run2.start.inputs),
    reuseCount: run2.reuseCount,
    ...run2.finishedAt ? { finishedAt: run2.finishedAt } : {},
    ...run2.lastReusedAt ? { lastReusedAt: run2.lastReusedAt } : {}
  };
}
function budget(options) {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 5e3);
  return options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
}
async function location(repository2, options, signal) {
  const git = new Git(repository2, signal);
  await git.run(["rev-parse", "--show-toplevel"]);
  const origin = (await git.run(["config", "--get", "remote.origin.url"], void 0, true)).toString().trim();
  const remote2 = parseRemoteUrl(origin);
  let key;
  if (remote2) {
    let forge = remote2.host;
    if (forge === "github.com")
      forge = "github";
    if (forge === "gitlab.com")
      forge = "gitlab";
    key = repositoryKey(forge, remote2.path);
  } else {
    const common = (await git.run(["rev-parse", "--path-format=absolute", "--git-common-dir"])).toString().trim();
    key = localKey(await realpath4(common));
  }
  return { key, directory: join8(options.historyDir || join8(resolveHome(options.home), "repositories"), key) };
}
async function listValidationRuns(query) {
  const limit = query.limit === void 0 || query.limit === 0 ? 20 : query.limit, offset = query.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0)
    fail("Limit must be 1\u2013100 and offset must be nonnegative");
  if (query.check && !["lint", "test"].includes(query.check))
    fail("Check must be lint or test");
  if (query.status && !["passed", "failed", "cancelled", "uncertain", "unfinished"].includes(query.status))
    fail("Invalid run status");
  const signal = budget(query), { key, directory } = await location(query.repository, query, signal);
  let checkout = query.checkout ? resolve3(query.checkout) : "";
  if (checkout) {
    try {
      checkout = await realpath4(checkout);
    } catch (error) {
      if (!missing2(error))
        throw error;
    }
  }
  return inspectHistory(directory, signal, async (events) => {
    const runs = [];
    for (const run2 of replay(events).values()) {
      signal.throwIfAborted();
      if (checkout && run2.start.checkout !== checkout || query.component && run2.start.component !== query.component || query.check && run2.check !== query.check)
        continue;
      const row = summary(run2);
      if (!query.status || row.status === query.status)
        runs.push(row);
    }
    runs.sort((a, b) => compareTime(b.startedAt, a.startedAt) || Buffer.compare(Buffer.from(a.runID), Buffer.from(b.runID)));
    return { repository: key, runs: runs.slice(offset, offset + limit), total: runs.length, offset, limit, hasMore: offset + limit < runs.length };
  });
}
async function output(path, id, signal) {
  let data;
  try {
    data = await readFile3(path, { encoding: "utf8", signal });
  } catch (error) {
    if (missing2(error))
      return void 0;
    throw error;
  }
  const lines = data.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    signal.throwIfAborted();
    const record2 = object4(JSON.parse(lines[i]));
    if (record2.runID === id)
      return text(record2.output);
  }
  if (lines.at(-1))
    fail("Incomplete output record");
  return void 0;
}
async function readValidationRun(repository2, runID, options = {}) {
  if (!/^[A-Z2-7]+$/.test(runID))
    fail("Invalid run ID");
  const signal = budget(options), { key, directory } = await location(repository2, options, signal);
  return inspectHistory(directory, signal, async (events) => {
    const stored = replay(events).get(runID);
    if (!stored)
      throw Object.assign(new Error("Run is not present in retained repository history"), { code: "validation.run_not_found" });
    const run2 = summary(stored), check = result(stored), diagnostics = [];
    let inputs = null, stdout = "", stderr = "";
    try {
      if (!/^[A-Z2-7]+$/.test(run2.inputID))
        fail("Invalid input record ID");
      const raw = object4(JSON.parse(await readFile3(join8(directory, "inputs", run2.inputID + ".json"), { encoding: "utf8", signal })));
      if (raw.schemaVersion !== 1 || raw.checkout !== run2.checkout || !text(raw.snapshot))
        fail("Input manifest identity or schema is invalid");
      object4(raw.files);
      for (const value of Object.values(object4(raw.files))) {
        const entry = object4(value);
        text(entry.kind);
        text(entry.digest);
        if (entry.version != null && typeof entry.version !== "boolean")
          fail("Invalid input version marker");
      }
      inputs = raw;
    } catch (error) {
      signal.throwIfAborted();
      diagnostics.push({ artifact: "inputs", message: String(error) });
    }
    try {
      const prefix = join8(directory, "logs", new Date(run2.startedAt).toISOString().slice(0, 10));
      const out = await output(prefix + ".stdout.jsonl", runID, signal), err = await output(prefix + ".stderr.jsonl", runID, signal);
      if (out !== void 0 && err !== void 0) {
        stdout = out;
        stderr = err;
      } else if (out !== void 0 || err !== void 0)
        fail("Incomplete daily output for run " + runID);
      else {
        stdout = await readFile3(join8(directory, "logs", runID, "stdout"), { encoding: "utf8", signal });
        stderr = await readFile3(join8(directory, "logs", runID, "stderr"), { encoding: "utf8", signal });
      }
    } catch (error) {
      signal.throwIfAborted();
      diagnostics.push({ artifact: "output", message: String(error) });
    }
    return { repository: key, run: run2, result: { ...check, stdout, stderr }, inputs, complete: diagnostics.length === 0, diagnostics };
  });
}

// lib/repokit.ts
import { realpathSync as realpathSync2, existsSync as existsSync2 } from "node:fs";
import { dirname as dirname6, join as join9, sep } from "node:path";
var InspectionError = class extends Error {
};
async function inspectRepository(repo) {
  try {
    const report = await inspect({ repository: repo, timeoutMs: 5e3 });
    if (!report.complete || report.diagnostics.length > 0) throw new Error("repository inspection incomplete");
    const checkout = realpathSync2(repo);
    for (const component of report.components) {
      let ancestor = join9(checkout, component.root);
      while (!existsSync2(ancestor)) ancestor = dirname6(ancestor);
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
  constructor(path, id, language, name = "", tools = [], depot, toolEvidence = {}) {
    this.name = name;
    this.tools = tools;
    this.depot = depot;
    this.toolEvidence = toolEvidence;
    this.path = path;
    this.id = id;
    this.language = language;
  }
  name;
  tools;
  depot;
  toolEvidence;
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
    return new _Component(join10(root, info.root), info.root, info.language, info.name, info.tools ?? [], info.depot, info.toolEvidence ?? {});
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
    const path = relative(this.root, resolve4(target)).replaceAll("\\", "/");
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
  return [component ? join10(component, "AGENTS.md") : "", join10(repo, "AGENTS.md")].find((path) => path && existsSync3(path));
}

// domain/context/workspace.ts
import { existsSync as existsSync6, lstatSync as lstatSync2, readdirSync, realpathSync as realpathSync4 } from "node:fs";
import { join as join12, resolve as resolve7 } from "node:path";

// lib/git-state.ts
var PROTECTED_BRANCHES = [/^main$/, /^master$/, /^release$/, /^release.*/, /.*release$/];
function isProtectedBranch(branch) {
  return branch !== void 0 && PROTECTED_BRANCHES.some((pattern) => pattern.test(branch));
}
function localDefaultTarget(repo) {
  const branch = localDefaultBranch(repo);
  if (branch !== void 0) return branch;
  if (targetExists(repo, "main")) return "main";
  if (targetExists(repo, "master")) return "master";
  return "main";
}
function ensureGitExclude(repo, pattern = "/.devloop/") {
  try {
    addExclude(repo, pattern);
  } catch {
  }
}

// lib/parsers.ts
import { existsSync as existsSync4, readFileSync as readFileSync2 } from "node:fs";
import { basename as basename4, dirname as dirname7, isAbsolute, resolve as resolve5 } from "node:path";
function read(path) {
  if (!existsSync4(path)) return void 0;
  try {
    return readFileSync2(path, "utf8");
  } catch {
    return void 0;
  }
}
function concretePath(value, base) {
  if (value.includes("<") || value.includes(">")) return value;
  const expanded = value.startsWith("~") ? `${process.env.HOME ?? ""}${value.slice(1)}` : value;
  return isAbsolute(expanded) ? expanded : resolve5(base, expanded);
}
function parseReferencesSection(path) {
  const content = read(path);
  if (content === void 0) return [];
  const match2 = /^##\s+References?\s*$/im.exec(content);
  if (!match2?.index && match2?.index !== 0) return [];
  const tail = content.slice(match2.index + match2[0].length);
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
      entries.push({ title, path: concretePath(link[2].trim(), dirname7(path)), description });
      continue;
    }
    const bare = /`([^`]+\.md)`/.exec(value);
    if (bare?.[1]) {
      const description = `${value.slice(0, bare.index)} ${value.slice(bare.index + bare[0].length)}`.replace(/[:：—-]+/g, " ").trim();
      entries.push({ title: basename4(bare[1]), path: concretePath(bare[1], dirname7(path)), description: description || basename4(bare[1]) });
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

// domain/context/store.ts
import { appendFileSync as appendFileSync2, existsSync as existsSync5, mkdirSync as mkdirSync2, readFileSync as readFileSync3, renameSync, writeFileSync } from "node:fs";
import { dirname as dirname8, join as join11, parse as parse2, resolve as resolve6 } from "node:path";
var STATE_DIRECTORY_NAME = ".devloop";
var WORKSPACE_STATE_FILE = "context.json";
function sharedStateRoot(root) {
  const info = checkoutAt(root);
  return info ? info.mainRoot ?? info.commonDir : root;
}
function stateDirectory(root) {
  return join11(sharedStateRoot(resolve6(root)), STATE_DIRECTORY_NAME);
}
function workingTreeStateDirectory(root) {
  return join11(resolve6(root), STATE_DIRECTORY_NAME);
}
function branchSegment(branch, name) {
  return `branches/${branch ?? "@detached"}/${name}`;
}
function workspaceStateFile(root) {
  return join11(stateDirectory(root), WORKSPACE_STATE_FILE);
}
function segmentFile(root, name) {
  return join11(stateDirectory(root), `${name}.json`);
}
function atomicWrite(path, data) {
  try {
    mkdirSync2(dirname8(path), { recursive: true });
    const temporary = join11(dirname8(path), `${parse2(path).base}.${process.pid}.tmp`);
    writeFileSync(temporary, JSON.stringify(data, null, 2), "utf8");
    renameSync(temporary, path);
  } catch {
  }
}
function readJson(path) {
  if (!existsSync5(path)) return void 0;
  try {
    const value = JSON.parse(readFileSync3(path, "utf8"));
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
    const path = join11(stateDirectory(root), `${name}.jsonl`);
    mkdirSync2(dirname8(path), { recursive: true });
    appendFileSync2(path, `${JSON.stringify(record2)}
`, "utf8");
  } catch {
  }
}

// domain/context/workspace.ts
var DISCOVERY_SKIP = /* @__PURE__ */ new Set(["docs", "worktrees", "worktree", "node_modules"]);
function isGitRepository(path) {
  return checkoutAt(path) !== void 0;
}
function discoverSubprojectNames(root) {
  try {
    return readdirSync(root).filter((name) => {
      if (name.startsWith(".") || DISCOVERY_SKIP.has(name)) return false;
      const path = join12(root, name);
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
    const path = join12(root, name);
    let canonical;
    try {
      const real = realpathSync4(path);
      if (real !== resolve7(path)) canonical = real;
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
      record2.workspace_root || resolve7(root),
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
    const root = resolve7(rootValue);
    const agentsPath = join12(root, "AGENTS.md");
    const hasAgents = existsSync6(agentsPath);
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
    if (checkoutAt(this.workspaceRoot) !== void 0) ensureGitExclude(this.workspaceRoot);
  }
  isStale(ttl = WORKSPACE_STALE_SECONDS) {
    return stale(this.parsedAt || void 0, ttl);
  }
};

// domain/context/session.ts
import { closeSync, existsSync as existsSync7, mkdirSync as mkdirSync3, openSync, readFileSync as readFileSync4, readdirSync as readdirSync2, renameSync as renameSync2, statSync as statSync2, unlinkSync, writeFileSync as writeFileSync2 } from "node:fs";
import { basename as basename5, dirname as dirname9, join as join13, resolve as resolve8 } from "node:path";
var OWNER_TTL_SECONDS = 1800;
function identityFromEnvironment() {
  if (process.env.DEVLOOP_HARNESS === "opencode" && process.env.DEVLOOP_SESSION_ID) return { harness: "opencode", sessionId: process.env.DEVLOOP_SESSION_ID };
  const codex = process.env.CODEX_THREAD_ID ?? process.env.CODEX_SESSION_ID;
  if (codex) return { harness: "codex", sessionId: codex };
  if (process.env.CLAUDE_CODE_SESSION_ID) return { harness: "claude", sessionId: process.env.CLAUDE_CODE_SESSION_ID };
  return { harness: "unknown", sessionId: "" };
}
function safeHarness(harness) {
  return harness.trim().toLowerCase().replace(/[^A-Za-z0-9._-]/g, "-") || "unknown";
}
function lockFile(repo) {
  return join13(workingTreeStateDirectory(repo), "owner.lock");
}
function legacyLockFile(repo, harness) {
  return join13(workingTreeStateDirectory(repo), `${safeHarness(harness)}.owner.lock`);
}
function readOwnerFile(path) {
  try {
    const value = JSON.parse(readFileSync4(path, "utf8"));
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
      const owner2 = readOwnerFile(join13(workingTreeStateDirectory(repo), name));
      if (active(owner2, at)) return owner2;
    }
  } catch {
  }
  return void 0;
}
function acquireOwner(repo, identity2, branch = currentBranch(repo) ?? "", at = now(), pid = identity2.harness === "opencode" ? process.pid : process.ppid) {
  if (!identity2.sessionId) return true;
  const harness = safeHarness(identity2.harness);
  const path = lockFile(repo);
  const record2 = { harness, session_id: identity2.sessionId, pid, branch, acquired_at: at };
  const owner2 = anyActiveOwner(repo, at);
  if (owner2?.session_id === identity2.sessionId && owner2.harness === harness) {
    try {
      const temporary = `${path}.${process.pid}.tmp`;
      writeFileSync2(temporary, JSON.stringify(record2));
      renameSync2(temporary, path);
      try {
        unlinkSync(legacyLockFile(repo, harness));
      } catch {
      }
    } catch {
    }
    return true;
  }
  if (owner2) return false;
  try {
    ensureGitExclude(repo);
    mkdirSync3(workingTreeStateDirectory(repo), { recursive: true });
    if (existsSync7(path)) unlinkSync(path);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const descriptor = openSync(path, "wx", 420);
        writeFileSync2(descriptor, JSON.stringify(record2));
        closeSync(descriptor);
        return true;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        const current = readOwner(repo);
        if (current) return current.session_id === identity2.sessionId && current.harness === harness;
        try {
          unlinkSync(path);
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
      unlinkSync(lockFile(repo));
      released = true;
    } catch {
    }
  }
  const legacy = readOwnerFile(legacyLockFile(repo, harness));
  if (legacy?.session_id === identity2.sessionId) {
    try {
      unlinkSync(legacyLockFile(repo, harness));
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
  return basename5(repo);
}
function sessionName(sessionId2) {
  return (sessionId2 ?? identityFromEnvironment().sessionId).replace(/[^A-Za-z0-9._-]/g, "-") || "anon";
}
function activeRepoFile(workspaceRoot2, sessionId2) {
  return join13(stateDirectory(workspaceRoot2), "active", `${sessionName(sessionId2)}.json`);
}
function activeBinding(path, enforceTtl) {
  try {
    const value = JSON.parse(readFileSync4(path, "utf8"));
    if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
    const row = value;
    if (typeof row.repo_dir !== "string" || !existsSync7(row.repo_dir)) return void 0;
    const timestamp = typeof row.ts === "number" ? row.ts : statSync2(path).mtimeMs / 1e3;
    const age = Math.max(0, now() - timestamp);
    return enforceTtl && age >= ACTIVE_REPO_TTL_SECONDS ? void 0 : { repo: row.repo_dir, age };
  } catch {
    return void 0;
  }
}
function recordActiveRepo(workspaceRoot2, repo, sessionId2) {
  const path = activeRepoFile(workspaceRoot2, sessionId2);
  try {
    mkdirSync3(dirname9(path), { recursive: true });
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync2(temporary, JSON.stringify({ repo_dir: resolve8(repo), ts: now() }));
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
    unlinkSync(activeRepoFile(workspaceRoot2, sessionId2));
  } catch {
  }
}
function recordSessionEvent(repo, sessionId2, kind, fields = {}) {
  appendLedger(repo, `sessions/${sessionName(sessionId2)}`, { ts: Math.round(now() * 10) / 10, kind, ...fields });
}

// domain/context/tool-calls.ts
import { existsSync as existsSync8, mkdirSync as mkdirSync4, readFileSync as readFileSync5, renameSync as renameSync3, statSync as statSync3, utimesSync, writeFileSync as writeFileSync3 } from "node:fs";
import { join as join14 } from "node:path";
var TOOL_CALL_SCHEMA = "devloop.tool-call/v1";
var FILE_NAME = "tool-calls.jsonl";
var WINDOW_SECONDS = 3600;
var COMPACT_INTERVAL_SECONDS = 60;
function appendToolCall(root, record2, at = Date.now() / 1e3) {
  const directory = stateDirectory(root);
  const path = join14(directory, FILE_NAME);
  const marker = join14(directory, "tool-calls.compact");
  try {
    mkdirSync4(directory, { recursive: true });
    const due = !existsSync8(marker) || at - statSync3(marker).mtimeMs / 1e3 >= COMPACT_INTERVAL_SECONDS;
    if (due) {
      compact(path, at - WINDOW_SECONDS);
      writeFileSync3(marker, "", { flag: "a" });
      utimesSync(marker, at, at);
    }
    appendLedger(root, "tool-calls", record2);
  } catch {
  }
}
function toolCallStartedAt(root, callId, at = Date.now() / 1e3) {
  if (!callId) return void 0;
  try {
    const rows2 = readFileSync5(join14(stateDirectory(root), FILE_NAME), "utf8").trimEnd().split("\n").reverse();
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
  if (!existsSync8(path)) return;
  try {
    const retained = readFileSync5(path, "utf8").split("\n").flatMap((line) => {
      try {
        const record2 = JSON.parse(line);
        return record2 !== null && typeof record2 === "object" && !Array.isArray(record2) && typeof record2.ts === "number" && record2.ts >= cutoff ? [JSON.stringify(record2)] : [];
      } catch {
        return [];
      }
    });
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync3(temporary, retained.map((line) => `${line}
`).join(""), "utf8");
    renameSync3(temporary, path);
  } catch {
  }
}

// domain/workspace.ts
import { existsSync as existsSync10, statSync as statSync4 } from "node:fs";
import { homedir as homedir3 } from "node:os";
import { join as join16, resolve as resolve10 } from "node:path";

// lib/config.ts
import { existsSync as existsSync9, mkdirSync as mkdirSync5, readFileSync as readFileSync6, renameSync as renameSync4, writeFileSync as writeFileSync4 } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { dirname as dirname10, isAbsolute as isAbsolute2, join as join15, resolve as resolve9 } from "node:path";
var DEFAULTS = {
  workspaces: [],
  lifecycle: { default: { pre_commit: [], post_commit: [] }, repos: {} },
  arch: {
    default: {
      enabled: false,
      layers: { "/api/": "api", "/service/": "service", "/dao/": "dao", "/model/": "model" },
      order: ["api", "service", "dao", "model"]
    },
    repos: {}
  }
};
function object5(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function expandPath(value) {
  let expanded = value.startsWith("~") ? join15(homedir2(), value.slice(1)) : value;
  expanded = expanded.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, braced, bare) => process.env[braced || bare] ?? "");
  return expanded;
}
function configDirectory() {
  return process.env.DEVLOOP_CONFIG_DIR ? expandPath(process.env.DEVLOOP_CONFIG_DIR) : join15(homedir2(), ".devloop");
}
function configFile() {
  return join15(configDirectory(), "config.json");
}
function deepMerge(base, override) {
  const result2 = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = result2[key];
    result2[key] = value !== null && typeof value === "object" && !Array.isArray(value) && current !== null && typeof current === "object" && !Array.isArray(current) ? deepMerge(current, value) : value;
  }
  return result2;
}
function readJson2(path) {
  if (!existsSync9(path)) return void 0;
  try {
    const parsed = JSON.parse(readFileSync6(path, "utf8"));
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : void 0;
  } catch {
    return void 0;
  }
}
function ancestorFiles(root) {
  const global2 = resolve9(configFile());
  const home = resolve9(homedir2());
  const found = [];
  let current = root;
  while (true) {
    const candidate = join15(current, ".devloop", "config.json");
    if (resolve9(candidate) !== global2 && existsSync9(candidate)) found.push(candidate);
    if (current === home || current === dirname10(current)) break;
    current = dirname10(current);
  }
  return found.reverse();
}
function resolveLayer(layer, repoKeys) {
  const result2 = { ...layer };
  for (const name of ["lifecycle", "arch"]) {
    if (!(name in layer)) continue;
    const section = object5(layer[name]);
    let policy = object5(section.default);
    for (const key of repoKeys) policy = deepMerge(policy, object5(object5(section.repos)[key]));
    result2[name] = { ...section, default: policy };
  }
  return result2;
}
function loadConfig2(repo) {
  const checkout = repo ? resolve9(expandPath(repo)) : void 0;
  let main;
  try {
    main = checkout ? mainRepoRoot(checkout) : void 0;
  } catch {
    main = void 0;
  }
  const repoKeys = [...new Set([main, checkout].filter((path) => path !== void 0))];
  const files = [...new Set(repoKeys.flatMap(ancestorFiles))];
  const global2 = deepMerge(DEFAULTS, readJson2(configFile()) ?? {});
  let result2 = resolveLayer(global2, repoKeys);
  for (const path of files) result2 = deepMerge(result2, resolveLayer(readJson2(path) ?? {}, repoKeys));
  result2.workspaces = global2.workspaces ?? [];
  return result2;
}
function saveConfig(data) {
  const path = configFile();
  mkdirSync5(dirname10(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync4(temporary, `${JSON.stringify(data, null, 2)}
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
function pullRequestTarget(repo) {
  const value = object5(loadConfig2(repo).pull_request).target_repository;
  return typeof value === "string" && value ? value : void 0;
}
function architectureConfig(repo) {
  return object5(object5(loadConfig2(repo).arch).default);
}

// domain/workspace.ts
function reserved(path) {
  const root = resolve10(path);
  return [
    process.env.CODEX_HOME ?? join16(homedir3(), ".codex"),
    process.env.CLAUDE_HOME ?? join16(homedir3(), ".claude")
  ].some((candidate) => resolve10(expandPath(candidate)) === root);
}
function registeredWorkspaces() {
  return workspaces().map((path) => resolve10(path)).filter((path) => !reserved(path));
}
function registerWorkspace(path) {
  const root = resolve10(expandPath(path));
  if (reserved(root)) return;
  const current = [...registeredWorkspaces()];
  if (!current.includes(root)) setWorkspaces([...current, root]);
}
function maybeRegisterWorkspace(path) {
  const root = resolve10(path);
  if (reserved(root) || !existsSync10(root) || !statSync4(root).isDirectory() || checkoutAt(root) !== void 0) return void 0;
  const agents = join16(root, "AGENTS.md");
  if (!existsSync10(agents)) return void 0;
  if (discoverSubprojectNames(root).length === 0 && parseSubprojectsSection(agents).length === 0) return void 0;
  registerWorkspace(root);
  return root;
}
function findContainingWorkspace(path) {
  const target = resolve10(path);
  return registeredWorkspaces().find((root) => target === root || target.startsWith(`${root}/`));
}

// domain/board/delivery.ts
import { unlinkSync as unlinkSync2 } from "node:fs";

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
function pullRequestLabel(provider, number4) {
  const [noun, sigil] = vocabulary(provider);
  return `${noun} ${sigil}${number4}`;
}

// domain/board/render.ts
import { basename as basename6 } from "node:path";
function rows(value) {
  return Array.isArray(value) ? value.filter((item) => item !== null && typeof item === "object" && !Array.isArray(item)) : [];
}
function text2(value) {
  return typeof value === "string" ? value : "";
}
function number2(value) {
  return typeof value === "number" ? value : 0;
}
function reference(item) {
  const title = text2(item.title) || "?";
  const path = text2(item.path);
  const description = text2(item.description).trim();
  const base = basename6(path);
  return description && description !== base && description !== path ? `${title} \u2014 ${description}  \u2190 ${base}` : `${title}  \u2190 ${base}`;
}
function renderItem(item) {
  const payload = item.payload;
  if (item.type === "workspace") {
    const lines = [`[Workspace: ${text2(payload.root)}]`];
    const references = rows(payload.references);
    if (references.length) lines.push("AGENTS.md references (Read when the task touches these topics):", ...references.map((row) => `  - ${reference(row)}`));
    const projects = rows(payload.subprojects);
    if (projects.length) lines.push("Subprojects:", ...projects.slice(0, 12).map((project) => {
      const aliases = Array.isArray(project.aliases) && project.aliases.length ? ` (${project.aliases.join(", ")})` : "";
      const note = [text2(project.language), text2(project.role)].filter(Boolean).join(" \xB7 ");
      return `  - ${text2(project.name)}${aliases}: ${note}${text2(project.canonical) ? ` \u2192 ${text2(project.canonical)}` : ""}`;
    }));
    return lines.join("\n");
  }
  if (item.type === "repo.references") return ["Repo AGENTS.md references (Read when the task touches these topics):", ...rows(payload.references).map((row) => `  - ${reference(row)}`)].join("\n");
  if (item.type === "repo.identity") {
    const dirty = payload.workspaceDirty ? `dirty(${number2(payload.modifiedCount)} modified, ${number2(payload.untrackedCount)} untracked)` : payload.workspaceDirty === null ? "unknown" : "clean";
    const warnings = [payload.protected ? "PROTECTED" : "", typeof payload.staleBindingHours === "number" ? `repo binding is ${payload.staleBindingHours.toFixed(1)}h old; confirm the repo with cd` : ""].filter(Boolean);
    if (payload.inspectionProblem) warnings.push(text2(payload.inspectionProblem));
    return `[Current repo: ${text2(payload.codeDir) || text2(payload.repoRoot)} (${text2(payload.language) || "?"})] | Branch: ${text2(payload.branch) || "?"}${payload.linkedWorktree === null ? " (checkout unknown)" : payload.linkedWorktree ? " (worktree)" : ""} (ahead ${typeof payload.ahead === "number" ? payload.ahead : "?"}, behind ${typeof payload.behind === "number" ? payload.behind : "?"} vs ${text2(payload.baseBranch)}, target=${text2(payload.targetBranch)}) | Workspace: ${dirty}${warnings.length ? ` \u26A0\uFE0F ${warnings.join("; ")}` : ""}`;
  }
  if (item.type === "repo.pull-request") {
    if (payload.error) return `PR status unavailable: ${text2(payload.error)}`;
    if (payload.ambiguous) return `Branch '${text2(payload.branch)}' matches multiple PRs; select a proposal explicitly.`;
    return `${pullRequestLabel(text2(payload.provider), number2(payload.number))} ${text2(payload.state)} (${text2(payload.repository)})`;
  }
  if (item.type === "repo.validation") {
    if (payload.error) return text2(payload.error);
    if (!number2(payload.total)) return "Validation history: no retained runs for this checkout.";
    const lines = rows(payload.runs).map((run2) => {
      let source = "source comparison unavailable";
      if (run2.sourceState === "changed") source = "source changed since this run";
      else if (run2.sourceState === "unchanged") source = "source unchanged";
      const consistency = run2.inputsConsistent === false ? "; inputs changed during execution" : "";
      return `  - ${text2(run2.component)} ${text2(run2.check)}: ${text2(run2.status)} (${text2(run2.scope)}), ${text2(run2.startedAt)}; ${source}${consistency}; run ${text2(run2.runID)}`;
    });
    return [`Validation history (${number2(payload.total)} retained runs; historical results, not current validation):`, ...lines].join("\n");
  }
  if (item.type === "repo.review") return renderReview(payload);
  return "";
}
function renderPrompt(items) {
  return items.map(renderItem).filter(Boolean).join("\n\n");
}
function renderReview(payload) {
  const status = text2(payload.status);
  const sha = text2(payload.reviewedSha).slice(0, 9);
  const artifact = text2(payload.artifactPath);
  if (status === "running" || status === "stale") return `Review: ${status} on ${sha}; see ${artifact}`;
  const parts = [];
  const findings = number2(payload.findings);
  const failed = number2(payload.failedFiles);
  if (findings) parts.push(`${findings} finding(s)`);
  if (failed) parts.push(`${failed} file(s) failed`);
  if (status === "error" || status === "failed") parts.push("review errored");
  else if (status === "completed_with_errors") parts.push("review incomplete");
  else if (status === "completed_with_warnings") parts.push("review warnings");
  else if (status !== "success") parts.push(`review ${status}`);
  const message = text2(payload.message).trim();
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
      return [[key, { item_type: text3(row.item_type ?? row.item_key), signature: text3(row.signature), count: number3(row.count), ...typeof row.last_emit_at === "number" ? { last_emit_at: row.last_emit_at } : {} }]];
    }));
  }
  deliver(view, trigger = "user_prompt") {
    const due = this.deliverItems(view, trigger);
    return due.length ? renderPrompt(due) : void 0;
  }
  /** Select and mark items once; request-local adapters retain the selection for their turn. */
  deliverItems(view, trigger = "user_prompt") {
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
    if (due.length === 0) return [];
    for (const item of due) {
      const previous = receipt[item.id];
      const same = previous?.signature === item.signature;
      receipt[item.id] = { item_type: item.type, signature: item.signature, count: same ? previous.count + 1 : 1, last_emit_at: at };
    }
    saveSegment(this.root, this.segment(), { items: receipt });
    return due;
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
      unlinkSync2(segmentFile(this.root, this.segment()));
    } catch {
    }
  }
};
function text3(value) {
  return typeof value === "string" ? value : "";
}
function number3(value) {
  return typeof value === "number" ? value : 0;
}

// lib/forge.ts
async function prContextForRepo(repo) {
  const target = pullRequestTarget(repo);
  return pullRequestContext(repo, target ? { targets: [target] } : {});
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

// domain/board/validation.ts
async function validationHistory(repo) {
  const signal = AbortSignal.timeout(1e3);
  try {
    const history = await listValidationRuns({ repository: repo, checkout: repo, limit: 3, signal });
    if (!history.total) return { total: 0, runs: [] };
    const current = await snapshot(repo, { signal }).catch(() => void 0);
    const runs = await Promise.all(history.runs.map(async (run2) => {
      const detail = await readValidationRun(repo, run2.runID, { signal }).catch(() => void 0);
      let sourceState = "unknown";
      if (current?.complete && detail?.inputs) sourceState = current.digest === detail.inputs.snapshot ? "unchanged" : "changed";
      return {
        runID: run2.runID,
        component: run2.component,
        check: run2.check,
        status: run2.status,
        scope: run2.scope,
        startedAt: run2.startedAt,
        inputsConsistent: run2.inputsConsistent,
        sourceState,
        evidenceComplete: detail?.complete ?? false
      };
    }));
    return { total: history.total, hasMore: history.hasMore, runs };
  } catch (error) {
    return { error: `Validation history unavailable: ${error instanceof Error ? error.message : String(error)}` };
  }
}

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
  try {
    const catalog = await inspectCatalog(repo);
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
  items.push(boardItem("repo.validation", "state", scope, await validationHistory(repo)));
  if (branch === void 0) return new Board(root, items);
  let prContext;
  try {
    prContext = branch ? await prContextForRepo(repo) : void 0;
    if (prContext) {
      const view = await prContext.getCheckout({ signal: AbortSignal.timeout(1e3) });
      if (view?.selected || view?.error || view?.ambiguous) items.push(boardItem("repo.pull-request", "state", scope, {
        branch: view.branch,
        provider: prContext.reader.provider,
        ...view.selected ? { repository: view.selected.repository.path, number: view.selected.number, state: view.selected.state, url: view.selected.url } : {},
        ...view.error ? { error: view.error } : {},
        ambiguous: view.ambiguous
      }));
    }
  } catch (error) {
    items.push(boardItem("repo.pull-request", "state", scope, { branch, error: String(error) }));
  } finally {
    prContext?.close();
  }
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
    const result2 = new PromptDelivery(this.root, this.sessionId).deliver(this.view, trigger);
    if (result2 && this.repo) recordSessionEvent(this.repo, this.sessionId, "inject", { text: result2 });
    return result2;
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
import { basename as basename7, isAbsolute as isAbsolute3, resolve as resolve11 } from "node:path";
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
  if (["git", "go", "make"].includes(basename7(argv[0]))) {
    const index = argv.indexOf("-C");
    if (index >= 0 && argv[index + 1]) {
      const configuredPath = argv[index + 1];
      dashC = configuredPath;
      const path = isAbsolute3(configuredPath) ? configuredPath : base.path ? resolve11(base.path, configuredPath) : void 0;
      workingDirectory = { ...path ? { path } : {}, source: "git -C" };
      if (basename7(argv[0]) === "git") argv = [...argv.slice(0, index), ...argv.slice(index + 2)];
    }
  }
  let subcommand;
  let args = argv.slice(1);
  if (basename7(argv[0]) === "git") {
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
      const path = isAbsolute3(words[1]) ? words[1] : current.path ? resolve11(current.path, words[1]) : void 0;
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
  for (const match2 of command2.matchAll(heredoc)) {
    for (const target of patchFileChanges(match2[2])) {
      targets.push({
        ...target,
        path: isAbsolute3(target.path) || !current.path ? target.path : resolve11(current.path, target.path)
      });
    }
  }
  return targets;
}
function wrappedCommand(words) {
  const executable = basename7(words[0] ?? "");
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
    const path = configured ? isAbsolute3(configured) ? configured : resolve11(cwd2, configured) : input.harness === "codex" && toolName === "Bash" ? void 0 : cwd2;
    return { targets: commandTargets(command2, { ...path ? { path } : {}, source: configured ? "tool workdir" : "hook cwd" }), cwd: cwd2, tool: toolName, command: command2 };
  }
  if (toolName === "apply_patch" || input.harness === "opencode" && toolName === "patch") {
    const patch = toolInput.patchText ?? toolInput.patch ?? toolInput.input ?? toolInput.command;
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
import { dirname as dirname11, isAbsolute as isAbsolute4, resolve as resolve12 } from "node:path";
var PolicyContext = class _PolicyContext {
  constructor(cwd2, identity2, anchorPath = "", inspections = /* @__PURE__ */ new Map()) {
    this.inspections = inspections;
    this.cwd = cwd2;
    this.identity = identity2;
    this.anchorPath = anchorPath ? isAbsolute4(anchorPath) ? anchorPath : resolve12(cwd2, anchorPath) : "";
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
    const key = resolve12(repo);
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
import { existsSync as existsSync11, readFileSync as readFileSync7 } from "node:fs";
import { basename as basename8, dirname as dirname12, extname, join as join17, resolve as resolve13 } from "node:path";

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
    return refExists(repo, `refs/tags/${spec}`) && !refExists(repo, `refs/heads/${spec}`);
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
    if (!existsSync11(join17(component, "pyproject.toml")) || !existsSync11(join17(component, "uv.lock"))) return [];
    return finding("pip-install", "This component is uv-managed. Use `uv add` or `uv sync`; direct `pip install` bypasses pyproject.toml and uv.lock.", commandLine(value));
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
  return workspaces().some((root) => resolve13(root) === resolve13(path)) || WorkspaceContext.load(path) !== void 0 && !findGitRoot(path);
}
var workspaceCwd = {
  name: "workspace-cwd",
  targetKind: "command",
  applies: (target) => projectLocal(command(target)),
  check: (target) => {
    const path = command(target).workingDirectory.path;
    if (!path || !workspaceRoot(path)) return [];
    const names = WorkspaceContext.load(path)?.subprojects.slice(0, 10).map((item) => item.name).join(", ");
    return finding("workspace-cwd", `You're at aggregate workspace '${resolve13(path)}', not a subproject. Enter a repository or pass --repo explicitly.${names ? ` Subprojects: ${names}` : ""}`, commandLine(command(target)));
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
      if (isIgnored(repo, path)) return [];
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
    return existsSync11(join17(parent, "pyproject.toml")) || existsSync11(join17(dirname12(parent), "pyproject.toml")) ? finding("requirements-edit", `\`${path}\` is generated dependency output. Edit pyproject.toml, then regenerate it with uv.`, file(target).path) : [];
  }
};
function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function resultingText(target) {
  const input = target.toolInput;
  if (!input) return void 0;
  if (typeof input.content === "string") return input.content;
  if (typeof input.file_text === "string") return input.file_text;
  let current;
  try {
    current = readFileSync7(target.path, "utf8");
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
  const patterns2 = extension === ".py" ? [/^\s*import\s+([\w.]+)/gm, /^\s*from\s+([\w.]+)\s+import\s+/gm] : [/(?:import|export)\s+(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g, /require\(\s*["']([^"']+)["']\s*\)/g];
  return patterns2.flatMap((pattern) => [...source.matchAll(pattern)].map((match2) => match2[1] ?? "")).filter(Boolean);
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
    const text4 = resultingText(value);
    if (!ownLayer || text4 === void 0 || !order.includes(ownLayer)) return [];
    const rank = new Map(order.map((layer, index) => [layer, index]));
    return importedModules(text4, extname(value.path).toLowerCase()).flatMap((module) => {
      const dependency = importLayer(module, order);
      return dependency && dependency !== ownLayer && rank.get(dependency) < rank.get(ownLayer) ? [{ rule: "layer-deps", severity: "deny", message: `Layer violation: ${ownLayer} file ${value.path} must not depend on higher layer ${dependency} (import: ${module}). Move cross-layer orchestration to ${dependency}.`, locator: value.path }] : [];
    });
  }
};
var RULES2 = [protectBranch, checkoutOwner, worktreeAdd, addAll, workspaceCwd, pipInstall, editOwner, branchMerged, requirementsEdit, layerDeps];

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
  const result2 = await evaluate(change, context, RULES2);
  if (result2.action === "deny" && context.gitRoot) {
    recordDeniedDecision(context.gitRoot, result2, {
      tool: input.toolName,
      cwd: input.cwd,
      sessionId: identity2.sessionId
    });
  }
  return result2;
}
async function deniedReason(input) {
  const result2 = await evaluateTool(input);
  return result2.action === "deny" ? decisionMessage(result2) : void 0;
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

// adapters/codex/index.ts
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
  for (const target of change.targets) {
    if (target.kind !== "command" || !target.subcommand || !STATE_SUBCOMMANDS.has(target.subcommand) || !target.workingDirectory.path) continue;
    const repo = findGitRoot(target.workingDirectory.path);
    if (!repo) continue;
    const workspace = findContainingWorkspace(repo);
    if (workspace) recordActiveRepo(workspace, repo, sessionId(payload));
    if (target.subcommand !== "fetch") acquireOwner(repo, identity(payload, harness), currentBranch(repo) ?? "");
  }
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
      const path = isAbsolute5(target.path) ? target.path : resolve14(directory, target.path);
      anchors.push(dirname13(path));
    } else if (target.workingDirectory.path) anchors.push(target.workingDirectory.path);
  }
  for (const key of ["file_path", "notebook_path", "path"]) {
    const value = toolInput[key];
    if (typeof value !== "string" || !value.trim()) continue;
    const path = isAbsolute5(value) ? value : resolve14(directory, value);
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

// adapters/claude/index.ts
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
    const parsed = JSON.parse(readFileSync8(0, "utf8") || "{}");
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
/*! Bundled license information:

smol-toml/dist/error.js:
smol-toml/dist/primitive.js:
smol-toml/dist/date.js:
smol-toml/dist/extract.js:
smol-toml/dist/util.js:
smol-toml/dist/struct.js:
smol-toml/dist/parse.js:
smol-toml/dist/stringify.js:
smol-toml/dist/index.js:
  (*!
   * Copyright (c) Squirrel Chat et al., All rights reserved.
   * SPDX-License-Identifier: BSD-3-Clause
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   * 1. Redistributions of source code must retain the above copyright notice, this
   *    list of conditions and the following disclaimer.
   * 2. Redistributions in binary form must reproduce the above copyright notice,
   *    this list of conditions and the following disclaimer in the
   *    documentation and/or other materials provided with the distribution.
   * 3. Neither the name of the copyright holder nor the names of its contributors
   *    may be used to endorse or promote products derived from this software without
   *    specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
   * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
   * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
   * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
   * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
   * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
   * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
   * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
   * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
   * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   *)
*/
//# sourceMappingURL=runtime.js.map
