using { sap.copilot as db } from '../db/schema';

service CopilotService {
    @readonly entity SalesOrders as projection on db.SalesOrders;

    @open
    type AskRequest {
        question: String;
        role: String;
    }

    action ask(question: String, role: String) returns String;
    action analyzeData(question: String) returns String;
    action queryDocument(question: String) returns String;
    action executeAction(prompt: String) returns String;
}
