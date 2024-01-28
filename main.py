from flask import Flask, render_template, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
from google.cloud import translate_v2 as translate
import os
import logging
import threading
import json
import time
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

isRunning = False
JSON_DIR = "translations"
app = Flask('NBC Live translation', static_folder="web", static_url_path="")
socketio = SocketIO(app, cors_allowed_origins="*")
transcription_dir = './translations/'
transcription_path = ""
translationsJSON = {
    "transcript": [],
    "languages": {}
}
translate_client = translate.Client()

languages = []
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

def updatetranscription_path(tpath):
    global transcription_path, transcription_dir
    tempTranscription_path = transcription_dir+tpath
    # remove // and test for location, if it exists, update curerntTranslation
    tempTranscription_path.replace('//', '/')
    if os.path.exists(tempTranscription_path):
        transcription_path = tempTranscription_path
    print(f'Current translation: {transcription_path}')

# Function to handle new file creation
class NewFileHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory or not event.src_path.endswith('.txt'):
            return
        # Call getLatestTranscription when a new file is created
        getLatestTranscription()
        
def getLatestTranscription():
    """ Look for the latest transcription and update the transcription_path with the correct path
    """
    print(f'Looking for latest transcription')
    global transcription_path, transcription_dir
    print(f'Trasnscription Directory: {transcription_dir}')
    # Get a list of all files in the directory
    files = os.listdir(transcription_dir)
    print(f'files pre check {files}')
    # Filter the list to include only .txt files
    files = [file for file in files if file.endswith('.txt')]
    print(f'files exclusive {files}')
    # If there are no .txt files, return an error
    if not files:
        return "No transcriptions", 404
    # Get the latest file
    latest_file = max(files, key=lambda file: os.path.getmtime(os.path.join(transcription_dir, file)))
    # Update the transcription_path
    updatetranscription_path(latest_file)
    return transcription_path

def getTranscription():
    last_size = 0
    global transcription_path
    while isRunning:
        if transcription_path is None:
            logging.error("transcription_path is not set.")
            time.sleep(5)  # Wait for some time before trying again
            continue
        try:
            # the tail read
            current_size = os.path.getsize(transcription_path)
            # print(f'Current Size: {current_size}')
            if current_size > last_size:
                print(f'Change Detected in Transcripted File')
                with open(transcription_path, 'r') as file:
                    file.seek(last_size)
                    transcript = file.read()
                    
                    translations = translate_text(transcript)
                    tr_data = {
                        'transcript': transcript,
                        'translations': translations
                    }
                    print(f'Translation Data: {tr_data}')
                    send_translations(tr_data)
                    last_size = file.tell()
            time.sleep(1)
        except Exception as e:
            logging.error(f'Error in getTranscription: {e}')
            time.sleep(10)
    
def getRooms():
    # rooms = sio.manager.rooms['/']
    rooms = socketio.server.manager.rooms['/']
    print(f'{rooms}')
    return rooms

@app.route('/')
def home():
    return show_controls()

@app.route('/controls')
def show_controls():
    return render_template('controls.html')

@app.route('/settings', methods=['GET'])
def get_settings():
    with open('web/settings.json') as f:
        settings = json.load(f)
    return jsonify(settings)

@app.route('/supported-languages')
def supported_languages():
    global supportedLanguages
    return jsonify(supportedLanguages)

@socketio.on('instances')
def instances():
    global languages
    # sio.emit('instances', {'languages': languages})
    socketio.emit('instances', {'languages': languages})

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

@socketio.on('tab_focus')
def tab_focus(data):
    print(f'Focusing: {data}')
    socketio.emit('tab_focus', data)

@socketio.on('tab_active')
def tab_active(data):
    print(f'Tab active: {data}')
    global languages
    language = data['language']
    add_language(language)

@socketio.on('update_settings')
def update_settings(new_settings):
    global settings
    settings = new_settings
    with open('./web/settings.json', 'w') as f:
        json.dump(settings, f, indent=4)
    socketio.emit('settings-updated', settings)

@socketio.on('supported_languages')
def supported_languages():
    global supportedLanguages
    socketio.emit('supported-languages', supportedLanguages)
    
@socketio.on('add_language')
def add_language(lang):
    global languages
    if lang not in languages:
        languages.append(lang)
    print(f'Added {lang}.\nCurrent Languages: {languages}')
    instances()

# Start observer in a separate thread
def start_observer():
    global transcription_dir
    if not os.path.exists(transcription_dir):
        os.makedirs(transcription_dir)
    event_handler = NewFileHandler()
    observer = Observer()
    observer.schedule(event_handler, transcription_dir, recursive=False)
    observer.start()
    try:
        while observer.is_alive():
            observer.join(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

def send_translations(data):
    print(f'{data}')
    socketio.emit('translation', data)
    print(f"Sent translation to client: {data}")

@socketio.on('start')
def start():
    print(f'Starting Transcription')
    global isRunning, languages, transcription_path, transcription_dir
    if not isRunning:
        try:
            print(f'Was not running')
            isRunning = True
            getLatestTranscription()
            socketio.emit('instances', languages)
            if transcription_path != "":
                getTranscription()
        except Exception as e:
            logging.error(f"An error occurred: {e}")
            socketio.emit('error', str(e))
            stop()

@socketio.on("stop")
def stop():
    global isRunning
    print("Stop command received")
    if isRunning:
        isRunning = False
    save_json()
    status()

@socketio.on('get_translations')
def get_translations():
    # Get all files in translations and return them
    files = os.listdir(JSON_DIR)
    files = [file for file in files if file.endswith('.json')]
    files.sort(reverse=True)
    # sio.emit('translations', files)
    socketio.emit('translations', files)

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

@socketio.on('status')
def status():
    global isRunning
    socketio.emit('status', {
        'isRunning': isRunning
    })

@app.route('/status')
def http_status():
    global isRunning
    return {
        'isRunning': isRunning
    }

# @app.route('/')
# def index():
#     return render_template('index.html')

@socketio.on('connect')
def on_connect():
    print('Client connected')

@socketio.on('disconnect')
def on_disconnect():
    print('Client disconnected')
    
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
    global languages
    print(f'languages {languages}')
    current_languages = languages.copy()
    print(f'Current Languages {current_languages}')
    translations = {}
    for target in current_languages:
        result = translate_client.translate(text, target_language=target)
        translations[target] = result['translatedText']
        print(f'{target}: {result}\n')
    return translations
    
# # Function to perform text translation
# def translate_text(text, target_language):
#     result = translate_client.translate(text, target_language=target_language)
#     translated_text = result['translatedText']
#     return translated_text

# Start Flask app
if __name__ == '__main__':
    threading.Thread(target=start_observer).start()
    logging.basicConfig(level=logging.DEBUG)
    logging.getLogger('socketio').setLevel(logging.DEBUG)
    logging.getLogger('engineio').setLevel(logging.DEBUG)
    socketio.run(app, debug=True, host='localhost', port=451)