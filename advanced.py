
# import threading
# import eventlet
# eventlet.monkey_patch()

from flask import Flask, render_template, send_from_directory, request, jsonify
from flask_socketio import SocketIO, emit
from google.cloud import speech
from google.cloud import translate_v2 as translate
import pyaudio
from six.moves import queue
import os
import logging
# import simple_websocket
import time
import json
from datetime import datetime
from MicrophoneStream import MicrophoneStream
from ContinuousMicrophoneStream import ContinuousMicrophoneStream
from google.api_core.exceptions import OutOfRange
import atexit
# import socketio


# Create a global lock for thread-safe operations
# data_lock = threading.Lock()
# Audio recording parameters
RATE = 16000
CHUNK = int(RATE / 10)  # 100ms
TIMEOUT = 30
JSON_DIR = "translations"
device_index = -1
isRunning = False
isPaused = False

client = speech.SpeechClient()
app = Flask(__name__, static_folder="web", static_url_path="")
# app.config.update(
#     SESSION_COOKIE_SECURE=True,
#     SESSION_COOKIE_SAMESITE='None',
# )

socketio = SocketIO(app, cors_allowed_origins="*")
# sio = socketio.Server(cors_allowed_origins="*")
# app.wsgi_app = socketio.WSGIApp(sio, app.wsgi_app)
translate_client = translate.Client()
languages = []
stream = None
translationsJSON = {
    "transcript": [],
    "languages": {}
}

spoken_commands = {
    "stop": "stop.",
    "resume": "resume.",
    "pause": "pause."
}

supportedLanguages = [
    {'code': 'en', 'name': 'English'},
    {'code': 'es', 'name': 'Spanish'},
    {'code': 'fa', 'name': 'Persian'},
    {'code': 'ar', 'name': 'Arabic'},
    {'code': 'zh', 'name': 'Chinese'},
    {'code': 'fr', 'name': 'French'},
    {'code': 'de', 'name': 'German'},
    {'code': 'hi', 'name': 'Hindi'},
    {'code': 'it', 'name': 'Italian'},
    {'code': 'ja', 'name': 'Japanese'},
    {'code': 'ko', 'name': 'Korean'},
    {'code': 'pt', 'name': 'Portuguese'},
    {'code': 'ru', 'name': 'Russian'},
    {'code': 'tr', 'name': 'Turkish'},
    {'code': 'ur', 'name': 'Urdu'},
    {'code': 'ig', 'name': 'Igbo'}
]

def getRooms():
    # rooms = sio.manager.rooms['/']
    rooms = socketio.server.manager.rooms['/']
    print(f'{rooms}')
    return rooms

# Load settings from a JSON file
with open('./web/settings.json', 'r') as f:
    settings = json.load(f)


@app.route('/')
def home():
    return show_controls()

@app.route('/translation/<language>')
def index(language=None):
    if language is None:
        return "No language code specified"
    else:
        for lang in supportedLanguages:
            if lang['code'] == language:
                language = lang['name']
                break
        return render_template('index.html', title=f'{language} Translation')
    
@app.route('/controls')
def show_controls():
    return render_template('controls.html')

@app.route('/settings', methods=['GET'])
def get_settings():
    with open('web/settings.json') as f:
        settings = json.load(f)
    return jsonify(settings)

# @sio.event     
@socketio.on('instances')
def instances():
    global languages
    # sio.emit('instances', {'languages': languages})
    socketio.emit('instances', {'languages': languages})

# @sio.event
@socketio.on('set_device_index')
def set_device_index(dIndex):
    print(f'{dIndex}')
    global device_index
    device_index = int(dIndex)
    # sio.emit('active-mic', device_index)
    socketio.emit('active-mic', device_index)

# @sio.event
@socketio.on('supported_languages')
def supported_languages():
    global supportedLanguages
    # sio.emit('supported-languages', supportedLanguages)
    socketio.emit('supported-languages', supportedLanguages)
    
# route for supported-languages
@app.route('/supported-languages')
def supported_languages():
    global supportedLanguages
    return jsonify(supportedLanguages)

# @sio.event
@socketio.on('tab_closed')
def tab_closed(data):
    print(f'Tab closed: {data}')
    global languages
    language = data['language']
    # with data_lock:
    if language in languages:
        languages.remove(language)
    print(f'Removed {language}.\nCurrent Languages: {languages}')
    instances()
    
# @sio.event
@socketio.on('tab_focus')
def tab_focus(data):
    print(f'Focusing: {data}')
    # sio.emit('tab_focus', data)
    socketio.emit('tab_focus', data)

# @sio.event
@socketio.on('tab_active')
def tab_active(data):
    print(f'Tab active: {data}')
    global languages
    language = data['language']
    add_language(language)

# @sio.event
@socketio.on('update_settings')
def update_settings(new_settings):
    # Update the settings
    global settings
    settings = new_settings

    # Save the settings back to the JSON file
    with open('./web/settings.json', 'w') as f:
        json.dump(settings, f, indent=4)

    # Emit an event to all clients to notify them of the updated settings
    # sio.emit('settings-updated', settings)
    socketio.emit('settings-updated', settings)

# static files css, js
# @app.route('/<path:path>')
# def static_proxy(path):
#     return send_from_directory('web', path)

# @sio.event
@socketio.on('active_mic')
def active_mic():
    # sio.emit('active-mic', device_index)
    socketio.emit('active-mic', device_index)

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

@app.route('/test_emit')
def test_emit():
    # sio.emit('translation', {'message': 'test'})
    socketio.emit('translation', {'message': 'test'})
    return "Emitted"

# @sio.event
@socketio.on('add_language')
def add_language(lang):
    global languages
    # with data_lock:
    if lang not in languages:
        languages.append(lang)
    print(f'Added {lang}.\nCurrent Languages: {languages}')
    instances()

# @sio.event
@socketio.on('start')
def start():
    global stream, isRunning, isPaused, device_index, languages
    if not isRunning:
        try:
            isRunning = True
            isPaused = False
            # sio.emit('instances', languages)
            socketio.emit('instances', languages)
            stream = create_new_stream()
            stream.__enter__()
            # Start the transcription thread
            # socketio.start_background_task(transcribe_stream, stream)
            transcribe_stream(stream)
        except Exception as e:
            logging.error(f"An error occurred: {e}")
            # sio.emit('error', str(e))
            socketio.emit('error', str(e))
            stop()
        
def transcribe_stream(stream):
    while isRunning:
        audio_generator = stream.generator()
        language_code = "en-CA"

        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=RATE,
            language_code=language_code,
            max_alternatives=1,
            # alternative_language_codes=["en-US"],
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
        try:
            responses = client.streaming_recognize(streaming_config, requests)
            # print(f'{responses}')            
            for response in responses:
                # print(f'{response}')
                if not response.results:
                    continue
                
                result = response.results[0]
                
                if not result.alternatives:
                    continue
                
                alternative = result.alternatives[0]
                transcript = alternative.transcript
                confidence = alternative.confidence
                translations = translate_text(transcript)
                tr_data = {
                    'transcript': transcript,
                    'confidence': confidence,
                    'translations': translations,
                    'isFinal': result.is_final
                }
                send_translations(tr_data)
    
                if result.is_final:
                    # Check for spoken commands
                    for command, spoken_command in spoken_commands.items():
                        if spoken_command in transcript.lower():
                            print(f"Spoken command detected: {command}")
                            if spoken_command == "stop.":
                                stop()
                            elif spoken_command == "pause.":
                                pause()
                            elif spoken_command == "resume.":
                                resume()
                            # sio.emit(command)
                            socketio.emit(command)
                            break
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
        except OutOfRange:
            # Stream duration limit exceeded, restart the stream
            print("Elapsed time: ", stream.elapsed_time())
            print("Stream duration limit exceeded. Restarting stream.")
            stream.__exit__(None, None, None)
            stream = create_new_stream()
            stream.__enter__()
        except Exception as e:
            logging.error(f"An error occurred: {e}")
            # sio.emit('error', str(e))
            socketio.emit('error', str(e))
            stop()
            break

def send_translations(data):
    print(f'{data}')
    socketio.emit('translation', data)
    print(f"Sent translation to client: {data}")


def create_new_stream():
    global RATE, CHUNK, device_index
    return ContinuousMicrophoneStream(RATE, CHUNK, device_index)

def check_timeout():
    print(f"Timeout check started. Will stop transcription if no audio is detected for {TIMEOUT} seconds.")
    while stream is not None:
        try:
            if time.time() - stream._last_chunk_time > TIMEOUT:
                print(f"No audio detected for {TIMEOUT} seconds. Stopping transcription.")
                stop()
            time.sleep(1)  # Sleep for a short time to prevent this loop from running too fast
        except Exception as e:
            print(f"An error occurred while checking for timeout: {e}")
            break
        
def monitor_stream_duration(stream):
    print(f"Stream duration monitor started. Will stop transcription if the stream duration exceeds {300} seconds.")
    while isRunning:
        time.sleep(1)  # Check the stream duration every second
        if stream.elapsed_time() >= 280:
            print("Stream duration is close to the limit. Resetting stream.")
            # Signal the end of the stream
            # sio.emit('resume')
            socketio.emit('resume')
            # Reset the stream
            print("Closing stream...")
            stream.__exit__(None, None, None)
            print("Creating new stream...")
            stream = create_new_stream()
            stream.__enter__()

# @sio.event
@socketio.on("stop")
def stop():
    global stream, isRunning, isPaused
    print("Stop command received")
    if stream is not None:
        stream.stop()
        stream = None
        isRunning = False
        isPaused = False
    save_json()
    # sio.emit('status', {
    #     'isRunning': isRunning,
    #     'isPaused': isPaused
    # })
    status()
        
# @sio.event
@socketio.on('pause')
def pause():
    global stream, isPaused
    print("Pause command received")
    if stream is not None:
        stream.pause()
        isPaused = True

# @sio.event
@socketio.on('resume')
def resume():
    global stream, isPaused
    print("Resume command received")
    if isRunning:
        if stream is not None:
            stream.__exit__(None, None, None)
        stream = create_new_stream()
        stream.__enter__()
        # threading.Thread(target=transcribe_stream, args=(stream,)).start()
        transcribe_stream(stream)
    elif isPaused:
        stream.resume()
        isPaused = False
    save_json()

# @sio.event
@socketio.on('get_translations')
def get_translations():
    # Get all files in translations and return them
    files = os.listdir(JSON_DIR)
    files = [file for file in files if file.endswith('.json')]
    files.sort(reverse=True)
    # sio.emit('translations', files)
    socketio.emit('translations', files)
    
# @sio.event
@socketio.on('status')
def status():
    global isRunning, isPaused
    # sio.emit('status', {
    #     'isRunning': isRunning,
    #     'isPaused': isPaused
    # })
    socketio.emit('status', {
        'isRunning': isRunning,
        'isPaused': isPaused
    })

@app.route('/status')
def http_status():
    global isRunning, isPaused
    return {
        'isRunning': isRunning,
        'isPaused': isPaused
    }

# @sio.event
# @socketio.on('disconnect')
# def disconnect():
#     global languages
#     print(f'Disconnected: {request.sid}')
#     stop()
#     languages = []
#     instances()
#     status()

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
    # with data_lock:
    #     current_languages = languages.copy()
    current_languages = languages.copy()
    translations = {}
    for target in current_languages:
        result = translate_client.translate(text, target_language=target)
        translations[target] = result['translatedText']
        print(f'{target}: {result}\n')
    return translations

# Register the function to be called on exit
# atexit.register(save_json)

if __name__ == '__main__':
    logging.basicConfig(level=logging.DEBUG)
    logging.getLogger('socketio').setLevel(logging.DEBUG)
    logging.getLogger('engineio').setLevel(logging.DEBUG)
    # socketio.serve_forever(app, debug=True)
<<<<<<< HEAD
    eventlet.wsgi.server(eventlet.listen(('', 451)), app)
=======
    # eventlet.wsgi.server(eventlet.listen(('localhost', 5000)), app)
    socketio.run(app, debug=True, host='localhost', port=451)
>>>>>>> ce7b2c7c7320a5655be8eaaaa141ccb0bc95fb79
