from flask import Flask, render_template, send_from_directory, request, jsonify
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
from MicrophoneStream import MicrophoneStream
from ContinuousMicrophoneStream import ContinuousMicrophoneStream
from google.api_core.exceptions import OutOfRange
import atexit
import socketio
import eventlet 

# Audio recording parameters
RATE = 16000
CHUNK = int(RATE / 10)  # 100ms
TIMEOUT = 30
JSON_DIR = "translations"
device_index = -1
isRunning = False
isPaused = False

client = speech.SpeechClient()
app = Flask(__name__, static_folder='web')
app.config.update(
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_SAMESITE='None',
)
# static_files = {
#     '/': './web'
# }
# socketio = SocketIO(app, cors_allowed_origins="*")
sio = socketio.Server(cors_allowed_origins="*")
app.wsgi_app = socketio.WSGIApp(sio, app.wsgi_app)
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

activeLanguages = {}

def getRooms():
    rooms = sio.manager.rooms['/']
    print(f'{rooms}')
    return rooms

# Load settings from a JSON file
with open('./web/settings.json', 'r') as f:
    settings = json.load(f)

@app.route('/')
@app.route('/<instance_id>/<language>')
def index(instance_id=None, language=None):
    return send_from_directory('web', 'index.html')
    
@app.route('/controls')
def show_controls():
    return send_from_directory('web', 'controls.html')

@app.route('/settings', methods=['GET'])
def get_settings():
    with open('web/settings.json') as f:
        settings = json.load(f)
    return jsonify(settings)

# @socketio.on('set-device-index')
@sio.event
def set_device_index(sid, dIndex):
    print(f'{dIndex}')
    global device_index
    device_index = int(dIndex)
    sio.emit('active-mic', device_index)
    

@sio.event
# @socketio.on('supported-languages')
def supported_languages(sid):
    global supportedLanguages
    sio.emit('supported-languages', supportedLanguages)
    
# route for supported-languages
@app.route('/supported-languages')
def supported_languages():
    global supportedLanguages
    return jsonify(supportedLanguages)

@sio.event
# @socketio.on('tab-closed')
def tab_closed(sid, data):
    print(f'Tab closed: {data}')
    global activeLanguages, languages
    #  remove data['language'] form both variables
    instance = data['instance']
    language = data['language']
    if language in activeLanguages:
        if instance in activeLanguages[language]:
            activeLanguages[language].remove(instance)
        if len(activeLanguages[language]) == 0:
            activeLanguages.pop(language)
    if language in languages:
        languages.remove(language)
    print(f'{languages}')
    sio.emit('instances', languages)

@sio.event             
# @socketio.on('tab-active')
def tab_active(sid, data):
    global activeLanguages
    instance = data['instance']
    language = data['language']
    add_language(sid, language)
    # if instance not in activeLanguages[language]:
    #     activeLanguages[language].append(instance)
    sio.emit('instances', languages)

@sio.event     
# @socketio.on('instances')
def instances(sid):
    global languages
    sio.emit('instances', languages)

@sio.event
# @socketio.on('update-settings')
def update_settings(sid, new_settings):
    # Update the settings
    global settings
    settings = new_settings

    # Save the settings back to the JSON file
    with open('./web/settings.json', 'w') as f:
        json.dump(settings, f, indent=4)

    # Emit an event to all clients to notify them of the updated settings
    sio.emit('settings-updated', settings)

# static files css, js
@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory('web', path)

@sio.event
# @socketio.on('active-mic')
def active_mic(sid):
    sio.emit('active-mic', device_index)

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

@sio.event
def add_language(sid, lang):
    global languages
    if lang not in languages:
        languages.append(lang)
    sio.emit('languages', languages)

@sio.event
# @socketio.on('start')
def start(sid):
    global stream, isRunning, isPaused, device_index, activeLanguages, languages
    # instanceId = data['instanceId']
    # language = data['language']
    # add_language(sid, language)
    # if language not in activeLanguages:
    #     activeLanguages[language] = []
    # activeLanguages[language].append(instanceId)
    if not isRunning:
        try:
            isRunning = True
            isPaused = False
            sio.emit('instances', languages)
            stream = create_new_stream()
            stream.__enter__()
            # Start the stream duration monitor thread
            threading.Thread(target=monitor_stream_duration, args=(stream,)).start()
            # Start the transcription thread
            threading.Thread(target=transcribe_stream, args=(sid,stream,)).start()
            # sio.start_background_task(transcribe_stream, stream)
            # transcribe_stream(stream)
        except Exception as e:
            logging.error(f"An error occurred: {e}")
            sio.emit('error', str(e))
            stop(sid)
        
def transcribe_stream(sid, stream):
    while isRunning:
        audio_generator = stream.generator()
        language_code = "en-CA"
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=RATE,
            language_code=language_code,
            max_alternatives=1,
            alternative_language_codes=["en-US"],
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
            print("Elapsed time: ", stream.elapsed_time())
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
                trData = {
                    'transcript': transcript,
                    'confidence': confidence,
                    'translations': translations,
                    'isFinal': result.is_final
                }
                print(f'{trData}')
                sio.emit('translation', trData)
    
                if result.is_final:
                    # Check for spoken commands
                    for command, spoken_command in spoken_commands.items():
                        if spoken_command in transcript.lower():
                            print(f"Spoken command detected: {command}")
                            if spoken_command == "stop.":
                                stop(sid)
                            elif spoken_command == "pause.":
                                pause(sid)
                            elif spoken_command == "resume.":
                                resume(sid)
                            sio.emit(command)
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
            print("Stream duration limit exceeded. Restarting stream.")
            stream.__exit__(None, None, None)
            stream = create_new_stream()
            stream.__enter__()

def create_new_stream():
    global RATE, CHUNK, device_index
    return ContinuousMicrophoneStream(RATE, CHUNK, device_index)

def check_timeout():
    print(f"Timeout check started. Will stop transcription if no audio is detected for {TIMEOUT} seconds.")
    while stream is not None:
        try:
            if time.time() - stream._last_chunk_time > TIMEOUT:
                print(f"No audio detected for {TIMEOUT} seconds. Stopping transcription.")
                stop(sid)
            time.sleep(1)  # Sleep for a short time to prevent this loop from running too fast
        except Exception as e:
            print(f"An error occurred while checking for timeout: {e}")
            break
        
def monitor_stream_duration(stream):
    print(f"Stream duration monitor started. Will stop transcription if the stream duration exceeds {300} seconds.")
    while isRunning:
        time.sleep(1)  # Check the stream duration every second
        if stream.elapsed_time() > 290:
            print("Stream duration is close to the limit. Resetting stream.")
            # Signal the end of the stream
            sio.emit('resume')
            # Reset the stream
            print("Closing stream...")
            stream.__exit__(None, None, None)
            print("Creating new stream...")
            stream = create_new_stream()
            stream.__enter__()

@sio.event
# @socketio.on("stop")
def stop(sid):
    global stream, isRunning, isPaused
    print("Stop command received")
    if stream is not None:
        stream.stop(sid)
        stream = None
        isRunning = False
        isPaused = False
    save_json()
    sio.emit('status', {
        'isRunning': isRunning,
        'isPaused': isPaused
    })
        
@sio.event
# @socketio.on('pause')
def pause(sid):
    global stream, isPaused
    print("Pause command received")
    if stream is not None:
        stream.pause()
        isPaused = True

@sio.event
# @socketio.on('resume')
def resume(sid):
    global stream, isPaused
    print("Resume command received")
    if isRunning:
        if stream is not None:
            stream.__exit__(None, None, None)
        stream = create_new_stream()
        stream.__enter__()
        threading.Thread(target=transcribe_stream, args=(stream,)).start()
    elif isPaused:
        stream.resume()
        isPaused = False
    save_json()

@sio.event
# @socketio.on('get-translations')
def get_translations(sid):
    # Get all files in translations and return them
    files = os.listdir(JSON_DIR)
    files = [file for file in files if file.endswith('.json')]
    files.sort(reverse=True)
    sio.emit('translations', files)
    
@sio.event
# @socketio.on('status')
def status(sid):
    global isRunning, isPaused
    sio.emit('status', {
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
    print(f'{languages}')
    for target in languages:
        result = translate_client.translate(text, target_language=target)
        translations[target] = result['translatedText']
        print(f'{target}: {result}\n')

    return translations

# Register the function to be called on exit
# atexit.register(save_json)

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    # socketio.serve_forever(app, debug=True)
    eventlet.wsgi.server(eventlet.listen(('', 5000)), app)