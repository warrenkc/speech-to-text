// script.js


document.addEventListener('DOMContentLoaded', function() {
    const subscriptionKeyInput = document.getElementById('subscriptionKey');
    const regionInput = document.getElementById('region');
    const regionOptions = document.getElementById("regionOptions");
    const languageOptions = document.getElementById("languageOptions");
    const microphoneOptions= document.getElementById("microphoneOptions");
    const groqTranslationCheckbox = document.getElementById('groqTranslationCheckbox');
    const groqAPIKeyInput = document.getElementById('groqAPIKeyInput');
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
    const systemPrompt = "I used speech to text to produce the Mandarin Chinese text below. This is from a talk in Taiwan by a Japanese elder speaking Mandarin Chinese. Please fix any mistakes in the transcription because the speaker has a Japanese accent and the speech to text makes mistakes in the transcription. Please make it coherent and flow naturally. Remember this is from a meeting of Jehovah's Witnesses and the topics are often about being a Christian and following Bible principles. 範例：如果有人錯誤地說「神經」而不是「聖經」，他們可能會不小心把聖經叫做「瘋狂」而不是「神聖的經文」！ Please output just the results in English with no extra information or explanation. Thanks! ";   
    const extraVocabulary = "List of vocabulary words that are might be used:\n聖經研究者\n耶和華見證人\n弟兄\n姐妹\n基督徒姐妹\n我們的基督徒姐妹\n你的屬靈的弟兄姐妹\n另外的綿羊\n受膏基督徒\n忠信睿智的奴隸\n中央長老團\n中央長老團成員\n受浸\n施浸\n浸禮\n傳道員\n未受浸傳道員\n受了浸的傳道員\n不經常傳道的傳道員\n不活躍的傳道員\n服務\n工作\n全時服務\n以XXX的身份服務\n長老\n先驅\n僕人\n全時僕人\n上帝的僕人\n志願人員\n不受薪的志願人員\n王國聚會所建築工程\n賑災救援工作\n需要\n參加先驅訓練班\n正規先驅\n輔助先驅\n經常輔助先驅\n特別先驅\n海外傳道員\n申請XXX\n申請特別服務機會\n申請參加基列聖經學校\n申請表\n推薦\n填寫申請表\n填寫正規先驅申請表\n提交申請表\n被推薦做長老\n推薦XXX成為長老\n任命\n被任命為XXX\n任命XXX為助理僕人\n資格\n討論XXX是否符合資格做未受浸傳道員\n符合資格受浸\n符合資格成為做未受浸傳道員\n監督\n《作為恩賜的人》\n助理僕人\n長老團\n舉行長老團會議\n會眾服務委員會\n長老團統籌者\n會眾秘書\n傳道監督\n守望台研究班主持人\n傳道訓練班監督\n特別導師\n小組監督\n司法委員會\n成立司法委員會\n屬靈的牧人\n屬靈的羊\n牧養探訪\n牧養探訪XXX\n周遊監督\n分區監督\n分區\n代理分區監督\n探訪會眾\n分區監督的探訪\n區域監督\n區域\n海外特訪監督\n會眾\n分會眾\n成立(一個)新的會眾\n基督徒會眾\n小組\n偏遠小組\n外語小組\n分部\n耶和華見證人的分部辦事處\n分部統籌者\n分部委員會\n國家委員會\n伯特利\n伯特利成員\n參觀\n傳道部\n世界總部\n招待員\n出席(聚會)的人\n聽眾\n計算出席聚會人數\n出席聚會人數\n傳遞麥克風的人\n麥克風\n傳遞(/負責)麥克風\n調整麥克風\n打開麥克風\n關閉麥克風\n負責音響的弟兄\n音響系統\n操作音響系統\n調大音量\n調小音量\n負責講臺的弟兄\n講臺\n講桌\n調整講桌\n負責書刊的弟兄\n書籍部\n預定書刊\n負責雜誌的弟兄\n雜誌部\n領取[你的]雜誌\n負責地區的弟兄\n(傳道)地區\n外勤服務地區地圖\n地區卡\n負責帳目的弟兄\n帳目\n會眾帳目\n整理會眾帳目\n審計會眾帳目\n捐款\n支持全球工作的捐款\n本地捐款\n計算捐款\n做出捐獻\n為全球工作捐款\n捐款箱\n把捐款放入捐款箱內 \n";
    // Code to use Groq API. 
    async function callGroqAPI(message) {
        const groqAPIKey = groqAPIKeyInput.value.trim();
        if (!groqAPIKey) {
            alert("Please enter your Groq API Key.");
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
                        // {'role': 'system', 'content': systemPrompt},
                        {'role': 'user', 'content': systemPrompt + message + extraVocabulary}
                    ],
                    'model': 'deepseek-r1-distill-llama-70b',
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