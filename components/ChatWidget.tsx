import React, { useEffect } from 'react';

export const ChatWidget: React.FC = () => {
    useEffect(() => {
        // Extract table from URL (e.g., ?table=T1)
        const urlParams = new URLSearchParams(window.location.search);
        const tableFromUrl = urlParams.get('table');

        // Load Flowise Embed Script
        const script = document.createElement('script');
        script.type = 'module';
        script.innerHTML = `
            import Chatbot from "https://cdn.jsdelivr.net/npm/flowise-embed/dist/web.js"
            Chatbot.init({
                chatflowid: "771f0508-35a2-4317-a82d-a2b662cf52a8",
                apiHost: "https://srv1320791.hstgr.cloud",
                overrideConfig: {
                    table_number: "${tableFromUrl || ''}"
                },
                theme: {
                    button: {
                        backgroundColor: "#EAB308",
                        right: 20,
                        bottom: 20,
                        size: "medium",
                        iconColor: "black"
                    },
                    chatWindow: {
                        welcomeMessage: "Welcome to Baro OS! How can I help you today?",
                        backgroundColor: "#000000",
                        fontSize: 16,
                        poweredByTextColor: "#303235",
                        botMessage: {
                            backgroundColor: "#1f1f1f",
                            textColor: "#ffffff",
                            showAvatar: true,
                        },
                        userMessage: {
                            backgroundColor: "#EAB308",
                            textColor: "#000000",
                            showAvatar: true,
                        },
                        textInput: {
                            placeholder: "Type your query...",
                            backgroundColor: "#111111",
                            textColor: "#ffffff",
                            sendButtonColor: "#EAB308",
                        }
                    }
                }
            })
        `;
        document.body.appendChild(script);

        return () => {
            // Cleanup: Flowise doesn't have an official destroy method via script tag easily 
            // but we can remove the script. The chatbot element itself is usually appended to body.
            const chatbotElement = document.querySelector('flowise-chatbot');
            if (chatbotElement) {
                chatbotElement.remove();
            }
            document.body.removeChild(script);
        };
    }, []);

    return null; // The chatbot is rendered globally by the script
};
