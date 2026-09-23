"""MongoDB repository for hashed OTP challenges."""

from __future__ import annotations

from bson import ObjectId

from app.db.collections import CollectionName
from app.models.otp import OtpCodeDocument
from app.repositories.base import BaseRepository
from app.utils.datetime import utc_now


class OtpRepository(BaseRepository[OtpCodeDocument]):
    collection_name = CollectionName.OTP_CODES.value
    model_type = OtpCodeDocument
    supports_soft_delete = False

    async def get_latest(self, phone_number: str) -> OtpCodeDocument | None:
        results = await self.find_many(
            {"phone_number": phone_number}, page_size=1, sort=[("created_at", -1)]
        )
        return results[0] if results else None

    async def create_token(self, document: OtpCodeDocument) -> OtpCodeDocument:
        return await self.insert_one(document)

    async def increment_attempts(self, challenge_id: ObjectId, max_attempts: int) -> None:
        await self.collection.update_one(
            {"_id": challenge_id, "used_at": None, "attempts": {"$lt": max_attempts}},
            {"$inc": {"attempts": 1}},
        )

    async def consume_if_valid(
        self, challenge_id: ObjectId, *, now: object, max_attempts: int
    ) -> OtpCodeDocument | None:
        result = await self.collection.find_one_and_update(
            {
                "_id": challenge_id,
                "used_at": None,
                "expires_at": {"$gt": now},
                "attempts": {"$lt": max_attempts},
            },
            {"$set": {"used_at": utc_now()}},
            return_document=True,
        )
        return self.model_type.model_validate(result) if result is not None else None