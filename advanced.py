from flask import Flask, render_template, send_from_directory, request
from flask_socketio import SocketIO, emit
from google.cloud import speech
from google.cloud import translate_v2 as translate
import pyaudio
from six.moves import queue
import os
import logging
import simple_websocket
import time
import threading
import json
from datetime import datetime

# Audio recording parameters
RATE = 16000
CHUNK = int(RATE / 10)  # 100ms
TIMEOUT = 30
JSON_DIR = "translations"

client = speech.SpeechClient()
app = Flask(__name__, static_folder='web')
socketio = SocketIO(app, cors_allowed_origins="*")
translate_client = translate.Client()
languages = []
stream = None
translationsJSON = {
    "transcript": [],
    "languages": {}
}

stop_command = "stop."
resume_command = "resume."

class MicrophoneStream(object):
    """Opens a recording stream as a generator yielding the audio chunks."""
    def __init__(self, rate, chunk, device_index):
        self._rate = rate
        self._chunk = chunk
        self._device_index = device_index

        # Create a thread-safe buffer of audio data
        self._buff = queue.Queue()
        self.closed = True
        self._last_chunk_time = time.time()

    def __enter__(self):
        self._audio_interface = pyaudio.PyAudio()
        self._audio_stream = self._audio_interface.open(
            format=pyaudio.paInt16,
            channels=1, rate=self._rate,
            input=True, frames_per_buffer=self._chunk,
            stream_callback=self._fill_buffer,
            input_device_index=self._device_index
        )

        self.closed = False

        return self

    def __exit__(self, type, value, traceback):
        self._audio_stream.stop_stream()
        self._audio_stream.close()
        self.closed = True
        self._buff.put(None)
        self._audio_interface.terminate()

    def _fill_buffer(self, in_data, frame_count, time_info, status_flags):
        """Continuously collect data from the audio stream, into the buffer."""
        self._buff.put(in_data)
        self._last_chunk_time = time.time()  # Update the timestamp
        return None, pyaudio.paContinue

    def generator(self):
        while not self.closed:
            chunk = self._buff.get()
            if chunk is None:
                return
            data = [chunk]

            while True:
                try:
                    chunk = self._buff.get(block=False)
                    if chunk is None:
                        return
                    data.append(chunk)
                except queue.Empty:
                    break

            yield b''.join(data)

    def stop(self):
        if hasattr(self, '_audio_stream'):
            self._audio_stream.stop_stream()
            self._audio_stream.close()
        self.closed = True
        self._buff.put(None)
        if hasattr(self, '_audio_interface'):
            self._audio_interface.terminate()
        
    def pause(self):
        self._audio_stream.stop_stream()

    def resume(self):
        self._audio_stream.start_stream()

@app.route('/')
def index():
    return send_from_directory('web', 'index.html')

# static files css, js
@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory('web', path)

@app.route('/microphones')
def list_microphones():
    p = pyaudio.PyAudio()
    info = p.get_host_api_info_by_index(0)
    numdevices = info.get('deviceCount')
    devices = []
    for i in range(0, numdevices): # type: ignore
        if (p.get_device_info_by_host_api_device_index(0, i).get('maxInputChannels')) > 0: # type: ignore
            devices.append({
                "id": i,
                "name": p.get_device_info_by_host_api_device_index(0, i).get('name')
            })
    return {"devices": devices}

@socketio.on('start')
def handle_start(data):
    global stream
    device_index = int(data['deviceIndex'])
    for lan in data['languages']:
        languages.append(lan)
    try:
        with MicrophoneStream(RATE, CHUNK, device_index) as stream:
            audio_generator = stream.generator()
            language_code = "en-CA"
            config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                sample_rate_hertz=RATE,
                language_code=language_code,
                # alternate language codes
                # alternative_language_codes=["en-US", "es-ES", "fr-FR", "fa-IR"],
                enable_automatic_punctuation=True,
                model='default',
                use_enhanced=True,
                enable_word_time_offsets=True
            )
            streaming_config = speech.StreamingRecognitionConfig(
                config=config,
                interim_results=True,
                single_utterance=False
            )
            requests = (speech.StreamingRecognizeRequest(audio_content=content)
                        for content in audio_generator)

            responses = client.streaming_recognize(streaming_config, requests)
            
            # Start the timeout check in a new thread
            timeout_thread = threading.Thread(target=check_timeout)
            timeout_thread.start()
            # Now, put the transcription responses to use.
            for response in responses:
                if not response.results:
                    continue

                result = response.results[0]

                # Only process the result if it's final
                # if not result.is_final:
                #     continue

                if not result.alternatives:
                    continue

                # Get the first alternative (the most likely transcription)
                alternative = result.alternatives[0]

                # Extract the transcript and confidence
                transcript = alternative.transcript
                    
                confidence = alternative.confidence

                # Translate the transcript
                translations = translate_text(transcript)

                # Send the transcript and translations to the client
                socketio.emit('translation', {
                    'transcript': transcript,
                    'confidence': confidence,
                    'translations': translations,
                    'isFinal': result.is_final
                })
                
                if result.is_final:
                    # Check for spoken commands
                    if transcript.lower() == stop_command:
                        handle_stop()
                    elif transcript.lower() == resume_command:
                        handle_resume()
                    translationsJSON["transcript"].append({
                        "datetime": datetime.now().isoformat(),
                        "transcript": transcript,
                    })
                    
                    for lang, translation in translations.items():
                        if lang not in translationsJSON["languages"]:
                            translationsJSON["languages"][lang] = []
                        translationsJSON["languages"][lang].append({
                            "datetime": datetime.now().isoformat(),
                            "translation": translation
                        })
    except Exception as e:
        logging.error(f"An error occurred: {e}")
        emit('error', str(e))

def check_timeout():
    print(f"Timeout check started. Will stop transcription if no audio is detected for {TIMEOUT} seconds.")
    while stream is not None:
        try:
            if time.time() - stream._last_chunk_time > TIMEOUT:
                print(f"No audio detected for {TIMEOUT} seconds. Stopping transcription.")
                handle_stop()
            time.sleep(1)  # Sleep for a short time to prevent this loop from running too fast
        except Exception as e:
            print(f"An error occurred while checking for timeout: {e}")
            break

@socketio.on("stop")
def handle_stop():
    global stream
    print("Stop command received")
    if stream is not None:
        stream.stop()
        stream = None
    save_json()
        
@socketio.on('pause')
def handle_pause():
    global stream
    print("Pause command received")
    if stream is not None:
        stream.pause()

@socketio.on('resume')
def handle_resume():
    global stream
    print("Resume command received")
    if stream is not None:
        stream.resume()

@socketio.on('get-translations')
def get_translations():
    # Get all files in translations and return them
    files = os.listdir(JSON_DIR)
    files = [file for file in files if file.endswith('.json')]
    files.sort(reverse=True)
    emit('translations', files)

@app.route('/download/', defaults={'filename': ''})
@app.route('/download/<filename>')
def download(filename):
    print(f'Donwload Requested for {filename}')
    if not filename:
        # Get a list of all files in the directory
        files = os.listdir(JSON_DIR)
        # Filter the list to include only .json files
        files = [file for file in files if file.endswith('.json')]
        # If there are no .json files, return an error
        if not files:
            return "No files available for download", 404
        # Get the latest file
        latest_file = max(files, key=lambda file: os.path.getmtime(os.path.join(JSON_DIR, file)))
        filename = latest_file
    elif filename not in os.listdir(JSON_DIR):
        return "File not found", 404
    return send_from_directory(JSON_DIR, filename, as_attachment=True)
        
def save_json():
    print('Saving translation data to json')
    with open(os.path.join(JSON_DIR, f"{datetime.now().date()}.json"), "w") as f:
        json.dump(translationsJSON, f, indent=4)

def translate_text(text):
    translations = {}
    for target in languages:
        result = translate_client.translate(text, target_language=target)
        translations[target] = result['translatedText']
        print(f'{target}: {result}\n')

    return translations

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    socketio.run(app, debug=True)