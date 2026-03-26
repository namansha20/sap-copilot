from fastapi import APIRouter
from pydantic import BaseModel
from app.services.llm_service import get_llm_response

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    session_id: str

@router.post("/chat")
def chat(request: ChatRequest):
    reply = get_llm_response(request.message, request.session_id)
    return {"response": reply}

@router.delete("/memory/{session_id}")
def clear_memory(session_id: str):
    chat_memory.pop(session_id, None)
    return {"message": "Memory cleared"}