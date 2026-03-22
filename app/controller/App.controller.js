sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel"
], function (Controller, MessageToast, JSONModel) {
    "use strict";

    return Controller.extend("sap.copilot.controller.App", {
        onInit: function () {
            // Set initial role model
            var oModel = new JSONModel({
                currentRole: "intern"
            });
            this.getView().setModel(oModel, "viewMode");
        },

        onRoleChange: function (oEvent) {
            var sKey = oEvent.getParameter("selectedItem").getKey();
            this.getView().getModel("viewMode").setProperty("/currentRole", sKey);
            MessageToast.show("Switched to role: " + sKey);
        },

        onItemSelect: function(oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            var oNavContainer = this.byId("pageContainer");
            if (oNavContainer.getPage(sKey)) {
                oNavContainer.to(this.byId(sKey));
            } else {
                MessageToast.show("Page not implemented yet.");
            }
        },

        onAskPress: function () {
            var sQuestion = this.byId("questionInput").getValue();
            var sRole = this.getView().getModel("viewMode").getProperty("/currentRole");
            var oResponseText = this.byId("responseText");

            if (!sQuestion) {
                MessageToast.show("Please enter a question.");
                return;
            }

            oResponseText.setText("Thinking...");

            // Call CAP OData action
            $.ajax({
                url: "/odata/v4/copilot/ask",
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify({ question: sQuestion, role: sRole }),
                success: function (oData) {
                    var sAns = oData.value || "No response generated.";
                    oResponseText.setText(sAns);
                },
                error: function (oError) {
                    MessageToast.show("Error connecting to SAP Copilot AI.");
                    oResponseText.setText("Failed to fetch response. See console.");
                    console.error("AI Error:", oError);
                }
            });
        },

        onAnalyzePress: function () {
            var sQuestion = this.byId("insightInput").getValue();
            var oResponseText = this.byId("insightResponse");

            if (!sQuestion) {
                MessageToast.show("Please enter a question.");
                return;
            }

            oResponseText.setText("Analyzing Sales Data...");

            $.ajax({
                url: "/odata/v4/copilot/analyzeData",
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify({ question: sQuestion }),
                success: function (oData) {
                    var sAns = oData.value || "No analysis generated.";
                    oResponseText.setText(sAns);
                },
                error: function (oError) {
                    MessageToast.show("Error fetching data insights.");
                    oResponseText.setText("Failed to analyze data. See console.");
                    console.error("AI Insight Error:", oError);
                }
            });
        },

        onUploadPress: function () {
            var oFileUploader = this.byId("fileUploader");
            if (!oFileUploader.getValue()) {
                MessageToast.show("Please choose a file first");
                return;
            }

            MessageToast.show("Uploading and ingesting document...");
            oFileUploader.upload();
            
            oFileUploader.attachEventOnce("uploadComplete", function (oEvent) {
                var sResponse = oEvent.getParameter("responseRaw");
                if (oEvent.getParameter("status") === 200) {
                    MessageToast.show("Upload successful! Document Brain updated.");
                } else {
                    MessageToast.show("Upload failed: " + sResponse);
                }
            });
        },

        onQueryDocPress: function () {
            var sQuestion = this.byId("docQuestionInput").getValue();
            var oResponseText = this.byId("docResponseText");

            if (!sQuestion) {
                MessageToast.show("Please enter a question about the documents.");
                return;
            }

            oResponseText.setText("Querying Document Brain...");

            $.ajax({
                url: "/odata/v4/copilot/queryDocument",
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify({ question: sQuestion }),
                success: function (oData) {
                    var sAns = oData.value || "No answer generated.";
                    oResponseText.setText(sAns);
                },
                error: function (oError) {
                    MessageToast.show("Error querying document.");
                    oResponseText.setText("Failed to query document. See console.");
                    console.error("AI Doc Error:", oError);
                }
            });
        },

        onExecuteAgentPress: function () {
            var sPrompt = this.byId("agentInput").getValue();
            var oResponseText = this.byId("agentResponseText");

            if (!sPrompt) {
                MessageToast.show("Please enter a multi-step instruction.");
                return;
            }

            oResponseText.setText("Agent is planning and executing steps... Please wait.");

            $.ajax({
                url: "/odata/v4/copilot/executeAction",
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify({ prompt: sPrompt }),
                success: function (oData) {
                    var sAns = oData.value || "No result generated.";
                    oResponseText.setText(sAns);
                },
                error: function (oError) {
                    MessageToast.show("Error executing agent action.");
                    oResponseText.setText("Failed to execute action. See console.");
                    console.error("AI Agent Error:", oError);
                }
            });
        }
    });
});
