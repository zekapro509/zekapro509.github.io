let peer;
let conn;
let myPeerId;
let isConnected = false;
let encryptionKey = null;
let isInitiator = false;

// Инициализация PeerJS
function initPeer() {
    const randomId = 'tlc_' + Math.random().toString(36).substring(2, 12);
    
    peer = new Peer(randomId, {
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        debug: 0,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });

    peer.on('open', function(id) {
        myPeerId = id;
        document.getElementById('myPeerId').textContent = id;
    });

    peer.on('connection', function(connection) {
        if (isConnected) {
            connection.close();
            return;
        }
        
        conn = connection;
        isInitiator = false;
        setupConnection();
        
        document.getElementById('connectionStatus').className = 'status-badge status-connected';
        document.getElementById('connectionStatus').textContent = 'Подключен';
        document.getElementById('connectedPeerId').textContent = conn.peer.substring(0, 12) + '...';
        document.getElementById('chatArea').style.display = 'block';
        document.getElementById('encryptionInfo').style.display = 'flex';
        isConnected = true;
        
        generateAndSendKey();
    });

    peer.on('error', function(err) {
        console.error('Peer error:', err);
        if (err.type === 'peer-unavailable') {
            alert('Собеседник не найден. Проверьте ID.');
        } else if (err.type === 'server-error') {
            document.getElementById('myPeerId').textContent = 'Ошибка подключения к серверу. Обновите страницу.';
        } else if (err.type === 'network') {
            document.getElementById('myPeerId').textContent = 'Ошибка сети. Проверьте интернет.';
        } else {
            document.getElementById('myPeerId').textContent = 'Ошибка: ' + err.type;
        }
    });

    peer.on('disconnected', function() {
        setTimeout(function() {
            if (peer && !peer.destroyed) {
                peer.reconnect();
            }
        }, 3000);
    });
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
        resetConnection();
    });
}

function generateAndSendKey() {
    if (isInitiator) {
        encryptionKey = CryptoJS.lib.WordArray.random(32).toString();
        conn.send({
            type: 'key',
            key: encryptionKey
        });
    }
}

function receiveKey(key) {
    encryptionKey = key;
    if (!isInitiator) {
        conn.send({
            type: 'key',
            key: encryptionKey
        });
    }
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
        alert('Введите ID собеседника');
        return;
    }

    if (isConnected) {
        alert('Вы уже подключены. Сначала отключитесь.');
        return;
    }

    conn = peer.connect(remoteId, {
        reliable: true
    });

    isInitiator = true;

    conn.on('open', function() {
        setupConnection();
        document.getElementById('connectionStatus').className = 'status-badge status-connected';
        document.getElementById('connectionStatus').textContent = 'Подключен';
        document.getElementById('connectedPeerId').textContent = remoteId.substring(0, 12) + '...';
        document.getElementById('chatArea').style.display = 'block';
        document.getElementById('encryptionInfo').style.display = 'flex';
        isConnected = true;
        
        generateAndSendKey();
    });

    conn.on('error', function(err) {
        alert('Не удалось подключиться к собеседнику');
        console.error(err);
    });
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message) return;
    if (!conn || !isConnected) {
        alert('Нет подключения');
        return;
    }
    if (!encryptionKey) {
        alert('Ключ шифрования ещё не установлен. Подождите.');
        return;
    }

    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const encryptedText = encryptMessage(message);

    const messageData = {
        type: 'message',
        text: encryptedText,
        time: time
    };

    conn.send(messageData);
    addMessage({ text: message, time: time }, 'out');
    input.value = '';
}

function addMessage(data, direction) {
    const messagesBox = document.getElementById('messagesBox');
    
    const emptyChat = messagesBox.querySelector('.empty-chat');
    if (emptyChat) {
        emptyChat.remove();
    }

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
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function copyMyId() {
    if (!myPeerId) {
        alert('ID ещё не сгенерирован. Подождите секунду.');
        return;
    }
    
    if (myPeerId.startsWith('Ошибка')) {
        alert('Не удалось получить ID. Обновите страницу.');
        return;
    }
    
    navigator.clipboard.writeText(myPeerId).then(function() {
        alert('ID скопирован в буфер обмена.');
    }).catch(function() {
        const input = document.createElement('input');
        input.value = myPeerId;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        alert('ID скопирован в буфер обмена.');
    });
}

function disconnect() {
    if (conn) {
        conn.close();
    }
    resetConnection();
}

function resetConnection() {
    isConnected = false;
    conn = null;
    encryptionKey = null;
    isInitiator = false;
    
    document.getElementById('connectionStatus').className = 'status-badge status-disconnected';
    document.getElementById('connectionStatus').textContent = 'Не подключен';
    document.getElementById('chatArea').style.display = 'none';
    document.getElementById('encryptionInfo').style.display = 'none';
    
    const messagesBox = document.getElementById('messagesBox');
    messagesBox.innerHTML = '<div class="empty-chat">Сообщений пока нет</div>';
    
    document.getElementById('remotePeerId').value = '';
    document.getElementById('messageInput').value = '';
}

window.onload = function() {
    initPeer();
};