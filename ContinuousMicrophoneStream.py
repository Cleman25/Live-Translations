import queue
import time
from MicrophoneStream import MicrophoneStream

# ResumableMicrophoneStream
class ContinuousMicrophoneStream(MicrophoneStream):
    """Opens a recording stream as a generator yielding the audio chunks.
    This inherits from MicrophoneStream and overrides the __enter__ and __exit__ methods.
    """
    def __init__(self, rate, chunk, device_index):
        super().__init__(rate, chunk, device_index)
        self._last_chunk_time = time.time()
        self._last_chunk = None
        
    def reset(self):
        """Resets the stream.."""
        self._last_chunk_time = time.time()
        self._last_chunk = None
        
    def elapsed_time(self):
        """Returns the elapsed time in seconds."""
        return time.time() - self._last_chunk_time
    
    def generator(self):
        """Yields audio chunks from the audio stream."""
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
            
            # Update the last chunk time
            self._last_chunk_time = time.time()

            yield b''.join(data)