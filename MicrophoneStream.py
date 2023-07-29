import queue
import time
import pyaudio

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