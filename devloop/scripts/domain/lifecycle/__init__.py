"""Lifecycle actions and background review signals.

Project validation is an explicit repocli command, initiated by the AI following skills.
Lifecycle actions do not run format/lint/test or consume validation evidence as a gate.
"""
from __future__ import annotations

from .base import (
    PHASES,
    BackgroundSpec,
    DispatchResult,
    HookResult,
    dispatch,
    resolve_handler,
)
