"""Plain-text line diff for governance version comparison.

No HTML rendering and no medical interpretation — this only reports textual
differences between two version bodies so a reviewer can see what changed.
"""

from __future__ import annotations

import difflib

from app.schemas.knowledge_governance import KnowledgeDiffLine

MAX_DIFF_LINES = 4_000


class KnowledgeDiffService:
    def diff(self, from_text: str, to_text: str) -> tuple[list[KnowledgeDiffLine], bool]:
        from_lines = (from_text or "").splitlines()
        to_lines = (to_text or "").splitlines()
        truncated = len(from_lines) > MAX_DIFF_LINES or len(to_lines) > MAX_DIFF_LINES
        from_lines = from_lines[:MAX_DIFF_LINES]
        to_lines = to_lines[:MAX_DIFF_LINES]

        matcher = difflib.SequenceMatcher(a=from_lines, b=to_lines, autojunk=False)
        result: list[KnowledgeDiffLine] = []
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == "equal":
                for a, b in zip(from_lines[i1:i2], to_lines[j1:j2], strict=True):
                    result.append(KnowledgeDiffLine(op="equal", from_line=a, to_line=b))
            elif tag == "delete":
                for a in from_lines[i1:i2]:
                    result.append(KnowledgeDiffLine(op="delete", from_line=a, to_line=None))
            elif tag == "insert":
                for b in to_lines[j1:j2]:
                    result.append(KnowledgeDiffLine(op="insert", from_line=None, to_line=b))
            elif tag == "replace":
                for a in from_lines[i1:i2]:
                    result.append(KnowledgeDiffLine(op="delete", from_line=a, to_line=None))
                for b in to_lines[j1:j2]:
                    result.append(KnowledgeDiffLine(op="insert", from_line=None, to_line=b))
        return result, truncated
