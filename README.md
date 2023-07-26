# Live Translations

Live Translations is a real-time multilingual transcription and translation service. It uses Google Cloud's Speech-to-Text, Translation, and Text-to-Speech APIs to transcribe and translate spoken language into multiple languages in real-time.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Installation](#installation)
    - [Prerequisites](#prerequisites)
    - [Setting up the Environment](#setting-up-the-environment)
    - [Generating requirements.txt (if it doesn't exist)](#generating-requirementstxt-if-it-doesnt-exist)
    - [Installing Dependencies](#installing-dependencies)
4. [Google Cloud Setup](#google-cloud-setup)
5. [Usage](#usage)
6. [Troubleshooting](#troubleshooting)
    - [Third-Party Packages](#third-party-packages)
    - [Google Cloud SDK/CLI](#google-cloud-sdkcli)
7. [Contributing](#contributing)
8. [License](#license)
9. [Contact](#contact)


## Features

- Real-time transcription and translation
- Supports multiple languages
~~- Noise reduction~~
~~- Speaker diarization~~

## Installation

### Prerequisites

- Python 3.7 or higher
- pip (Python package installer)

### Setting up the Environment

Before you install the dependencies, we recommend you to set up a Python virtual environment. This is an isolated environment where you can install Python packages without interfering with your system's Python setup. Here's how to set it up:

1. Open a terminal and navigate to the root folder of the project.

2. Run the following command to create a virtual environment named `venv`:

    ```bash
    python3 -m venv venv
    ```

    This will create a new folder named `venv` in your project root directory.

3. Activate the virtual environment:

    - On Windows, run:

        ```bash
        .\venv\Scripts\activate
        ```

    - On Unix or MacOS, run:

        ```bash
        source venv/bin/activate
        ```

    When the virtual environment is activated, your terminal prompt will be prefixed with `(venv)`.

### Generating requirements.txt (if it doesn't exist)

If the `requirements.txt` file doesn't exist in the project root directory, you can generate it. This file lists all the Python packages that your project depends on. Here's how to generate it:

1. Make sure you have activated your virtual environment and installed all the necessary packages.

2. Run the following command:

    ```bash
    pip freeze > requirements.txt
    ```

This will create a `requirements.txt` file and fill it with a list of all installed packages and their versions. This is useful for other developers who want to install all the project dependencies in one go.

### Installing Dependencies

With the virtual environment activated, you can now install the project dependencies. These are listed in the `requirements.txt` file in the project root directory. To install them, run:

    pip install -r requirements.txt

This will download and install all the required packages.

Remember to always activate the virtual environment before you start working on the project. When you're done, you can deactivate the virtual environment by simply running:

    deactivate

## Google Cloud Setup

1. Install the Google Cloud SDK following the instructions here.

2. Authenticate with Google Cloud:
    ```
    gcloud auth login
    ```

3. Set up a Google Cloud project and enable the Speech-to-Text, Translation, and Text-to-Speech APIs.

4. Download your service account key as a JSON file and save it in the project directory.

5. Set the environment variable GOOGLE_APPLICATION_CREDENTIALS to the path of your service account key:
    ```
    export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-file.json"
    ```

## Usage

1. Start the server:
    ```bash
    python server.py
    ```

2. Open your web browser and navigate to http://localhost:5000.

3. Select your microphone and the languages you want to translate to, then click the "Start" button to start transcribing and translating.

## Troubleshooting

If you encounter issues with the third-party packages used in this project, you can visit their respective support pages:

- [Google Cloud SDK](https://cloud.google.com/sdk/docs/quickstart)
- [Google Cloud CLI](https://cloud.google.com/sdk/gcloud)
- [Google Cloud Speech-to-Text](https://cloud.google.com/speech-to-text/docs/troubleshooting)
- [Google Cloud Translation](https://cloud.google.com/translate/docs/troubleshooting)
- [Google Cloud Text-to-Speech](https://cloud.google.com/text-to-speech/docs/troubleshooting)
- [Flask](https://flask.palletsprojects.com/en/2.0.x/errors/)
- [Flask-SocketIO](https://flask-socketio.readthedocs.io/en/latest/)
- [Eventlet](https://eventlet.net/doc/)

If you're still having trouble, feel free to [open an issue](https://github.com/Cleman25/Live-Translations/issues) on this repository.

## Contributing

Contributions are welcome! Please read the [contributing guidelines](CONTRIBUTING.md) first.

## License

This project is licensed under the terms of the MIT license.

## Contact

If you have any questions, feel free to contact me.