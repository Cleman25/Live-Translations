const socket = io('http://127.0.0.1:5000');
const microphoneSelect = document.getElementById('microphone-select');
const languagesSelect = document.getElementById('languages');
const translationsDiv = document.getElementById('translations');
const layoutRadios = document.getElementsByName('layout');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const transcriptDiv = document.getElementById('transcript');
const statusDiv = document.getElementById("status");
const menuBtn = document.getElementById("menu-button")
const controls = document.getElementById('controls');
// const downloadLink = document.getElementById("downloadLink")
const LANG_MAX = 3;
let selected = [];
let history = {};
let transcriptHistory = []
let started = false;
statusDiv.textContent = `Please select a microphone and up to ${LANG_MAX} language(s) before starting.`;
let languageDivs = {}
// Fetch the list of microphones when the page loads
window.onload = function() {
    fetch('/microphones')
        .then(response => response.json())
        .then(data => {
            for (const device of data.devices) {
                const option = document.createElement('option');
                option.value = device.id;
                option.text = device.name;
                microphoneSelect.appendChild(option);
            }
        });
    socket.emit('get-translations')
};
// Populate the languages dropdown
const languages = [
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

menuBtn.addEventListener('click', () => {
    // if #controls display is grid, set it to none, else grid
    if (controls.style.display === 'grid') {
        controls.style.display = 'none';
    } else {
        controls.style.display = 'grid';
    }
})

const transcriptHistoryBox = document.createElement('div')
transcriptHistoryBox.className = 'history';
transcriptHistoryBox.dataset.language = 'transcript';
transcriptDiv.appendChild(transcriptHistoryBox);

// Handle layout changes
for (const radio of layoutRadios) {
    radio.addEventListener('change', () => {
        translationsDiv.className = radio.value;
    });
}

async function buildLanguages() {
    return new Promise((resolve, reject) => {
        try {
            for (const {code, name} of languages) {
                const option = document.createElement('option');
                option.value = code;
                option.textContent = `${code.toUpperCase()} - ${name}`;
                languagesSelect.appendChild(option);
                // select en, es and fa as default
                if (code === 'fr' || code === 'es' || code === 'fa') {
                    option.selected = true;
                    buildBox(option);
                }
            }
            
            languagesSelect.style.height = `${languages.length*23}px`;
            resolve()
        } catch (e) {
            reject(e)
        }
    })
}

function buildBox(option) {
    // reset the history
    history = {};
    history[option.value] = [];
    const div = document.createElement('div');
    div.className = 'translation';
    div.dataset.language = option.value;
    languageDivs[option.value] = {
        div: div,
        language: option.textContent
    }
    translationsDiv.appendChild(div);
    // create a span element that floats below it (position: absolute) as a sibling
    const span = document.createElement('span');
    // build history box
    const historyDiv = document.createElement('div');
    historyDiv.className = 'history';
    historyDiv.dataset.language = option.value;
    span.className = 'language';
    span.textContent = option.textContent;
    div.appendChild(historyDiv);
    div.appendChild(span);
}

function updateTranscript(tr, final) {
    // create a span for the tr
    // if final is true, push to transcript history
    // then add a span for the final text and add to the historyBox (make one if there isn't any)
    // if there's no language span, create and add one
    const historyBox = transcriptDiv.querySelector('.history')
    if (final) {
        const historyText = document.createElement('span')
        historyText.className = 'history-span';
        historyText.innerHTML = tr;
        transcriptHistory.push(historyText);
        transcriptHistoryBox.appendChild(historyText);
        historyBox.scrollTop = historyBox.scrollHeight;
    }
    const trSpan = document.createElement('div')
    trSpan.className = 'currentText';
    trSpan.innerHTML = tr;
    const currentText = transcriptDiv.querySelector('.currentText');
    if (currentText) {
        currentText.remove();
    }
    transcriptDiv.appendChild(trSpan);
    transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
}

socket.on('translations', (data) => {
    // files returned from the server
    // build a li to hook into #tr_files (ul)
    // on click, call the download for the filename
    console.log(data)
    const files = data;
    const ul = document.getElementById('tr_files');
    ul.innerHTML = '';
    for (const file of files) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = file;
        a.dataset.filename = `${file}`
        a.addEventListener('click', (e) => {
            e.preventDefault();
            download(file);
        })
        li.appendChild(a);
        ul.appendChild(li);
    }
})

buildLanguages()
    .then(() => {
        // on languagesSelect change, create the divs
        languagesSelect.addEventListener('change', (e) => {
            selected = Array.from(languagesSelect.selectedOptions);
            // can't select more than lang_max
            if (languagesSelect.selectedOptions.length > LANG_MAX) {
                alert(`You can only select up to ${LANG_MAX} languages.`);
                // undo the selection
                selected[selected.length - 1].selected = false;
                selected.pop();
            }
            // stop the translation and disable
            for (const {div} of Object.values(languageDivs)) {
                div.remove();
            }
            for (const option of languagesSelect.selectedOptions) {
                buildBox(option);
            }
        });
    })
    .catch(() => {

    })

// Handle translation events from the server
socket.on('translation', function(data) {
    console.log(data)
    updateTranscript(data.transcript, data.isFinal);
    for (const [lang, text] of Object.entries(data.translations)) {
        const div = languageDivs[lang].div;
        // create a span element that floats below it (position: absolute) as a sibling
        const span = document.createElement('span');
        span.className = 'language';
        span.textContent = lang;
        span.textContent = languageDivs[lang].language;
        const historyBox = div.querySelector('.history');
        if (!history[lang]) {
            history[lang] = [];
        }
        if (data.isFinal) {
            const historyText = document.createElement('span')
            historyText.className = 'history-span';
            historyText.innerHTML = text;
            history[lang].push(historyText)
            historyBox.appendChild(historyText);
            historyBox.scrollTop = historyBox.scrollHeight;
        }
        const textElement = document.createElement('span')
        textElement.className = "currentText";
        textElement.innerHTML = text;
        // remove all currentText
        const currentText = div.querySelector('.currentText');
        if (currentText) {
            currentText.remove();
        }
        div.appendChild(textElement);
        div.appendChild(span);
        div.scrollTop = div.scrollHeight;
    }
});

// function showHistory(lang) {
//     const historyBox = languageDivs[lang].div.querySelector('.history');
//     historyBox.innerHTML = '';
//     for (const text of history[lang]) {
//         historyBox.appendChild(text);
//     }
// }

// Handle timeout
socket.on('timeout', function() {
    console.log('No stream for 30 seconds. Please try again.')
    alert('No stream for 30 seconds. Please try again.');
    statusDiv.textContent =  `No stream for 30 seconds. Please make sure your language(s) and microphone are still selected before re-starting.`;
    startBtn.disabled = false;
    stopBtn.disabled = true;
});

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

// downloadLink.addEventListener('click', (e) => {
//     e.preventDefault();
//     let filename = downloadLink.dataset.filename;
//     if (!filename) {
//         filename = "";
//     }
//     download(filename);
// })


// Handle the start button
startBtn.addEventListener('click', () => {
    const deviceIndex = microphoneSelect.value;
    var languages = Array.from(languagesSelect.querySelectorAll('option'))
        .filter(option => option.selected)
        .map(option => option.value);
    // if no mic or languages are selected, alert the user
    if (!deviceIndex || languages.length === 0) {
        alert('Please select a microphone and language(s) before starting.');
        return;
    }
    
    socket.emit('start', { deviceIndex: parseInt(deviceIndex), languages: languages });
    statusDiv.textContent = "Listening...";
    startBtn.disabled = true;
    stopBtn.disabled = false;
    started = true;
});

// if page refreshed, closed or not focused, stop
window.addEventListener('beforeunload', () => {
    if (started) {
        console.log('Page refreshed, closed or not focused. Stopping transcription.')
        socket.emit('stop');
    }
});

// if in another tab, stop
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        console.log('Tab is hidden. Stopping transcription.')
        if (started) {
            socket.emit('stop');
        }
    }
});

// Handle the stop button
stopBtn.addEventListener('click', () => {
    socket.emit('stop');
    if (started) {
        statusDiv.textContent = "Stopped";
    }
    startBtn.disabled = false;
    stopBtn.disabled = true;
    started = false;
});
