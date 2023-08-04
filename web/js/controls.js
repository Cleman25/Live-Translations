
// document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start')
    const stopBtn = document.getElementById('stop')
    let dropdowns = document.querySelectorAll('.dropdown');
    const microphoneSelect = document.getElementById('microphone-select');
    let selectedMic = null;
    const languagesDiv = document.getElementById('languages');
    const languagesInUseDiv = document.getElementById('active-languages')
    let activeLanguages = { // instance1: [en, es], instance2
    }
    let languages = [
        {code: 'en', name: 'English'},
        {code: 'es', name: 'Spanish'},
        {code: 'fa', name: 'Persian'},
        {code: 'ar', name: 'Arabic'},
        {code: 'zh', name: 'Chinese'},
        {code: 'fr', name: 'French'},
        {code: 'de', name: 'German'},
        {code: 'hi', name: 'Hindi'},
        {code: 'it', name: 'Italian'},
        {code: 'ja', name: 'Japanese'},
        {code: 'ko', name: 'Korean'},
        {code: 'pt', name: 'Portuguese'},
        {code: 'ru', name: 'Russian'},
        {code: 'tr', name: 'Turkish'},
        {code: 'ur', name: 'Urdu'},
        {code: 'ig', name: 'Igbo'}
        // Add more languages here
    ];
    // get instance tabs from local if it exists
    socket.emit('status')
    socket.emit('instances')
    socket.emit('get_translations')
    socket.emit('supported_languages')
    socket.on('supported-languages', (data) => {
        languages = data;
        languagesDiv.innerHTML = '';
        populateLanguages();
        console.log('Supported languages have been updated.')
    })
    let instanceTabs = {};
    let instanceLanguages = {};
    function createDropdown(id, title, values={}, preIcon = null) {
        // values = {name: string, data: {name: value}}
        const dropdown = document.createElement('div')
        dropdown.className = 'dropdown';
        dropdown.id = id;
        dropdown.title = title;
        if(preIcon) {
            const dropdownPreIcon = document.createElement('i');
            dropdownPreIcon.className = 'dropdown-pre-icon material-icons noselect';
            dropdownPreIcon.textContent = preIcon;
            dropdown.appendChild(dropdownPreIcon);
        }
        const dropdownTitle = document.createElement('span');
        dropdownTitle.className = 'dropdown-title noselect';
        dropdownTitle.textContent = title;
        const dropdownButton = document.createElement('i');
        dropdownButton.className = 'material-icons dropdown-button noselect';
        dropdownButton.textContent = 'arrow_drop_down';
        dropdown.appendChild(dropdownTitle);
        dropdown.appendChild(dropdownButton);
        const dropdownContent = document.createElement('div')
        dropdownContent.className = 'dropdown-content';
        for (const [name, value] of Object.entries(values)) {
            const dropdownItem = document.createElement('span');
            dropdownItem.className = 'dropdown-item';
            dropdownItem.textContent = name;
            if (value.hasOwnProperty('data')) {
                for(const [dataName, dataValue] of Object.entries(value.data)) {
                    dropdownItem.dataset[dataName] = dataValue;
                }
            }
            dropdownContent.appendChild(dropdownItem);
        }
        dropdown.appendChild(dropdownContent);
        // add listeners
        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target === dropdownButton || e.target === dropdownTitle || e.target === dropdown || e.target === dropdownPreIcon) {
                if (dropdownContent.classList.contains('show')) {
                    dropdownContent.classList.remove('show');
                } else {
                    dropdownContent.classList.add('show');
                }
            }
        });
        return dropdown;
    }
    // Fetch settings from the server
    let settings;
    fetch('/settings')
        .then(response => {
            console.log(response)
            return response.json()
        })
        .then(currentSettings => {
            console.log(currentSettings)
            settings = currentSettings;
            const controlsDiv = document.querySelector('.controls');
            buildControlsForSettings(settings, controlsDiv);
        });

        function buildControlsForSettings(settings, parentContainer, parentKey = '') {
        for (const [settingKey, settingValue] of Object.entries(settings)) {
            // If parentKey is not empty, append a dot and the current settingKey to it
            // Otherwise, just use the current settingKey
            const fullSettingKey = parentKey ? `${parentKey}.${settingKey}` : settingKey;

            buildControl(fullSettingKey, settingValue, parentContainer);
        }
    }

    function buildControl(settingPath, settingValue, parentContainer) {
        // Create a container for the control
        const controlContainer = document.createElement('div');
        controlContainer.className = 'control';

        // Create a label for the control
        const controlLabel = document.createElement('label');
        // split settingPath by . and use the last item
        let sP = settingPath.split('.').pop();
        controlLabel.textContent = sP;
        controlContainer.appendChild(controlLabel);

        if (typeof settingValue === 'object' && settingValue !== null) {
            // If the setting value is an object, create a new section for it
            const section = document.createElement('section');
            section.className = 'section';
            controlContainer.appendChild(section);
            buildControlsForSettings(settingValue, section, settingPath);
        } else if (typeof settingValue === 'boolean') {
            // Create a switch for boolean settings
            const switchLabel = document.createElement('label');
            switchLabel.className = 'switch';

            const visibilitySwitch = document.createElement('input');
            visibilitySwitch.type = 'checkbox';
            visibilitySwitch.checked = settingValue;
            // title
            visibilitySwitch.title = `${settingValue}`;
            visibilitySwitch.addEventListener('change', () => {
                visibilitySwitch.title = `${visibilitySwitch.checked}`;
                setSettingByPath(settings, settingPath, visibilitySwitch.checked);
                socket.emit('update_settings', settings);  // Send the entire updated settings object
            });
            switchLabel.appendChild(visibilitySwitch);

            const switchSlider = document.createElement('span');
            switchSlider.className = 'slider round';
            switchLabel.appendChild(switchSlider);

            controlContainer.appendChild(switchLabel);
        } else if (typeof settingValue === 'string') {
            // Create a color picker or text input for string settings
            // if key is layout create a dropdown
            let input;
            if (settingPath === 'layout') {
                const inputValues = {
                    // horizontal, and vertical
                    'Horizontal': {
                        data: {
                            value: 'horizontal'
                        }
                    },
                    'Vertical': {
                        data: {
                            value: 'vertical'
                        }
                    }
                }
                input = createDropdown('layout', 'Layout', inputValues, 'keyboard');
                // set active for the settingsValue that matches
                const activeItem = input.querySelector(`[data-value="${settingValue}"]`);
                if (activeItem) {
                    activeItem.classList.add('active');
                    input.querySelector('.dropdown-title').textContent = activeItem.textContent;
                }
                input.querySelector('.dropdown-content').addEventListener('click', (e) => {
                    e.stopPropagation();
                    // switch activeItem to the item clicked, if unset then set to the first item
                    let activeItem = input.querySelector('.active');
                    if (activeItem) {
                        activeItem.classList.remove('active');
                    }
                    if (e.target.classList.contains('dropdown-item')) {
                        e.target.classList.add('active');
                        input.querySelector('.dropdown-title').textContent = e.target.textContent;
                    } else {
                        input.querySelector('.dropdown-title').textContent = 'Layout';
                    }
                    activeItem = input.querySelector('.active');
                    if (activeItem) {
                        const layout = activeItem.dataset.value;
                        setSettingByPath(settings, settingPath, layout);
                        socket.emit('update_settings', settings);  // Send the entire updated settings object
                    }
                })
            } else {
                input = document.createElement('input');
                if (settingValue.startsWith('#')) {
                    input.type = 'color';
                } else {
                    input.type = 'text';
                }
                input.value = settingValue;
                input.title = settingValue;
                // on change and on input
                input.addEventListener('change', () => {
                    input.title = input.value;
                    setSettingByPath(settings, settingPath, input.value);
                    socket.emit('update_settings', settings);  // Send the entire updated settings object
                });
            }
            controlContainer.appendChild(input);
        } else if (typeof settingValue === 'number') {
            // Create a slider for number settings
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = 0;
            slider.max = 100;
            slider.value = settingValue;
            slider.title = slider.value;
            // on hover, display the value
            // also display the value in the ::before
            ['change', 'input'].forEach((listener) => {
                // update title
                slider.title = slider.value;
                slider.addEventListener(listener, () => {
                    setSettingByPath(settings, settingPath, Number(slider.value));
                    socket.emit('update_settings', settings);  // Send the entire updated settings object
                });
            })
            controlContainer.appendChild(slider);
        }

        // Add the control to the parent container
        parentContainer.appendChild(controlContainer);
    }

    function setSettingByPath(obj, path, value) {
        const keys = path.split('.');
        let current = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            // If the current key does not exist in the object, create an empty object for it
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }

        // Only update the value if the final key exists in the object
        if (keys[keys.length - 1] in current) {
            current[keys[keys.length - 1]] = value;
        }
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
        if (!languageSpan) {
            const newLanguageSpan = document.createElement('div');
            newLanguageSpan.className = 'language';
            newLanguageSpan.textContent = 'Transcript';
            transcriptDiv.appendChild(newLanguageSpan);
        }
    }

    // Handle translation events from the server
    socket.on('translation', function(data) {
        updateTranscript(data.transcript, data.isFinal);
    });

    socket.on('window', data => {
        // update instance tab
        // if instanceTabs data.instance does not exist, create one and equal data.window
        console.log('Window:',data)
        try {
            if (!instanceTabs[data.instance]) {
                instanceTabs[data.instance] = data.window;
            }
        } catch(e) {
            console.log(e)
        }
    })

    function createLanguageTag(language) {
        // console.log(language)
        if (language) {
            const languageTag = document.createElement('div');
            languageTag.className = 'tag';
            languageTag.dataset.lang = language.code;
            const languageTagText = document.createElement('span');
            languageTagText.className = 'tag-title noselect';
            languageTagText.dataset.lang = language.code;
            languageTagText.textContent = language.name;
            languageTag.addEventListener('click', () => {
                if (!languageTag.classList.contains('tag-active')) {
                    languageTag.classList.add('tag-active');
                    const languageTagX = document.createElement('span');
                    languageTagX.className = 'material-icons tag-close noselect';
                    languageTagX.textContent = 'close';
                    languageTagX.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        languageTag.classList.remove('tag-active');
                        languageTag.removeChild(languageTagX);
                    })
                    languageTag.insertBefore(languageTagX, languageTagText);
                }
            });
            languageTag.appendChild(languageTagText);
            return languageTag;
        }
        return;
    }


    function populateLanguages() {
        languages.forEach(language => {
            const languageTag = createLanguageTag(language);
            languagesDiv.appendChild(languageTag);
        });
    }

    populateLanguages();

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
                v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    socket.on('status', data => {
        const serverInfo = document.getElementById('server-info');
        const running = serverInfo.querySelector('.running')
        const paused = serverInfo.querySelector('.paused')

        running.querySelector('.status').textContent = `Translating:`;
        const lightbulb = running.querySelector('.material-icons');
        toggleLightBulb(lightbulb, data.isRunning);
        paused.querySelector('.status').textContent = `Paused:`;
        const lightbulb2 = paused.querySelector('.material-icons');
        toggleLightBulb(lightbulb2, data.isPaused ? 'paused' : data.isRunning ? 'not paused' : data.isPaused);
    })

    function toggleLightBulb(lightbulb, mode) {
        if (mode === 'on' || mode === true) {
            lightbulb.style.color = 'lime';
        } else if (mode === 'off' || mode === false) {
            lightbulb.style.color = '#FF4848';
        } else if (mode === 'paused') {
            lightbulb.style.color = '#FFD700';
        } else if (mode === 'not paused') {
            lightbulb.style.color = 'lime';
        }
        lightbulb.style.boxShadow = `0 0 3px 0px ${lightbulb.style.color}`;
    }

    fetch('/microphones')
    .then(response => response.json())
    .then(data => {
        console.log(data)
        for (const device of data.devices) {
            const micDropDownContent = document.createElement('span');
            micDropDownContent.dataset.value = device.id
            micDropDownContent.dataset.deviceId = device.id;
            // add class
            micDropDownContent.className = 'dropdown-item';
            micDropDownContent.textContent = device.name;
            microphoneSelect.querySelector('.dropdown-content').appendChild(micDropDownContent);
        }
        dropdownUpdated();
    });
    if (document.readyState !== 'loading') {
        // Document is already ready, call the callback directly.
        dropdowns = document.querySelectorAll('.dropdown');
        dropdownUpdated();
    } else {
        // Document is not ready, wait for the DOMContentLoaded event.
        document.addEventListener('DOMContentLoaded', (e) => {
            dropdowns = document.querySelectorAll('.dropdown');
            dropdownUpdated();
        });
    }

    function dropdownUpdated() {
        dropdowns.forEach((dropdown) => {
            const content = dropdown.querySelector('.dropdown-content');
            const title = dropdown.querySelector('.dropdown-title');
            const button = dropdown.querySelector('.dropdown-button');
            // if first child is a material-icons i or span or if has class dropdown-pre-icon
            const preIcon = dropdown.querySelector('.dropdown-pre-icon') || (dropdown.firstElementChild && (dropdown.firstElementChild.tagName === 'I' || dropdown.firstElementChild.tagName === 'SPAN'));
            
            dropdown.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.target === button || e.target === title || e.target === dropdown || e.target === preIcon) {
                    console.log('test')
                    if (content.classList.contains('show')) {
                        content.classList.remove('show');
                    } else {
                        content.classList.add('show');
                    }
                }
            });
            
            // dropdown.addEventListener('mouseover', () => {
            //     button.textContent = 'arrow_drop_up';
            //     if (!content.classList.contains('show')) {
            //         content.classList.add('show')
            //     }
            // })
            
            // dropdown.addEventListener('mouseout', () => {
            //     button.textContent = 'arrow_drop_down';
            // })

            content.querySelectorAll('.dropdown-item').forEach((item) => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const activeItem = content.querySelector('.active');
                    if (activeItem) {
                        activeItem.classList.remove('active');
                    }
                    if (activeItem !== item) {
                        item.classList.add('active');
                        title.textContent = item.textContent;
                    } else {
                        if (dropdown.hasAttribute('title') && dropdown.getAttribute('title') !== null) {
                            title.textContent = dropdown.getAttribute('title');
                        } else {
                            title.textContent = 'Dropdown';
                        }
                    }
                    content.classList.remove('show');
                })
            });
        })
    }

    window.addEventListener('click', (event) => {
        dropdowns = document.querySelectorAll('.dropdown');
        dropdowns.forEach((dropdown) => {
            const content = dropdown.querySelector('.dropdown-content');
            if (!dropdown.contains(event.target)) {
                content.classList.remove('show');
            }
        });
    });

    // on microphone selected, emit set-device-index
    microphoneSelect.addEventListener('click', (e) => {
        e.stopPropagation();
        const micContent = microphoneSelect.querySelector('.dropdown-content')
        if (!micContent.classList.contains('show')) {
            micContent.classList.add('show');
        }
        const activeItem = microphoneSelect.querySelector('.active');
        const items = micContent.querySelectorAll('.dropdown-item');
        items.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const deviceId = item.dataset.deviceId;
                if (!activeItem) {
                    item.classList.add('active');
                    socket.emit('set_device_index', deviceId);
                } else {
                    if (activeItem === item) {
                        activeItem.classList.remove('active');
                        socket.emit('set_device_index', -1);
                    } else {
                        activeItem.classList.remove('active');
                        item.classList.add('active');
                        socket.emit('set_device_index', deviceId);
                    }
                }
            })
        })
    });


    function populateInUse() {
        for (const language of activeLanguages) {
            // get language full text from languages
            const languageObj = languages.find(lang => lang.code === language);
            console.log(languageObj)
            const languageTag = createLanguageTag(languageObj);
            // add data.instance to the tag, make sure it matches instancesLanguages {'en': '1930f661-5d0e-4137-b45b-732e9a894eda'}
            const instanceId = instanceLanguages[language];
            languageTag.dataset.instance = instanceId;
            // add tag-active class
            languageTag.classList.add('tag-active');
            // remove onclick listener for this item and add a custome one that opens the tab associate with the instance id
            languageTag.removeEventListener('click', () => {});
            languageTag.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(instanceTabs)
                // the instanceTab where the value is equal to the language
                const instanceTab = Object.values(instanceTabs).find(tab => tab.location.href.includes(language));
                console.log(instanceTab)
                if (instanceTab) {
                    instanceTab.focus();
                }
                socket.emit('tab_focus', {
                    instance: instanceId,
                    lang: language
                })
            });
            languagesInUseDiv.appendChild(languageTag);
        }
    }

    socket.on('instances', (data) => {
        console.log('Instances:', data);
        activeLanguages = data.languages;
        instanceLanguages = data.active;
        languagesInUseDiv.innerHTML = '';
        populateInUse();
    })

    socket.on('translations', (data) => {
        console.log(data)
        const files = data;
        const ul = document.getElementById('tr_files');
        ul.innerHTML = '';
        for (const file of files) {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = '#';
            // trim the extrension
            const fileName = file.split('.')[0];
            a.textContent = fileName;
            a.dataset.filename = `${file}`
            a.addEventListener('click', (e) => {
                e.preventDefault();
                download(file);
            })
            li.appendChild(a);
            ul.appendChild(li);
        }
    })

    function download(filename) {
        // Create a link element
        const link = document.createElement('a');
        // Set the href to the server's download route
        link.href = '/download/' + (filename?? '');
        // Set the download attribute to suggest a filename for the download
        link.download = filename??'';
        // Append the link to the body
        document.body.appendChild(link);
        // Simulate a click on the link
        link.click();
        // Remove the link from the body
        document.body.removeChild(link);
    }

    startBtn.addEventListener('click', () => {
        // if no mic selected
        // if microphoneSelct's dropdown-content's dropdown items has an item with active class
        let micContent = microphoneSelect.querySelector('.dropdown-content');
        console.log(micContent)
        let activeMic = micContent.querySelector('.active')
        if (activeMic) {
            // get the selected item's value
            selectedMic = activeMic.dataset.value;
            socket.emit('start');
        } else {
            alert('Please select a microphone.')
        }
        socket.emit('status');
    })

    stopBtn.addEventListener('click', () => {
        socket.emit('status');
        socket.emit('stop');
    })

    // document.addEventListener('DOMContentLoaded', () => {
        document.body.addEventListener('click', (e) => {
            let target = e.target;
            // console.log(target)
            while (target && !target.matches('.tag')) {
                target = target.parentElement;
            }
            if (target) {
                e.preventDefault();
                try {
                    // if an instance tab of this exists, focus on that tab
                    let language = target.dataset.lang;
                    let instanceId;
                    console.log(instanceId, language)
                    // if instanceTab where the language's window exists, open it
                    const instanceTab = Object.values(instanceTabs).find(tab => tab.location.href.includes(language));
                    console.log(instanceTab);
                    if (instanceTab) {
                        // remove tag-active from this tag
                        target.classList.remove('tag-active');
                        instanceTab.focus();
                    } else {
                        instanceId = generateUUID();
                        const url = `/${instanceId}/${language}`;
                        // console.log(url)
                        const tab = window.open(url, '_blank');
                        // // console.log(tab)
                        instanceTabs[instanceId] = tab;
                        console.log(instanceTabs)
                        // // open the tab
                        tab.focus();
                        socket.emit('tab_focus', {
                            instance: instanceId,
                            lang: language
                        })
                        if (!activeLanguages[language]) {
                            activeLanguages[language] = [];
                        }
                        activeLanguages[language].push(instanceId);
                        // socket.emit('start', { instanceId, language });
                    }
                } catch(e) {
                    console.log(e);
                }
            }
        })
    // })

// })