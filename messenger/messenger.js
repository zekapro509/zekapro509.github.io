let peer;
let conn;
let myPeerId;
let isConnected = false;
let encryptionKey = null;
let isInitiator = false;
let currentRoomId = null;

// Определяем режим: главная или чат
const hash = window.location.hash.substring(1);
if (hash) {
    // Режим чата — подключаемся к комнате
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('chatPage').style.display = 'block';
    document.getElementById('backBtn').style.display = 'none';
    currentRoomId = hash;
    initPeerAndJoinRoom(hash);
} else {
    // Главная страница
    document.getElementById('homePage').style.display = 'block';
    document.getElementById('chatPage').style.display = 'none';
    initPeer();
}

function initPeer() {
    const randomId = 'tlc_' + Math.random().toString(36).substring(2, 12);
    
    peer = new Peer(randomId, {
        host: 'peerjs-server.onrender.com',
        port: 443,
        secure: true,
        debug: 0,
        path: '/',
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        }
    });

    peer.on('open', function(id) {
        myPeerId = id;
        const idElement = document.getElementById('myPeerId');
        if (idElement) {
            idElement.textContent = id;
        }
    });

    peer.on('connection', function(connection) {
        if (isConnected) {
            connection.close();
            return;
        }
        
        conn = connection;
        isInitiator = false;  // Создатель комнаты НЕ инициатор
        setupConnection();
        
        // Ждём ключ от инициатора
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
                alert('Собеседник не найден. Проверьте ID.');
            } else if (err.type === 'server-error') {
                idElement.textContent = 'Ошибка сервера. Обновите страницу.';
            } else if (err.type === 'network') {
                idElement.textContent = 'Ошибка сети. Проверьте интернет.';
            } else {
                idElement.textContent = 'Ошибка: ' + err.type;
            }
        }
    });

    peer.on('disconnected', function() {
        const idElement = document.getElementById('myPeerId');
        if (idElement) {
            idElement.textContent = 'Переподключение...';
        }
        setTimeout(function() {
            if (peer && !peer.destroyed) {
                peer.reconnect();
            }
        }, 2000);
    });
}

function initPeerAndJoinRoom(roomId) {
    const randomId = 'tlc_' + Math.random().toString(36).substring(2, 12);
    
    peer = new Peer(randomId, {
        host: 'peerjs-server.onrender.com',
        port: 443,
        secure: true,
        debug: 0,
        path: '/',
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        }
    });

    peer.on('open', function() {
        // Подключаемся к создателю комнаты
        connectToRoom(roomId);
    });

    peer.on('connection', function(connection) {
        // Этот обработчик не должен срабатывать для присоединяющегося,
        // но оставим для надёжности
        if (isConnected) {
            connection.close();
            return;
        }
        
        conn = connection;
        isInitiator = false;
        setupConnection();
        document.getElementById('chatStatus').textContent = 'Подключен';
        isConnected = true;
    });

    peer.on('error', function(err) {
        console.error('Peer error:', err);
        document.getElementById('chatStatus').textContent = 'Ошибка подключения';
        if (err.type === 'peer-unavailable') {
            alert('Комната не найдена. Возможно, создатель вышел.');
        }
    });
}

function connectToRoom(roomId) {
    document.getElementById('chatPeerId').textContent = roomId.substring(0, 12) + '...';
    document.getElementById('chatStatus').textContent = 'Подключение...';
    
    conn = peer.connect(roomId, {
        reliable: true
    });

    // Тот, кто переходит по ссылке — ИНИЦИАТОР
    isInitiator = true;

    conn.on('open', function() {
        setupConnection();
        document.getElementById('chatStatus').textContent = 'Подключен';
        isConnected = true;
        
        // Инициатор генерирует ключ и отправляет создателю
        generateAndSendKey();
    });

    conn.on('error', function(err) {
        document.getElementById('chatStatus').textContent = 'Не удалось подключиться';
        console.error(err);
    });
}

function createRoom() {
    if (!myPeerId) {
        alert('ID ещё не сгенерирован. Подождите секунду.');
        return;
    }
    
    const roomUrl = window.location.href.split('#')[0] + '#' + myPeerId;
    
    navigator.clipboard.writeText(roomUrl).then(function() {
        alert('Ссылка на комнату скопирована. Отправьте её собеседнику.\n\nОставайтесь на этой странице и ждите подключения.');
    }).catch(function() {
        prompt('Ссылка на комнату (скопируйте и отправьте собеседнику):', roomUrl);
    });
    
    document.getElementById('connectionStatus').textContent = 'Ожидание...';
}

function switchToChatMode(peerId) {
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('chatPage').style.display = 'block';
    document.getElementById('backBtn').style.display = 'none';
    document.getElementById('chatPeerId').textContent = peerId.substring(0, 12) + '...';
    document.getElementById('encryptionInfo').style.display = 'flex';
    
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
            document.getElementById('chatStatus').textContent = 'Соединение разорвано';
        }
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
    // Создатель комнаты (не инициатор) просто сохраняет ключ
    // Отправлять обратно не нужно
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
        switchToChatMode(remoteId);
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
    
    if (!messagesBox) return;
    
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

function disconnectAndGoHome() {
    if (conn) {
        conn.close();
    }
    resetConnection();
    
    window.location.hash = '';
    window.location.reload();
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
    
    const connectionStatus = document.getElementById('connectionStatus');
    if (connectionStatus) {
        connectionStatus.className = 'status-badge status-disconnected';
        connectionStatus.textContent = 'Не подключен';
    }
}

window.onload = function() {
    // Уже инициализировано выше
};