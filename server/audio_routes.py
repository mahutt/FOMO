import os
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse

router = APIRouter(prefix="/audio", tags=["audio"])

# Create audio directory if it doesn't exist
AUDIO_DIR = Path("audio_files")
AUDIO_DIR.mkdir(exist_ok=True)

# Define the fixed filename for the current sound
CURRENT_SOUND_FILE = "current_sound"

# Allowed audio file extensions
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"}


def get_file_extension(filename: str) -> str:
    """Extract file extension from filename"""
    return Path(filename).suffix.lower()


def is_audio_file(filename: str) -> bool:
    """Check if the file has an allowed audio extension"""
    return get_file_extension(filename) in ALLOWED_EXTENSIONS


@router.post("/upload")
async def upload_sound(file: UploadFile = File(...)):
    """
    Upload an audio file and replace the current sound at /my-sound

    Accepts common audio formats: mp3, wav, ogg, m4a, aac, flac
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    if not is_audio_file(file.filename):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Get the file extension
    file_extension = get_file_extension(file.filename)

    # Remove any existing current sound files (with any extension)
    for existing_file in AUDIO_DIR.glob(f"{CURRENT_SOUND_FILE}.*"):
        existing_file.unlink()

    # Save the new file with the fixed name and original extension
    file_path = AUDIO_DIR / f"{CURRENT_SOUND_FILE}{file_extension}"

    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        return {
            "message": "Sound uploaded successfully",
            "filename": file.filename,
            "size": len(content),
            "url": "/my-sound",
            "type": file_extension[1:],  # Remove the dot
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")


@router.get("/current")
async def get_current_sound_info():
    """Get information about the currently stored sound"""
    # Find the current sound file
    current_files = list(AUDIO_DIR.glob(f"{CURRENT_SOUND_FILE}.*"))

    if not current_files:
        raise HTTPException(status_code=404, detail="No sound file found")

    current_file = current_files[0]  # Should only be one
    file_stats = current_file.stat()

    return {
        "filename": current_file.name,
        "size": file_stats.st_size,
        "url": "/my-sound",
        "type": current_file.suffix[1:],  # Remove the dot
        "uploaded": file_stats.st_mtime,
    }


@router.delete("/current")
async def delete_current_sound():
    """Delete the currently stored sound"""
    # Find and delete the current sound file
    current_files = list(AUDIO_DIR.glob(f"{CURRENT_SOUND_FILE}.*"))

    if not current_files:
        raise HTTPException(status_code=404, detail="No sound file found")

    for file_path in current_files:
        file_path.unlink()

    return {"message": "Sound deleted successfully"}
