let peer;
let conn;
let myPeerId;
let isConnected = false;
let encryptionKey = null;
let isInitiator = false;
let currentRoomId = null;

function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) {
        errorEl.textContent = message;
        setTimeout(() => { errorEl.textContent = ''; }, 3000);
    }
}

function showChatError(message) {
    const errorEl = document.getElementById('chatErrorMessage');
    if (errorEl) {
        errorEl.textContent = message;
        setTimeout(() => { errorEl.textContent = ''; }, 3000);
    }
}

window.addEventListener('hashchange', function() {
    const newHash = window.location.hash.substring(1);
    
    if (!newHash) {
        if (conn) conn.close();
        resetConnection();
        showHomePage();
    } else if (newHash !== currentRoomId) {
        if (conn) conn.close();
        resetConnection();
        currentRoomId = newHash;
        joinRoomFromHash(newHash);
    }
});

const hash = window.location.hash.substring(1);
if (hash) {
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('chatPage').style.display = 'block';
    currentRoomId = hash;
    initPeerAndJoinRoom(hash);
} else {
    showHomePage();
}

function showHomePage() {
    document.getElementById('homePage').style.display = 'block';
    document.getElementById('chatPage').style.display = 'none';
    
    if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname);
    }
    
    document.getElementById('remotePeerId').value = '';
    
    if (peer && !peer.destroyed) peer.destroy();
    initPeer();
}

function joinRoomFromHash(roomId) {
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('chatPage').style.display = 'block';
    
    if (peer && !peer.destroyed) peer.destroy();
    initPeerAndJoinRoom(roomId);
}

function generateNumericId() {
    const num = Math.floor(Math.random() * 10000);
    return num.toString().padStart(4, '0');
}

function initPeer() {
    const randomId = generateNumericId();
    
    peer = new Peer(randomId, {
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        debug: 0,
        path: '/',
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });

    peer.on('open', function(id) {
        myPeerId = id;
        const idElement = document.getElementById('myPeerId');
        if (idElement) idElement.textContent = id;
    });

    peer.on('connection', function(connection) {
        if (isConnected) {
            connection.close();
            return;
        }
        
        conn = connection;
        isInitiator = false;
        setupConnection();
        isConnected = true;
        
        if (document.getElementById('homePage').style.display !== 'none') {
            switchToChatMode(conn.peer);
        }
    });

    peer.on('error', function(err) {
        console.error('Peer error:', err);
        const idElement = document.getElementById('myPeerId');
        if (idElement) {
            if (err.type === 'peer-unavailable') {
                showError('Собеседник не найден');
            } else if (err.type === 'server-error') {
                idElement.textContent = 'Ошибка сервера';
                setTimeout(() => { initPeer(); }, 1000);
            } else if (err.type === 'network') {
                idElement.textContent = 'Ошибка сети';
            } else {
                idElement.textContent = 'Ошибка';
            }
        }
    });

    peer.on('disconnected', function() {
        const idElement = document.getElementById('myPeerId');
        if (idElement) idElement.textContent = 'Переподключение...';
        setTimeout(() => { if (peer && !peer.destroyed) peer.reconnect(); }, 2000);
    });
}

function initPeerAndJoinRoom(roomId) {
    const randomId = generateNumericId();
    
    peer = new Peer(randomId, {
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        debug: 0,
        path: '/',
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });

    peer.on('open', () => connectToRoom(roomId));

    peer.on('connection', function(connection) {
        if (isConnected) {
            connection.close();
            return;
        }
        conn = connection;
        isInitiator = false;
        setupConnection();
        isConnected = true;
    });

    peer.on('error', function(err) {
        console.error('Peer error:', err);
        if (err.type === 'peer-unavailable') {
            showChatError('Комната не найдена');
        }
    });
}

function connectToRoom(roomId) {
    document.getElementById('chatPeerId').textContent = roomId;
    conn = peer.connect(roomId, { reliable: true });
    isInitiator = true;

    conn.on('open', function() {
        setupConnection();
        isConnected = true;
        generateAndSendKey();
    });

    conn.on('error', function() {
        showChatError('Не удалось подключиться');
    });
}

function switchToChatMode(peerId) {
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('chatPage').style.display = 'block';
    document.getElementById('chatPeerId').textContent = peerId;
    
    currentRoomId = myPeerId;
    window.location.hash = myPeerId;
}

function setupConnection() {
    conn.on('data', function(data) {
        if (data.type === 'key') {
            receiveKey(data.key);
        } else if (data.type === 'message') {
            const decryptedText = decryptMessage(data.text);
            addMessage({ text: decryptedText, time: data.time }, 'in');
        }
    });

    conn.on('close', function() {
        if (document.getElementById('chatPage').style.display === 'block') {
            showChatError('Собеседник отключился');
            setTimeout(() => { window.location.hash = ''; }, 500);
        } else {
            window.location.hash = '';
        }
        resetConnection();
    });
}

function generateAndSendKey() {
    if (isInitiator) {
        encryptionKey = CryptoJS.lib.WordArray.random(32).toString();
        conn.send({ type: 'key', key: encryptionKey });
    }
}

function receiveKey(key) {
    encryptionKey = key;
}

function encryptMessage(text) {
    if (!encryptionKey) return text;
    return CryptoJS.AES.encrypt(text, encryptionKey).toString();
}

function decryptMessage(encryptedText) {
    if (!encryptionKey) return encryptedText;
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedText, encryptionKey);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        return '[Ошибка расшифровки]';
    }
}

function connectToPeer() {
    const remoteId = document.getElementById('remotePeerId').value.trim();
    if (!remoteId) {
        showError('Введите ID собеседника');
        return;
    }

    if (isConnected) {
        showError('Вы уже подключены');
        return;
    }

    conn = peer.connect(remoteId, { reliable: true });
    isInitiator = true;

    conn.on('open', function() {
        setupConnection();
        switchToChatMode(remoteId);
        isConnected = true;
        generateAndSendKey();
    });

    conn.on('error', function() {
        showError('Не удалось подключиться');
    });
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message) return;
    if (!conn || !isConnected) {
        showChatError('Нет подключения');
        return;
    }
    if (!encryptionKey) {
        showChatError('Ключ шифрования не установлен');
        return;
    }

    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const encryptedText = encryptMessage(message);

    conn.send({ type: 'message', text: encryptedText, time: time });
    addMessage({ text: message, time: time }, 'out');
    input.value = '';
}

function addMessage(data, direction) {
    const messagesBox = document.getElementById('messagesBox');
    if (!messagesBox) return;
    
    const emptyChat = messagesBox.querySelector('.empty-chat');
    if (emptyChat) emptyChat.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + (direction === 'in' ? 'message-in' : 'message-out');
    messageDiv.innerHTML = `
        <div>${escapeHtml(data.text)}</div>
        <div class="message-time">${data.time || ''}</div>
    `;
    
    messagesBox.appendChild(messageDiv);
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function handleKeyPress(event) {
    if (event.key === 'Enter') sendMessage();
}

function copyMyId() {
    if (!myPeerId) return;
    if (myPeerId.startsWith('Ошибка')) return;
    
    navigator.clipboard.writeText(myPeerId).catch(() => {
        const input = document.createElement('input');
        input.value = myPeerId;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
    });
}

function disconnectAndGoHome() {
    if (conn) conn.close();
    resetConnection();
    window.location.hash = '';
}

function resetConnection() {
    isConnected = false;
    conn = null;
    encryptionKey = null;
    isInitiator = false;
}