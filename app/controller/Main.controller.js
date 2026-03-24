sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel"
], function (Controller, MessageToast, JSONModel) {
    "use strict";

    return Controller.extend("sap.copilot.controller.Main", {
        onInit: function () {
            // Set initial role model
            var oModel = new JSONModel({
                currentRole: "intern"
            });
            this.getView().setModel(oModel, "viewMode");

            // Load Sales Data into Chart Model
            var oSalesModel = new JSONModel();
            oSalesModel.loadData("/api/getSalesData");
            this.getView().setModel(oSalesModel, "salesData");

            // Ensure an initial page is visible without waiting for first nav selection.
            var oInitialPage = this.byId("processPage");
            var oNavContainer = this.byId("pageContainer");
            if (oInitialPage && oNavContainer) {
                oNavContainer.to(oInitialPage);
            }
        },

        onRoleChange: function (oEvent) {
            var sKey = oEvent.getParameter("selectedItem").getKey();
            this.getView().getModel("viewMode").setProperty("/currentRole", sKey);
            MessageToast.show("Switched to role: " + sKey);
        },

        onItemSelect: function(oEvent) {
            var oItem = oEvent.getParameter("item");
            var sKey = oItem && oItem.getKey ? oItem.getKey() : oEvent.getParameter("key");
            var mPageKeyMap = {
                processPage: "processPage",
                insightsPage: "insightsPage",
                docsPage: "docsPage",
                agentPage: "agentPage"
            };
            var mItemIdToPageMap = {
                navProcess: "processPage",
                navInsights: "insightsPage",
                navDocs: "docsPage",
                navAgent: "agentPage"
            };
            var sItemId = oItem && oItem.getId ? oItem.getId().split("--").pop() : "";
            var sTargetPageId = mPageKeyMap[sKey] || mItemIdToPageMap[sItemId] || "processPage";
            var oNavContainer = this.byId("pageContainer");
            var oPage = this.byId(sTargetPageId);
            var oFallbackPage = this.byId("processPage");

            if (oPage && oNavContainer) {
                oNavContainer.to(oPage);
            } else if (oFallbackPage && oNavContainer) {
                oNavContainer.to(oFallbackPage);
                MessageToast.show("Unable to navigate to the selected page.");
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

            // Call Python REST API
            $.ajax({
                url: "/api/ask",
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
                url: "/api/analyzeData",
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
                url: "/api/queryDocument",
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
                url: "/api/executeAction",
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
