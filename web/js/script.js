// const microphoneSelect = document.getElementById('microphone-select');
// const languagesSelect = document.getElementById('languages');
// const translationsDiv = document.getElementById('translations');
// const layoutRadios = document.getElementsByName('layout');
// const startBtn = document.getElementById('start');
// const stopBtn = document.getElementById('stop');
// const transcriptDiv = document.getElementById('transcript');
// const statusDiv = document.getElementById("status");
// const menuBtn = document.getElementById("menu-button")
// const controls = document.getElementById('controls');
// const lightbulb = document.getElementById('lightbulb')
// // const downloadLink = document.getElementById("downloadLink")
// const LANG_MAX = 3;
// let selected = [];
// let history = {};
// let transcriptHistory = []
// let started = false;
// statusDiv.textContent = `Please select a microphone and up to ${LANG_MAX} language(s) before starting.`;
// let languageDivs = {}


// function generateUUID() {
//     return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
//         var r = Math.random() * 16 | 0,
//             v = c === 'x' ? r : (r & 0x3 | 0x8);
//         return v.toString(16);
//     });
// }

// let tabID = generateUUID();
// console.log(tabID)
// if (!sessionStorage.tabID) {
//     sessionStorage.tabID = generateUUID();
// }
// console.log(sessionStorage.tabID);  // This will be unique for each tab
// // Fetch the list of microphones when the page loads
// window.onload = function() {
//     fetch('/microphones')
//         .then(response => response.json())
//         .then(data => {
//             for (const device of data.devices) {
//                 const option = document.createElement('option');
//                 option.value = device.id;
//                 option.text = device.name;
//                 microphoneSelect.appendChild(option);
//             }
//         });
//     // Fetch settings from the server
//     fetch('/settings')
//         .then(response => response.json())
//         .then(settings => {
//             // Apply settings to page elements
//             applySettings(settings);
//         });

    

//     socket.emit('get-translations')
//     socket.emit('status')
// };
// // Function to apply settings to a specific element
// function applyElementSettings(element, settings) {
//     element.style.display = settings.visible ? 'block' : 'none';
//     element.style.color = settings.textColor;
//     element.style.backgroundColor = settings.bg;
//     element.style.fontSize = settings.fontSize + 'px';
//     element.style.fontWeight = settings.fontWeight;
//     element.style.fontFamily = settings.fontFamily;
// }

// // Function to apply settings to a specific text element
// function applyTextSettings(element, settings) {
//     element.style.color = settings.textColor;
//     element.style.backgroundColor = settings.bg;
// }

// // Function to apply settings to a specific history element
// function applyHistorySettings(element, settings) {
//     element.style.color = settings.historyTextColor;
//     element.style.backgroundColor = settings.historyBg;
// }

// // Function to apply settings to a specific current text element
// function applyCurrentTextSettings(element, settings) {
//     element.style.color = settings.currentTextColor;
//     element.style.backgroundColor = settings.currentBg;
// }

// // Function to apply settings to a specific language element
// function applyLanguageSettings(element, settings) {
//     element.style.color = settings.languageTextColor;
//     element.style.backgroundColor = settings.languageTextBg;
// }

// // Function to apply settings to a specific history span element
// function applyHistorySpanSettings(element, settings) {
//     element.style.color = settings.historySpanTextColor;
//     element.style.backgroundColor = settings.historySpanBg;
// }
// // Function to apply settings to page elements
// function applySettings(settings) {
//     for (const [settingKey, settingValue] of Object.entries(settings)) {
//         const elements = document.querySelectorAll(`.${settingKey}`);
//         for (const element of elements) {
//             applyElementSettings(element, settingValue);
//             const textElements = element.querySelectorAll('.text');
//             for (const textElement of textElements) {
//                 applyTextSettings(textElement, settingValue);
//             }
//             const historyElements = element.querySelectorAll('.history');
//             for (const historyElement of historyElements) {
//                 applyHistorySettings(historyElement, settingValue);
//             }
//             const currentTextElements = element.querySelectorAll('.currentText');
//             for (const currentTextElement of currentTextElements) {
//                 applyCurrentTextSettings(currentTextElement, settingValue);
//             }
//             const languageElements = element.querySelectorAll('.language');
//             for (const languageElement of languageElements) {
//                 applyLanguageSettings(languageElement, settingValue);
//             }
//             const historySpanElements = element.querySelectorAll('.history-span');
//             for (const historySpanElement of historySpanElements) {
//                 applyHistorySpanSettings(historySpanElement, settingValue);
//             }
//         }
//     }
// }
// // Populate the languages dropdown
// const languages = [
//     {code: 'en', name: 'English'},
//     {code: 'es', name: 'Spanish'},
//     {code: 'fa', name: 'Persian'},
//     {code: 'ar', name: 'Arabic'},
//     {code: 'zh', name: 'Chinese'},
//     {code: 'fr', name: 'French'},
//     {code: 'de', name: 'German'},
//     {code: 'hi', name: 'Hindi'},
//     {code: 'it', name: 'Italian'},
//     {code: 'ja', name: 'Japanese'},
//     {code: 'ko', name: 'Korean'},
//     {code: 'pt', name: 'Portuguese'},
//     {code: 'ru', name: 'Russian'},
//     {code: 'tr', name: 'Turkish'},
//     {code: 'ur', name: 'Urdu'},
//     {code: 'ig', name: 'Igbo'}
//     // Add more languages here
// ];

// menuBtn.addEventListener('click', () => {
//     // if #controls display is grid, set it to none, else grid
//     if (controls.style.display === 'none') {
//         controls.style.display = 'flex';
//     } else {
//         controls.style.display = 'none';
//     }
// })

// // Handle layout changes
// for (const radio of layoutRadios) {
//     radio.addEventListener('change', () => {
//         translationsDiv.className = radio.value;
//     });
// }

// async function buildLanguages() {
//     return new Promise((resolve, reject) => {
//         try {
//             for (const {code, name} of languages) {
//                 const option = document.createElement('option');
//                 option.value = code;
//                 option.textContent = `${code.toUpperCase()} - ${name}`;
//                 languagesSelect.appendChild(option);
//                 // select en, es and fa as default
//                 if (code === 'fr' || code === 'es' || code === 'fa') {
//                     option.selected = true;
//                     buildBox(option);
//                 }
//             }
            
//             languagesSelect.style.height = `${languages.length*23}px`;
//             resolve()
//         } catch (e) {
//             reject(e)
//         }
//     })
// }

// function buildBox(option) {
//     // reset the history
//     history = {};
//     history[option.value] = [];
//     const div = document.createElement('div');
//     div.className = 'translation';
//     div.dataset.language = option.value;
//     languageDivs[option.value] = {
//         div: div,
//         language: option.textContent
//     }
//     translationsDiv.appendChild(div);
//     // create a span element that floats below it (position: absolute) as a sibling
//     const span = document.createElement('span');
//     // build history box
//     const historyDiv = document.createElement('div');
//     historyDiv.className = 'history';
//     historyDiv.dataset.language = option.value;
//     span.className = 'language';
//     span.textContent = option.textContent;
//     div.appendChild(historyDiv);
//     div.appendChild(span);
// }

// function updateTranscript(tr, final) {
//     const transcriptDiv = document.getElementById('transcript');
//     const historyBox = transcriptDiv.querySelector('.history');
//     const currentTextSpan = transcriptDiv.querySelector('.currentText');
//     const languageSpan = transcriptDiv.querySelector('.language');

//     // if final is true, push to transcript history
//     if (final) {
//         const historyText = document.createElement('span');
//         historyText.className = 'history-span';
//         historyText.innerHTML = tr;
//         historyBox.appendChild(historyText);
//         historyBox.scrollTop = historyBox.scrollHeight;
//     }

//     // update the current text span
//     currentTextSpan.innerHTML = tr;
//     transcriptDiv.scrollTop = transcriptDiv.scrollHeight;

//     // if there's no language span, create and add one
//     if (!languageSpan) {
//         const newLanguageSpan = document.createElement('div');
//         newLanguageSpan.className = 'language';
//         newLanguageSpan.textContent = 'Transcript';
//         transcriptDiv.appendChild(newLanguageSpan);
//     }
// }

// socket.on('status', (data) => {
//     console.log(data)
//     // if data.isRunning and not Paused, Listening...
//     // if data.isRunning and paused, Paused...
//     // if not data.isRunning, Stopped
//     if (data.isRunning) {
//         if (data.isPaused) {
//             statusDiv.textContent = "Paused...";
//             toggleLightBulb('paused')
//         } else {
//             statusDiv.textContent = "Listening...";
//             toggleLightBulb('on')
//         }
//     } else {
//         statusDiv.textContent = `Please select a microphone and up to ${LANG_MAX} language(s) before starting.`;
//         toggleLightBulb('off')
//     }
// })

// socket.on('translations', (data) => {
//     // files returned from the server
//     // build a li to hook into #tr_files (ul)
//     // on click, call the download for the filename
//     console.log(data)
//     const files = data;
//     const ul = document.getElementById('tr_files');
//     ul.innerHTML = '';
//     for (const file of files) {
//         const li = document.createElement('li');
//         const a = document.createElement('a');
//         a.href = '#';
//         a.textContent = file;
//         a.dataset.filename = `${file}`
//         a.addEventListener('click', (e) => {
//             e.preventDefault();
//             download(file);
//         })
//         li.appendChild(a);
//         ul.appendChild(li);
//     }
// })

// // function showHistory(lang) {
// //     const historyBox = languageDivs[lang].div.querySelector('.history');
// //     historyBox.innerHTML = '';
// //     for (const text of history[lang]) {
// //         historyBox.appendChild(text);
// //     }
// // }

// // Handle timeout
// socket.on('timeout', function() {
//     console.log('No stream for 30 seconds. Please try again.')
//     alert('No stream for 30 seconds. Please try again.');
//     statusDiv.textContent =  `No stream for 30 seconds. Please make sure your language(s) and microphone are still selected before re-starting.`;
//     startBtn.disabled = false;
//     stopBtn.disabled = true;
//     toggleLightBulb('off')
//     setStatus("Timed Out...")
// });

// // Handle pause
// socket.on('pause', function() {
//     console.log('Paused...')
//     toggleLightBulb('paused')
//     setStatus("Paused...")
// });

// // Handle resume
// socket.on('resume', function() {
//     console.log('Resumed...')
//     toggleLightBulb('on')
//     setStatus("Listening...")
// });

// // Handle error
// socket.on('error', function(data) {
//     console.log(data)
//     alert(data);
//     toggleLightBulb('off')
//     setStatus(`Error: ${data}`)
//     // statusDiv.textContent =  `Error: ${data.error}`;
// });