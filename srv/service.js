require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { AgentExecutor, createReactAgent } = require('langchain/agents');
const { DynamicTool } = require('@langchain/core/tools');
const { PromptTemplate } = require('@langchain/core/prompts');
const fs = require('fs');
const knowledgeBase = require('./knowledge-base.json');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); 

module.exports = function () {
    this.on('ask', async (req) => {
        const { question, role } = req.data;
        try {
            let roleContext = "";
            switch (role?.toLowerCase()) {
                case "intern": roleContext = "Explain everything simply and step-by-step. Avoid heavy jargon."; break;
                case "manager": roleContext = "Focus on business value, insights, and high-level process impact."; break;
                case "developer": roleContext = "Include technical details, tables, background data flow, and exact transaction codes."; break;
                default: roleContext = "Act as an experienced SAP Consultant.";
            }

            const systemInstruction = `You are an expert SAP Enterprise AI Assistant. 
Your goal is to answer questions based on the provided Knowledge Base of SAP processes.
Format your answer elegantly using Markdown. Include the explanation, the step-by-step process, and the relevant t-code.
Role Persona: ${roleContext}

===== KNOWLEDGE BASE =====
${JSON.stringify(knowledgeBase, null, 2)}
==========================`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: question,
                config: {
                    systemInstruction: systemInstruction,
                    temperature: 0.2
                }
            });

            return response.text;
        } catch (error) {
            console.error("Error calling Gemini API:", error);
            return `Error communicating with AI: ${error.message}`;
        }
    });

    this.on('analyzeData', async (req) => {
        const { question } = req.data;
        try {
            // Query mock HANA data from SQLite using CAP CDS API
            const db = await cds.connect.to('db');
            const { SalesOrders } = db.entities('sap.copilot');
            
            // Limit to top 50 strictly for context window
            const salesData = await db.read(SalesOrders).limit(50); 
            
            if (!salesData || salesData.length === 0) {
                return "No sales data found to analyze.";
            }

            const systemInstruction = `You are a Data Insight AI for an enterprise SAP system. 
You will be provided with a JSON dataset of recent sales records.
Analyze the data and answer the user's question with reasoning, identifying trends, and giving insights.
Do NOT just list the numbers. Act like a smart business analyst.
Respond in formatted Markdown.`;

            const prompt = `User Question: ${question}\n\nDataset:\n${JSON.stringify(salesData, null, 2)}`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    systemInstruction: systemInstruction,
                    temperature: 0.2
                }
            });

            return response.text;
        } catch (error) {
            console.error("Error running data insight:", error);
            return "Failed to analyze data: " + error.message;
        }
    });

    this.on('queryDocument', async (req) => {
        const { question } = req.data;
        try {
            const vectorStore = global.myVectorStore;
            if (!vectorStore) {
                return "No documentation uploaded yet. Please upload a PDF first.";
            }

            // Retrieve top 3 chunks
            const results = await vectorStore.similaritySearch(question, 3);
            if (!results || results.length === 0) {
                return "No relevant information found in the uploaded documents.";
            }

            let contextText = "";
            results.forEach((r, idx) => {
                contextText += `--- SOURCE CHUNK ${idx + 1} ---\n${r.pageContent}\n\n`;
            });

            const systemInstruction = `You are a Document Brain AI. Answer the user's question explicitly based ONLY on the provided SOURCE CHUNKS.
Do NOT use external knowledge. 
At the end of your response, include a 'Sources Used' section that lists which chunks you derived your answer from. Include snippets to build trust. Format nicely in Markdown.`;
            
            const prompt = `User Question: ${question}\n\n${contextText}`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    systemInstruction: systemInstruction,
                    temperature: 0.2
                }
            });

            return response.text;
        } catch (error) {
            console.error("Error querying document:", error);
            return "Failed to query document brain: " + error.message;
        }
    });

    this.on('executeAction', async (req) => {
        const { prompt } = req.data;
        try {
            const llm = new ChatGoogleGenerativeAI({
                modelName: "gemini-2.5-flash",
                temperature: 0,
                apiKey: process.env.GEMINI_API_KEY
            });

            const tools = [
                new DynamicTool({
                    name: "fetch_sales_data",
                    description: "Fetches the latest sales data from the SAP mock database. Input should be 'all' or empty.",
                    func: async () => {
                        const db = await cds.connect.to('db');
                        const { SalesOrders } = db.entities('sap.copilot');
                        const salesData = await db.read(SalesOrders).limit(10);
                        return JSON.stringify(salesData, null, 2);
                    }
                }),
                new DynamicTool({
                    name: "generate_report",
                    description: "Generates a textual sales report from raw JSON data. Input should be the raw JSON data.",
                    func: async (input) => {
                        return `Generated Report:\nBased on the data provided, the sales team has completed multiple high-value orders. Data snippet: ${input.substring(0, 100)}...`;
                    }
                }),
                new DynamicTool({
                    name: "draft_email",
                    description: "Drafts an email summarizing a report. Input should be the generated report text.",
                    func: async (input) => {
                        return `Subject: Weekly Sales Report Summary\n\nTeam,\nHere is the latest report:\n\n${input}\n\nBest,\nSAP Copilot`;
                    }
                })
            ];

            const agentPrompt = PromptTemplate.fromTemplate(`Answer the following questions as best you can. You have access to the following tools:

{tools}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Begin!

Question: {input}
Thought:{agent_scratchpad}`);

            const agent = await createReactAgent({
                llm,
                tools,
                prompt: agentPrompt
            });

            const agentExecutor = new AgentExecutor({
                agent,
                tools,
                verbose: true,
                maxIterations: 5,
                returnIntermediateSteps: true
            });

            const result = await agentExecutor.invoke({ input: prompt });
            
            // Format intermediate steps for a nice display
            let stepsStr = "### Agent Execution Logs ###\n";
            if (result.intermediateSteps) {
                result.intermediateSteps.forEach((step, idx) => {
                    stepsStr += `\n**Step ${idx + 1}**\n*Tool called:* \`${step.action.tool}\`\n*Input:* ${step.action.toolInput}\n*Observation:* ${step.observation.substring(0, 150)}...\n`;
                });
            }

            return `${stepsStr}\n\n### Final Answer ###\n${result.output}`;

        } catch (error) {
            console.error("Error executing agent action:", error);
            return `Agent failed: ${error.message}`;
        }
    });
};
