"""Development workflow configuration, with global and checkout-local policy layers.

Repository access belongs to RepoKit. This loader owns workspaces, lifecycle,
architecture, review and explicit pull_request.target_repository policy only.
"""
from __future__ import annotations

import json
import os
from pathlib import Path


from .git_state import main_repo_root

# Section defaults — every load() deep-merges real layers over these, so a partial
# config (e.g. only `workspaces`) still yields sane lifecycle policies.
_DEFAULTS: dict = {
    "workspaces": [],
    # devops 生命周期 hook：相位 → [hook 名]。opt-in，默认全空 = dispatch 每相位 no-op、零行为
    # 变化。domain.lifecycle.dispatch 读它决定每个相位跑哪些 hook。
    "lifecycle": {
        "default": {"pre_commit": [], "post_commit": []},
        "repos": {},
    },
    # 代码策略引擎的架构/层级规则。enabled 默认 False：opt-in per repo，装上不按猜的层映射误拦。
    "arch": {
        "default": {
            "enabled": False,
            "layers": {"/api/": "api", "/service/": "service", "/dao/": "dao", "/model/": "model"},
            "order": ["api", "service", "dao", "model"],
        },
        "repos": {},
    },
}

_LOCAL_NAME = ".devloop"


def _expand(p: str) -> str:
    return os.path.expanduser(os.path.expandvars(p))


def config_dir() -> Path:
    """Global config dir — survives plugin version switches."""
    env = os.environ.get("DEVLOOP_CONFIG_DIR")
    if env:
        return Path(_expand(env))
    return Path.home() / ".devloop"


def config_file() -> Path:
    """The global, writable config file."""
    return config_dir() / "config.json"


def plugin_root() -> Path:
    """Resolve plugin root from CLI-provided plugin root env or relative fallback.

    CLI-agnostic: any CLI exporting a plugin-root alias works; the relative
    fallback (this file at `<plugin_root>/scripts/lib/config.py`) covers the rest.
    """
    env_root = os.environ.get("PLUGIN_ROOT") or os.environ.get("CLAUDE_PLUGIN_ROOT")
    if env_root:
        return Path(env_root)
    return Path(__file__).resolve().parents[2]


# ── read / write ─────────────────────────────────────────────────────────────
def load(repo_dir: str | Path | None = None) -> dict:
    """逐字段向上补全：全局 < 主仓库 < 当前 checkout；显式空列表和 False 不回退。

    Git 识别主仓库，祖先配置文件只加载一次。default/repos 在每个来源内部解析，
    避免全局仓库策略压过本地配置；返回的 lifecycle/arch.default 已是有效策略。
    workspaces 始终只取全局；不传 repo_dir 时只读取内置默认值和全局配置。
    """
    checkout = os.path.abspath(_expand(str(repo_dir))) if repo_dir else None
    # Configuration also applies outside Git; unavailable ancestry uses explicit paths.
    try:
        main = main_repo_root(checkout) if checkout else None
    except OSError:
        main = None
    repo_keys = list(dict.fromkeys(p for p in (main, checkout) if p))
    files = dict.fromkeys(f for root in repo_keys for f in _ancestor_files(root))
    global_config = _deep_merge(_DEFAULTS, _read_global())
    out = _resolve_layer(global_config, repo_keys)
    for path in files:
        out = _deep_merge(out, _resolve_layer(_read_json(path) or {}, repo_keys))
    out["workspaces"] = global_config["workspaces"]
    return out


def save(data: dict) -> None:
    """Persist to the GLOBAL file. Local overrides are hand-authored, never written here."""
    path = config_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    _atomic_write(path, json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def update(mutate) -> dict:
    """Read-modify-write the GLOBAL config, preserving all sections. `mutate(d)` edits in place."""
    data = _deep_merge(_DEFAULTS, _read_global())
    mutate(data)
    save(data)
    return data


# ── section accessors ────────────────────────────────────────────────────────
def workspaces() -> list[str]:
    # The workspace registry is a global-only discovery concern — not subject to
    # per-repo override (a repo declaring "which dirs are workspaces" is nonsensical).
    return [_expand(p) for p in (_deep_merge(_DEFAULTS, _read_global())).get("workspaces", []) if isinstance(p, str)]


def set_workspaces(ws: list[str]) -> None:
    update(lambda d: d.__setitem__("workspaces", list(ws)))


def pull_request_target(repo_dir: str | Path | None = None) -> str | None:
    """The workflow's explicit proposal destination, independent of access settings."""
    value = (load(repo_dir).get("pull_request") or {}).get("target_repository")
    return value if isinstance(value, str) and value else None


def lifecycle(repo_dir: str | Path | None = None) -> dict:
    """返回 load 已解析的 phase → [hook 名]；默认全空，每相位 no-op。"""
    return (load(repo_dir).get("lifecycle") or {}).get("default") or {}


def arch(repo_dir: str | Path | None = None) -> dict:
    """返回 load 已解析的架构规则（layer 映射、方向序和开关）。"""
    return (load(repo_dir).get("arch") or {}).get("default") or {}


# ── internals ────────────────────────────────────────────────────────────────
def _read_global() -> dict:
    """Global layer: `~/.devloop/config.json` (or `$DEVLOOP_CONFIG_DIR`). `{}` if absent."""
    return _read_json(config_file()) or {}


def _resolve_layer(layer: dict, repo_keys: list[str]) -> dict:
    """Resolve path-keyed policy within one source before applying closer sources."""
    out = dict(layer)
    for name in ("lifecycle", "arch"):
        if name not in layer:
            continue
        section = layer[name] if isinstance(layer[name], dict) else {}
        default = section.get("default")
        policy = dict(default) if isinstance(default, dict) else {}
        repos = section.get("repos")
        overrides = repos if isinstance(repos, dict) else {}
        for key in repo_keys:
            override = overrides.get(key)
            if isinstance(override, dict):
                policy = _deep_merge(policy, override)
        out[name] = {**section, "default": policy}
    return out


def _ancestor_files(root: str) -> list[Path]:
    """Ancestor `.devloop/config.json` files from root upward, shallow→deep so the
    closest (deepest) wins when deep-merged last. Excludes the global file; bounded at $HOME."""
    glob = config_file()
    home = Path.home()
    found: list[Path] = []
    start = Path(root)
    for anc in [start, *start.parents]:
        f = anc / _LOCAL_NAME / "config.json"
        if f != glob and f.is_file():
            found.append(f)
        if anc == home:
            break
    found.reverse()
    return found


def _read_json(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        d = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return d if isinstance(d, dict) else None


def _deep_merge(base: dict, over: dict) -> dict:
    out = dict(base)
    for k, v in over.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def _atomic_write(path: Path, content: str) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    tmp.replace(path)
