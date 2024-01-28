class Controls {
    startBtn = document.getElementById('start')
    stopBtn = document.getElementById('stop')
    dropdowns = document.querySelectorAll('dropdown-element');
    languagesDiv = document.getElementById('languages');
    languagesInUseDiv = document.getElementById('active-languages')
    controlsDiv = $('.controls');
    activeLanguages = {};
    supportedLanuages = {};
    settings = null;

    constructor() {
        this.emit('status');
        this.emit('get_translations');
        this.getLanguages();
        this.initializeSettings();
        this.listeners();
        this.socketListeners();
    }

    initializeSettings() {
        fetch('/settings')
            .then((res) => {
                return res.json();
            })
            .then(async (currentSettings) => {
                this.settings = currentSettings;
                await this.buildControlsForSettings(this.settings, this.controlsDiv);
            })
    }
        
    async buildControlsForSettings(settings, parentContainer, parentKey = '') {
        for(const [settingKey, settingValue] of Object.entries(settings)) {
            const fullSettingKey = parentKey ? `${parentKey}.${settingKey}` : settingKey;

            await this.buildControl(fullSettingKey, settingValue, parentContainer);
        }
    }

    async buildControl(settingPath, settingValue, parentContainer) {
        let sP = settingPath.split('.').pop();
        const controlContainer = $('<div>', {
            class: 'control'
        });
        const controlLabel = $('<label>', {
            text: sP
        });
        controlContainer.append(controlLabel);

        if (typeof settingValue === 'object' && settingValue !== null) {
            const section = $('<section>', {
                class: 'section'
            });
            controlContainer.append(section);
            await this.buildControlsForSettings(settingValue, section, settingPath);
        } else if (typeof settingValue === 'boolean') {
            const switchLabel = $('<label>', {
                class: 'switch'
            });
            const input = $('<input>', {
                type: 'checkbox',
                checked: settingValue,
                title: settingValue
            });
            input.on('change', (e) => {
                input.title = `${input.checked}`;
                this.setSettingByPath(this.settings, settingPath, input.checked);
                this.emit('update_settings', this.settings);
            });
            const span = $('<span>', {
                class: 'slider round'
            });
            switchLabel.append(input);
            switchLabel.append(span);
            controlContainer.append(switchLabel);
        } else if (typeof settingValue === 'string') {
            let input;
            if (settingPath === 'layout') {
                const inputValues = {
                    'Horizontal': {
                        data: {
                            value: 'horizontal',
                        }
                    },
                    'Vertical': {
                        data: {
                            value: 'vertical',
                        }
                    }
                }

                const input = await this.createDropdown('layout', 'Layout', 'view_module', null, null, null);
                console.log(input);
                for (const [name, value] of Object.entries(inputValues)) {
                    await input.appendValue(name, value);
                }
                console.log(input.getItems())
                input.selectItem(settingValue);
                input.addEventListener('click', (e) => {
                    let activeLayout = input.getSelected();
                    if (activeLayout) {
                        const layout = activeLayout.getAttribute('data-value');
                        this.setSettingByPath(this.settings, settingPath, layout);
                        this.emit('update_settings', this.settings);
                    }
                });
                controlContainer.append(input);
            } else {
                // if color in path, create color picker
                const colorFirstChars = [
                    '#',
                    'rgb',
                    'rgba',
                    'hsl',
                    'hsla'
                ];
                input = document.createElement('input');
                if (settingPath.toLowerCase().includes('color') || colorFirstChars.some((char) => settingValue.startsWith(char))) {
                    input.type = 'color';
                } else {
                    input.type = 'text';
                }
                input.value = settingValue;
                input.title = settingValue;
                $(input).on('change', (e) => {
                    input.title = input.value;
                    this.setSettingByPath(this.settings, settingPath, input.value);
                    this.emit('update_settings', this.settings);
                });
                console.log(input)
                controlContainer.append(input);
            }
        } else if (typeof settingValue === 'number') {
            const slider = $('<input>', {
                type: 'range',
                value: settingValue,
                title: settingValue,
                min: 0,
                max: 100
            });
            ['change', 'keyup'].forEach((listener) => {
                slider.title = slider.val();
                slider.on(listener, () => {
                    console.log(slider.val());
                    this.setSettingByPath(this.settings, settingPath, Number(slider.val()));
                    this.emit('update_settings', this.settings);
                });
            });
            controlContainer.append(slider);
        } else {
            console.log(`Unknown type for setting ${settingPath}: ${typeof settingValue}`);
        }

        parentContainer.append(controlContainer);
    }

    setSettingByPath(settings, path, value) {
        const pathParts = path.split('.');
        let currentSetting = settings;

        // Loop until the second to last part of the path to build the nested structure
        for (let part of pathParts.slice(0, -1)) {
            if (!currentSetting[part]) {
                currentSetting[part] = {};
            }
            currentSetting = currentSetting[part];
        }

        // Only set the value if the last key exists
        if (pathParts[pathParts.length - 1] in currentSetting) {
            currentSetting[pathParts[pathParts.length - 1]] = value;
        }
    }

    listeners() {
        this.startBtn.addEventListener('click', () => {
            this.start();
        });

        this.stopBtn.addEventListener('click', () => {
            this.stop();
        });

        this.dropdowns.forEach((dropdown) => {
            dropdown.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('is-active');
            });
        });

        document.addEventListener('click', (e) => {
            if (e.target.closest('tag-element')) {
                const tag = e.target.closest('tag-element');
            }

        });

        // prevent page from being closed without confirmation
        window.addEventListener('beforeunload', (e) => {
            e.preventDefault();
            // if user clicks cancel, don't close the page, otherwise close it and send a stop signal and disconnect
            e.returnValue = false;
            this.stop();
        })
    }

    emit (event, data) {
        console.log(`Emitting ${event} with data:`, data??'none');
        try {
            if (data) {            
                socket.emit(event, data);
            } else {
                socket.emit(event);
            }
        } catch(err) {
            console.log(`Error emitting ${event} with data: ${JSON.stringify(data)}\n`, err);
        }
    }

    socketListeners() {
        socket.on('translation', (data) => {
            console.log(`Received translation for ${data.language}: ${data.transcript}`);
            this.updateTranscript(data.transcript, data.isFinal);
        });

        socket.on('instances', (data) => {
            console.log(`Received instances:`, data);
            this.updateActiveLanguages(data);
        });

        socket.on('supported-languages', (data) => {
            console.log(data)
            console.log(`Received supported languages:`, data);
            this.updateSupportedLanguages(data);
        });

        socket.on('translations', (data) => {
            console.log(`Received translations:`, data);
            this.updateTranslations(data);
        })

        socket.on('error', (data) => {
            console.log('Received error:', data);
            alert(data);
            this.toggleLightbulb(false);
        })

        socket.on('status', (data) => {
            const serverInfo = $('#server-info');
            const running = serverInfo.find('.running');

            running.find('.status').text('Translating:');
            const lightbulb = running.find('.material-icons');
            this.toggleLightbulb(lightbulb, data.isRunning);
        })
    }

    toggleLightbulb(lightbulb, mode) {
        // if lightbulb is jquery object, get the first element
        if (lightbulb instanceof jQuery) {
            lightbulb = lightbulb[0];
        }
        if (mode === 'on' || mode === true) {
            lightbulb.style.color = 'lime';
        } else if (mode === 'off' || mode === false) {
            lightbulb.style.color = '#FF4848';
        }
        lightbulb.style.boxShadow = `0 0 3px 0px ${lightbulb.style.color}`;
    }

    start() {
        this.emit('start');
        this.emit('status');
    }

    stop() {
        this.emit('stop');
        this.emit('status');
    }

    getLanguages() {
        this.emit('supported_languages');
    }

    updateTranscript(tr) {
        const transcriptDiv = document.getElementById('transcript');
        const historyBox = transcriptDiv.querySelector('.history');
        const currentTextSpan = transcriptDiv.querySelector('.currentText');
        const languageSpan = transcriptDiv.querySelector('.language');

        // if final is true, push to transcript history
        const historyText = document.createElement('span');
        historyText.className = 'history-span';
        historyText.innerHTML = tr;
        historyBox.appendChild(historyText);
        historyBox.scrollTop = historyBox.scrollHeight;

        // update the current text span
        currentTextSpan.innerHTML = tr;
        transcriptDiv.scrollTop = transcriptDiv.scrollHeight;

        // if there's no language span, create and add one
        if (!languageSpan) {
            const newLanguageSpan = document.createElement('div');
            newLanguageSpan.className = 'language';
            newLanguageSpan.textContent = 'Transcript';
            transcriptDiv.appendChild(newLanguageSpan);
        }
    }

    updateActiveLanguages(data) {
        this.activeLanguages = data.languages;
        this.languagesInUseDiv.innerHTML = '';
        this.populateActiveLanguages(this.activeLanguages);
    }

    populateActiveLanguages(al) {
        console.log('Active Languages:', al);
        // activeLanguages is an array of strings ['en', 'es', 'fr']
        if (al?.length>0) {
            al.forEach((language) => {
                console.log('Language:', language);
                const lang = this.supportedLanuages.find((lang) => lang.code === language);
                const languageTag = this.createLanguageTag(lang);
                console.log('Language Tag:', languageTag);
                this.languagesInUseDiv.appendChild(languageTag);
                // languageTag.setAttribute('selected', '');
                languageTag.addEventListener('click', (e) => {
                    this.openLanguage(
                        languageTag.getAttribute('data-lang'),
                        languageTag.querySelector('.tag-title').textContent
                    );
                });
            })
        } else {
            console.log('No active languages')
        }
    }

    openLanguage(language, languageName) {
        const target = `/translation/${language}`;
        const windowName = `${languageName} Translation`;
        window.open(target, windowName);
    }

    updateSupportedLanguages(data) {
        this.languagesDiv.innerHTML = '';
        this.supportedLanuages = data;
        data.forEach((language) => {
            const languageTag = this.createLanguageTag(language);
            this.languagesDiv.appendChild(languageTag);
        });
    }

    updateTranslations(data) {
        const files = data;
        const ul = $('#tr_files');
        ul.empty();
        files.forEach((file) => {
            const li = $('<li></li>');
            const a = $('<a></a>');
            a.attr('href', `#`);
            a.text(file.split('.')[0]);
            a.attr('data-filename', file);
            a.on('click', (e) => {
                e.preventDefault();
                this.download(file);
            });
            li.append(a);
            ul.append(li);
        });
    }

    download(file) {
        const link = $('<a></a>');
        link.attr('href', `/download/${file}`);
        link.attr('download', file);
        link[0].click();
        link.remove();
    }

    toggleLanguage(language) {
        // console.log('Toggling language:', language);
        // if (this.activeLanguages[language.id]) {
        //     this.emit('remove-language', {
        //         language: language.id
        //     });
        // } else {
        //     this.emit('add-language', {
        //         language: language.id
        //     });
        // }
    }

    createLanguageTag(language) {
        if (language) {
            const languageTag = document.createElement('tag-element');
            languageTag.setAttribute('data-lang', language.code);
            const languageTagText = document.createElement('span');
            languageTagText.className = 'tag-title noselect';
            languageTagText.setAttribute('data-lang', language.code);
            languageTagText.textContent = language.name;
            languageTag.appendChild(languageTagText);
            languageTag.addEventListener('click', (e) => {
                this.openLanguage(language.code, language.name);
            });
            return languageTag;
        }
    }

    async createDropdown(id, title, preIcon = 'lists', multiple = null, searchable = null, values = null, source=null) {
        const dropdown = document.createElement('dropdown-element');
        dropdown.id = id;
        dropdown.title = title;
        if (preIcon) {
            dropdown.setAttribute('pre-icon', preIcon);
        }
        if (multiple) {
            dropdown.setAttribute('multiple', '');
        }
        if (searchable) {
            dropdown.setAttribute('searchable', '');
        }
        if (source !== null) {
            dropdown.setAttribute('source', source);
        }
        if (values !== null) {
            dropdown.setAttribute('values', values);
        }
        dropdown.getItems().forEach((item) => {
            // set the value and data-value
            item.setAttribute('data-value', item.textContent);
            item.setAttribute('value', item.textContent);
        });
        return dropdown;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const controls = new Controls();
});