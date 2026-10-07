#!/usr/bin/env node

// hooks/runtime.ts
import { readFileSync as readFileSync10 } from "node:fs";

// adapters/process-hooks.ts
import { basename as basename8, dirname as dirname11, isAbsolute as isAbsolute5, resolve as resolve14 } from "node:path";

// domain/repo-layout.ts
import { existsSync as existsSync4, readFileSync as readFileSync2, realpathSync as realpathSync3 } from "node:fs";
import { basename, join as join6, relative, resolve as resolve2 } from "node:path";

// lib/ecosystem.ts
import { createHash as createHash2 } from "node:crypto";
import { existsSync as existsSync2, readFileSync, writeFileSync } from "node:fs";
import { join as join4 } from "node:path";

// node_modules/@compforge/repocli/dist/inspect.js
import { realpath as realpath2 } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

// node_modules/@compforge/repocli/dist/git.js
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { dirname, join } from "node:path";

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
      if (!["ssh:", "git:", "http:", "https:"].includes(url.protocol))
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

// node_modules/@compforge/repocli/dist/layout.js
import { posix as posix2 } from "node:path";

// node_modules/@compforge/repocli/dist/language.js
import { posix } from "node:path";

// node_modules/@compforge/repocli/dist/languages.json
var languages_default = {
  fallback: {
    ".4dform": "",
    ".4dproject": "",
    ".4th": "",
    "._js": "javascript",
    ".a51": "",
    ".ada": "",
    ".adb": "",
    ".adml": "",
    ".admx": "",
    ".adp": "",
    ".ads": "",
    ".agda": "",
    ".al": "",
    ".ant": "",
    ".apex": "apex",
    ".app": "erlang",
    ".app.src": "erlang",
    ".asd": "commonlisp",
    ".asm": "",
    ".astro": "",
    ".auk": "",
    ".avsc": "",
    ".aw": "php",
    ".awk": "",
    ".axaml": "",
    ".axml": "",
    ".bash": "bash",
    ".bats": "bash",
    ".bb": "bitbake",
    ".bbappend": "bitbake",
    ".bbclass": "bitbake",
    ".bib": "",
    ".bibtex": "",
    ".bicep": "",
    ".bicepparam": "",
    ".blade": "",
    ".blade.php": "",
    ".bones": "javascript",
    ".boot": "clojure",
    ".brs": "",
    ".builder": "ruby",
    ".builds": "",
    ".bzl": "starlark",
    ".c": "c",
    ".c++": "cpp",
    ".caddyfile": "",
    ".cairo": "cairo",
    ".cake": "c_sharp",
    ".capnp": "capnp",
    ".cats": "c",
    ".cbl": "",
    ".cc": "cpp",
    ".ccp": "",
    ".ccproj": "",
    ".ccxml": "",
    ".cdf": "",
    ".cfg": "",
    ".cgi": "bash",
    ".cginc": "hlsl",
    ".circom": "circom",
    ".cjs": "javascript",
    ".cl": "commonlisp",
    ".cl2": "clojure",
    ".clixml": "",
    ".clj": "clojure",
    ".cljc": "clojure",
    ".cljs": "clojure",
    ".cljs.hl": "clojure",
    ".cljscm": "clojure",
    ".cljx": "clojure",
    ".cls": "apex",
    ".cmake": "cmake",
    ".cmake.in": "cmake",
    ".cnf": "",
    ".cob": "",
    ".cobol": "",
    ".command": "bash",
    ".containerfile": "",
    ".cook": "",
    ".cp": "cpp",
    ".cpp": "cpp",
    ".cppm": "cpp",
    ".cproject": "",
    ".cpy": "",
    ".cr": "crystal",
    ".cs": "c_sharp",
    ".cs.pp": "c_sharp",
    ".cscfg": "",
    ".csdef": "",
    ".csl": "",
    ".csproj": "",
    ".css": "",
    ".csv": "",
    ".csx": "c_sharp",
    ".ct": "",
    ".ctp": "php",
    ".cts": "typescript",
    ".cu": "cuda",
    ".cue": "",
    ".cuh": "cuda",
    ".cxx": "cpp",
    ".cylc": "",
    ".d": "d",
    ".dart": "dart",
    ".ddl": "sql",
    ".depproj": "",
    ".desktop": "",
    ".desktop.in": "",
    ".dfm": "",
    ".dhall": "",
    ".di": "d",
    ".diff": "",
    ".dita": "",
    ".ditamap": "",
    ".ditaval": "",
    ".dll.config": "",
    ".dockerfile": "",
    ".dof": "",
    ".dot": "",
    ".dotsettings": "",
    ".dpr": "",
    ".dsp": "faust",
    ".ebnf": "",
    ".editorconfig": "",
    ".el": "",
    ".eliom": "ocaml",
    ".eliomi": "ocaml",
    ".elm": "",
    ".emacs": "",
    ".emacs.desktop": "",
    ".erb": "",
    ".erb.deface": "",
    ".erl": "erlang",
    ".es": "javascript",
    ".es6": "javascript",
    ".escript": "erlang",
    ".ex": "elixir",
    ".exs": "elixir",
    ".eye": "ruby",
    ".f": "",
    ".f77": "",
    ".fcgi": "bash",
    ".filters": "",
    ".fir": "",
    ".fish": "fish",
    ".fnl": "",
    ".for": "",
    ".forth": "",
    ".fp": "glsl",
    ".fpp": "",
    ".fr": "",
    ".frag": "javascript",
    ".frg": "glsl",
    ".frm": "",
    ".frt": "",
    ".fs": "glsl",
    ".fsh": "glsl",
    ".fshader": "glsl",
    ".fsi": "fsharp",
    ".fsproj": "",
    ".fsx": "fsharp",
    ".fth": "",
    ".fx": "hlsl",
    ".fxh": "hlsl",
    ".fxml": "",
    ".gawk": "",
    ".gd": "gdscript",
    ".gdnlib": "",
    ".gdns": "",
    ".gemspec": "ruby",
    ".geo": "glsl",
    ".geojson": "",
    ".geom": "glsl",
    ".gitconfig": "",
    ".glade": "",
    ".gleam": "gleam",
    ".glsl": "glsl",
    ".glslf": "glsl",
    ".glslv": "glsl",
    ".gltf": "",
    ".gml": "",
    ".gmx": "",
    ".gn": "",
    ".gni": "",
    ".go": "go",
    ".god": "ruby",
    ".gpx": "",
    ".gql": "graphql",
    ".graphql": "graphql",
    ".graphqls": "graphql",
    ".groovy": "groovy",
    ".grt": "groovy",
    ".grxml": "",
    ".gs": "javascript",
    ".gshader": "glsl",
    ".gst": "",
    ".gtpl": "groovy",
    ".gv": "",
    ".gvy": "groovy",
    ".gyp": "python",
    ".gypi": "python",
    ".h": "c",
    ".h++": "cpp",
    ".h.in": "c",
    ".ha": "hare",
    ".hack": "hack",
    ".har": "",
    ".hcl": "",
    ".heex": "",
    ".hh": "cpp",
    ".hhi": "hack",
    ".hic": "clojure",
    ".hlsl": "hlsl",
    ".hlsli": "hlsl",
    ".hpp": "cpp",
    ".hrl": "erlang",
    ".hs": "",
    ".hs-boot": "",
    ".hsc": "",
    ".hta": "",
    ".htm": "",
    ".html": "",
    ".html.eex": "",
    ".html.hl": "",
    ".http": "",
    ".hurl": "",
    ".hx": "haxe",
    ".hxsl": "haxe",
    ".hxx": "cpp",
    ".hzp": "",
    ".i": "",
    ".ice": "",
    ".idc": "c",
    ".iml": "",
    ".inc": "cpp",
    ".ini": "",
    ".inl": "cpp",
    ".ino": "cpp",
    ".ipp": "cpp",
    ".ivy": "",
    ".ixx": "cpp",
    ".j2": "",
    ".jade": "",
    ".jake": "javascript",
    ".janet": "",
    ".jav": "java",
    ".java": "java",
    ".javascript": "javascript",
    ".jbuilder": "ruby",
    ".jelly": "",
    ".jinja": "",
    ".jinja2": "",
    ".jl": "julia",
    ".jq": "jq",
    ".js": "javascript",
    ".jsb": "javascript",
    ".jscad": "javascript",
    ".jsfl": "javascript",
    ".jsh": "java",
    ".jslib": "javascript",
    ".jsm": "javascript",
    ".json": "",
    ".json-tmlanguage": "",
    ".json.example": "",
    ".json5": "",
    ".jsonl": "",
    ".jsonnet": "",
    ".jspre": "javascript",
    ".jsproj": "",
    ".jss": "javascript",
    ".jsx": "javascript",
    ".just": "",
    ".kdl": "",
    ".kml": "",
    ".kojo": "scala",
    ".ksh": "bash",
    ".kt": "kotlin",
    ".ktm": "kotlin",
    ".kts": "kotlin",
    ".l": "commonlisp",
    ".launch": "",
    ".ld": "",
    ".lds": "",
    ".leex": "",
    ".lektorproject": "",
    ".less": "",
    ".libsonnet": "",
    ".linq": "c_sharp",
    ".liquid": "",
    ".lisp": "commonlisp",
    ".livemd": "",
    ".ll": "",
    ".lmi": "python",
    ".lpr": "",
    ".lsp": "commonlisp",
    ".lua": "lua",
    ".luau": "luau",
    ".m": "objc",
    ".ma": "",
    ".mak": "",
    ".make": "",
    ".makefile": "",
    ".markdown": "",
    ".mathematica": "",
    ".matlab": "matlab",
    ".mawk": "",
    ".mcmeta": "",
    ".md": "",
    ".mdown": "",
    ".mdpolicy": "",
    ".mdwn": "",
    ".mermaid": "",
    ".mir": "",
    ".mjml": "",
    ".mjs": "javascript",
    ".mk": "",
    ".mkd": "",
    ".mkdn": "",
    ".mkdown": "",
    ".mkfile": "",
    ".ml": "ocaml",
    ".ml4": "ocaml",
    ".mli": "ocaml",
    ".mll": "ocaml",
    ".mly": "ocaml",
    ".mm": "",
    ".mmd": "",
    ".mod": "",
    ".mojo": "",
    ".move": "move",
    ".mspec": "ruby",
    ".mt": "",
    ".mts": "typescript",
    ".mxml": "",
    ".mysql": "sql",
    ".nas": "",
    ".nasm": "",
    ".natvis": "",
    ".nawk": "",
    ".nb": "",
    ".nbp": "",
    ".ncl": "",
    ".ndproj": "",
    ".nginx": "",
    ".nginxconf": "",
    ".nim": "nim",
    ".nim.cfg": "nim",
    ".nimble": "nim",
    ".nimrod": "nim",
    ".nims": "nim",
    ".ninja": "",
    ".nix": "",
    ".njs": "javascript",
    ".nomad": "",
    ".nproj": "",
    ".nse": "lua",
    ".nu": "",
    ".nuspec": "",
    ".nut": "squirrel",
    ".ny": "commonlisp",
    ".odd": "",
    ".odin": "odin",
    ".org": "",
    ".osm": "",
    ".p8": "lua",
    ".pac": "javascript",
    ".pas": "",
    ".pascal": "",
    ".patch": "",
    ".pbt": "",
    ".pbtxt": "",
    ".pd_lua": "lua",
    ".perl": "",
    ".ph": "",
    ".php": "php",
    ".php3": "php",
    ".php4": "php",
    ".php5": "php",
    ".phps": "php",
    ".phpt": "php",
    ".pkgproj": "",
    ".pkl": "",
    ".pl": "",
    ".plt": "",
    ".pluginspec": "ruby",
    ".plx": "",
    ".pm": "",
    ".podsl": "commonlisp",
    ".podspec": "ruby",
    ".pp": "",
    ".prawn": "ruby",
    ".prc": "sql",
    ".prefs": "",
    ".prisma": "prisma",
    ".pro": "",
    ".proj": "",
    ".prolog": "",
    ".properties": "",
    ".props": "",
    ".proto": "proto",
    ".ps1": "powershell",
    ".ps1xml": "",
    ".psc1": "",
    ".psd1": "powershell",
    ".psgi": "",
    ".psm1": "powershell",
    ".pt": "",
    ".pubxml": "",
    ".pug": "",
    ".purs": "",
    ".py": "python",
    ".py3": "python",
    ".pyde": "python",
    ".pyi": "python",
    ".pyp": "python",
    ".pyt": "python",
    ".pyw": "python",
    ".qhelp": "",
    ".ql": "",
    ".qll": "",
    ".r": "r",
    ".rabl": "ruby",
    ".rake": "ruby",
    ".rb": "ruby",
    ".rbi": "ruby",
    ".rbuild": "ruby",
    ".rbw": "ruby",
    ".rbx": "ruby",
    ".rbxs": "lua",
    ".rchit": "glsl",
    ".rd": "r",
    ".rdf": "",
    ".re": "cpp",
    ".reek": "",
    ".rego": "",
    ".res": "",
    ".resi": "",
    ".resource": "",
    ".rest": "",
    ".rest.txt": "",
    ".resx": "",
    ".rhtml": "",
    ".rkt": "",
    ".rktd": "",
    ".rktl": "",
    ".rmiss": "glsl",
    ".robot": "",
    ".rockspec": "lua",
    ".ron": "",
    ".ronn": "",
    ".rpy": "python",
    ".rq": "",
    ".rs": "rust",
    ".rs.in": "rust",
    ".rss": "",
    ".rst": "",
    ".rst.txt": "",
    ".rsx": "r",
    ".ru": "ruby",
    ".ruby": "ruby",
    ".rviz": "",
    ".s": "",
    ".sarif": "",
    ".sbatch": "bash",
    ".sbt": "scala",
    ".sc": "scala",
    ".scala": "scala",
    ".scd": "",
    ".sch": "",
    ".scm": "scheme",
    ".scrbl": "",
    ".scss": "",
    ".scxml": "",
    ".sdc": "",
    ".service": "",
    ".sexp": "commonlisp",
    ".sfproj": "",
    ".sh": "bash",
    ".sh.in": "bash",
    ".shader": "glsl",
    ".shproj": "",
    ".sjs": "javascript",
    ".sld": "scheme",
    ".slnx": "",
    ".sls": "scheme",
    ".slurm": "bash",
    ".smithy": "",
    ".sol": "solidity",
    ".sparql": "",
    ".spec": "python",
    ".sps": "scheme",
    ".sql": "sql",
    ".srdf": "",
    ".ss": "scheme",
    ".ssjs": "javascript",
    ".star": "starlark",
    ".storyboard": "",
    ".sublime-snippet": "",
    ".sublime-syntax": "",
    ".svelte": "",
    ".sw": "",
    ".swift": "swift",
    ".syntax": "",
    ".t": "",
    ".tab": "sql",
    ".tac": "python",
    ".tact": "",
    ".targets": "",
    ".tcc": "cpp",
    ".tcl": "",
    ".tcl.in": "",
    ".templ": "templ",
    ".tesc": "glsl",
    ".tese": "glsl",
    ".textproto": "",
    ".tf": "",
    ".tfstate": "",
    ".tfstate.backup": "",
    ".tfvars": "",
    ".thor": "ruby",
    ".thrift": "thrift",
    ".tl": "teal",
    ".tla": "tlaplus",
    ".tm": "",
    ".tml": "",
    ".tmux": "bash",
    ".tofu": "",
    ".toml": "",
    ".toml.example": "",
    ".tool": "bash",
    ".topojson": "",
    ".tpp": "cpp",
    ".tres": "",
    ".trigger": "bash",
    ".ts": "typescript",
    ".tscn": "",
    ".tsx": "tsx",
    ".ttl": "",
    ".twig": "",
    ".txt": "",
    ".txx": "cpp",
    ".typ": "",
    ".udf": "sql",
    ".ui": "",
    ".urdf": "",
    ".url": "",
    ".ux": "",
    ".v": "",
    ".vbproj": "",
    ".vcxproj": "",
    ".veo": "",
    ".vert": "glsl",
    ".vhd": "vhdl",
    ".vhdl": "vhdl",
    ".vhf": "vhdl",
    ".vhi": "vhdl",
    ".vho": "vhdl",
    ".vhost": "",
    ".vhs": "vhdl",
    ".vht": "vhdl",
    ".vhw": "vhdl",
    ".viw": "sql",
    ".vrx": "glsl",
    ".vs": "glsl",
    ".vsh": "glsl",
    ".vshader": "glsl",
    ".vsixmanifest": "",
    ".vssettings": "",
    ".vstemplate": "",
    ".vue": "",
    ".vxml": "",
    ".wast": "",
    ".wat": "",
    ".watchr": "ruby",
    ".webapp": "",
    ".webmanifest": "",
    ".wgsl": "wgsl",
    ".wixproj": "",
    ".wl": "",
    ".wls": "",
    ".wlt": "",
    ".wlua": "lua",
    ".workbook": "",
    ".workflow": "",
    ".wsdl": "",
    ".wsf": "",
    ".wsgi": "python",
    ".wxi": "",
    ".wxl": "",
    ".wxs": "",
    ".x": "",
    ".x3d": "",
    ".xacro": "",
    ".xaml": "",
    ".xdc": "",
    ".xht": "",
    ".xhtml": "",
    ".xib": "",
    ".xlf": "",
    ".xliff": "",
    ".xmi": "",
    ".xml": "",
    ".xml.dist": "",
    ".xmp": "",
    ".xproj": "",
    ".xpy": "python",
    ".xrl": "erlang",
    ".xsd": "",
    ".xsjs": "javascript",
    ".xsjslib": "javascript",
    ".xspec": "",
    ".xul": "",
    ".yaml": "",
    ".yaml-tmlanguage": "",
    ".yaml.sed": "",
    ".yap": "",
    ".yml": "",
    ".yml.mysql": "",
    ".yrl": "erlang",
    ".yy": "",
    ".yyp": "",
    ".zcml": "",
    ".zig": "zig",
    ".zig.zon": "zig",
    ".zsh": "bash",
    ".zsh-theme": "bash"
  },
  filenames: {
    ".JUSTFILE": "",
    ".Justfile": "",
    ".Rprofile": "r",
    ".abbrev_defs": "",
    ".all-contributorsrc": "",
    ".arcconfig": "",
    ".auto-changelog": "",
    ".bash_aliases": "bash",
    ".bash_functions": "bash",
    ".bash_history": "bash",
    ".bash_logout": "bash",
    ".bash_profile": "bash",
    ".bashrc": "bash",
    ".buckconfig": "",
    ".c8rc": "",
    ".clang-format": "",
    ".clang-tidy": "",
    ".clangd": "",
    ".classpath": "",
    ".coveragerc": "",
    ".cproject": "",
    ".cshrc": "bash",
    ".editorconfig": "",
    ".emacs": "",
    ".emacs.desktop": "",
    ".envrc": "bash",
    ".flake8": "",
    ".flaskenv": "bash",
    ".gclient": "python",
    ".gemrc": "",
    ".gitconfig": "",
    ".gitmodules": "",
    ".gn": "",
    ".gnus": "",
    ".htmlhintrc": "",
    ".imgbotconfig": "",
    ".irbrc": "ruby",
    ".justfile": "",
    ".kshrc": "bash",
    ".latexmkrc": "",
    ".login": "bash",
    ".luacheckrc": "lua",
    ".nycrc": "",
    ".php": "php",
    ".php_cs": "php",
    ".php_cs.dist": "php",
    ".profile": "bash",
    ".project": "",
    ".pryrc": "ruby",
    ".pylintrc": "",
    ".simplecov": "ruby",
    ".spacemacs": "",
    ".tern-config": "",
    ".tern-project": "",
    ".tmux.conf": "bash",
    ".viper": "",
    ".watchmanconfig": "",
    ".xinitrc": "bash",
    ".xsession": "bash",
    ".zlogin": "bash",
    ".zlogout": "bash",
    ".zprofile": "bash",
    ".zshenv": "bash",
    ".zshrc": "bash",
    "9fs": "bash",
    "App.config": "",
    Appraisals: "ruby",
    BSDmakefile: "",
    BUCK: "starlark",
    BUILD: "starlark",
    "BUILD.bazel": "starlark",
    Berksfile: "ruby",
    Brewfile: "ruby",
    Buildfile: "ruby",
    "CITATION.cff": "",
    "CMakeLists.txt": "cmake",
    COMMIT_EDITMSG: "",
    Caddyfile: "",
    Capfile: "ruby",
    "Cargo.lock": "",
    "Cargo.toml.orig": "",
    Cask: "",
    Containerfile: "",
    DEPS: "python",
    Dangerfile: "ruby",
    Deliverfile: "ruby",
    Dockerfile: "",
    Earthfile: "",
    Eask: "",
    Emakefile: "erlang",
    Fastfile: "ruby",
    GNUmakefile: "",
    Gemfile: "ruby",
    "Gopkg.lock": "",
    Guardfile: "ruby",
    HOSTS: "",
    JUSTFILE: "",
    Jakefile: "javascript",
    Jarfile: "ruby",
    Jenkinsfile: "groovy",
    Justfile: "",
    Kbuild: "",
    "MODULE.bazel": "starlark",
    "MODULE.bazel.lock": "",
    Makefile: "",
    "Makefile.PL": "",
    "Makefile.am": "",
    "Makefile.boot": "",
    "Makefile.frag": "",
    "Makefile.in": "",
    "Makefile.inc": "",
    "Makefile.wat": "",
    Mavenfile: "ruby",
    Modulefile: "puppet",
    "NuGet.config": "",
    Nukefile: "",
    PKGBUILD: "bash",
    "Package.resolved": "",
    Phakefile: "php",
    Pipfile: "",
    "Pipfile.lock": "",
    Podfile: "ruby",
    "Project.ede": "",
    Puppetfile: "ruby",
    Rakefile: "ruby",
    Rexfile: "",
    SConscript: "python",
    SConstruct: "python",
    "Settings.StyleCop": "",
    Snapfile: "ruby",
    Steepfile: "ruby",
    Thorfile: "ruby",
    Tiltfile: "starlark",
    Vagrantfile: "ruby",
    WORKSPACE: "starlark",
    "WORKSPACE.bazel": "starlark",
    "WORKSPACE.bzlmod": "starlark",
    "Web.Debug.config": "",
    "Web.Release.config": "",
    "Web.config": "",
    _emacs: "",
    abbrev_defs: "",
    ack: "",
    bash_aliases: "bash",
    bash_logout: "bash",
    bash_profile: "bash",
    bashrc: "bash",
    buildfile: "ruby",
    "buildozer.spec": "",
    "bun.lock": "",
    "composer.lock": "",
    "contents.lr": "",
    cpanfile: "",
    cshrc: "bash",
    "deno.lock": "",
    "dev-requirements.txt": "",
    "expr-dist": "r",
    "flake.lock": "",
    "glide.lock": "",
    "go.mod": "",
    gradlew: "bash",
    hosts: "",
    justfile: "",
    kshrc: "bash",
    latexmkrc: "",
    "ld.script": "",
    login: "bash",
    makefile: "",
    "makefile.sco": "",
    man: "bash",
    "mcmod.info": "",
    "meson.build": "",
    "meson_options.txt": "",
    "mix.lock": "elixir",
    mkfile: "",
    mvnw: "bash",
    "nginx.conf": "",
    "nim.cfg": "nim",
    owh: "",
    "package.json": "",
    "packages.config": "",
    "pdm.lock": "",
    "pixi.lock": "",
    "poetry.lock": "",
    profile: "bash",
    "project.godot": "",
    pylintrc: "",
    "pyproject.toml": "",
    "rebar.config": "erlang",
    "rebar.config.lock": "erlang",
    "rebar.lock": "erlang",
    "requirements-dev.txt": "",
    "requirements.lock.txt": "",
    "requirements.txt": "",
    "riemann.config": "clojure",
    starfield: "",
    "suite.rc": "",
    "tmux.conf": "bash",
    "uv.lock": "",
    vlcrc: "",
    wscript: "python",
    xinitrc: "bash",
    xsession: "bash",
    "yarn.lock": "",
    zlogin: "bash",
    zlogout: "bash",
    zprofile: "bash",
    zshenv: "bash",
    zshrc: "bash"
  },
  overrides: {
    ".cjs": "javascript",
    ".cts": "typescript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".mts": "typescript",
    ".pyi": "python"
  },
  registry: {
    ".4th": "",
    ".R": "r",
    ".adb": "",
    ".ads": "",
    ".agda": "",
    ".asm": "",
    ".astro": "",
    ".awk": "",
    ".bass": "",
    ".bb": "bitbake",
    ".bbappend": "bitbake",
    ".bbclass": "bitbake",
    ".beancount": "",
    ".bib": "",
    ".bicep": "",
    ".blade.php": "",
    ".brs": "",
    ".bzl": "starlark",
    ".c": "c",
    ".cairo": "cairo",
    ".capnp": "capnp",
    ".cbl": "",
    ".cc": "cpp",
    ".cfg": "",
    ".chatito": "",
    ".circom": "circom",
    ".cjs": "javascript",
    ".cl": "commonlisp",
    ".clj": "clojure",
    ".cljc": "clojure",
    ".cljs": "clojure",
    ".cls": "apex",
    ".cmake": "cmake",
    ".cob": "",
    ".conf": "",
    ".cook": "",
    ".corn": "",
    ".cpon": "",
    ".cpp": "cpp",
    ".cpy": "",
    ".cr": "crystal",
    ".cs": "c_sharp",
    ".css": "",
    ".csv": "",
    ".cu": "cuda",
    ".cue": "",
    ".cuh": "cuda",
    ".cxx": "cpp",
    ".cylc": "",
    ".d": "d",
    ".dart": "dart",
    ".desktop": "",
    ".dhall": "",
    ".di": "d",
    ".diff": "",
    ".dis": "",
    ".djot": "",
    ".dot": "",
    ".dsp": "faust",
    ".dtd": "",
    ".dts": "",
    ".dtsi": "",
    ".dump": "",
    ".ebnf": "",
    ".editorconfig": "",
    ".edn": "clojure",
    ".eds": "",
    ".eex": "",
    ".ejs": "",
    ".el": "",
    ".elm": "",
    ".elsa": "",
    ".enf": "",
    ".erb": "",
    ".erl": "erlang",
    ".ex": "elixir",
    ".exs": "elixir",
    ".f": "",
    ".f03": "",
    ".f08": "",
    ".f90": "",
    ".f95": "",
    ".fac": "",
    ".fidl": "",
    ".fir": "",
    ".fish": "fish",
    ".fnl": "",
    ".frag": "glsl",
    ".fs": "",
    ".fsi": "fsharp",
    ".fsx": "fsharp",
    ".fth": "",
    ".fx": "hlsl",
    ".gd": "gdscript",
    ".gitattributes": "",
    ".gitconfig": "",
    ".gitignore": "",
    ".gleam": "gleam",
    ".glsl": "glsl",
    ".gn": "",
    ".gni": "",
    ".go": "go",
    ".gql": "graphql",
    ".graphql": "graphql",
    ".groovy": "groovy",
    ".gv": "",
    ".gvy": "groovy",
    ".h": "c",
    ".ha": "hare",
    ".hack": "hack",
    ".hcl": "",
    ".heex": "",
    ".hh": "cpp",
    ".hlsl": "hlsl",
    ".hpp": "cpp",
    ".hrl": "erlang",
    ".hs": "",
    ".htm": "",
    ".html": "",
    ".http": "",
    ".hurl": "",
    ".hx": "haxe",
    ".hxx": "cpp",
    ".inc": "",
    ".ini": "",
    ".ino": "arduino",
    ".j2": "",
    ".jade": "",
    ".janet": "",
    ".java": "java",
    ".jinja": "",
    ".jinja2": "",
    ".jl": "julia",
    ".journal": "",
    ".jq": "jq",
    ".js": "javascript",
    ".json": "",
    ".json5": "",
    ".jsonnet": "",
    ".just": "",
    ".kdl": "",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".ld": "",
    ".lds": "",
    ".ledger": "",
    ".less": "",
    ".lhs": "",
    ".libsonnet": "",
    ".liquid": "",
    ".lisp": "commonlisp",
    ".ll": "",
    ".lsp": "commonlisp",
    ".lua": "lua",
    ".luau": "luau",
    ".m": "matlab",
    ".mak": "",
    ".mat": "matlab",
    ".md": "",
    ".mermaid": "",
    ".mjs": "javascript",
    ".mk": "",
    ".ml": "ocaml",
    ".mli": "ocaml",
    ".mmd": "",
    ".mojo": "mojo",
    ".move": "move",
    ".nb": "",
    ".ncl": "",
    ".nim": "nim",
    ".nims": "nim",
    ".ninja": "",
    ".nix": "",
    ".norg": "",
    ".nu": "",
    ".nut": "squirrel",
    ".odin": "odin",
    ".org": "",
    ".pas": "",
    ".patch": "",
    ".pbtxt": "",
    ".pem": "",
    ".php": "php",
    ".pkl": "",
    ".pl": "",
    ".pm": "",
    ".pp": "",
    ".prisma": "prisma",
    ".pro": "",
    ".promql": "",
    ".properties": "",
    ".proto": "proto",
    ".ps1": "powershell",
    ".psd1": "powershell",
    ".psm1": "powershell",
    ".pug": "",
    ".purs": "",
    ".py": "python",
    ".ql": "",
    ".r": "r",
    ".rb": "ruby",
    ".regex": "",
    ".rego": "",
    ".res": "",
    ".resi": "",
    ".rkt": "",
    ".robot": "",
    ".ron": "",
    ".rq": "",
    ".rs": "rust",
    ".rst": "",
    ".s": "",
    ".scala": "scala",
    ".scm": "scheme",
    ".scss": "",
    ".sh": "bash",
    ".smithy": "",
    ".sol": "solidity",
    ".sparql": "",
    ".sql": "sql",
    ".ss": "scheme",
    ".star": "starlark",
    ".sv": "",
    ".svelte": "",
    ".svh": "",
    ".swift": "swift",
    ".tal": "",
    ".tcl": "",
    ".td": "",
    ".templ": "templ",
    ".textproto": "",
    ".tf": "",
    ".tfvars": "",
    ".thrift": "thrift",
    ".tl": "teal",
    ".tla": "tlaplus",
    ".toml": "",
    ".tres": "",
    ".trigger": "apex",
    ".ts": "typescript",
    ".tscn": "",
    ".tsv": "",
    ".tsx": "tsx",
    ".ttl": "",
    ".twig": "",
    ".txtpb": "",
    ".typ": "",
    ".v": "v",
    ".vert": "glsl",
    ".vhd": "vhdl",
    ".vhdl": "vhdl",
    ".vsh": "v",
    ".vue": "",
    ".wast": "",
    ".wat": "",
    ".wgsl": "wgsl",
    ".wl": "",
    ".xml": "",
    ".yaml": "",
    ".yml": "",
    ".yuck": "",
    ".zed": "",
    ".zig": "zig",
    ".\u{1F525}": "mojo"
  }
};

// node_modules/@compforge/repocli/dist/language.js
function language(path) {
  const base = posix.basename(path);
  const ext = base.includes(".") ? base.slice(base.lastIndexOf(".")).toLowerCase() : "";
  const lookup = (table, key) => Object.hasOwn(table, key) ? table[key] : void 0;
  const override = lookup(languages_default.overrides, ext);
  if (override !== void 0)
    return override;
  const filename = lookup(languages_default.filenames, base);
  if (filename !== void 0)
    return filename;
  const suffixes = [];
  for (let i = base.length - 1; i > 0 && suffixes.length < 4; i--) {
    if (base[i] === ".")
      suffixes.push(base.slice(i));
  }
  for (const suffix of suffixes.reverse()) {
    const found = lookup(languages_default.registry, suffix);
    if (found !== void 0)
      return found;
  }
  const goExt = base.includes(".") ? base.slice(base.lastIndexOf(".")).toLowerCase() : "";
  return lookup(languages_default.fallback, goExt) ?? "";
}

// node_modules/@compforge/repocli/dist/layout.js
var compare = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
var needsContent = (name) => name === ".repocli.json" || posix2.basename(name) === "package.json";
var validPath = (name) => name !== "" && name !== "." && name !== ".." && !name.includes("\0") && !name.includes("\\") && !name.startsWith("/") && !name.startsWith("../") && posix2.normalize(name) === name && !name.endsWith("/");
function fromOrigin(origin) {
  const remote = parseRemoteUrl(origin);
  if (!remote)
    return null;
  const { host, path } = remote;
  return { forge: { name: host === "github.com" ? "github" : host === "gitlab.com" ? "gitlab" : host }, path };
}
var excluded = /* @__PURE__ */ new Set(["node_modules", "vendor", "venv", "env", "dist", "build", "target", "__pycache__", "testdata"]);
var skip = (name) => name.split("/").slice(0, -1).some((p) => p.startsWith(".") || excluded.has(p));
var markers = [["python", "pyproject.toml", "setup.py"], ["go", "go.mod"], ["node", "package.json"]];
function detectLanguage(files, root) {
  for (const [ecosystem, ...manifests] of markers) {
    if (ecosystem === "python")
      manifests.push("requirements.txt");
    for (const manifest of manifests) {
      const name = posix2.join(root, manifest);
      if (!files.has(name))
        continue;
      if (ecosystem !== "node")
        return ecosystem;
      const text3 = files.get(name)?.toString().toLowerCase() ?? "";
      return text3.includes("typescript") || text3.includes("@types/") || files.has(posix2.join(root, "tsconfig.json")) ? "typescript" : "javascript";
    }
  }
  const languages = /* @__PURE__ */ new Set();
  for (const name of files.keys()) {
    if (skip(name) || root !== "." && !name.startsWith(root + "/"))
      continue;
    const value = language(name);
    if (value)
      languages.add(value === "tsx" ? "typescript" : value);
  }
  return languages.size > 1 ? "mixed" : languages.values().next().value ?? "";
}
function discover(files) {
  const roots = /* @__PURE__ */ new Set();
  for (const name of files.keys()) {
    if (!skip(name) && markers.some(([, ...names]) => names.includes(posix2.basename(name))))
      roots.add(posix2.dirname(name));
  }
  const selected = [];
  for (const root of [...roots].sort(compare)) {
    if (!selected.some((parent) => parent !== "." && root.startsWith(parent + "/")))
      selected.push(root);
  }
  if (!selected.length)
    selected.push(".");
  return selected.map((root) => ({ name: root, root }));
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
  const manifest = posix2.join(root, "package.json");
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
    const name = posix2.join(root, file2);
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
function array(value) {
  if (value == null)
    return [];
  if (!Array.isArray(value))
    throw new Error("expected an array");
  return value;
}
function repository(value) {
  const obj = object(value);
  return { forge: { name: string(field(object(field(obj, "forge")), "name")) }, path: string(field(obj, "path")) };
}
function load(files, origin) {
  let repo = fromOrigin(origin);
  let components = [];
  const data = files.get(".repocli.json");
  if (data) {
    try {
      const config = object(JSON.parse(data.toString()));
      const declared = field(config, "repository");
      if (declared !== void 0) {
        if (declared === null)
          repo = null;
        else {
          const value = object(declared);
          const forge = field(value, "forge");
          repo = {
            forge: { name: string(field(object(forge), "name") ?? repo?.forge.name) },
            path: string(field(value, "path") ?? repo?.path)
          };
        }
      }
      if (repo && (!repo.forge.name || !repo.path))
        throw new Error("repository requires forge.name and path");
      components = array(field(config, "components"));
    } catch (error) {
      throw new Error("read .repocli.json", { cause: error });
    }
  }
  if (!components.length)
    components = discover(files);
  const roots = /* @__PURE__ */ new Set(), names = /* @__PURE__ */ new Set();
  const bindings = components.map((value) => {
    const item = object(value);
    const root = string(field(item, "root")) || ".";
    const name = string(field(item, "name"));
    if (!name || names.has(name) || roots.has(root) || root !== "." && !validPath(root))
      throw new Error("invalid or duplicate component name/root");
    roots.add(root);
    names.add(name);
    const productNames = /* @__PURE__ */ new Set();
    const products = array(field(item, "products")).map((value2) => {
      const name2 = string(field(object(value2), "name"));
      if (!name2 || productNames.has(name2))
        throw new Error("empty or duplicate product name");
      productNames.add(name2);
      return { name: name2 };
    }).sort((a, b) => compare(a.name, b.name));
    const description = string(field(item, "description"));
    const language2 = string(field(item, "language")) || detectLanguage(files, root);
    for (const value2 of array(field(item, "packageTools"))) {
      const tool = object(value2);
      string(field(tool, "name"));
      string(field(tool, "version"));
      for (const evidence of array(field(tool, "evidence")))
        string(evidence);
    }
    const tools = packageTools(files, root);
    const identity2 = repository(field(item, "repository"));
    const binding = {
      repository: repo ?? identity2,
      name,
      root,
      products,
      ...description ? { description } : {},
      ...language2 ? { language: language2 } : {},
      ...tools.length ? { packageTools: tools } : {}
    };
    return binding;
  }).sort((a, b) => compare(a.root, b.root));
  return { repository: repo, components: bindings };
}

// node_modules/@compforge/repocli/dist/git.js
var maxFileBytes = 2 << 20;
var maxTotalBytes = 128 << 20;
var Git = class {
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
    const root = await realpath2((await initial.run(["rev-parse", "--show-toplevel"])).toString().trimEnd());
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

// node_modules/@compforge/repocli/dist/git-state.js
import { existsSync, realpathSync } from "node:fs";
import { join as join2, resolve } from "node:path";
function currentBranch(repo) {
  const result = runGit(repo, ["branch", "--show-current"]);
  return result.ok && result.stdout ? result.stdout : void 0;
}
function aheadBehind(repo, target = "main") {
  const ahead = runGit(repo, ["rev-list", "--count", `origin/${target}..HEAD`]);
  const behind = runGit(repo, ["rev-list", "--count", `HEAD..origin/${target}`]);
  if (!ahead.ok || !behind.ok)
    return void 0;
  const values = [Number.parseInt(ahead.stdout, 10), Number.parseInt(behind.stdout, 10)];
  return values.every(Number.isFinite) ? values : void 0;
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
  const result = runGit(repo, ["rev-parse", "--verify", "--quiet", ref]);
  return result.ok ? result.stdout : "";
}
function headSha(repo) {
  const result = runGit(repo, ["rev-parse", "HEAD"]);
  return result.ok ? result.stdout : "";
}
function targetExists(repo, target = "main") {
  return revParse(repo, `origin/${target}`) !== "";
}
function isAncestor(repo, ancestor, descendant) {
  if (!ancestor || !descendant)
    return false;
  return ancestor === descendant || runGit(repo, ["merge-base", "--is-ancestor", ancestor, descendant]).code === 0;
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
function mainRepoRoot(repo) {
  try {
    return checkoutInfo(repo).mainRoot;
  } catch {
    return void 0;
  }
}
function worktreeMetadata(repo) {
  const gitDir = runGit(repo, ["rev-parse", "--git-dir"]);
  const commonDir = runGit(repo, ["rev-parse", "--git-common-dir"]);
  if (!gitDir.ok || !commonDir.ok || !gitDir.stdout || !commonDir.stdout)
    return { linked: false, commonDir: "" };
  const resolvedGit = resolve(repo, gitDir.stdout);
  const resolvedCommon = resolve(repo, commonDir.stdout);
  if (resolvedGit === resolvedCommon)
    return { linked: false, commonDir: "" };
  const mainBranch = listWorktrees(repo)[0]?.branch;
  return { linked: true, commonDir: resolvedCommon, ...mainBranch ? { mainBranch } : {} };
}

// node_modules/@compforge/repocli/dist/snapshot.js
import { createHash } from "node:crypto";
import { constants as constants2 } from "node:fs";
import { lstat as lstat2, open as open2, readlink, realpath as realpath3 } from "node:fs/promises";
import { dirname as dirname2, join as join3, posix as posix3 } from "node:path";
async function snapshot(repository2, options = {}) {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 3e4);
  const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
  const root = await realpath3((await new Git(repository2, signal).run(["rev-parse", "--show-toplevel"])).toString().trim());
  const first = await capture(root, signal, 0);
  const second = await capture(root, signal, 0);
  return first.digest === second.digest ? second : { ...second, complete: false, diagnostics: [...second.diagnostics, "snapshot_changed"] };
}
function frame(name, data) {
  return Buffer.concat([Buffer.from(`${Buffer.byteLength(name)}:${name}${data.length}:`), data]);
}
function sorted(names) {
  return [...names].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
}
async function capture(root, signal, depth) {
  const git = new Git(root, signal);
  const entries = /* @__PURE__ */ new Map();
  for (const record of (await git.run(["ls-files", "--stage", "-z"])).toString().split("\0")) {
    if (!record)
      continue;
    const tab = record.indexOf("	");
    const [mode, , stage] = record.slice(0, tab).split(" ");
    if (tab < 0 || stage !== "0")
      throw new Error("unmerged or invalid index");
    entries.set(record.slice(tab + 1), mode);
  }
  for (const name of (await git.run(["ls-files", "--others", "--exclude-standard", "-z"])).toString().split("\0")) {
    if (name && !name.endsWith("/") && !entries.has(name))
      entries.set(name, "");
  }
  if (entries.size > 1e4)
    throw new Error("repository exceeds 10000 files");
  const digest = createHash("sha256");
  const files = /* @__PURE__ */ new Set();
  const links = /* @__PURE__ */ new Map();
  const modules = /* @__PURE__ */ new Map();
  const large = /* @__PURE__ */ new Map();
  const issues = [];
  let total = 0;
  for (const name of sorted(entries.keys())) {
    signal.throwIfAborted();
    const path = join3(root, name);
    let info;
    try {
      info = await lstat2(path);
      if (await realpath3(dirname2(path)) !== dirname2(path)) {
        issues.push(`${name}: symlinked parent`);
        continue;
      }
    } catch (error) {
      if (error.code === "ENOENT")
        continue;
      throw error;
    }
    if (entries.get(name) === "160000") {
      if (depth >= 8 || !info.isDirectory()) {
        issues.push(`${name}: submodule unavailable or nesting limit`);
        continue;
      }
      try {
        await lstat2(join3(path, ".git"));
      } catch {
        issues.push(`${name}: submodule unavailable`);
        continue;
      }
      const child = await capture(path, signal, depth + 1);
      const oid = (await new Git(path, signal).run(["rev-parse", "HEAD"])).toString().trim();
      modules.set(name, `${oid}:${child.digest}`);
      issues.push(...child.diagnostics.map((issue) => `${name}/${issue}`));
    } else if (info.isSymbolicLink())
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
          digest.update(frame(name, Buffer.concat(chunks)));
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
    const captured = files.has(current) || [...modules.keys()].some((m) => current === m || current.startsWith(m + "/")) || current !== "" && [...files].some((f) => current === "." || f.startsWith(current + "/"));
    if (!captured)
      issues.push(`${name}: symlink target is outside captured contents or cyclic/missing`);
  }
  for (const [kind, values] of [["symlink", links], ["submodule", modules], ["large_file", large]]) {
    for (const name of sorted(values.keys()))
      digest.update(Buffer.concat([Buffer.from(kind + ":"), frame(name, Buffer.from(values.get(name)))]));
  }
  for (const issue of sorted(issues))
    digest.update(`issue:${Buffer.byteLength(issue)}:${issue}`);
  return { checkout: root, digest: `sha256:${digest.digest("hex")}`, fileCount: files.size, complete: issues.length === 0, diagnostics: issues };
}

// lib/ecosystem.ts
var BaseEcosystem = class {
  prepareCommand(_path) {
    return void 0;
  }
  environmentProblem(_path) {
    return void 0;
  }
  markPrepared(_path) {
  }
  fallbackTestCommand(_path) {
    return void 0;
  }
};
var GoEcosystem = class extends BaseEcosystem {
  name = "go";
  fallbackTestCommand() {
    return ["go", "test", "./..."];
  }
};
function hashFiles(path, names) {
  const hash = createHash2("sha256");
  for (const name of names) {
    hash.update(name);
    hash.update("\0");
    try {
      hash.update(readFileSync(join4(path, name)));
    } catch {
    }
    hash.update("\0");
  }
  return hash.digest("hex");
}
var NODE_LOCKFILES = [
  ["pnpm-lock.yaml", ["pnpm", "install", "--frozen-lockfile", "--prefer-offline"]],
  ["package-lock.json", ["npm", "ci", "--prefer-offline"]],
  ["yarn.lock", ["yarn", "install", "--immutable"]]
];
var NodeEcosystem = class extends BaseEcosystem {
  name = "node";
  lockfile(path) {
    return NODE_LOCKFILES.find(([name]) => existsSync2(join4(path, name)));
  }
  prepareCommand(path) {
    return this.lockfile(path)?.[1];
  }
  environmentProblem(path) {
    const lockfile = this.lockfile(path);
    const modules = join4(path, "node_modules");
    if (!existsSync2(modules)) {
      return lockfile ? "node_modules missing - in-repo worktrees can resolve dependencies from another checkout" : "node_modules missing and no supported lockfile exists - cannot prepare without changing project state";
    }
    if (!lockfile) return void 0;
    const marker = join4(modules, ".devloop-envhash");
    if (!existsSync2(marker)) return void 0;
    try {
      return readFileSync(marker, "utf8").trim() === hashFiles(path, ["package.json", lockfile[0]]) ? void 0 : "package.json or lockfile changed since devloop installed dependencies";
    } catch (error) {
      return `cannot read devloop environment fingerprint: ${String(error)}`;
    }
  }
  markPrepared(path) {
    const lockfile = this.lockfile(path);
    const modules = join4(path, "node_modules");
    if (lockfile && existsSync2(modules)) writeFileSync(join4(modules, ".devloop-envhash"), hashFiles(path, ["package.json", lockfile[0]]));
  }
};
var PythonEcosystem = class extends BaseEcosystem {
  name = "python";
  isUvManaged(path) {
    return existsSync2(join4(path, "pyproject.toml")) && existsSync2(join4(path, "uv.lock"));
  }
  prepareCommand(path) {
    return this.isUvManaged(path) ? ["uv", "sync", "--frozen"] : void 0;
  }
  environmentProblem(path) {
    if (!this.isUvManaged(path)) return void 0;
    const environment = join4(path, ".venv");
    if (!existsSync2(environment)) return ".venv missing - a stale VIRTUAL_ENV could run another checkout's editable install";
    const marker = join4(environment, ".devloop-envhash");
    if (!existsSync2(marker)) return void 0;
    try {
      return readFileSync(marker, "utf8").trim() === hashFiles(path, ["pyproject.toml", "uv.lock"]) ? void 0 : "pyproject.toml or uv.lock changed since devloop synced dependencies";
    } catch (error) {
      return `cannot read devloop environment fingerprint: ${String(error)}`;
    }
  }
  markPrepared(path) {
    const environment = join4(path, ".venv");
    if (this.isUvManaged(path) && existsSync2(environment)) writeFileSync(join4(environment, ".devloop-envhash"), hashFiles(path, ["pyproject.toml", "uv.lock"]));
  }
};
var ECOSYSTEMS = [new PythonEcosystem(), new GoEcosystem(), new NodeEcosystem()];
function detectEcosystem(language2) {
  const name = ["javascript", "typescript", "tsx", "jsx"].includes(language2 ?? "") ? "node" : language2;
  return ECOSYSTEMS.find((ecosystem) => ecosystem.name === name);
}

// lib/repocli.ts
import { realpathSync as realpathSync2, existsSync as existsSync3 } from "node:fs";
import { dirname as dirname3, join as join5, sep } from "node:path";
var InspectionError = class extends Error {
};
async function inspectRepository(repo) {
  try {
    const report = await inspect({ repository: repo, timeoutMs: 5e3 });
    if (!report.complete || report.diagnostics.length > 0) throw new Error("repository inspection incomplete");
    const checkout = realpathSync2(repo);
    for (const component of report.components) {
      let ancestor = join5(checkout, component.root);
      while (!existsSync3(ancestor)) ancestor = dirname3(ancestor);
      const resolved = realpathSync2(ancestor);
      if (resolved !== checkout && !resolved.startsWith(checkout + sep)) throw new Error("component root escapes checkout");
    }
    return report;
  } catch (error) {
    throw new InspectionError(`repository inspection unavailable: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

// domain/repo-layout.ts
var SAFE_SCOPE = /^[A-Za-z0-9_./@+][A-Za-z0-9_./@+:-]*$/;
var Component = class _Component {
  constructor(path, id, language2, name = "", packageTools2 = []) {
    this.name = name;
    this.packageTools = packageTools2;
    this.path = path;
    this.id = id;
    this.language = language2;
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
    return new _Component(join6(root, info.root), info.root, info.language, info.name, info.packageTools ?? []);
  }
  hasTarget(name, suffix = false) {
    try {
      const makefile = readFileSync2(join6(this.path, "Makefile"), "utf8");
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`^${escaped}${suffix ? "(-\\w+)?" : ""}\\s*:`, "m").test(makefile);
    } catch {
      return false;
    }
  }
  lintTarget() {
    return ["lint-ci", "lint"].find((target) => this.hasTarget(target));
  }
  testTarget() {
    return ["test", "test-ci", "test-local"].find((target) => this.hasTarget(target));
  }
  testCommand() {
    const target = this.testTarget();
    return target ? ["make", target] : detectEcosystem(this.language)?.fallbackTestCommand(this.path);
  }
  supportsLintFiles() {
    return this.makefileUses("LINT_FILES");
  }
  supportsTestFiles() {
    return this.makefileUses("TEST_FILES");
  }
  makefileUses(variable) {
    try {
      return new RegExp(`\\$\\(${variable}\\)|\\$\\{${variable}\\}`).test(readFileSync2(join6(this.path, "Makefile"), "utf8"));
    } catch {
      return false;
    }
  }
  focusedLintCommand(files, target = this.lintTarget()) {
    return target && files.length > 0 && this.supportsLintFiles() && files.every((path) => SAFE_SCOPE.test(path)) ? ["make", target, `LINT_FILES=${files.join(" ")}`] : void 0;
  }
  focusedTestCommand(files) {
    const target = this.testTarget();
    return target && files.length > 0 && this.supportsTestFiles() && files.every((path) => SAFE_SCOPE.test(path)) ? ["make", target, `TEST_FILES=${files.join(" ")}`] : void 0;
  }
};
function findGitRoot(path) {
  const result = runGit(path, ["rev-parse", "--show-toplevel"], 3e3);
  return result.ok && result.stdout ? result.stdout : void 0;
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
    const path = relative(this.root, resolve2(target)).replaceAll("\\", "/");
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
    throw new InspectionError("no default Component; select a declared component explicitly");
  }
};
async function inspectCatalog(root) {
  const checkout = realpathSync3(root);
  return new ComponentCatalog(checkout, await inspectRepository(checkout));
}
async function defaultComponent(root) {
  return (await inspectCatalog(root)).default();
}
function enclosingComponent(target, catalog) {
  return catalog.owner(target) ?? catalog.default();
}
function findAgentsDocument(repo, component) {
  return [component ? join6(component, "AGENTS.md") : "", join6(repo, "AGENTS.md")].find((path) => path && existsSync4(path));
}

// domain/context/workspace.ts
import { existsSync as existsSync8, lstatSync, readdirSync, realpathSync as realpathSync4 } from "node:fs";
import { join as join8, resolve as resolve6 } from "node:path";

// lib/git-state.ts
import { appendFileSync, existsSync as existsSync5, mkdirSync, readFileSync as readFileSync3 } from "node:fs";
import { dirname as dirname4, resolve as resolve3 } from "node:path";
var PROTECTED_BRANCHES = [/^main$/, /^master$/, /^release$/, /^release.*/, /.*release$/];
function isProtectedBranch(branch) {
  return branch !== void 0 && PROTECTED_BRANCHES.some((pattern) => pattern.test(branch));
}
function localDefaultTarget(repo) {
  const result = runGit(repo, ["symbolic-ref", "refs/remotes/origin/HEAD"]);
  const prefix = "refs/remotes/origin/";
  if (result.ok && result.stdout.startsWith(prefix)) return result.stdout.slice(prefix.length);
  if (targetExists(repo, "main")) return "main";
  if (targetExists(repo, "master")) return "master";
  return "main";
}
function ensureGitExclude(repo, pattern = "/.devloop/") {
  const result = runGit(repo, ["rev-parse", "--git-path", "info/exclude"]);
  if (!result.ok || !result.stdout) return;
  const path = resolve3(repo, result.stdout);
  try {
    mkdirSync(dirname4(path), { recursive: true });
    const existing = existsSync5(path) ? readFileSync3(path, "utf8") : "";
    if (existing.split("\n").some((line) => line.trim() === pattern.trim())) return;
    appendFileSync(path, `${existing && !existing.endsWith("\n") ? "\n" : ""}${pattern}
`, "utf8");
  } catch {
  }
}

// lib/parsers.ts
import { existsSync as existsSync6, readFileSync as readFileSync4 } from "node:fs";
import { basename as basename2, dirname as dirname5, isAbsolute, resolve as resolve4 } from "node:path";
function read(path) {
  if (!existsSync6(path)) return void 0;
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
      entries.push({ title, path: concretePath(link[2].trim(), dirname5(path)), description });
      continue;
    }
    const bare = /`([^`]+\.md)`/.exec(value);
    if (bare?.[1]) {
      const description = `${value.slice(0, bare.index)} ${value.slice(bare.index + bare[0].length)}`.replace(/[:：—-]+/g, " ").trim();
      entries.push({ title: basename2(bare[1]), path: concretePath(bare[1], dirname5(path)), description: description || basename2(bare[1]) });
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

// domain/context/store.ts
import { appendFileSync as appendFileSync2, existsSync as existsSync7, mkdirSync as mkdirSync2, readFileSync as readFileSync5, renameSync, statSync, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname as dirname6, join as join7, parse, resolve as resolve5 } from "node:path";
var STATE_DIRECTORY_NAME = ".devloop";
var WORKSPACE_STATE_FILE = "context.json";
var stateRoots = /* @__PURE__ */ new Map();
function sharedStateRoot(root) {
  const path = join7(root, ".git");
  if (!existsSync7(path)) return root;
  const metadata = statSync(path);
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
  return join7(sharedStateRoot(resolve5(root)), STATE_DIRECTORY_NAME);
}
function workingTreeStateDirectory(root) {
  return join7(resolve5(root), STATE_DIRECTORY_NAME);
}
function branchSegment(branch, name) {
  return `branches/${branch ?? "@detached"}/${name}`;
}
function workspaceStateFile(root) {
  return join7(stateDirectory(root), WORKSPACE_STATE_FILE);
}
function segmentFile(root, name) {
  return join7(stateDirectory(root), `${name}.json`);
}
function atomicWrite(path, data) {
  try {
    mkdirSync2(dirname6(path), { recursive: true });
    const temporary = join7(dirname6(path), `${parse(path).base}.${process.pid}.tmp`);
    writeFileSync2(temporary, JSON.stringify(data, null, 2), "utf8");
    renameSync(temporary, path);
  } catch {
  }
}
function readJson(path) {
  if (!existsSync7(path)) return void 0;
  try {
    const value = JSON.parse(readFileSync5(path, "utf8"));
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
function appendLedger(root, name, record) {
  try {
    const path = join7(stateDirectory(root), `${name}.jsonl`);
    mkdirSync2(dirname6(path), { recursive: true });
    appendFileSync2(path, `${JSON.stringify(record)}
`, "utf8");
  } catch {
  }
}

// domain/context/workspace.ts
var DISCOVERY_SKIP = /* @__PURE__ */ new Set(["docs", "worktrees", "worktree", "node_modules"]);
function isGitRepository(path) {
  return existsSync8(join8(path, ".git"));
}
function discoverSubprojectNames(root) {
  try {
    return readdirSync(root).filter((name) => {
      if (name.startsWith(".") || DISCOVERY_SKIP.has(name)) return false;
      const path = join8(root, name);
      try {
        return (lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink()) && isGitRepository(path);
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
    const path = join8(root, name);
    let canonical;
    try {
      const real = realpathSync4(path);
      if (real !== resolve6(path)) canonical = real;
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
    const record = loadWorkspace(root);
    if (!record) return void 0;
    const references = (record.agents_md?.references ?? []).map((reference2) => ({
      title: reference2.title ?? "",
      path: reference2.path ?? "",
      ...reference2.hook ? { hook: reference2.hook } : {}
    }));
    return new _WorkspaceContext(
      record.workspace_root || resolve6(root),
      { ...record.agents_md?.path ? { path: record.agents_md.path } : {}, references },
      record.subprojects.map((entry) => ({
        name: entry.name ?? "",
        path: entry.path ?? "",
        aliases: entry.aliases ?? [],
        ...entry.language ? { language: entry.language } : {},
        ...entry.role ? { role: entry.role } : {},
        ...entry.canonical ? { canonical: entry.canonical } : {}
      })),
      record.parsed_at || 0
    );
  }
  static refresh(rootValue) {
    const root = resolve6(rootValue);
    const agentsPath = join8(root, "AGENTS.md");
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
    if (existsSync8(join8(this.workspaceRoot, ".git"))) ensureGitExclude(this.workspaceRoot);
  }
  isStale(ttl = WORKSPACE_STALE_SECONDS) {
    return stale(this.parsedAt || void 0, ttl);
  }
};

// domain/context/session.ts
import { closeSync, existsSync as existsSync9, mkdirSync as mkdirSync3, openSync, readFileSync as readFileSync6, readdirSync as readdirSync2, renameSync as renameSync2, statSync as statSync2, unlinkSync, writeFileSync as writeFileSync3 } from "node:fs";
import { basename as basename3, dirname as dirname7, join as join9, resolve as resolve7 } from "node:path";
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
  return join9(workingTreeStateDirectory(repo), "owner.lock");
}
function legacyLockFile(repo, harness) {
  return join9(workingTreeStateDirectory(repo), `${safeHarness(harness)}.owner.lock`);
}
function readOwnerFile(path) {
  try {
    const value = JSON.parse(readFileSync6(path, "utf8"));
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
      const owner2 = readOwnerFile(join9(workingTreeStateDirectory(repo), name));
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
  const record = { harness, session_id: identity2.sessionId, pid, branch, acquired_at: at };
  const owner2 = anyActiveOwner(repo, at);
  if (owner2?.session_id === identity2.sessionId && owner2.harness === harness) {
    try {
      const temporary = `${path}.${process.pid}.tmp`;
      writeFileSync3(temporary, JSON.stringify(record));
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
    if (existsSync9(path)) unlinkSync(path);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const descriptor = openSync(path, "wx", 420);
        writeFileSync3(descriptor, JSON.stringify(record));
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
  return basename3(repo);
}
function sessionName(sessionId2) {
  return (sessionId2 ?? identityFromEnvironment().sessionId).replace(/[^A-Za-z0-9._-]/g, "-") || "anon";
}
function activeRepoFile(workspaceRoot2, sessionId2) {
  return join9(stateDirectory(workspaceRoot2), "active", `${sessionName(sessionId2)}.json`);
}
function activeBinding(path, enforceTtl) {
  try {
    const value = JSON.parse(readFileSync6(path, "utf8"));
    if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
    const row = value;
    if (typeof row.repo_dir !== "string" || !existsSync9(row.repo_dir)) return void 0;
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
    mkdirSync3(dirname7(path), { recursive: true });
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync3(temporary, JSON.stringify({ repo_dir: resolve7(repo), ts: now() }));
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
import { existsSync as existsSync10, mkdirSync as mkdirSync4, readFileSync as readFileSync7, renameSync as renameSync3, statSync as statSync3, utimesSync, writeFileSync as writeFileSync4 } from "node:fs";
import { join as join10 } from "node:path";
var TOOL_CALL_SCHEMA = "devloop.tool-call/v1";
var FILE_NAME = "tool-calls.jsonl";
var WINDOW_SECONDS = 3600;
var COMPACT_INTERVAL_SECONDS = 60;
function appendToolCall(root, record, at = Date.now() / 1e3) {
  const directory = stateDirectory(root);
  const path = join10(directory, FILE_NAME);
  const marker = join10(directory, "tool-calls.compact");
  try {
    mkdirSync4(directory, { recursive: true });
    const due = !existsSync10(marker) || at - statSync3(marker).mtimeMs / 1e3 >= COMPACT_INTERVAL_SECONDS;
    if (due) {
      compact(path, at - WINDOW_SECONDS);
      writeFileSync4(marker, "", { flag: "a" });
      utimesSync(marker, at, at);
    }
    appendLedger(root, "tool-calls", record);
  } catch {
  }
}
function toolCallStartedAt(root, callId, at = Date.now() / 1e3) {
  if (!callId) return void 0;
  try {
    const rows2 = readFileSync7(join10(stateDirectory(root), FILE_NAME), "utf8").trimEnd().split("\n").reverse();
    for (const row of rows2) {
      let value;
      try {
        value = JSON.parse(row);
      } catch {
        continue;
      }
      if (value === null || typeof value !== "object" || Array.isArray(value)) continue;
      const record = value;
      if (typeof record.ts !== "number") continue;
      if (record.ts < at - WINDOW_SECONDS) break;
      if (record.schema === TOOL_CALL_SCHEMA && record.phase === "started" && record.call_id === callId) return record.ts;
    }
  } catch {
  }
  return void 0;
}
function compact(path, cutoff) {
  if (!existsSync10(path)) return;
  try {
    const retained = readFileSync7(path, "utf8").split("\n").flatMap((line) => {
      try {
        const record = JSON.parse(line);
        return record !== null && typeof record === "object" && !Array.isArray(record) && typeof record.ts === "number" && record.ts >= cutoff ? [JSON.stringify(record)] : [];
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
import { existsSync as existsSync12, statSync as statSync4 } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { join as join12, resolve as resolve9 } from "node:path";

// lib/config.ts
import { existsSync as existsSync11, mkdirSync as mkdirSync5, readFileSync as readFileSync8, renameSync as renameSync4, writeFileSync as writeFileSync5 } from "node:fs";
import { homedir } from "node:os";
import { dirname as dirname8, isAbsolute as isAbsolute2, join as join11, resolve as resolve8 } from "node:path";
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
  },
  worktree: { keep_recent: 5 }
};
function object2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function expandPath(value) {
  let expanded = value.startsWith("~") ? join11(homedir(), value.slice(1)) : value;
  expanded = expanded.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, braced, bare) => process.env[braced || bare] ?? "");
  return expanded;
}
function configDirectory() {
  return process.env.DEVLOOP_CONFIG_DIR ? expandPath(process.env.DEVLOOP_CONFIG_DIR) : join11(homedir(), ".devloop");
}
function configFile() {
  return join11(configDirectory(), "config.json");
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
    const parsed = JSON.parse(readFileSync8(path, "utf8"));
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : void 0;
  } catch {
    return void 0;
  }
}
function ancestorFiles(root) {
  const global = resolve8(configFile());
  const home = resolve8(homedir());
  const found = [];
  let current = root;
  while (true) {
    const candidate = join11(current, ".devloop", "config.json");
    if (resolve8(candidate) !== global && existsSync11(candidate)) found.push(candidate);
    if (current === home || current === dirname8(current)) break;
    current = dirname8(current);
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
  const checkout = repo ? resolve8(expandPath(repo)) : void 0;
  const repoKeys = checkout ? [...new Set([mainRepoRoot(checkout), checkout].filter((path) => path !== void 0))] : [];
  const files = [...new Set(repoKeys.flatMap(ancestorFiles))];
  const global = deepMerge(DEFAULTS, readJson2(configFile()) ?? {});
  let result = resolveLayer(global, repoKeys);
  for (const path of files) result = deepMerge(result, resolveLayer(readJson2(path) ?? {}, repoKeys));
  result.workspaces = global.workspaces ?? [];
  return result;
}
function saveConfig(data) {
  const path = configFile();
  mkdirSync5(dirname8(path), { recursive: true });
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
function lifecycleConfig(repo) {
  return object2(object2(loadConfig(repo).lifecycle).default);
}
function architectureConfig(repo) {
  return object2(object2(loadConfig(repo).arch).default);
}

// domain/workspace.ts
function reserved(path) {
  const root = resolve9(path);
  return [
    process.env.CODEX_HOME ?? join12(homedir2(), ".codex"),
    process.env.CLAUDE_HOME ?? join12(homedir2(), ".claude")
  ].some((candidate) => resolve9(expandPath(candidate)) === root);
}
function registeredWorkspaces() {
  return workspaces().map((path) => resolve9(path)).filter((path) => !reserved(path));
}
function registerWorkspace(path) {
  const root = resolve9(expandPath(path));
  if (reserved(root)) return;
  const current = [...registeredWorkspaces()];
  if (!current.includes(root)) setWorkspaces([...current, root]);
}
function maybeRegisterWorkspace(path) {
  const root = resolve9(path);
  if (reserved(root) || !existsSync12(root) || !statSync4(root).isDirectory() || existsSync12(join12(root, ".git"))) return void 0;
  const agents = join12(root, "AGENTS.md");
  if (!existsSync12(agents)) return void 0;
  if (discoverSubprojectNames(root).length === 0 && parseSubprojectsSection(agents).length === 0) return void 0;
  registerWorkspace(root);
  return root;
}
function findContainingWorkspace(path) {
  const target = resolve9(path);
  return registeredWorkspaces().find((root) => target === root || target.startsWith(`${root}/`));
}

// domain/board/delivery.ts
import { unlinkSync as unlinkSync2 } from "node:fs";

// domain/board/render.ts
import { basename as basename4 } from "node:path";
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
  const base = basename4(path);
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
    return `[Current repo: ${text(payload.codeDir) || text(payload.repoRoot)} (${text(payload.language) || "?"})] | Branch: ${text(payload.branch) || "?"}${payload.linkedWorktree ? " (worktree)" : ""} (ahead ${number(payload.ahead)}, behind ${number(payload.behind)} vs ${text(payload.baseBranch)}, target=${text(payload.targetBranch)}) | Workspace: ${dirty}${warnings.length ? ` \u26A0\uFE0F ${warnings.join("; ")}` : ""}`;
  }
  if (item.type === "repo.validation") {
    const components = rows(payload.components);
    const history = components.length === 0 ? "Validation history: no recorded runs" : `Validation: ${components.map((row) => `${text(row.component)}: lint=${formatTimestamp(typeof row.lintAt === "number" ? row.lintAt : void 0)}, test=${formatTimestamp(typeof row.testAt === "number" ? row.testAt : void 0)}`).join(" | ")}`;
    const analysis = payload.analysis;
    const scopes = rows(analysis?.checks).map((row) => `${text(row.component)} ${text(row.check)}=${text(row.scope)} (${text(row.reason)})`);
    return [history, ...scopes.length ? [`Latest validation scope: ${scopes.join(" | ")}`] : []].join("\n");
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
      unlinkSync2(segmentFile(this.root, this.segment()));
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

// domain/board/model.ts
import { createHash as createHash3 } from "node:crypto";
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
    signature: createHash3("sha1").update(JSON.stringify(stable(identity2))).digest("hex")
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
  try {
    component = await defaultComponent(repo);
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
  const branch = currentBranch(repo) ?? "";
  const base = localDefaultTarget(repo);
  const [ahead, behind] = aheadBehind(repo, base) ?? [0, 0];
  const status = workspaceStatus(repo);
  const codeDir = component?.path ?? "";
  items.push(boardItem("repo.identity", "state", scope, {
    codeDir,
    repoRoot: repo,
    language: component?.language ?? "",
    inspectionProblem,
    branch,
    linkedWorktree: worktreeMetadata(repo).linked,
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
  const lint = loadSegment(repo, branchSegment(branch || void 0, "lint")) ?? {};
  const test = loadSegment(repo, branchSegment(branch || void 0, "test")) ?? {};
  const componentIds = [.../* @__PURE__ */ new Set([...Object.keys(lint), ...Object.keys(test)])].sort();
  items.push(boardItem("repo.validation", "state", scope, {
    analysis: loadSegment(repo, branchSegment(branch || void 0, "validation_scope")) ?? {},
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
import { basename as basename5, isAbsolute as isAbsolute3, resolve as resolve10 } from "node:path";
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
  if (["git", "go", "make"].includes(basename5(argv[0]))) {
    const index = argv.indexOf("-C");
    if (index >= 0 && argv[index + 1]) {
      const configuredPath = argv[index + 1];
      dashC = configuredPath;
      const path = isAbsolute3(configuredPath) ? configuredPath : base.path ? resolve10(base.path, configuredPath) : void 0;
      workingDirectory = { ...path ? { path } : {}, source: "git -C" };
      if (basename5(argv[0]) === "git") argv = [...argv.slice(0, index), ...argv.slice(index + 2)];
    }
  }
  let subcommand;
  let args = argv.slice(1);
  if (basename5(argv[0]) === "git") {
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
      const path = isAbsolute3(words[1]) ? words[1] : current.path ? resolve10(current.path, words[1]) : void 0;
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
        path: isAbsolute3(target.path) || !current.path ? target.path : resolve10(current.path, target.path)
      });
    }
  }
  return targets;
}
function wrappedCommand(words) {
  const executable = basename5(words[0] ?? "");
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
    const path = configured ? isAbsolute3(configured) ? configured : resolve10(cwd2, configured) : input.harness === "codex" && toolName === "Bash" ? void 0 : cwd2;
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
import { dirname as dirname9, isAbsolute as isAbsolute4, resolve as resolve11 } from "node:path";
var PolicyContext = class _PolicyContext {
  constructor(cwd2, identity2, anchorPath = "", inspections = /* @__PURE__ */ new Map()) {
    this.inspections = inspections;
    this.cwd = cwd2;
    this.identity = identity2;
    this.anchorPath = anchorPath ? isAbsolute4(anchorPath) ? anchorPath : resolve11(cwd2, anchorPath) : "";
    this.anchorDirectory = this.anchorPath ? dirname9(this.anchorPath) : cwd2;
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
    const key = resolve11(repo);
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
import { basename as basename7, dirname as dirname10, extname, join as join14, resolve as resolve13 } from "node:path";

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

// domain/context/gate.ts
function pullRequest(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
  const row = value;
  if (typeof row.number !== "number") return void 0;
  return {
    number: row.number,
    title: typeof row.title === "string" ? row.title : "",
    state: row.state === "open" || row.state === "merged" || row.state === "closed" ? row.state : "",
    sourceBranch: typeof row.source_branch === "string" ? row.source_branch : "",
    targetBranch: typeof row.target_branch === "string" ? row.target_branch : "",
    webUrl: typeof row.web_url === "string" ? row.web_url : "",
    sha: typeof row.sha === "string" ? row.sha : "",
    ...typeof row.updated_at === "string" ? { updatedAt: row.updated_at } : {}
  };
}
function evaluateGate(repo) {
  const branch = currentBranch(repo);
  const head = headSha(repo);
  const target = localDefaultTarget(repo);
  const segment = loadSegment(repo, "pr") ?? {};
  const rows2 = Array.isArray(segment.prs) ? segment.prs : [];
  const candidates = rows2.map(pullRequest).filter((pr) => pr !== void 0 && pr.sourceBranch === branch);
  const activePullRequest = candidates.find(pullRequestOpen) ?? candidates.find((pr) => !pr.sha || isAncestor(repo, pr.sha, head));
  return {
    ...branch ? { branch } : {},
    head,
    target,
    ...typeof segment.provider === "string" ? { provider: segment.provider } : {},
    ...activePullRequest ? { activePullRequest } : {},
    protected: isProtectedBranch(branch),
    inactive: activePullRequest ? pullRequestInactive(activePullRequest) : false,
    inFlight: activePullRequest ? pullRequestOpen(activePullRequest) : false
  };
}

// domain/repo.ts
import { realpathSync as realpathSync5 } from "node:fs";
import { basename as basename6, join as join13, resolve as resolve12 } from "node:path";
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
    const owner2 = catalog.owner(join13(catalog.root, path));
    if (owner2) byId.set(owner2.id, owner2);
  }
  return [...byId.values()];
}
function selectComponents(rootValue, options) {
  const root = realpathSync5(rootValue);
  const catalog = options.catalog;
  if (catalog.components.length === 0) throw new InspectionError("repocli inspect returned no Components for validation");
  if (options.explicit) {
    const explicit = resolve12(options.explicit);
    if (explicit !== root && explicit.startsWith(`${root}/`)) {
      const component = enclosingComponent(explicit, catalog);
      return { components: [component], reason: `explicit target ${basename6(explicit)} -> component ${basename6(component.path)}` };
    }
  }
  if (options.paths !== void 0) {
    const components = projectComponents(options.paths, catalog);
    return components.length === 0 ? { components: [], reason: "no changed files in scope" } : { components, reason: `changed files under: ${components.map((item) => basename6(item.path)).join(", ")}` };
  }
  const dirty = projectComponents(changedPaths2(root), catalog);
  if (dirty.length > 0) return { components: dirty, reason: `changed files under: ${dirty.map((item) => basename6(item.path)).join(", ")}` };
  const all = catalog.components;
  return { components: all, reason: `clean tree, all components: ${all.map((item) => basename6(item.path)).join(", ")}` };
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
    const primary = repo ? listWorktrees(repo)[0]?.path ?? repo : "<repo>";
    return finding("worktree-add", `Direct \`git worktree add\` bypasses devloop lifecycle policy. Use \`python3 "<PLUGIN_ROOT>/scripts/checkout.py" ${basename7(primary)} --worktree <tag>\`.`, commandLine(command(target)));
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
  targetKind: "command",
  applies: (target) => ["commit", "push"].includes(command(target).subcommand ?? ""),
  check: (target) => {
    const value = command(target);
    const runDirectory = value.workingDirectory.path;
    const repo = runDirectory ? findGitRoot(runDirectory) : void 0;
    if (!repo) return [];
    const gate = evaluateGate(repo);
    if (!gate.protected || value.subcommand === "push" && tagOnlyPush(value.args, repo)) return [];
    return finding("protect-branch", `Refusing \`git commit/push\` on protected branch '${gate.branch ?? "?"}'. Create a feature branch with the devloop branch command first.`, commandLine(value));
  }
};
var checkoutOwner = {
  name: "checkout-owner",
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
  const base = basename7(argv[0] ?? "");
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
    const component = enclosingComponent(runDirectory, await context.catalog(repo)).path;
    if (!existsSync13(join14(component, "pyproject.toml")) || !existsSync13(join14(component, "uv.lock"))) return [];
    return finding("pip-install", "This component is uv-managed. Use `uv add` or `uv sync`; direct `pip install` bypasses pyproject.toml and uv.lock.", commandLine(value));
  }
};
function pytestInvocation(argv) {
  let args = [...argv];
  if (args[0] === "uv" && args[1] === "run") args = args.slice(2);
  const base = basename7(args[0] ?? "");
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
    const component = enclosingComponent(runDirectory, await context.catalog(repo));
    return component.hasTarget("test", true) ? finding("pytest-naked", `Use the project's canonical test target: cd ${component.path} && make test`, commandLine(value)) : [];
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
  const base = basename7(value.argv[0] ?? "");
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
  targetKind: "file_change",
  applies: () => true,
  check: (target, context) => {
    if (!context.gitRoot) return [];
    const gate = evaluateGate(context.gitRoot);
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
    if (basename7(path) !== "requirements.txt") return [];
    const parent = dirname10(path);
    return existsSync13(join14(parent, "pyproject.toml")) || existsSync13(join14(dirname10(parent), "pyproject.toml")) ? finding("requirements-edit", `\`${path}\` is generated dependency output. Edit pyproject.toml, then regenerate it with uv.`, file(target).path) : [];
  }
};
function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
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
      if (!component.lintTarget()) return [`  ${component.id}: lint entrypoint unavailable.`];
      const raw = lint[component.id];
      const stamp = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
      if (typeof stamp.passed_at !== "number") return [`  ${component.id}: lint has never run for this branch.`];
      return !fingerprint || typeof stamp.fingerprint !== "string" || stamp.fingerprint !== fingerprint ? [`  ${component.id}: content changed since its last lint pass.`] : [];
    });
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
  if (basename8(path) !== "AGENTS.md") return;
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
      anchors.push(dirname11(path));
    } else if (target.workingDirectory.path) anchors.push(target.workingDirectory.path);
  }
  for (const key of ["file_path", "notebook_path", "path"]) {
    const value = toolInput[key];
    if (typeof value !== "string" || !value.trim()) continue;
    const path = isAbsolute5(value) ? value : resolve14(directory, value);
    anchors.push(dirname11(path));
  }
  if (anchors.length === 0) anchors.push(directory);
  const timestamp = Date.now() / 1e3;
  const callId = string2(payload.tool_use_id);
  const phase = event === "PreToolUse" ? "started" : "finished";
  for (const root of new Set(anchors.flatMap((anchor) => findGitRoot(anchor) ?? []))) {
    const record = {
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
      record.outcome = event === "PostToolUseFailure" || harness === "codex" && codexToolFailed(payload) ? "failed" : "succeeded";
      const started = toolCallStartedAt(root, callId, timestamp);
      if (started !== void 0) record.duration_ms = Math.max(0, Math.round((timestamp - started) * 1e3));
    }
    appendToolCall(root, record, timestamp);
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
  for (const repo of [...candidates]) for (const worktree of listWorktrees(repo)) candidates.add(worktree.path);
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
