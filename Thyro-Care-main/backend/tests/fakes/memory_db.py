"""Minimal async in-memory Mongo stand-in for auth tests."""

from __future__ import annotations

from copy import deepcopy
from typing import Any
from uuid import uuid4

from bson import ObjectId


class _Cursor:
    def __init__(self, docs: list[dict[str, Any]]) -> None:
        self._docs = docs
        self._i = 0

    def sort(self, *_args: Any, **_kwargs: Any) -> _Cursor:
        return self

    def skip(self, n: int) -> _Cursor:
        self._docs = self._docs[n:]
        return self

    def limit(self, n: int) -> _Cursor:
        self._docs = self._docs[:n]
        return self

    async def to_list(self, length: int | None = None) -> list[dict[str, Any]]:
        if length is None:
            return [deepcopy(d) for d in self._docs]
        return [deepcopy(d) for d in self._docs[:length]]

    def __aiter__(self) -> _Cursor:
        self._i = 0
        return self

    async def __anext__(self) -> dict[str, Any]:
        if self._i >= len(self._docs):
            raise StopAsyncIteration
        doc = self._docs[self._i]
        self._i += 1
        return deepcopy(doc)


class MemoryCollection:
    def __init__(self) -> None:
        self.docs: list[dict[str, Any]] = []

    def _matches(self, doc: dict[str, Any], query: dict[str, Any]) -> bool:
        for key, expected in query.items():
            actual = doc.get(key)
            if isinstance(expected, dict):
                if "$ne" in expected and actual == expected["$ne"]:
                    return False
                if "$gt" in expected:
                    if actual is None or not (actual > expected["$gt"]):
                        return False
                if "$gte" in expected:
                    if actual is None or not (actual >= expected["$gte"]):
                        return False
                if "$lte" in expected:
                    if actual is None or not (actual <= expected["$lte"]):
                        return False
                if "$lt" in expected:
                    if actual is None or not (actual < expected["$lt"]):
                        return False
                continue
            if actual != expected:
                return False
        return True

    async def find_one(self, query: dict[str, Any]) -> dict[str, Any] | None:
        for doc in self.docs:
            if self._matches(doc, query):
                return deepcopy(doc)
        return None

    def find(self, query: dict[str, Any], projection: dict[str, Any] | None = None) -> _Cursor:
        matched = [deepcopy(d) for d in self.docs if self._matches(d, query)]
        if projection:
            keep = {k for k, v in projection.items() if v}
            matched = [{k: d[k] for k in d if k in keep or k == "_id"} for d in matched]
        return _Cursor(matched)

    async def insert_one(self, document: dict[str, Any]) -> Any:
        payload = deepcopy(document)
        if "_id" not in payload or payload["_id"] is None:
            payload["_id"] = ObjectId()
        # unique email simulation
        if "email_normalized" in payload:
            for existing in self.docs:
                if (
                    existing.get("email_normalized") == payload["email_normalized"]
                    and existing.get("is_deleted") is not True
                ):
                    from pymongo.errors import DuplicateKeyError

                    raise DuplicateKeyError("E11000 duplicate")
        if "token_hash" in payload:
            for existing in self.docs:
                if existing.get("token_hash") == payload["token_hash"]:
                    from pymongo.errors import DuplicateKeyError

                    raise DuplicateKeyError("E11000 duplicate")
        if "provider" in payload and "provider_subject" in payload:
            for existing in self.docs:
                if (
                    existing.get("provider") == payload["provider"]
                    and existing.get("provider_subject") == payload["provider_subject"]
                ):
                    from pymongo.errors import DuplicateKeyError

                    raise DuplicateKeyError("E11000 duplicate identity")
        if "medication_id" in payload and "scheduled_for" in payload:
            for existing in self.docs:
                if (
                    existing.get("medication_id") == payload["medication_id"]
                    and existing.get("scheduled_for") == payload["scheduled_for"]
                ):
                    from pymongo.errors import DuplicateKeyError

                    raise DuplicateKeyError("E11000 duplicate log occurrence")
        self.docs.append(payload)

        class _Result:
            inserted_id = payload["_id"]

        return _Result()

    async def update_one(
        self, query: dict[str, Any], update: dict[str, Any], upsert: bool = False
    ) -> Any:
        matched = 0
        modified = 0
        for doc in self.docs:
            if self._matches(doc, query):
                matched = 1
                if "$set" in update:
                    doc.update(update["$set"])
                    modified = 1
                if "$inc" in update:
                    for key, amount in update["$inc"].items():
                        doc[key] = int(doc.get(key, 0)) + int(amount)
                    modified = 1
                break
        if matched == 0 and upsert and "$set" in update:
            payload = deepcopy(update["$set"])
            for key, value in query.items():
                payload.setdefault(key, value)
            if "_id" not in payload or payload["_id"] is None:
                payload["_id"] = ObjectId()
            self.docs.append(payload)
            matched = 1
            modified = 1

        class _Result:
            matched_count = matched
            modified_count = modified

        return _Result()

    async def find_one_and_update(
        self,
        query: dict[str, Any],
        update: dict[str, Any],
        *,
        return_document: bool = False,
    ) -> dict[str, Any] | None:
        for doc in self.docs:
            if self._matches(doc, query):
                if "$set" in update:
                    doc.update(update["$set"])
                if "$inc" in update:
                    for key, amount in update["$inc"].items():
                        doc[key] = int(doc.get(key, 0)) + int(amount)
                return deepcopy(doc) if return_document else None
        return None

    async def update_many(self, query: dict[str, Any], update: dict[str, Any]) -> Any:
        modified = 0
        for doc in self.docs:
            if self._matches(doc, query):
                if "$set" in update:
                    doc.update(update["$set"])
                    modified += 1

        class _Result:
            modified_count = modified

        return _Result()

    async def count_documents(self, query: dict[str, Any]) -> int:
        return sum(1 for d in self.docs if self._matches(d, query))

    async def delete_many(self, query: dict[str, Any]) -> Any:
        before = len(self.docs)
        self.docs = [d for d in self.docs if not self._matches(d, query)]

        class _Result:
            deleted_count = before - len(self.docs)

        return _Result()


class MemoryDatabase:
    def __init__(self) -> None:
        self._collections: dict[str, MemoryCollection] = {}
        self.name = f"memory_{uuid4().hex}_test"

    def __getitem__(self, name: str) -> MemoryCollection:
        if name not in self._collections:
            self._collections[name] = MemoryCollection()
        return self._collections[name]
