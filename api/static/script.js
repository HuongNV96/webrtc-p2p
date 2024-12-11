
const createRoomButton = document.getElementById('create-room');
const joinRoomButton = document.getElementById('join-room');
const roomIdDisplay = document.getElementById('room-id');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const toggleCameraButton = document.getElementById('toggle-camera');
const toggleMicrophoneButton = document.getElementById('toggle-microphone');
const sendMessageButton = document.getElementById('send-message');
const chatInput = document.getElementById('chat-input');
const chatBox = document.getElementById('chat-box');

let localStream = null;
let peerConnection = null;
let cameraOn = false;
let microphoneOn = true;
let dataChannel = null;

const signalingServer = new WebSocket('ws://localhost:8080');
const apiServer = 'http://localhost:3000'; // Update with your API server URL
const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

let roomId = null;

function addChatMessage(message, isLocal) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.style.textAlign = isLocal ? 'right' : 'left';
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function getMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.getVideoTracks()[0].enabled = cameraOn;
        localStream.getAudioTracks()[0].enabled = microphoneOn;

        localVideo.srcObject = localStream;
    } catch (err) {
        console.error('Error accessing media devices.', err);
    }
}

async function createRoom() {
    try {
        const response = await fetch(`${apiServer}/createRoom`);
        const data = await response.json();
        roomId = data.roomId;
        roomIdDisplay.textContent = `Room ID: ${roomId}`;
        signalingServer.send(JSON.stringify({ type: 'create', room: roomId }));
        setupPeerConnection();
    } catch (err) {
        console.error('Failed to create room:', err);
    }
}

async function joinRoom() {
    roomId = prompt('Enter Room ID:');
    try {
        const response = await fetch(`${apiServer}/checkRoom?id=${roomId}`);
        const data = await response.json();

        if (data.exists) {
            roomIdDisplay.textContent = `Joined Room: ${roomId}`;
            signalingServer.send(JSON.stringify({ type: 'join', room: roomId }));
            setupPeerConnection();

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            signalingServer.send(JSON.stringify({
                type: 'offer',
                offer: peerConnection.localDescription,
                room: roomId
            }));
        } else {
            alert('Room ID not found!');
        }
    } catch (err) {
        console.error('Failed to join room:', err);
    }
}

function setupPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    dataChannel = peerConnection.createDataChannel('chat');
    dataChannel.onmessage = (event) => {
        addChatMessage(event.data, false);
    };

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            signalingServer.send(JSON.stringify({
                type: 'ice-candidate',
                candidate: event.candidate,
                room: roomId
            }));
        }
    };

    //peerConnection.onnegotiationneeded = async () => {
    //    const offer = await peerConnection.createOffer();
    //    await peerConnection.setLocalDescription(offer);
    //    signalingServer.send(JSON.stringify({
    //        type: 'offer',
    //        offer: peerConnection.localDescription,
    //        room: roomId
    //    }));
    //};

    peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        dataChannel.onmessage = (event) => {
            addChatMessage(event.data, false);
        };
    };
}

signalingServer.onmessage = async (message) => {
    const data = JSON.parse(message.data);
    console.dir(data)
    switch (data.type) {
        case 'offer':
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            signalingServer.send(JSON.stringify({
                type: 'answer',
                answer: peerConnection.localDescription,
                room: roomId
            }));

            signalingServer.send(JSON.stringify({
                type: 'update-status',
                status: { cameraOn, microphoneOn },
                room: roomId
            }));
            break;

        case 'answer':
            if (data.answer) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            }
            signalingServer.send(JSON.stringify({
                type: 'update-status',
                status: { cameraOn, microphoneOn },
                room: roomId
            }));
            break;

        case 'ice-candidate':
            if (data.candidate) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
            break;
        case 'update-status':
            updateRemoteStreamStatus(data.status)
            break;
        default:
            break;
    }
};

function updateRemoteStreamStatus(status) {
    const remoteControls = document.querySelector('#remote-controls');
    remoteControls.querySelector('button:nth-child(1)').textContent = status.cameraOn ? 'Camera On' : 'Camera Off';
    remoteControls.querySelector('button:nth-child(2)').textContent = status.microphoneOn ? 'Microphone On' : 'Microphone Off';
}

toggleCameraButton.addEventListener('click', () => {
    cameraOn = !cameraOn;
    localStream.getVideoTracks()[0].enabled = cameraOn;
    signalingServer.send(JSON.stringify({
        type: 'update-status',
        status: { cameraOn, microphoneOn },
        room: roomId
    }));
    toggleCameraButton.textContent = cameraOn ? 'Turn Off Camera' : 'Turn On Camera';
});

toggleMicrophoneButton.addEventListener('click', () => {
    microphoneOn = !microphoneOn;
    localStream.getAudioTracks()[0].enabled = microphoneOn;
    signalingServer.send(JSON.stringify({
        type: 'update-status',
        status: { cameraOn, microphoneOn },
        room: roomId
    }));
    toggleMicrophoneButton.textContent = microphoneOn ? 'Turn Off Microphone' : 'Turn On Microphone';
});

createRoomButton.addEventListener('click', createRoom);
joinRoomButton.addEventListener('click', joinRoom);

sendMessageButton.addEventListener('click', () => {
    const message = chatInput.value;
    if (message.trim() && dataChannel) {
        dataChannel.send(message);
        addChatMessage(message, true);
        chatInput.value = '';
    }
});

getMedia();
