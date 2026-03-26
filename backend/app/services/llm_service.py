import os
from mistralai.client import Mistral
from dotenv import load_dotenv
from app.utils.memory import get_history, add_message


load_dotenv()

api_key = os.getenv("MISTRAL_API_KEY")
client = Mistral(api_key=api_key)

def get_llm_response(user_input: str, session_id: str):
    
    history = get_history(session_id)

    messages = [
        {"role": "system", "content": "You are an SAP expert assistant."}
    ] + history + [
        {"role": "user", "content": user_input}
    ]

    response = client.chat.complete(
        model="mistral-small",
        messages=messages
    )

    ai_reply = response.choices[0].message.content

    # Save conversation
    add_message(session_id, "user", user_input)
    add_message(session_id, "assistant", ai_reply)

    return ai_reply