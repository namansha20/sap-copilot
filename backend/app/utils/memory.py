chat_memory = {}

def get_history(session_id: str):
    return chat_memory.get(session_id, [])

def add_message(session_id: str, role: str, content: str):
    if session_id not in chat_memory:
        chat_memory[session_id] = []
    
    chat_memory[session_id].append({
        "role": role,
        "content": content
    })