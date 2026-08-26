import hashlib
import uuid
from pathlib import Path
from typing import Annotated

import pymupdf4llm
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.databases.models import CV
from backend.databases.session import get_db
from backend.llm.keywords import extract_keywords
from backend.schema.cv import CVKeywordsUpdate, CVOut
from core.settings import SETTINGS

router = APIRouter(tags=["cv"])


MAX_CVS = SETTINGS.MAX_CVS
UPLOAD_DIR = Path(SETTINGS.CV_UPLOAD_DIR)


def _get_or_create_markdown(pdf_path: Path) -> str:
    md_path = pdf_path.with_suffix(".md")
    if md_path.exists():
        return md_path.read_text()
    markdown = pymupdf4llm.to_markdown(str(pdf_path), page_chunks=False)
    assert isinstance(markdown, str)  # page_chunks=False guarantees str, not list[dict]
    md_path.write_text(markdown)
    return markdown


@router.post("", response_model=CVOut)
async def upload_cv(file: UploadFile, db: Annotated[AsyncSession, Depends(get_db)]):
    contents = await file.read()
    content_hash = hashlib.sha256(contents).hexdigest()

    existing = await db.scalar(select(CV).where(CV.content_hash == content_hash))
    if existing:
        return existing

    count = await db.scalar(select(func.count()).select_from(CV)) or 0
    if count >= MAX_CVS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Max {MAX_CVS} CVs allowed — delete one first",
        )

    UPLOAD_DIR.mkdir(exist_ok=True)
    file_path = UPLOAD_DIR / f"{uuid.uuid4()}.pdf"
    file_path.write_bytes(contents)

    try:
        raw_text = _get_or_create_markdown(
            file_path
        )  # writes {uuid}.md, only regenerates if missing
        keywords = await extract_keywords(raw_text)

        cv = CV(
            filename=file.filename,
            file_path=str(file_path),
            raw_text=raw_text,
            keywords=keywords,
            content_hash=content_hash,
            is_active=(count == 0),  # first upload auto-activates
        )

        db.add(cv)
        await db.commit()
        await db.refresh(cv)
        return cv
    except Exception as e:
        file_path.unlink(missing_ok=True)
        file_path.with_suffix(".md").unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error Uploading CV"
        ) from e


@router.get("", response_model=list[CVOut])
async def list_cvs(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.scalars(select(CV).order_by(CV.uploaded_at.desc()))
    return result.all()


@router.put("/{cv_id}/activate", response_model=CVOut)
async def activate_cv(cv_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    cv = await db.get(CV, cv_id)
    if cv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CV not found")
    await db.execute(update(CV).values(is_active=False))
    cv.is_active = True
    await db.commit()
    await db.refresh(cv)
    return cv


@router.delete("/{cv_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cv(cv_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    cv = await db.get(CV, cv_id)
    if cv is None:
        raise HTTPException(404, "CV not found")

    was_active = cv.is_active
    pdf_path = Path(cv.file_path)
    pdf_path.unlink(missing_ok=True)
    pdf_path.with_suffix(".md").unlink(missing_ok=True)
    await db.delete(cv)

    if was_active:
        # auto-promote the most recent remaining CV so the app never has zero active
        next_cv = await db.scalar(select(CV).order_by(CV.uploaded_at.desc()).limit(1))
        if next_cv:
            next_cv.is_active = True

    await db.commit()


@router.put("/{cv_id}/keywords", response_model=CVOut)
async def update_cv_keywords(
    cv_id: int, body: CVKeywordsUpdate, db: Annotated[AsyncSession, Depends(get_db)]
):
    cv = await db.get(CV, cv_id)
    if cv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CV not found")
    cv.keywords = body.keywords
    await db.commit()
    await db.refresh(cv)
    return cv
