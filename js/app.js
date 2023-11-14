//webkitURL is deprecated but nevertheless
URL = window.URL || window.webkitURL;

var gumStream; // Stream from getUserMedia()
var rec; // Recorder.js object (if needed)
var input; // MediaStreamAudioSourceNode we'll be recording
var audioContext; // Audio context to help us record
var mediaRecorder; // MediaRecorder for real-time streaming
var socket; // WebSocket
var dataBuffer = []; // Buffer for storing data chunks if WebSocket is not ready

// Get elements from the DOM
var recordButton = document.getElementById("recordButton");
var stopButton = document.getElementById("stopButton");
var pauseButton = document.getElementById("pauseButton");

// Add event listeners to buttons
recordButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);
pauseButton.addEventListener("click", pauseRecording);

// Shim for AudioContext when it's not available
var AudioContext = window.AudioContext || window.webkitAudioContext;

function startRecording() {
    console.log("recordButton clicked");
    var constraints = { audio: true, video: false };

    recordButton.disabled = true;
    stopButton.disabled = false;
    pauseButton.disabled = false;

    navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
        console.log("getUserMedia() success, stream created");
        audioContext = new AudioContext();
        document.getElementById("formats").innerHTML="Format: 1 channel pcm @ "+audioContext.sampleRate/1000+"kHz";

        gumStream = stream;
        mediaRecorder = new MediaRecorder(stream);

        // Initialize WebSocket connection each time recording starts
        socket = new WebSocket('ws://localhost:5000/stream');
        socket.onopen = function() {
            console.log("WebSocket connection established");
            // Send any buffered data if WebSocket is now open
            while (dataBuffer.length > 0) {
                var data = dataBuffer.shift();
                socket.send(data);
            }
        };
        socket.onerror = function(error) {
            console.log("WebSocket error: ", error);
        };
        socket.onclose = function(event) {
            console.log("WebSocket is closed now.", event);
        };

        mediaRecorder.ondataavailable = function(event) {
            if (event.data.size > 0) {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(event.data);
                } else {
                    // Buffer the data if WebSocket is not open
                    dataBuffer.push(event.data);
                }
            }
        };

        mediaRecorder.start(250); // Send data every 250ms
        console.log("Recording started");
    }).catch(function(err) {
        recordButton.disabled = false;
        stopButton.disabled = true;
        pauseButton.disabled = true;
        console.log("getUserMedia() failed: ", err);
    });
}

function pauseRecording(){
	console.log("pauseButton clicked rec.recording=",rec.recording );
	if (rec.recording){
		//pause
		rec.stop();
		pauseButton.innerHTML="Resume";
	}else{
		//resume
		rec.record()
		pauseButton.innerHTML="Pause";

	}
}

function stopRecording() {
	console.log("stopButton clicked");

	//disable the stop button, enable the record too allow for new recordings
	stopButton.disabled = true;
	recordButton.disabled = false;
	pauseButton.disabled = true;

	//reset button just in case the recording is stopped while paused
	pauseButton.innerHTML="Pause";
	
	// Tell the MediaRecorder to stop recording
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }

	// Stop microphone access
	if (gumStream) {
		gumStream.getTracks().forEach(track => track.stop());
	}

	// Close the WebSocket connection if it's still open
	if (socket && socket.readyState === WebSocket.OPEN) {
		socket.close();
	}
}

function createDownloadLink(blob) {
    
    var url = URL.createObjectURL(blob);
    var au = document.createElement('audio');
    var li = document.createElement('li');
    var link = document.createElement('a');

    //name of .wav file to use during upload and download (without extension)
    var filename = new Date().toISOString();

    //add controls to the <audio> element
    au.controls = true;
    au.src = url;

    //save to disk link
    link.href = url;
    link.download = filename+".wav";
    link.innerHTML = "Save to disk";

    //add the new audio element to li
    li.appendChild(au);
    
    //add the filename to the li
    li.appendChild(document.createTextNode(filename+".wav "))

    //add the save to disk link to li
    li.appendChild(link);
    
    //upload link for your original server
    var originalUpload = document.createElement('a');
    originalUpload.href="#";
    originalUpload.innerHTML = "Upload Original Server";
    originalUpload.addEventListener("click", function(event){
          var xhr=new XMLHttpRequest();
          xhr.onload=function(e) {
              if(this.readyState === 4) {
                  console.log("Server returned: ",e.target.responseText);
              }
          };
          var fd=new FormData();
          fd.append("audio_data",blob, filename);
          xhr.open("POST","upload.php",true);
          xhr.send(fd);
    });
    li.appendChild(document.createTextNode (" "));
    li.appendChild(originalUpload);

    // NEW: upload link for localhost:5500
    var localUpload = document.createElement('a');
    localUpload.href="#";
    localUpload.innerHTML = "Upload Localhost";
    localUpload.addEventListener("click", function(event){
          var xhr=new XMLHttpRequest();
          xhr.onload=function(e) {
              if(this.readyState === 4) {
                  console.log("Localhost returned: ",e.target.responseText);
              }
          };
          var fd=new FormData();
          fd.append("audio_data",blob, filename);
          xhr.open("POST","http://127.0.0.1:5000/transcribe",true);
          xhr.send(fd);
    });
    li.appendChild(document.createTextNode (" "));
    li.appendChild(localUpload);

    //add the li element to the ol
    recordingsList.appendChild(li);
}
