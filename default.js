const RECEPTIONIST_NAME = "Receptionist";   // Name displayed in the chat window for the receptionist
const AI_THERAPIST_NAME = "AI therapist";   // Namne displayed in the chat window for the AI therapist
const USER_NAME = "You";                    // Name displayed in the chat window for the user
const INPUT_STATES = Object.freeze({
    NONE:       Symbol("none"),
    GET_NAME:   Symbol("getName"),
    GET_API_KEY: Symbol("getApiKey"),
    CHAT:       Symbol("chat")
});
let INPUT_STATE = INPUT_STATES.NONE;

let USER                // What the user likes to be called
let OPENAI_API_KEY      // The users openai API key, used for access to (and billing for) their use of openai's API

function startOrStopSession() {
    let startStopButton = document.getElementById("start_stop");
    let inputTextbox = document.getElementById("input");
    if (startStopButton.innerHTML != "End session") {
        clearChat();
        inputTextbox.value = "";
        inputTextbox.disabled = false;
        inputTextbox.focus();
        checkinPatient()
        startStopButton.innerHTML = "End session";
    } else {
        addChatMessage(AI_THERAPIST_NAME, "Thank you for coming in today. I hope you found our session helpful.");
        inputTextbox.disabled = true;
        INPUT_STATE = INPUT_STATES.NONE
        startStopButton.innerHTML = "Start a new session";
    }
}

function getPersistedValue(name) {
    return localStorage.getItem(name);
}

function persistValue(name, value) {
    localStorage.setItem(name, value);
}

function checkinPatient() {
    USER = getPersistedValue("user");
    OPENAI_API_KEY = getPersistedValue("openai_api_key");
    if (USER == null || OPENAI_API_KEY == null) {
        addChatMessage (RECEPTIONIST_NAME, "Let's get you checked in. What should I call you?");
        INPUT_STATE = INPUT_STATES.GET_NAME;
    } else {
        addChatMessage (RECEPTIONIST_NAME, "Welcome back, " + USER + ". " + AI_THERAPIST_NAME + " will see you now. If you ever want us to forget you, just type 'FORGET'");
        INPUT_STATE = INPUT_STATES.CHAT;
        addChatMessage (AI_THERAPIST_NAME, ": Hello, " + USER + ". Why have you come to see me today?");
    }
}

function processInput(event) {
    if (event.keyCode != 13) {
        return;
    }

    let input = document.getElementById("input");

    if (INPUT_STATE == INPUT_STATES.NONE) {
        console.log("Error: INPUT_STATE is NONE");
        return;
    } else if (INPUT_STATE == INPUT_STATES.GET_NAME) {
        USER = input.value;
        persistValue("user", USER);
        addChatMessage (RECEPTIONIST_NAME, "Hi, " + USER + 
            ". Next we'll need an OpenAI API key in order to use the chat service. " +
            "If you don't already have a key, you can get one with free trial credit per <a href='https://www.howtogeek.com/885918/how-to-get-an-openai-api-key/'>here</a>. " +
            "Remember to keep your key safe! For convenience, we'll remember it in this browswers local storage (only kept on this device), and you can type " +
            "FORGET at anytime and we'll remove it.</p>");
        input.value = "";
        INPUT_STATE = INPUT_STATES.GET_API_KEY;
    } else if (INPUT_STATE == INPUT_STATES.GET_API_KEY) {
        OPENAI_API_KEY = input.value;
        persistValue("openai_api_key", OPENAI_API_KEY);
        // TODO - validate the API key!
        addChatMessage (RECEPTIONIST_NAME, "Thank you, " + USER + ". " + AI_THERAPIST_NAME + " will see you now.");
        input.value = "";
        addChatMessage (AI_THERAPIST_NAME, "Hello, " + USER + ". Why have you come to see me today?");
        INPUT_STATE = INPUT_STATES.CHAT;
    } else if (INPUT_STATE == INPUT_STATES.CHAT) {
        if (input.value == "FORGET") {
            localStorage.clear();
            addChatMessage (AI_THERAPIST_NAME, "We have forgotten you and will now conclude this session.");
            startOrStopSession();
            return;
        }
        addChatMessage(USER_NAME, input.value);
        input.value = "";
        input.disabled = true;
        getAiTherapistReply();
    } else {
        console.log("Error: INPUT_STATE is invalid");
    }
}

function getAiTherapistReply() {
    let messages = [{"role": "system", "content": "You are a helpful AI therapist who probes for more insights into your patient."}];
    let chatMessages = getChatMessages();
    for (var i = 0; i < chatMessages.length; i++) {
        let chatMessage = chatMessages[i];
        let who = chatMessage[0];
        let message = chatMessage[1];
        if (who == AI_THERAPIST_NAME) {
            messages.push({"role": "assistant", "content": message});
        } else if (who == USER_NAME) {
            messages.push({"role": "user", "content": message});
        } else if (who != RECEPTIONIST_NAME) {
            console.log("Error: paragraph " + i + " does not start with " + AI_THERAPIST_NAME + " or " + USER_NAME + " or " + RECEPTIONIST_NAME);
        }
    }

    callOpenAI(OPENAI_API_KEY, messages, 0.2)
        .catch(error => addChatMessage (AI_THERAPIST_NAME, "Sorry, I'm having my owmn troubles (" + error + ") . Please try again later."));
}

async function callOpenAI(apiKey, messages, temperature) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + apiKey
        },
        body: JSON.stringify({
            "model": "gpt-3.5-turbo",
            "messages": messages,
            "temperature": temperature,
        }),
    });

    if (!response.ok) {
        throw new Error("HTTP error! status: ${response.status}");
    }

    let data = await response.json();
    let reply = data.choices[0].message.content;
    addChatMessage (AI_THERAPIST_NAME, reply);
    input.disabled = false;
    input.focus();
}

function clearChat() {
    let scrollableText = document.getElementById("scrollable_text");
    scrollableText.innerHTML = "";
}

function addChatMessage(who, message) {
    let scrollableText = document.getElementById("scrollable_text");
    scrollableText.innerHTML += "<p>" + who + ": " + message + "</p>";
    scrollableText.scrollTop = scrollableText.scrollHeight;
}

function getChatMessages() {
    let scrollableText = document.getElementById("scrollable_text").innerHTML;
    let paragraphs = scrollableText.replaceAll("</p>", "").split("<p>");
    let messages = [];
    for (var i = 1; i < paragraphs.length; i++) {
        let paragraph = paragraphs[i];
        // Split the paragraph text on the first occurance of ": "
        let split = paragraph.split(": ", 2);
        // If the split is successful, add the paragraph to the messages array
        if (split.length == 2) {
            messages.push(split)
        } else {
            console.log("Error: paragraph " + i + " does not contain ': '");
        }
    }
    return messages;
}


    
