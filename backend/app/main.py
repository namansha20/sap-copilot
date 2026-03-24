from fastapi import FastAPI
from app.routes import chat

app = FastAPI()

app.include_router(chat.router)

@app.get("/")
def home():
    return {"message": "SAP Copilot is running 🚀"}