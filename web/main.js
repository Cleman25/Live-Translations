const socket = io.connect('http://127.0.0.1:5000');
const microphoneSelect = document.getElementById('microphone-select');
const startButton = document.getElementById('start-button');
const stopButton = document.getElementById('stop-button');
const translationsDiv = document.getElementById('translations');

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
};

// Start the translation when the start button is clicked
startButton.onclick = function() {
    const deviceIndex = microphoneSelect.value;
    socket.emit('start', deviceIndex);
    startButton.disabled = true;
    stopButton.disabled = false;
};

// Stop the translation when the stop button is clicked
stopButton.onclick = function() {
    socket.emit('stop');
    startButton.disabled = false;
    stopButton.disabled = true;
};

// // Handle translation events from the server
// socket.on('translation', function(data) {
//     const transcriptDiv = document.createElement('div');
//     transcriptDiv.className = 'transcript';
//     transcriptDiv.textContent = `Transcript: ${data.transcript}`;
//     translationsDiv.appendChild(transcriptDiv);

//     for (const [language, text] of Object.entries(data.translations)) {
//         const div = document.createElement('div');
//         div.className = 'translation';
//         div.textContent = `${language}: ${text}`;
//         translationsDiv.appendChild(div);
//     }

//     translationsDiv.scrollTop = translationsDiv.scrollHeight;
// });

// Create a div for each language
const languageDivs = {
    'es': document.createElement('div'),
    'fa': document.createElement('div'),
    'en': document.createElement('div')
};

// Add the divs to translationsDiv
for (const div of Object.values(languageDivs)) {
    div.className = 'translation';
    translationsDiv.appendChild(div);
}

// layout stuff, horizontal, vertical
const layoutRadios = document.getElementsByName('layout');
for (const radio of layoutRadios) {
    radio.addEventListener('change', () => {
        translationsDiv.className = radio.value;
    });
}

// Handle translation events from the server
socket.on('translation', function(data) {
    const transcriptDiv = document.createElement('div');
    transcriptDiv.className = 'transcript';
    transcriptDiv.textContent = `Transcript: ${data.transcript}`;
    translationsDiv.appendChild(transcriptDiv);

    for (const [language, text] of Object.entries(data.translations)) {
        // Update the text in the div for this language
        languageDivs[language].textContent = `${language}: ${text}`;
    }

    translationsDiv.scrollTop = translationsDiv.scrollHeight;
});

// Handle error events from the server
socket.on('error', function(message) {
    console.error(message);
});
