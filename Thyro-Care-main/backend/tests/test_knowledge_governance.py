"""Phase 12 knowledge governance tests — workflow, authz, OCC, hash conflicts,
ingestion sync, append-only reviews, and patient privacy."""

from __future__ import annotations

import pytest
from app.api.dependencies import get_database
from app.core.config import get_settings
from app.core.tokens import create_access_token
from app.main import create_application
from app.models.enums import AccountStatus, KnowledgeStatus, UserRole
from app.models.user import UserDocument
from app.repositories.knowledge_repository import KnowledgeRepository
from app.repositories.user_repository import UserRepository
from app.schemas.knowledge_governance import KnowledgeDraftCreate, KnowledgeDraftUpdate
from app.services.knowledge_diff_service import KnowledgeDiffService
from app.services.knowledge_ingestion_service import canonical_content_hash
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from tests.fakes.memory_db import MemoryDatabase


@pytest.fixture
def memory_db() -> MemoryDatabase:
    return MemoryDatabase()


def _draft_payload(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "slug": "post-op-fatigue",
        "title": "Fatigue after thyroidectomy",
        "source_name": "ThyroCare Governance Test Sources",
        "source_url": "https://example.org/fatigue",
        "topic": "thyroidectomy_recovery",
        "language": "english",
        "body": (
            "Fatigue is commonly reported during recovery after thyroidectomy. "
            "Discuss persistent fatigue with your healthcare team."
        ),
        "medical_disclaimer": "Educational only.",
    }
    base.update(overrides)
    return base


async def _register_admin(memory_db: MemoryDatabase) -> tuple[str, object]:
    users = UserRepository(memory_db)  # type: ignore[arg-type]
    admin = await users.create_user_document(
        UserDocument(
            email_normalized="gov.admin@example.com",
            email_display="gov.admin@example.com",
            password_hash="$argon2id$placeholder",
            full_name="Governance Admin",
            role=UserRole.ADMIN,
            account_status=AccountStatus.ACTIVE,
        )
    )
    token, _ = create_access_token(user_id=admin.id, role=UserRole.ADMIN)
    return token, admin


async def _register_expert(memory_db: MemoryDatabase) -> tuple[str, object]:
    users = UserRepository(memory_db)  # type: ignore[arg-type]
    expert = await users.create_user_document(
        UserDocument(
            email_normalized="gov.expert@example.com",
            email_display="gov.expert@example.com",
            password_hash="$argon2id$placeholder",
            full_name="Governance Expert",
            role=UserRole.MEDICAL_EXPERT,
            account_status=AccountStatus.ACTIVE,
        )
    )
    token, _ = create_access_token(user_id=expert.id, role=UserRole.MEDICAL_EXPERT)
    return token, expert


def _setup_app_env(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("JWT_SECRET_KEY", "unit-test-secret-key-32-characters!!")
    get_settings.cache_clear()

    async def fake_connect(_settings: object) -> None:
        return None

    async def fake_close() -> None:
        return None

    async def fake_initialize(_settings: object) -> None:
        return None

    async def fake_ping() -> dict[str, object]:
        return {"connected": False, "status": "disconnected", "error": "test"}

    from app.db import mongodb as mongodb_module

    monkeypatch.setattr(mongodb_module, "connect_to_mongo", fake_connect)
    monkeypatch.setattr(mongodb_module, "close_mongo_connection", fake_close)
    monkeypatch.setattr(mongodb_module, "ping_mongo", fake_ping)
    monkeypatch.setattr("app.main.initialize_database", fake_initialize)


# ---- Schema-level tests ------------------------------------------------------------


def test_draft_create_rejects_client_supplied_actor_and_status_fields() -> None:
    with pytest.raises(ValidationError):
        KnowledgeDraftCreate.model_validate({**_draft_payload(), "created_by_user_id": "abc"})
    with pytest.raises(ValidationError):
        KnowledgeDraftCreate.model_validate({**_draft_payload(), "current_status": "approved"})
    with pytest.raises(ValidationError):
        KnowledgeDraftCreate.model_validate({**_draft_payload(), "reviewed_at": "2024-01-01"})


def test_draft_create_validates_url_scheme() -> None:
    with pytest.raises(ValidationError):
        KnowledgeDraftCreate.model_validate(
            {**_draft_payload(), "source_url": "javascript:alert(1)"}
        )
    with pytest.raises(ValidationError):
        KnowledgeDraftCreate.model_validate({**_draft_payload(), "source_url": "ftp://example.org"})
    ok = KnowledgeDraftCreate.model_validate(_draft_payload(source_url="https://example.org/x"))
    assert ok.source_url == "https://example.org/x"


def test_draft_create_bounds_text_and_forbids_extra() -> None:
    with pytest.raises(ValidationError):
        KnowledgeDraftCreate.model_validate({**_draft_payload(), "title": ""})
    with pytest.raises(ValidationError):
        KnowledgeDraftCreate.model_validate({**_draft_payload(), "unexpected_field": "x"})


def test_draft_update_requires_expected_version() -> None:
    with pytest.raises(ValidationError):
        KnowledgeDraftUpdate.model_validate({"title": "New title"})
    ok = KnowledgeDraftUpdate.model_validate({"title": "New title", "expected_version": 1})
    assert ok.expected_version == 1


def test_canonical_content_hash_is_stable_and_sensitive_to_medical_fields() -> None:
    kwargs = {
        "title": "T",
        "source_name": "S",
        "source_url": None,
        "topic": "general_education",
        "language": "english",
        "body": "Body text.",
        "medical_disclaimer": "Disclaimer.",
    }
    h1 = canonical_content_hash(**kwargs)
    h2 = canonical_content_hash(**kwargs)
    assert h1 == h2
    changed = canonical_content_hash(**{**kwargs, "body": "Different body."})
    assert changed != h1


def test_diff_service_reports_insert_delete_equal() -> None:
    svc = KnowledgeDiffService()
    lines, truncated = svc.diff("line one\nline two", "line one\nline three")
    assert truncated is False
    ops = [line.op for line in lines]
    assert "equal" in ops
    assert "delete" in ops or "insert" in ops


# ---- Index registration --------------------------------------------------------------


def test_governance_indexes_defined() -> None:
    from app.db.collections import CollectionName
    from app.db.indexes import INDEX_SPECS, assert_index_names_unique

    assert_index_names_unique()
    version_collection = CollectionName.KNOWLEDGE_DOCUMENT_VERSIONS.value
    version_names = {s.name for s in INDEX_SPECS if s.collection == version_collection}
    assert "ux_knowledge_versions_version_id" in version_names
    assert "ux_knowledge_versions_document_number" in version_names
    review_names = {
        s.name for s in INDEX_SPECS if s.collection == CollectionName.KNOWLEDGE_REVIEW_RECORDS.value
    }
    assert "ix_knowledge_reviews_version_created" in review_names


# ---- HTTP workflow tests --------------------------------------------------------------


@pytest.mark.asyncio
async def test_patient_denied_governance_access(
    memory_db: MemoryDatabase, monkeypatch: pytest.MonkeyPatch
) -> None:
    _setup_app_env(monkeypatch)
    app = create_application()
    app.dependency_overrides[get_database] = lambda: memory_db
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        reg = await client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Gov Patient",
                "email": "gov.patient@example.com",
                "password": "secure-pass-1",
                "confirm_password": "secure-pass-1",
                "consent_accepted": True,
                "disclaimer_accepted": True,
            },
        )
        assert reg.status_code == 201, reg.text
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

        assert (
            await client.get("/api/v1/governance/knowledge", headers=headers)
        ).status_code == 403
        assert (
            await client.post(
                "/api/v1/governance/knowledge", headers=headers, json=_draft_payload()
            )
        ).status_code == 403
        assert (
            await client.get("/api/v1/governance/review-queue", headers=headers)
        ).status_code == 403
        assert (await client.get("/api/v1/governance/knowledge")).status_code == 401

    app.dependency_overrides.clear()
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_full_review_workflow_and_ingestion_sync(
    memory_db: MemoryDatabase, monkeypatch: pytest.MonkeyPatch
) -> None:
    _setup_app_env(monkeypatch)
    admin_token, _ = await _register_admin(memory_db)
    expert_token, expert = await _register_expert(memory_db)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    expert_headers = {"Authorization": f"Bearer {expert_token}"}

    app = create_application()
    app.dependency_overrides[get_database] = lambda: memory_db
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        created = await client.post(
            "/api/v1/governance/knowledge", headers=admin_headers, json=_draft_payload()
        )
        assert created.status_code == 201, created.text
        detail = created.json()
        document_id = detail["document"]["document_id"]
        assert detail["document"]["current_status"] == "draft"
        assert detail["current_version"]["review_status"] == "draft"
        version_id = detail["current_version"]["version_id"]
        version_hash = detail["current_version"]["content_hash"]

        # Medical expert cannot create/edit drafts.
        assert (
            await client.patch(
                f"/api/v1/governance/knowledge/{document_id}/versions/{version_id}",
                headers=expert_headers,
                json={"expected_version": 1, "title": "Nope"},
            )
        ).status_code == 403

        # OCC conflict on stale expected_version.
        stale_update = await client.patch(
            f"/api/v1/governance/knowledge/{document_id}/versions/{version_id}",
            headers=admin_headers,
            json={"expected_version": 99, "title": "Should fail"},
        )
        assert stale_update.status_code == 409, stale_update.text

        updated = await client.patch(
            f"/api/v1/governance/knowledge/{document_id}/versions/{version_id}",
            headers=admin_headers,
            json={"expected_version": 1, "title": "Fatigue after thyroidectomy (updated)"},
        )
        assert updated.status_code == 200, updated.text
        version_hash = updated.json()["current_version"]["content_hash"]
        version_version = updated.json()["current_version"]["version"]

        # Admin cannot approve.
        deny_approve = await client.post(
            f"/api/v1/governance/review-queue/{document_id}/{version_id}/decision",
            headers=admin_headers,
            json={
                "decision": "approve",
                "expected_version": version_version,
                "expected_content_hash": version_hash,
            },
        )
        assert deny_approve.status_code == 403

        submitted = await client.post(
            f"/api/v1/governance/knowledge/{document_id}/versions/{version_id}/submit",
            headers=admin_headers,
            json={"expected_version": version_version},
        )
        assert submitted.status_code == 200, submitted.text
        assert submitted.json()["document"]["current_status"] == "pending_review"
        submit_version = submitted.json()["current_version"]["version"]

        queue = await client.get("/api/v1/governance/review-queue", headers=expert_headers)
        assert queue.status_code == 200
        assert any(item["version_id"] == version_id for item in queue.json()["items"])

        # Hash conflict on approve.
        bad_hash_approve = await client.post(
            f"/api/v1/governance/review-queue/{document_id}/{version_id}/decision",
            headers=expert_headers,
            json={
                "decision": "approve",
                "expected_version": submit_version,
                "expected_content_hash": "deadbeef",
            },
        )
        assert bad_hash_approve.status_code == 409

        approved = await client.post(
            f"/api/v1/governance/review-queue/{document_id}/{version_id}/decision",
            headers=expert_headers,
            json={
                "decision": "approve",
                "expected_version": submit_version,
                "expected_content_hash": version_hash,
                "comments": "Reviewed and clinically appropriate.",
            },
        )
        assert approved.status_code == 200, approved.text
        approval_body = approved.json()
        assert approval_body["ingestion_status"] == "completed"
        assert approval_body["document"]["current_status"] == "approved"

        # Patient-facing retrieval now sees approved content only.
        knowledge_repo = KnowledgeRepository(memory_db)  # type: ignore[arg-type]
        chunks = await knowledge_repo.list_approved_chunks()
        assert any(c.document_id == document_id for c in chunks)
        approved_doc = await knowledge_repo.get_approved_source_by_id(document_id)
        assert approved_doc is not None
        assert approved_doc.review_status == KnowledgeStatus.APPROVED

        # Append-only review record recorded (including optional approve comments).
        reviews = await client.get(
            f"/api/v1/governance/knowledge/{document_id}/review-history",
            headers=expert_headers,
        )
        assert reviews.status_code == 200
        assert reviews.json()[0]["decision"] == "approve"
        assert reviews.json()[0]["comments"] == "Reviewed and clinically appropriate."

        # Idempotent re-ingestion without re-approval.
        reingest = await client.post(
            f"/api/v1/governance/knowledge/{document_id}/versions/{version_id}/reingest",
            headers=admin_headers,
            json={"expected_content_hash": version_hash},
        )
        assert reingest.status_code == 200, reingest.text
        assert reingest.json()["ingestion_status"] == "completed"

        # New version from approved (ADMIN only).
        doc_version_after_approve = approval_body["document"]["version"]
        new_version = await client.post(
            f"/api/v1/governance/knowledge/{document_id}/versions/new",
            headers=admin_headers,
            json={
                "expected_version": doc_version_after_approve,
                "body": "Updated recovery guidance text.",
            },
        )
        assert new_version.status_code == 201, new_version.text
        new_detail = new_version.json()
        assert new_detail["document"]["current_status"] == "draft"
        new_version_id = new_detail["current_version"]["version_id"]
        assert new_version_id != version_id

        # Approved content is still what patients see while a new draft is edited.
        still_approved = await knowledge_repo.get_approved_source_by_id(document_id)
        assert still_approved is not None
        assert still_approved.body != "Updated recovery guidance text."

        new_version_hash = new_detail["current_version"]["content_hash"]
        new_version_version = new_detail["current_version"]["version"]
        submit2 = await client.post(
            f"/api/v1/governance/knowledge/{document_id}/versions/{new_version_id}/submit",
            headers=admin_headers,
            json={"expected_version": new_version_version},
        )
        assert submit2.status_code == 200, submit2.text
        submit2_version = submit2.json()["current_version"]["version"]

        changes = await client.post(
            f"/api/v1/governance/review-queue/{document_id}/{new_version_id}/decision",
            headers=expert_headers,
            json={
                "decision": "request_changes",
                "expected_version": submit2_version,
                "expected_content_hash": new_version_hash,
                "comments": "Please cite a source for the new claim.",
            },
        )
        assert changes.status_code == 200, changes.text
        assert changes.json()["document"]["current_status"] == "changes_requested"

        # Rejection never reaches patient endpoints — verify by checking the
        # approved denormalized document is untouched.
        untouched = await knowledge_repo.get_approved_source_by_id(document_id)
        assert untouched is not None and untouched.review_status == KnowledgeStatus.APPROVED

    app.dependency_overrides.clear()
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_retire_and_restore_cycle(
    memory_db: MemoryDatabase, monkeypatch: pytest.MonkeyPatch
) -> None:
    _setup_app_env(monkeypatch)
    admin_token, _ = await _register_admin(memory_db)
    expert_token, _ = await _register_expert(memory_db)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    expert_headers = {"Authorization": f"Bearer {expert_token}"}

    app = create_application()
    app.dependency_overrides[get_database] = lambda: memory_db
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        created = await client.post(
            "/api/v1/governance/knowledge",
            headers=admin_headers,
            json=_draft_payload(slug="retire-restore-doc"),
        )
        document_id = created.json()["document"]["document_id"]
        version_id = created.json()["current_version"]["version_id"]

        submitted = await client.post(
            f"/api/v1/governance/knowledge/{document_id}/versions/{version_id}/submit",
            headers=admin_headers,
            json={"expected_version": 1},
        )
        submit_version = submitted.json()["current_version"]["version"]
        content_hash = submitted.json()["current_version"]["content_hash"]

        approved = await client.post(
            f"/api/v1/governance/review-queue/{document_id}/{version_id}/decision",
            headers=expert_headers,
            json={
                "decision": "approve",
                "expected_version": submit_version,
                "expected_content_hash": content_hash,
            },
        )
        assert approved.status_code == 200, approved.text
        doc_version = approved.json()["document"]["version"]

        knowledge_repo = KnowledgeRepository(memory_db)  # type: ignore[arg-type]
        assert await knowledge_repo.get_approved_source_by_id(document_id) is not None

        # ADMIN can retire.
        retired = await client.post(
            f"/api/v1/governance/knowledge/{document_id}/retire",
            headers=admin_headers,
            json={"expected_version": doc_version, "reason": "Superseded guidance"},
        )
        assert retired.status_code == 200, retired.text
        assert retired.json()["document"]["current_status"] == "retired"
        assert await knowledge_repo.get_approved_source_by_id(document_id) is None

        retired_doc_version = retired.json()["document"]["version"]
        approved_hash = retired.json()["current_version"]["content_hash"]

        # ADMIN cannot restore — medical expert required.
        deny_restore = await client.post(
            f"/api/v1/governance/knowledge/{document_id}/restore",
            headers=admin_headers,
            json={"expected_version": retired_doc_version, "expected_content_hash": approved_hash},
        )
        assert deny_restore.status_code == 403

        restored = await client.post(
            f"/api/v1/governance/knowledge/{document_id}/restore",
            headers=expert_headers,
            json={"expected_version": retired_doc_version, "expected_content_hash": approved_hash},
        )
        assert restored.status_code == 200, restored.text
        assert restored.json()["document"]["current_status"] == "approved"
        assert restored.json()["ingestion_status"] == "completed"
        assert await knowledge_repo.get_approved_source_by_id(document_id) is not None

    app.dependency_overrides.clear()
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_reject_requires_comments_and_is_append_only(
    memory_db: MemoryDatabase, monkeypatch: pytest.MonkeyPatch
) -> None:
    _setup_app_env(monkeypatch)
    admin_token, _ = await _register_admin(memory_db)
    expert_token, _ = await _register_expert(memory_db)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    expert_headers = {"Authorization": f"Bearer {expert_token}"}

    app = create_application()
    app.dependency_overrides[get_database] = lambda: memory_db
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        created = await client.post(
            "/api/v1/governance/knowledge",
            headers=admin_headers,
            json=_draft_payload(slug="reject-doc"),
        )
        document_id = created.json()["document"]["document_id"]
        version_id = created.json()["current_version"]["version_id"]

        # Comments required for reject.
        with_missing_comments = {
            "expected_version": 1,
            "expected_content_hash": created.json()["current_version"]["content_hash"],
        }
        submitted = await client.post(
            f"/api/v1/governance/knowledge/{document_id}/versions/{version_id}/submit",
            headers=admin_headers,
            json={"expected_version": 1},
        )
        submit_version = submitted.json()["current_version"]["version"]
        content_hash = submitted.json()["current_version"]["content_hash"]

        missing_comments_resp = await client.post(
            f"/api/v1/governance/review-queue/{document_id}/{version_id}/decision",
            headers=expert_headers,
            json={**with_missing_comments, "decision": "reject"},
        )
        assert missing_comments_resp.status_code == 422

        rejected = await client.post(
            f"/api/v1/governance/review-queue/{document_id}/{version_id}/decision",
            headers=expert_headers,
            json={
                "decision": "reject",
                "expected_version": submit_version,
                "expected_content_hash": content_hash,
                "comments": "Content is not clinically accurate.",
            },
        )
        assert rejected.status_code == 200, rejected.text
        assert rejected.json()["document"]["current_status"] == "rejected"

        # Never retrievable by patients.
        knowledge_repo = KnowledgeRepository(memory_db)  # type: ignore[arg-type]
        assert await knowledge_repo.get_approved_source_by_id(document_id) is None

        reviews = await client.get(
            f"/api/v1/governance/knowledge/{document_id}/review-history",
            headers=expert_headers,
        )
        assert len(reviews.json()) == 1
        assert reviews.json()[0]["decision"] == "reject"
        assert reviews.json()[0]["comments"] == "Content is not clinically accurate."

    app.dependency_overrides.clear()
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_compare_versions(memory_db: MemoryDatabase, monkeypatch: pytest.MonkeyPatch) -> None:
    _setup_app_env(monkeypatch)
    admin_token, _ = await _register_admin(memory_db)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    app = create_application()
    app.dependency_overrides[get_database] = lambda: memory_db
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        created = await client.post(
            "/api/v1/governance/knowledge",
            headers=admin_headers,
            json=_draft_payload(slug="compare-doc"),
        )
        document_id = created.json()["document"]["document_id"]
        version_id = created.json()["current_version"]["version_id"]

        compare = await client.get(
            f"/api/v1/governance/knowledge/{document_id}/compare",
            headers=admin_headers,
            params={"to_version_id": version_id},
        )
        assert compare.status_code == 200, compare.text
        body = compare.json()
        assert body["to_version_id"] == version_id
        assert body["from_version_id"] is None
        assert all(line["op"] == "insert" for line in body["lines"])

    app.dependency_overrides.clear()
    get_settings.cache_clear()


def test_seed_files_still_pending_review_not_auto_approved() -> None:
    from app.services.knowledge_ingestion_service import KnowledgeIngestionService

    docs, _chunks, _versions = KnowledgeIngestionService().load_all()
    assert docs
    assert all(d.review_status == KnowledgeStatus.PENDING_REVIEW for d in docs)
    assert all(d.active is False for d in docs)
    assert all(d.current_version_id for d in docs)
    assert all(v.review_status == KnowledgeStatus.PENDING_REVIEW for v in _versions)
    assert {d.document_id for d in docs} == {v.document_id for v in _versions}


@pytest.mark.asyncio
async def test_seed_versions_appear_on_review_queue(
    memory_db: MemoryDatabase, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.repositories.knowledge_governance_repository import KnowledgeGovernanceRepository
    from app.services.knowledge_ingestion_service import KnowledgeIngestionService

    _setup_app_env(monkeypatch)
    expert_token, _ = await _register_expert(memory_db)
    expert_headers = {"Authorization": f"Bearer {expert_token}"}

    docs, chunks, versions = KnowledgeIngestionService().load_all()
    knowledge_repo = KnowledgeRepository(memory_db)  # type: ignore[arg-type]
    gov = KnowledgeGovernanceRepository(memory_db)  # type: ignore[arg-type]
    for doc in docs:
        await knowledge_repo.upsert_document(doc)
        related = [c for c in chunks if c.document_id == doc.document_id]
        await knowledge_repo.upsert_chunks(related)
    for version in versions:
        await gov.upsert_seed_version(version)

    app = create_application()
    app.dependency_overrides[get_database] = lambda: memory_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        queue = await client.get("/api/v1/governance/review-queue", headers=expert_headers)
        assert queue.status_code == 200, queue.text
        queued_ids = {item["document_id"] for item in queue.json()["items"]}
        assert queued_ids == {d.document_id for d in docs}
        # Seed chunks must not be patient-retrievable until approved.
        assert await knowledge_repo.list_approved_chunks() == []

    app.dependency_overrides.clear()
    get_settings.cache_clear()
