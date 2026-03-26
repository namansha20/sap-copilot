from fastapi import FastAPI
from app.routes import chat
from dotenv import load_dotenv
import os

load_dotenv()

print(os.getenv("APP_NAME"))

app = FastAPI()

app.include_router(chat.router)

@app.get("/")
def home():
    return {"message": "SAP Copilot is running 🚀"}