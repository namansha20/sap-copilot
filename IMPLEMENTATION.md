# SAP Copilot – Implementation Document

> **Last updated:** 2026-03-26 (reflects all commits up to `memory updatation`)

---

## 1. Project Overview

**SAP Copilot** is an AI-powered assistant for SAP applications. It exposes a REST API (built with FastAPI) that lets users chat with a Mistral AI language model pre-configured to act as an SAP expert. Conversation context is preserved across turns inside a session so the model can give coherent, multi-turn answers.

---

## 2. Repository Structure

```
sap-copilot/
├── README.md                 # Project overview and quick-start guide
├── mta.yaml                  # SAP Multi-Target Application descriptor (empty, reserved)
├── .vscode/
│   └── settings.json         # VS Code – sets system Python as default env manager
└── backend/
    └── app/
        ├── main.py           # FastAPI app entry point
        ├── routes/
        │   └── chat.py       # Chat and memory-management endpoints
        ├── services/
        │   └── llm_service.py # Mistral AI integration
        ├── utils/
        │   └── memory.py     # In-memory conversation store
        └── rag/
            └── data/
                └── SAP Certified – SAP Generative AI Developer Certification (C_AIG).pdf
```

---

## 3. Commit History

| # | Commit | Date | Description |
|---|--------|------|-------------|
| 1 | `dde1b8f` | 2026-03-24 | **final overwrite** – Initial project scaffold: FastAPI app, basic chat route, and project files |
| 2 | `e062e67` | 2026-03-26 | **memory updatation** – Added per-session conversation memory, Mistral AI LLM service, and RAG data directory |

---

## 4. Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | Python 3.13 |
| Web Framework | FastAPI |
| LLM Provider | Mistral AI (`mistral-small` model) |
| Memory | In-process Python dictionary (ephemeral) |
| Config | `python-dotenv` (`.env` file) |
| Deployment Target | SAP BTP / MTA (planned) |

---

## 5. Component Details

### 5.1 Application Entry Point – `backend/app/main.py`

- Initialises the **FastAPI** application instance.
- Loads environment variables from a `.env` file via `load_dotenv()`.
- Reads and prints the `APP_NAME` environment variable on startup.
- Registers the chat router under the default prefix.
- Exposes a health-check endpoint.

**Endpoints declared here:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check – returns `{"message": "SAP Copilot is running 🚀"}` |

---

### 5.2 Chat Routes – `backend/app/routes/chat.py`

Defines the conversational API surface.

**Request model:**

```python
class ChatRequest(BaseModel):
    message: str      # User's text message
    session_id: str   # Unique identifier for the conversation session
```

**Endpoints:**

| Method | Path | Input | Output | Description |
|--------|------|-------|--------|-------------|
| `POST` | `/chat` | `ChatRequest` JSON body | `{"response": "<ai reply>"}` | Sends a message to the LLM and returns the assistant's reply |
| `DELETE` | `/memory/{session_id}` | `session_id` path param | `{"message": "Memory cleared"}` | Clears stored conversation history for the given session |

---

### 5.3 LLM Service – `backend/app/services/llm_service.py`

Encapsulates all interaction with the Mistral AI API.

**Configuration:**
- API key read from the `MISTRAL_API_KEY` environment variable.
- Model: `mistral-small`.

**Function: `get_llm_response(user_input, session_id)`**

1. Retrieves existing conversation history for `session_id` from the memory store.
2. Constructs the message list:
   - System prompt: *"You are an SAP expert assistant."*
   - Full prior conversation history (alternating user/assistant turns).
   - The new user message.
3. Calls `client.chat.complete()` with the constructed message list.
4. Extracts the assistant's reply from `response.choices[0].message.content`.
5. Persists both the user message and the assistant reply to the memory store.
6. Returns the assistant reply string.

---

### 5.4 Conversation Memory – `backend/app/utils/memory.py`

Provides a lightweight, in-process session store.

**Data structure:**

```python
chat_memory: dict[str, list[dict]] = {}
# Example:
# {
#   "session-abc": [
#     {"role": "user",      "content": "What is SAP BTP?"},
#     {"role": "assistant", "content": "SAP Business Technology Platform is ..."}
#   ]
# }
```

**Functions:**

| Function | Signature | Description |
|----------|-----------|-------------|
| `get_history` | `(session_id: str) -> list` | Returns the message list for a session, or `[]` if none exists |
| `add_message` | `(session_id: str, role: str, content: str) -> None` | Appends a `{role, content}` dict to the session's history, creating the session key if absent |

> **Limitation:** Memory is held in-process. All conversation history is lost on server restart and does not scale across multiple instances.

---

### 5.5 RAG Data – `backend/app/rag/data/`

Contains a copy of the **SAP Certified – SAP Generative AI Developer Certification (C_AIG)** PDF (~45 MB). The `rag/` directory structure is in place for a future Retrieval-Augmented Generation (RAG) pipeline that will ground the assistant's answers in official SAP documentation. No RAG code is implemented yet.

---

## 6. API Reference

### POST `/chat`

Send a message and receive an AI response.

**Request body:**
```json
{
  "message": "What is SAP BTP?",
  "session_id": "user-123"
}
```

**Response:**
```json
{
  "response": "SAP Business Technology Platform (BTP) is a unified, intelligent, and sustainable technology platform..."
}
```

---

### DELETE `/memory/{session_id}`

Clear the conversation history for a session.

**Response:**
```json
{
  "message": "Memory cleared"
}
```

---

### GET `/`

Health check.

**Response:**
```json
{
  "message": "SAP Copilot is running 🚀"
}
```

---

## 7. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MISTRAL_API_KEY` | ✅ Yes | API key for Mistral AI |
| `APP_NAME` | No | Application name (logged at startup) |

Create a `.env` file in the project root (or `backend/`) with these values before running the server.

---

## 8. Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env   # then fill in MISTRAL_API_KEY

# Run the server (from backend/ directory)
uvicorn app.main:app --reload
```

---

## 9. Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| FastAPI server | ✅ Done | Health-check + chat routes |
| Chat endpoint (`POST /chat`) | ✅ Done | Accepts message + session_id |
| Mistral AI integration | ✅ Done | `mistral-small` model |
| Per-session conversation memory | ✅ Done | In-process dictionary |
| Clear memory endpoint (`DELETE /memory/{session_id}`) | ✅ Done | |
| RAG pipeline | ⏳ Planned | Data file present; ingestion/retrieval not built |
| SAP system integration | ⏳ Planned | Mentioned in README |
| Persistent storage | ⏳ Planned | Replace in-memory dict with a database |
| Authentication / authorization | ⏳ Planned | No auth layer yet |
| Error handling & input validation | ⏳ Planned | Minimal error handling in current routes |
| MTA / SAP BTP deployment config | ⏳ Planned | `mta.yaml` exists but is empty |

---

## 10. Known Limitations & Future Work

1. **Ephemeral memory** – Conversation history is stored in-process and lost on every restart. A persistent store (e.g., Redis, PostgreSQL) is needed for production.
2. **No RAG** – The certification PDF has been added to `rag/data/` but the indexing and retrieval pipeline has not been implemented yet.
3. **No authentication** – Any caller can use any `session_id`. An auth layer (API keys, OAuth 2.0, etc.) is needed before production deployment.
4. **Minimal error handling** – LLM API failures, malformed requests, and missing environment variables are not gracefully handled.
5. **Single-instance scaling** – The in-memory session store means horizontal scaling is not yet possible.
6. **Empty `mta.yaml`** – SAP BTP deployment configuration needs to be populated before the app can be deployed to SAP Cloud Platform.
