import io
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from pypdf import PdfReader
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.databases.models import CV
from backend.databases.session import get_db
from backend.schema.cv import CVOut
from core.settings import SETTINGS

router = APIRouter(tags=["cv"])


MAX_CVS = SETTINGS.MAX_CVS
UPLOAD_DIR = Path(SETTINGS.CV_UPLOAD_DIR)


def _extract_text(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


@router.post("", response_model=CVOut)
async def upload_cv(file: UploadFile, db: Annotated[AsyncSession, Depends(get_db)]):
    count = await db.scalar(select(func.count()).select_from(CV)) or 0
    if count >= MAX_CVS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Max {MAX_CVS} CVs allowed — delete one first",
        )

    contents = await file.read()
    UPLOAD_DIR.mkdir(exist_ok=True)
    file_path = UPLOAD_DIR / f"{uuid.uuid4()}.pdf"
    file_path.write_bytes(contents)

    cv = CV(
        filename=file.filename,
        file_path=str(file_path),
        raw_text=_extract_text(contents),
        is_active=(count == 0),  # first upload auto-activates
    )

    db.add(cv)
    await db.commit()
    await db.refresh(cv)
    return cv


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
    Path(cv.file_path).unlink(missing_ok=True)
    await db.delete(cv)

    if was_active:
        # auto-promote the most recent remaining CV so the app never has zero active
        next_cv = await db.scalar(select(CV).order_by(CV.uploaded_at.desc()).limit(1))
        if next_cv:
            next_cv.is_active = True

    await db.commit()
