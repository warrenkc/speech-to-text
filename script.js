// script.js


document.addEventListener('DOMContentLoaded', function() {
    const subscriptionKeyInput = document.getElementById('subscriptionKey');
    const regionInput = document.getElementById('region');
    const regionOptions = document.getElementById("regionOptions");
    const languageOptions = document.getElementById("languageOptions");
    const microphoneOptions= document.getElementById("microphoneOptions");
    const groqTranslationCheckbox = document.getElementById('groqTranslationCheckbox');
    const groqAPIKeyInput = document.getElementById('groqAPIKeyInput');
    const llmPromptInput = document.getElementById('llmPromptInput');
    const insertDefaultPromptBtn = document.getElementById('insertDefaultPromptBtn');
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const outputTextarea = document.getElementById('outputText');
    const outputTextInProgress = document.getElementById('outputTextInProgress');
    const outputTextFinal = document.getElementById('outputTextFinal');
    const statusDisplay = document.getElementById('status');    
    let recognizer;
    let audioConfig;

    // Load settings from local storage
    subscriptionKeyInput.value = localStorage.getItem('subscriptionKey') || "";
    regionOptions.value = localStorage.getItem('region') || "eastasia"; // Default region
    languageOptions.value = localStorage.getItem('language') || "en-US"; // Default language
    groqAPIKeyInput.value = localStorage.getItem('groqAPIKey') || "";
    llmPromptInput.value = localStorage.getItem('llmPrompt') || "";
    groqTranslationCheckbox.checked = localStorage.getItem('groqTranslation') === 'true';
    loadInputDevices(); // Load input devices

    const storedMicrophone = localStorage.getItem('microphone');
    if (storedMicrophone && Array.from(microphoneOptions.options).some(option => option.value === storedMicrophone)) {
        microphoneOptions.value = storedMicrophone;
    } else {
        microphoneOptions.value = "default"; // Default microphone
    }

    subscriptionKeyInput.addEventListener('input', saveKey); // Save key on input. This means that the key is saved as soon as it is entered.
    regionOptions.addEventListener('change', saveRegion); // Save region on input. This means that the region is saved as soon as it is entered.
    languageOptions.addEventListener('change', saveLanguage); // Save language on input. This means that the language is saved as soon as it is entered.
    microphoneOptions.addEventListener('change', saveMicrophone); // Save microphone on input. This means that the microphone is saved as soon as it is entered.
    groqTranslationCheckbox.addEventListener('change', saveGroqTranslation); // Save translation on input. This means that the translation is saved as soon as it is entered.    
    groqAPIKeyInput.addEventListener('input', saveGroqAPIKey); // Save key on input. This means that the key is saved as soon as it is entered.    
    llmPromptInput.addEventListener('input', saveLLMPrompt); // Save key on input. This means that the key is saved as soon as it is entered.
    insertDefaultPromptBtn.addEventListener('click', () => {
        llmPromptInput.value = "Please translate the following text into English fixing any mistakes etc. (with no extra information or explanation)";
        saveLLMPrompt();
    });
    startButton.addEventListener('click', startSpeechToText);
    stopButton.addEventListener('click', stopSpeechToText);

    // Save settings to local storage
    function saveKey() {
        localStorage.subscriptionKey = subscriptionKeyInput.value;
    }
    function saveRegion() {         
        console.debug("Region: ", regionOptions.value);
        localStorage.region = regionOptions.value;
    }
    function saveLanguage() {
        console.debug("Language: ", languageOptions.value);
        localStorage.language =  languageOptions.value;
    }
    function saveMicrophone() {
        console.debug("Microphone: ", microphoneOptions.value);
        localStorage.microphone =  microphoneOptions.value;
    }
    function saveGroqTranslation() {
        localStorage.groqTranslation = groqTranslationCheckbox.checked;
    }
    function saveGroqAPIKey() {
        localStorage.groqAPIKey = groqAPIKeyInput.value;
    }
    function saveLLMPrompt() {
        localStorage.llmPrompt = llmPromptInput.value;
    }
    

    function loadInputDevices() {
        navigator.mediaDevices.enumerateDevices()
            .then(devices => {
                let audioInputDevices = devices.filter(device => device.kind === 'audioinput');
                console.log("Audio input devices: ", audioInputDevices);
                audioInputDevices.forEach(device => {
                    let option = document.createElement('option');
                    option.value = device.deviceId;
                    option.text = device.label || `Microphone ${microphoneOptions.length + 1}`;
                    microphoneOptions.appendChild(option);
                });
            })
            .catch(error => {
                console.error("Error getting input devices: ", error);
            });
    }

    async function startSpeechToText() {
        startButton.disabled = true;
        stopButton.disabled = false;
        outputTextarea.value = ""; // Clear previous output
        statusDisplay.textContent = "Initializing...";

        const subscriptionKey = subscriptionKeyInput.value.trim();
        const region = regionOptions.value.trim();

        if (!subscriptionKey || !region) {
            alert("Please enter your Azure Subscription Key and Region.");
            startButton.disabled = false;
            stopButton.disabled = true;
            statusDisplay.textContent = "Ready";
            return;
        }

        try {
            const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, region);
            speechConfig.speechRecognitionLanguage = languageOptions.value;

            // audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
            audioConfig = SpeechSDK.AudioConfig.fromMicrophoneInput(microphoneOptions.value);
            
            recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

            statusDisplay.textContent = "Listening...";

            recognizer.recognizing = (s, event) => {
                // Intermediate result (while speaking)
                outputTextInProgress.value = event.result.text;
            };

            recognizer.recognized = (s, event) => {
                if (event.result.reason == SpeechSDK.ResultReason.RecognizedSpeech) {
                    outputTextarea.value += event.result.text + "\r\n"; // Final result
                    // Scroll to bottom
                    outputTextarea.scrollTop = outputTextarea.scrollHeight;
                    if (groqTranslationCheckbox.checked) {
                        // Call Groq API and get response and append to final output.
                    callGroqAPI(event.result.text).then(data => {
                        if (data && data.choices && data.choices[0] && data.choices[0].message) {
                            let result = data.choices[0].message.content;
                            // Remove <think> tags. Example: <think>好的，我现在需要处理这个</think>
                            let cleanedStr = result.replace(/<think>[\s\S]*?<\/think>\s*/, '');
                            console.log(cleanedStr);
                            
                            outputTextFinal.value += cleanedStr + "\r\n";
                            // Scroll to bottom
                            outputTextFinal.scrollTop = outputTextFinal.scrollHeight;
                        }
                    });
                    }
                    

                } else if (event.result.reason == SpeechSDK.ResultReason.NoMatch) {
                    outputTextarea.value += "No speech could be recognized...\r\n";
                }
            };

            recognizer.sessionStopped = (s, event) => {
                console.log("\n    Session stopped event.");
                stopSpeechToText(); // Automatically stop after session ends
            };

            recognizer.canceled = (s, event) => {
                console.log(`Recognition canceled. Reason: ${event.reason}`);
                if (event.reason == SpeechSDK.CancellationReason.Error) {
                    statusDisplay.textContent = `ERROR: ${event.errorDetails}`;
                }
                stopSpeechToText(); // Stop on cancellation as well
            };

            recognizer.startContinuousRecognitionAsync();


        } catch (error) {
            console.error("Error initializing speech recognition:", error);
            statusDisplay.textContent = `Error: ${error.message}`;
            startButton.disabled = false;
            stopButton.disabled = true;
        }
    }

    function stopSpeechToText() {
        startButton.disabled = false;
        stopButton.disabled = true;
        statusDisplay.textContent = "Stopping...";

        if (recognizer) {
            recognizer.stopContinuousRecognitionAsync(
                () => {
                    recognizer.close();
                    recognizer = undefined;
                    audioConfig = undefined;
                    statusDisplay.textContent = "Ready";
                },
                error => {
                    console.error("Error stopping speech recognition:", error);
                    statusDisplay.textContent = `Error stopping: ${error.message}`;
                    statusDisplay.textContent = "Ready"; // Still set to ready state after error
                }
            );
        } else {
            statusDisplay.textContent = "Ready"; // If recognizer wasn't started
        }
    }
    /*
    I used speech to text to produce the Mandarin Chinese text below. This is from a talk in Taiwan by a Japanese elder speaking Mandarin Chinese. Please fix any mistakes in the transcription because the speaker has a Japanese accent and the speech to text makes mistakes in the transcription. Please make it coherent and flow naturally. Remember this is from a meeting of Jehovah's Witnesses and the topics are often about being a Christian and following Bible principles.
Please output just the results in English with no extra information or explanation. Thanks!
    */
   
    // Code to use Groq API. 
    async function callGroqAPI(message) {
        const groqAPIKey = groqAPIKeyInput.value.trim();
        if (!groqAPIKey) {
            alert("Please enter your Groq API Key.");
            return;
        }
        if (llmPromptInput.value.trim() === "") {
            alert("Please enter your LLM Prompt if you want to use Groq API.");
            return;
        }

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + groqAPIKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    'messages': [
                         {'role': 'system', 'content': llmPromptInput.value},
                        {'role': 'user', 'content': message}
                    ],
                    'model': 'gemma2-9b-it',
                    'temperature': 0.6
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(data);
            return data;
        } catch (error) {
            console.error('Error:', error);
        }
    }
});