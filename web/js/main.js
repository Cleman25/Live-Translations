// document.addEventListener('DOMContentLoaded', () => {
    const translationsDiv = document.getElementById('translations');
    const transcriptDiv = document.getElementById('transcript');
    const lightbulb = document.getElementById('lightbulb')
    const activeMicElement = document.getElementById("microphone-name");
    const startBtn = document.getElementById('toggle-start');
    const LANG_MAX = 3;
    let history = {};
    let transcriptHistory = []
    let started = false;
    const languages = [];
    let activeMic = {
        id: null,
        name: null
    };
    let languageDivs = {}
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            let r = Math.random() * 16 | 0,
                v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    let langCode = window.location.pathname.split('/')[2];
    let instanceId = window.location.pathname.split('/')[1];
    console.log(langCode, instanceId)
    socket.emit('active_mic');
    // socket.emit('get_translations')
    socket.emit('supported_languages');
    socket.emit('status')
    // Fetch settings from the server
    fetch('/settings')
        .then(response => response.json())
        .then(newSettings => {
            // Apply settings to page elements
            socket.emit('update_settings', newSettings)
        });
    // Listen for settings changes from the server
    socket.on('settings-updated', function(newSettings) {
        console.log(newSettings)
        // Apply new settings to page elements
        applySettings(newSettings);
    });

    socket.on('active-mic', (data) => {
        console.log(data)
        // get the name from /microphones, it should match id
        fetch('/microphones')
            .then(response => response.json())
            .then(microphones => {
                // console.log(microphones.devices)
                for (const device of microphones.devices) {
                    if (device.id === data.id) {
                        activeMic.name = device.name;
                        activeMic.id = device.id;
                        activeMicElement.textContent = activeMic.name;
                        break;
                    }
                }
            });
        console.log(activeMic)
    })


    socket.on('supported-languages', (data) => {
        console.log(data)
        if (languages !== data) {
            // clear languages
            languages.length = 0;
            // loop through the data and build the languages variable
            for (const item of data) {
                languages.push({
                    code: item.code,
                    name: item.name
                })
            }
        }
        // find the lang from languages that match langCode
        const lang = languages.find(item => item.code === langCode)
        console.log(lang)
        // build the language box from the languageCode
        buildBox(lang)
    })

    // Function to apply settings to a specific element
    function applyElementSettings(element, settings) {
        if (settings.hasOwnProperty('visible') || settings.hasOwnProperty('Visible')) {
            // if header use flex
            if (element.tagName.toLowerCase() === 'header') {
                element.style.display = settings.visible ? 'flex' : 'none';
            } else {
                element.style.display = settings.visible ? 'block' : 'none';
            }
        }
        if (settings.hasOwnProperty('TextColor') || settings.hasOwnProperty('textcolor') || settings.hasOwnProperty('textColor')) {
            element.style.color = settings.TextColor;
        }
        if (settings.hasOwnProperty('Bg') || settings.hasOwnProperty('bg') || settings.hasOwnProperty('Background') || settings.hasOwnProperty('background')) {
            element.style.backgroundColor = settings.Bg;
        }
        if (settings.hasOwnProperty('fontSize') || settings.hasOwnProperty('fontsize')) {
            element.style.fontSize = settings.fontSize + 'px';
        }
        if (settings.hasOwnProperty('fontWeight') || settings.hasOwnProperty('fontweight')) {
            element.style.fontWeight = settings.fontWeight;
        }
        if (settings.hasOwnProperty('fontFamily') || settings.hasOwnProperty('fontfamily')) {
            element.style.fontFamily = settings.fontFamily;
        }
        // padding
        if (settings.hasOwnProperty('padding')) {
            element.style.padding = settings.padding + 'px';
        }
        // box-shadow
        if (settings.hasOwnProperty('boxShadow') || settings.hasOwnProperty('box-shadow') || settings.hasOwnProperty('boxshadow') || settings.hasOwnProperty('BoxShadow')
            || settings.hasOwnProperty('Box-Shadow') || settings.hasOwnProperty('Boxshadow')) {
            element.style.boxShadow = settings.boxShadow;
        }
        // border-radius
        if (settings.hasOwnProperty('borderRadius') || settings.hasOwnProperty('border-radius') || settings.hasOwnProperty('borderradius') || settings.hasOwnProperty('BorderRadius') || settings.hasOwnProperty('Border-Radius')) {
            element.style.borderRadius = settings.borderRadius;
        }
    }

    // Function to apply settings to page elements
    function applySettings(settings) {
        for (const [settingKey, settingValue] of Object.entries(settings)) {
            console.log(settingKey)
            // const sanitizedSettingKey = settingKey.replace(/[^a-z0-9_-]/gi, '_');
            if (typeof settingValue === 'object' && settingValue !== null) {
                const elements = document.querySelectorAll(`#${settingKey}, .${settingKey}, ${settingKey}`);
                for (const element of elements) {
                    applyElementSettings(element, settingValue);
                    if (settingValue.hasOwnProperty('history')) {
                        const historyElements = element.querySelectorAll('.history');
                        for (const historyElement of historyElements) {
                            applyElementSettings(historyElement, settingValue.history);
                        }
                    }
                    if (settingValue.hasOwnProperty('history-span')) {
                        const historySpanElements = element.querySelectorAll('.history-span');
                        for (const historySpanElement of historySpanElements) {
                            applyElementSettings(historySpanElement, settingValue['history-span']);
                        }
                    }
                    if (settingValue.hasOwnProperty('language')) {
                        const languageElements = element.querySelectorAll('.language');
                        for (const languageElement of languageElements) {
                            applyElementSettings(languageElement, settingValue.language);
                        }
                    }
                    // currentText
                    if (settingValue.hasOwnProperty('currentText')) {
                        const currentTextElements = element.querySelectorAll('.currentText');
                        for (const currentTextElement of currentTextElements) {
                            applyElementSettings(currentTextElement, settingValue.currentText);
                        }
                    }
                }
            } else {
                const elements = document.querySelectorAll(`#${settingKey}, .${settingKey}, ${settingKey}`);
                for (const element of elements) {
                    applyElementSettings(element, settings);
                }
            }
        }
    }


    function buildBox(option) {
        // if a box for it exists, don't duplicate
        // reset the history
        // clear translationDivs
        translationsDiv.innerHTML = ''
        console.log(option)
        history = {};
        history[option.code] = [];
        const div = document.createElement('div');
        div.className = 'translation';
        div.dataset.language = option.code;
        const textContent = `${option.code.toUpperCase()} - ${option.name}`
        languageDivs[option.code] = {
            div: div,
            language: textContent
        }
        translationsDiv.appendChild(div);
        // create a span element that floats below it (position: absolute) as a sibling
        const span = document.createElement('span');
        // build history box
        const historyDiv = document.createElement('div');
        historyDiv.className = 'history';
        historyDiv.dataset.language = option.code;
        // build currentText
        const currentText = document.createElement('div');
        currentText.className = 'currentText';
        currentText.dataset.language = option.code;
        span.className = 'language';
        span.textContent = textContent;
        div.appendChild(historyDiv);
        div.appendChild(currentText);
        div.appendChild(span);
    }

    function updateTranscript(tr, final) {
        const transcriptDiv = document.getElementById('transcript');
        const historyBox = transcriptDiv.querySelector('.history');
        const currentTextSpan = transcriptDiv.querySelector('.currentText');
        const languageSpan = transcriptDiv.querySelector('.language');

        // if final is true, push to transcript history
        if (final) {
            const historyText = document.createElement('span');
            historyText.className = 'history-span';
            historyText.innerHTML = tr;
            historyBox.appendChild(historyText);
            historyBox.scrollTop = historyBox.scrollHeight;
        }

        // update the current text span
        currentTextSpan.innerHTML = tr;
        transcriptDiv.scrollTop = transcriptDiv.scrollHeight;

        // if there's no language span, create and add one
        // if (!languageSpan) {
        //     const newLanguageSpan = document.createElement('div');
        //     newLanguageSpan.className = 'language';
        //     newLanguageSpan.textContent = 'Transcript';
        //     transcriptDiv.appendChild(newLanguageSpan);
        // }
    }

    function updateLanguage(lang, tr, final) {
        const languageDiv = document.querySelector('.translation');
        // where data-language = lang
        const historyBox = languageDiv.querySelector('.history');
        const currentTextBox = languageDiv.querySelector('.currentText');
        const languageBox = languageDiv.querySelector('.language');

        if (final) {
            if (!history[lang]) {
                history[lang] = [];
            }
            const historyText = document.createElement('span');
            historyText.className = 'history-span';
            historyText.innerHTML = tr;
            history[lang].push(historyText)
            historyBox.appendChild(historyText);
            historyBox.scrollTop = historyBox.scrollHeight;
        }

        // update the current text span
        currentTextBox.innerHTML = tr;
        languageDiv.scrollTop = languageDiv.scrollHeight;
    }

    socket.on('status', (data) => {
        console.log(data)
        started = data.isRunning;
        // if data.isRunning and not Paused, Listening...
        // if data.isRunning and paused, Paused...
        // if not data.isRunning, Stopped
        if (data.isRunning) {
            if (data.isPaused) {
                // statusDiv.textContent = "Paused...";
                toggleLightBulb('paused')
            } else {
                // statusDiv.textContent = "Listening...";
                toggleLightBulb('on')
            }
        } else {
            // statusDiv.textContent = `Please select a microphone and up to ${LANG_MAX} language(s) before starting.`;
            toggleLightBulb('off')
        }

        if (started) {
            startBtn.textContent = 'stop';
        } else {
            startBtn.textContent = 'play_arrow';
        }
    })

    // Handle translation events from the server
    socket.on('translation', function(data) {
        console.log(data)
        updateTranscript(data.transcript, data.isFinal);
        for (const [lang, text] of Object.entries(data.translations)) {
            console.log(lang, text)
            updateLanguage(lang, text, data.isFinal);
        }
    });

    // Handle timeout
    socket.on('timeout', function() {
        console.log('No stream for 30 seconds. Please try again.')
        alert('No stream for 30 seconds. Please try again.');
        // statusDiv.textContent =  `No stream for 30 seconds. Please make sure your language(s) and microphone are still selected before re-starting.`;
        startBtn.textContent = 'play_arrow';
        toggleLightBulb('off')
        setStatus("Timed Out...")
    });

    // Handle pause
    socket.on('pause', function() {
        console.log('Paused...')
        toggleLightBulb('paused')
        setStatus("Paused...")
    });

    // Handle resume
    socket.on('resume', function() {
        console.log('Resumed...')
        toggleLightBulb('on')
        setStatus("Listening...")
    });

    // Handle error
    socket.on('error', function(data) {
        console.log(data)
        alert(data);
        toggleLightBulb('off')
        setStatus(`Error: ${data}`)
        // statusDiv.textContent =  `Error: ${data.error}`;
    });

    // Handle the start button
    startBtn.addEventListener('click', () => {
        if(!started) {
            // get the deviceIndex and languages
            let deviceIndex = activeMic.id;
            let selectedLanguage = langCode;
            // if no mic or languages are selected, alert the user
            if (!deviceIndex || !selectedLanguage) {
                alert('Invalid Audio Input or Language');
                return;
            }
            
            socket.emit(`start`, { deviceIndex: parseInt(deviceIndex), languages: [selectedLanguage] });
            // statusDiv.textContent = "Listening...";
            started = true;
            toggleLightBulb("on")
            setStatus("Listening...")
            startBtn.textContent = 'play_arrow';
        } else {
            socket.emit('stop');
            toggleLightBulb("off");
            setStatus("Stopped.");
            started = false;
            startBtn.textContent = 'stop';
        }
    });

    function setStatus(text) {
        // statusDiv.textContent = text;
    }

    function toggleLightBulb(mode) {
        if (mode === 'on') {
            lightbulb.style.color = 'lime';
        } else if (mode === 'off') {
            lightbulb.style.color = '#FF4848';
        } else if (mode === 'paused') {
            lightbulb.style.color = '#FFD700';
        }
        lightbulb.style.boxShadow = `0 0 7px 2px ${lightbulb.style.color}`;
    }

// })