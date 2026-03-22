import os
import json
import pandas as pd
from typing import Optional
from fastapi import FastAPI, File, UploadFile, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

# LangChain Imports
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain.prompts import PromptTemplate
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import PyPDFLoader
from langchain.agents import initialize_agent, AgentType, Tool
import tempfile

load_dotenv()

app = FastAPI(title="SAP Copilot AI")

# Mount UI5 static files
# We serve index.html on the root, but the static files need /app
app.mount("/app", StaticFiles(directory="app"), name="app")

@app.get("/")
def read_root():
    return FileResponse("app/index.html")

# Initialize LLM
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.2)
embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")

# Load Knowledge Base
with open("srv/knowledge-base.json", "r") as f:
    knowledge_base = json.load(f)

# Request Models
class AskRequest(BaseModel):
    question: str
    role: Optional[str] = "intern"

class AnalyzeRequest(BaseModel):
    question: str

class QueryRequest(BaseModel):
    question: str

class ActionRequest(BaseModel):
    prompt: str

# Endpoints
@app.post("/api/ask")
async def ask_process(req: AskRequest):
    role_context = ""
    role = req.role.lower() if req.role else "intern"
    if role == "intern":
        role_context = "Explain everything simply and step-by-step. Avoid heavy jargon."
    elif role == "manager":
        role_context = "Focus on business value, insights, and high-level process impact."
    elif role == "developer":
        role_context = "Include technical details, tables, background data flow, and exact transaction codes."
    else:
        role_context = "Act as an experienced SAP Consultant."

    system_instruction = f"""You are an expert SAP Enterprise AI Assistant. 
Your goal is to answer questions based on the provided Knowledge Base of SAP processes.
Format your answer elegantly using Markdown. Include the explanation, the step-by-step process, and the relevant t-code.
Role Persona: {role_context}

===== KNOWLEDGE BASE =====
{json.dumps(knowledge_base, indent=2)}
=========================="""

    try:
        response = llm.invoke([
            ("system", system_instruction),
            ("user", req.question)
        ])
        return {"value": response.content}
    except Exception as e:
        return {"value": f"Error: {str(e)}"}

@app.post("/api/analyzeData")
async def analyze_data(req: AnalyzeRequest):
    try:
        # Load mock SAP data
        df = pd.read_csv("db/data/sap.copilot-SalesOrders.csv", sep=";")
        data_json = df.head(50).to_json(orient="records")

        system_instruction = """You are a Data Insight AI for an enterprise SAP system. 
You will be provided with a JSON dataset of recent sales records.
Analyze the data and answer the user's question with reasoning, identifying trends, and giving insights.
Do NOT just list the numbers. Act like a smart business analyst. Respond in formatted Markdown."""

        prompt = f"User Question: {req.question}\n\nDataset:\n{data_json}"
        
        response = llm.invoke([
            ("system", system_instruction),
            ("user", prompt)
        ])
        return {"value": response.content}
    except Exception as e:
        return {"value": f"Failed to analyze data: {str(e)}"}

@app.post("/api/uploadPdf")
async def upload_pdf(file: UploadFile = File(...)):
    try:
        # Save uploaded file to temp buffer to process with PyPDF
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        loader = PyPDFLoader(tmp_path)
        documents = loader.load()
        
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        docs = text_splitter.split_documents(documents)

        # Save to local FAISS
        vector_store = FAISS.from_documents(docs, embeddings)
        vector_store.save_local("vector_store")
        
        os.unlink(tmp_path)
        
        # UI5 uploader expects just 200/201 response text or simple message
        # But for ajax it might be text
        return JSONResponse(content="Upload successful", status_code=200)
    except Exception as e:
        return JSONResponse(content=str(e), status_code=500)

@app.post("/api/queryDocument")
async def query_document(req: QueryRequest):
    try:
        if not os.path.exists("vector_store"):
            return {"value": "No documentation uploaded yet. Please upload a PDF first."}

        vector_store = FAISS.load_local("vector_store", embeddings, allow_dangerous_deserialization=True)
        results = vector_store.similarity_search(req.question, k=3)
        
        if not results:
            return {"value": "No relevant information found in the uploaded documents."}

        context_text = ""
        for idx, r in enumerate(results):
            context_text += f"--- SOURCE CHUNK {idx + 1} ---\n{r.page_content}\n\n"

        system_instruction = """You are a Document Brain AI. Answer the user's question explicitly based ONLY on the provided SOURCE CHUNKS.
Do NOT use external knowledge. 
At the end of your response, include a 'Sources Used' section that lists which chunks you derived your answer from. Include snippets to build trust. Format nicely in Markdown."""

        prompt = f"User Question: {req.question}\n\n{context_text}"
        
        response = llm.invoke([
            ("system", system_instruction),
            ("user", prompt)
        ])
        
        return {"value": response.content}
    except Exception as e:
        return {"value": f"Failed: {str(e)}"}

@app.post("/api/executeAction")
async def execute_action(req: ActionRequest):
    try:
        def fetch_sales_data(input_str: str) -> str:
            df = pd.read_csv("db/data/sap.copilot-SalesOrders.csv", sep=";")
            return df.head(10).to_json(orient="records")

        def generate_report(input_str: str) -> str:
            return f"Generated Report:\nBased on the data provided, the sales team has completed multiple high-value orders. Data snippet: {input_str[:100]}..."

        def draft_email(input_str: str) -> str:
            return f"Subject: Weekly Sales Report Summary\n\nTeam,\nHere is the latest report:\n\n{input_str}\n\nBest,\nSAP Copilot"

        tools = [
            Tool(name="fetch_sales_data", func=fetch_sales_data, description="Fetches the latest sales data from the SAP mock database. Input should be 'all' or empty."),
            Tool(name="generate_report", func=generate_report, description="Generates a textual sales report from raw JSON data. Input should be the raw JSON data."),
            Tool(name="draft_email", func=draft_email, description="Drafts an email summarizing a report. Input should be the generated report text.")
        ]

        agent = initialize_agent(
            tools=tools,
            llm=llm,
            agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
            verbose=True,
            return_intermediate_steps=True
        )

        result = agent.invoke({"input": req.prompt})
        
        # Build nice string showing steps
        output = "### Agent Execution Logs ###\n"
        if "intermediate_steps" in result and result["intermediate_steps"]:
            for idx, step in enumerate(result["intermediate_steps"]):
                action, observation = step
                output += f"\n**Step {idx + 1}**\n*Tool called:* `{action.tool}`\n*Input:* {action.tool_input}\n*Observation:* {str(observation)[:150]}...\n"
                
        output += f"\n\n### Final Answer ###\n{result['output']}"
        return {"value": output}
    except Exception as e:
        return {"value": f"Agent Execute Failed: {str(e)}"}
