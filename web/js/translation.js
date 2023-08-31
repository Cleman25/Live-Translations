
class TranslationApp {
    constructor() {
        this.translationsDiv = document.getElementById('translations');
        this.lightbulb = document.getElementById('lightbulb');
        this.activeMicElement = document.getElementById("microphone-name");
        this.startBtn = document.getElementById('toggle-start');
        this.history = {};
        this.languages = [];
        this.started = false;
        this.activeMic = {
            id: null,
            name: null
        };
        this.languageDivs = {};
        this.langCode = window.location.pathname.split('/')[2];

        // Initial method calls and event listeners
        this.initialize();
    }

    initialize() {
        console.log(this.langCode);
        socket.emit('active_mic');
        socket.emit('supported_languages');
        socket.emit('status');

        // Fetch settings from the server
        fetch('/settings')
            .then(response => response.json())
            .then(newSettings => {
                socket.emit('update_settings', newSettings);
            });

        // Socket event listeners
        socket.on('settings-updated', this.applySettings.bind(this));
        socket.on('active-mic', this.handleActiveMic.bind(this));
        socket.on('supported-languages', this.handleSupportedLanguages.bind(this));
        socket.on('status', this.handleStatus.bind(this));
        socket.on('pause', this.handlePause.bind(this));
        socket.on('resume', this.handleResume.bind(this));
        socket.on('timeout', this.handleTimeout.bind(this));
        socket.on('error', this.handleError.bind(this));
        socket.on('translation', this.handleTranslation.bind(this));
    }


    applySettings(settings) {
        console.log(settings);
        for (const [settingKey, settingValue] of Object.entries(settings)) {
            console.log(settingKey)
            // const sanitizedSettingKey = settingKey.replace(/[^a-z0-9_-]/gi, '_');
            if (typeof settingValue === 'object' && settingValue !== null) {
                const elements = document.querySelectorAll(`#${settingKey}, .${settingKey}, ${settingKey}`);
                for (const element of elements) {
                    this.applyElementSettings(element, settingValue);
                    if (settingValue.hasOwnProperty('history')) {
                        const historyElements = element.querySelectorAll('.history');
                        for (const historyElement of historyElements) {
                            this.applyElementSettings(historyElement, settingValue.history);
                        }
                    }
                    if (settingValue.hasOwnProperty('history-span')) {
                        const historySpanElements = element.querySelectorAll('.history-span');
                        for (const historySpanElement of historySpanElements) {
                            this.applyElementSettings(historySpanElement, settingValue['history-span']);
                        }
                    }
                    if (settingValue.hasOwnProperty('language')) {
                        const languageElements = element.querySelectorAll('.language');
                        for (const languageElement of languageElements) {
                            this.applyElementSettings(languageElement, settingValue.language);
                        }
                    }
                    // currentText
                    if (settingValue.hasOwnProperty('currentText')) {
                        const currentTextElements = element.querySelectorAll('.currentText');
                        for (const currentTextElement of currentTextElements) {
                            this.applyElementSettings(currentTextElement, settingValue.currentText);
                        }
                    }
                }
            } else {
                const elements = document.querySelectorAll(`#${settingKey}, .${settingKey}, ${settingKey}`);
                for (const element of elements) {
                    this.applyElementSettings(element, settings);
                }
            }
        }
    }

    applyElementSettings(element, settings) {
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

    handleActiveMic(data) {
        console.log(data);
        fetch('/microphones')
            .then(response => response.json())
            .then(microphones => {
                for (const device of microphones.devices) {
                    if (device.id === data.id) {
                        this.activeMic.name = device.name;
                        this.activeMic.id = device.id;
                        this.activeMicElement.textContent = this.activeMic.name;
                    }
                }
            });
    }

    handleSupportedLanguages(data) {
        console.log(data);
        if (this.languages !== data) {
            // clear languages
            this.languages.length = 0;
            // loop through the data and build the languages variable
            for (const item of data) {
                this.languages.push({
                    code: item.code,
                    name: item.name
                })
            }
        }
        // find the lang from languages that match langCode
        const lang = this.languages.find(item => item.code === this.langCode)
        console.log(lang)
        // build the language box from the languageCode
        this.buildTranslationDivs(lang);
    }

    handleStatus(data) {
        console.log(data)
        this.started = data.isRunning;
        // if data.isRunning and not Paused, Listening...
        // if data.isRunning and paused, Paused...
        // if not data.isRunning, Stopped
        if (data.isRunning) {
            if (data.isPaused) {
                // statusDiv.textContent = "Paused...";
                this.toggleLightBulb('paused')
            } else {
                // statusDiv.textContent = "Listening...";
                this.toggleLightBulb('on')
            }
        } else {
            // statusDiv.textContent = `Please select a microphone and up to ${LANG_MAX} language(s) before starting.`;
            this.toggleLightBulb('off')
        }

        if (this.started) {
            this.startBtn.textContent = 'stop';
        } else {
            this.startBtn.textContent = 'play_arrow';
        }
    }

    handlePause() {
        console.log('Paused...');
        this.toggleLightBulb('paused');
        // Update status (implementation missing)
    }

    handleResume() {
        console.log('Resumed...');
        this.toggleLightBulb('on');
        // Update status (implementation missing)
    }

    handleTimeout() {
        console.log('Timeout...');
        startBtn.textContent = 'play_arrow';
        this.toggleLightBulb('off');
        // Update status (implementation missing)
    }

    handleError(data) {
        console.log(data);
        this.toggleLightBulb('off');
        // Update status with error (implementation missing)
    }

    toggleLightBulb(mode) {
        if (mode === 'on') {
            this.lightbulb.style.color = 'lime';
        } else if (mode === 'off') {
            this.lightbulb.style.color = '#FF4848';
        } else if (mode === 'paused') {
            this.lightbulb.style.color = '#FFD700';
        }
        this.lightbulb.style.boxShadow = `0 0 7px 2px ${this.lightbulb.style.color}`;
    }

    buildTranslationDivs(option) {
        // if a box for it exists, don't duplicate
        if (this.languageDivs.hasOwnProperty(option.code)) {
            return;
        }
        // reset the history
        // clear translationDivs
        this.translationsDiv.innerHTML = ''
        console.log(option)
        this.history = {};
        this.history[option.code] = [];
        const div = document.createElement('div');
        div.className = 'translation';
        div.dataset.language = option.code;
        const textContent = `${option.code.toUpperCase()} - ${option.name}`
        this.languageDivs[option.code] = {
            div: div,
            language: textContent
        }
        this.translationsDiv.appendChild(div);
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

    handleTranslation(data) {
        console.log(data)
        // updateTranscript(data.transcript, data.isFinal);
        for (const [lang, text] of Object.entries(data.translations)) {
            console.log(lang, text)
            if (lang === this.langCode) {
                this.updateLanguage(lang, text, data.isFinal);
            }
        }
    }

    updateLanguage(lang, tr, final) {
        const languageDiv = document.querySelector(`.translation[data-language="${lang}"]`);
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
}

// Instantiate the class
new TranslationApp();
