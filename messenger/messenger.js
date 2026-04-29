let peer;
let conn;
let myPeerId;
let isConnected = false;
let sharedSecret = null;
let isInitiator = false;
let heartbeatInterval = null;
let isGoingHome = false;

function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    if (!errorEl) return;
    errorEl.textContent = message;
}

function showChatError(message) {
    const errorEl = document.getElementById('chatErrorMessage');
    if (!errorEl) return;
    errorEl.textContent = message;
}

function extractPeerId(input) {
    const match = input.match(/#(t\w+)$/);
    return match ? match[1] : input.trim();
}

// Обработка хеша
function handleHashChange() {
    if (isGoingHome) {
        isGoingHome = false;
        return;
    }
    
    const hash = window.location.hash.substring(1);
    
    if (!hash) {
        cleanupConnection();
        showHomePage();
        initPeerAndRedirect();
    } else if (hash !== myPeerId && !isConnected) {
        cleanupConnection();
        joinRoom(hash);
    }
}

window.addEventListener('hashchange', handleHashChange);

// Инициализация при загрузке
const hash = window.location.hash.substring(1);
if (hash) {
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('chatPage').style.display = 'block';
    joinRoom(hash);
} else {
    showHomePage();
    initPeerAndRedirect();
}

function showHomePage() {
    document.getElementById('homePage').style.display = 'block';
    document.getElementById('chatPage').style.display = 'none';
    document.getElementById('remotePeerId').value = '';
    document.getElementById('errorMessage').textContent = '';
    document.getElementById('chatErrorMessage').textContent = '';
}

function joinRoom(roomId) {
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('chatPage').style.display = 'block';
    document.getElementById('chatPeerId').textContent = roomId;
    document.getElementById('messagesBox').innerHTML = '<div class="empty-chat">Ожидание собеседника...</div>';
    
    initPeer(roomId);
}

function generateNumericId() {
    const num = Math.floor(Math.random() * 10000);
    return 't' + num.toString().padStart(4, '0');
}

function initPeerAndRedirect() {
    const peerId = generateNumericId();
    
    const peerConfig = {
        host: 'peerjs-server.onrender.com',
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
    };

    peer = new Peer(peerId, peerConfig);

    peer.on('open', (id) => {
        myPeerId = id;
        const idElement = document.getElementById('myPeerId');
        if (idElement) idElement.textContent = id;
        
        if (!isGoingHome) {
            window.location.hash = id;
        }
    });

    peer.on('connection', (connection) => {
        if (isConnected) {
            connection.close();
            return;
        }
        // Проверяем, что это не подключение к самому себе
        if (connection.peer === myPeerId) {
            connection.close();
            return;
        }
        conn = connection;
        isInitiator = false;
        setupConnection();
        startHeartbeat();
        
        if (document.getElementById('homePage').style.display !== 'none') {
            switchToChatMode(conn.peer);
        }
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
        const idElement = document.getElementById('myPeerId');
        if (!idElement) return;
        
        switch(err.type) {
            case 'peer-unavailable':
                showError('Собеседник не найден');
                break;
            case 'server-error':
                idElement.textContent = 'Ошибка сервера';
                break;
            case 'network':
                idElement.textContent = 'Ошибка сети';
                break;
            default:
                idElement.textContent = 'Ошибка';
        }
    });

    peer.on('disconnected', () => {
        const idElement = document.getElementById('myPeerId');
        if (idElement) idElement.textContent = 'Переподключение...';
        peer.reconnect();
    });
}

function initPeer(roomId = null) {
    const peerId = generateNumericId();
    
    const peerConfig = {
        host: 'peerjs-server.onrender.com',
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
    };

    // Если есть хеш, используем его как ID
    const hash = window.location.hash.substring(1);
    if (hash && !roomId) {
        roomId = hash;
    }

    peer = new Peer(peerId, peerConfig);

    peer.on('open', (id) => {
        myPeerId = id;
        const idElement = document.getElementById('myPeerId');
        if (idElement) idElement.textContent = id;
        
        if (roomId && roomId !== id) {
            connectToRoom(roomId);
        }
    });

    peer.on('connection', (connection) => {
        if (isConnected) {
            connection.close();
            return;
        }
        // Проверяем, что это не подключение к самому себе
        if (connection.peer === myPeerId) {
            connection.close();
            return;
        }
        conn = connection;
        isInitiator = false;
        setupConnection();
        startHeartbeat();
        
        if (document.getElementById('homePage').style.display !== 'none') {
            switchToChatMode(conn.peer);
        }
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
        const idElement = document.getElementById('myPeerId');
        if (!idElement) return;
        
        switch(err.type) {
            case 'peer-unavailable':
                showChatError('Собеседник не найден');
                break;
            case 'server-error':
                idElement.textContent = 'Ошибка сервера';
                break;
            case 'network':
                idElement.textContent = 'Ошибка сети';
                break;
            default:
                idElement.textContent = 'Ошибка';
        }
    });

    peer.on('disconnected', () => {
        const idElement = document.getElementById('myPeerId');
        if (idElement) idElement.textContent = 'Переподключение...';
        peer.reconnect();
    });
}

function connectToRoom(roomId) {
    // Не подключаемся к самому себе
    if (roomId === myPeerId) {
        showChatError('Нельзя подключиться к самому себе');
        return;
    }
    
    document.getElementById('chatPeerId').textContent = roomId;
    conn = peer.connect(roomId, { reliable: true });
    isInitiator = true;

    conn.on('open', () => {
        setupConnection();
        startHeartbeat();
        initiateKeyExchange();
        document.getElementById('messagesBox').innerHTML = '<div class="empty-chat">Сообщений пока нет</div>';
    });

    conn.on('error', () => {
        showChatError('Не удалось подключиться к комнате');
    });
}

function connectToPeer() {
    const input = document.getElementById('remotePeerId').value.trim();
    const remoteId = extractPeerId(input);
    
    if (!remoteId) {
        showError('Введите ID или ссылку собеседника');
        return;
    }

    if (isConnected) {
        showError('Вы уже подключены');
        return;
    }

    if (remoteId === myPeerId) {
        showError('Нельзя подключиться к самому себе');
        return;
    }

    conn = peer.connect(remoteId, { reliable: true });
    isInitiator = true;

    conn.on('open', () => {
        setupConnection();
        startHeartbeat();
        initiateKeyExchange();
        switchToChatMode(remoteId);
    });

    conn.on('error', () => {
        showError('Не удалось подключиться');
        conn = null;
    });
}

function switchToChatMode(peerId) {
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('chatPage').style.display = 'block';
    document.getElementById('chatPeerId').textContent = peerId;
    document.getElementById('messagesBox').innerHTML = '<div class="empty-chat">Сообщений пока нет</div>';
    
    window.location.hash = myPeerId;
}

function setupConnection() {
    if (!conn) return;

    conn.on('data', (data) => {
        switch(data.type) {
            case 'dh_public':
                handleDHPublicKey(data.key);
                break;
            case 'message':
                handleIncomingMessage(data);
                break;
            case 'ping':
                if (conn.open) {
                    conn.send({ type: 'pong' });
                }
                break;
            case 'pong':
                break;
        }
    });

    conn.on('close', () => {
        stopHeartbeat();
        isConnected = false;
        conn = null;
        
        if (!isGoingHome && document.getElementById('chatPage').style.display === 'block') {
            showChatError('Собеседник отключился');
        }
    });

    isConnected = true;
}

async function initiateKeyExchange() {
    try {
        const keyPair = await crypto.subtle.generateKey(
            {
                name: 'ECDH',
                namedCurve: 'P-256'
            },
            true,
            ['deriveBits']
        );

        const publicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
        
        if (conn && conn.open) {
            conn.send({
                type: 'dh_public',
                key: Array.from(new Uint8Array(publicKey))
            });
        }

        window.dhKeyPair = keyPair;
    } catch (err) {
        console.error('DH init error:', err);
        showChatError('Ошибка инициализации шифрования');
    }
}

async function handleDHPublicKey(publicKeyArray) {
    try {
        const publicKey = await crypto.subtle.importKey(
            'raw',
            new Uint8Array(publicKeyArray),
            {
                name: 'ECDH',
                namedCurve: 'P-256'
            },
            true,
            []
        );

        if (!window.dhKeyPair) {
            await initiateKeyExchange();
        }

        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'ECDH',
                public: publicKey
            },
            window.dhKeyPair.privateKey,
            256
        );

        sharedSecret = await crypto.subtle.importKey(
            'raw',
            derivedBits,
            { name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt']
        );

        window.dhKeyPair = null;
    } catch (err) {
        console.error('DH handle error:', err);
        showChatError('Ошибка обмена ключами');
    }
}

async function encryptMessage(text) {
    if (!sharedSecret) return text;
    
    try {
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = encoder.encode(text);
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            sharedSecret,
            encoded
        );
        
        return {
            iv: Array.from(iv),
            data: Array.from(new Uint8Array(encrypted))
        };
    } catch (err) {
        console.error('Encrypt error:', err);
        return text;
    }
}

async function decryptMessage(encryptedData) {
    if (!sharedSecret || typeof encryptedData === 'string') return encryptedData;
    
    try {
        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: new Uint8Array(encryptedData.iv)
            },
            sharedSecret,
            new Uint8Array(encryptedData.data)
        );
        
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (err) {
        console.error('Decrypt error:', err);
        return '[Ошибка расшифровки]';
    }
}

function handleIncomingMessage(data) {
    decryptMessage(data.text).then(decryptedText => {
        addMessage({ text: decryptedText, time: data.time }, 'in');
    });
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message) return;
    if (!conn || !isConnected) {
        showChatError('Нет подключения');
        return;
    }
    if (!sharedSecret) {
        showChatError('Шифрование не установлено');
        return;
    }

    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const encryptedText = await encryptMessage(message);

    if (conn && conn.open) {
        conn.send({ type: 'message', text: encryptedText, time: time });
        addMessage({ text: message, time: time }, 'out');
        input.value = '';
    }
}

function addMessage(data, direction) {
    const messagesBox = document.getElementById('messagesBox');
    if (!messagesBox) return;
    
    const emptyChat = messagesBox.querySelector('.empty-chat');
    if (emptyChat) emptyChat.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + (direction === 'in' ? 'message-in' : 'message-out');
    
    const textDiv = document.createElement('div');
    textDiv.textContent = data.text;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = data.time || '';
    
    messageDiv.appendChild(textDiv);
    messageDiv.appendChild(timeDiv);
    messagesBox.appendChild(messageDiv);
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

function handleKeyPress(event) {
    if (event.key === 'Enter') sendMessage();
}

function copyMyId() {
    if (!myPeerId || myPeerId.includes('Ошибка')) return;
    
    navigator.clipboard.writeText(myPeerId).then(() => {
        showError('ID скопирован!');
    }).catch(() => {
        const input = document.createElement('input');
        input.value = myPeerId;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showError('ID скопирован!');
    });
}

function goBack(event) {
    event.preventDefault();
    isGoingHome = true;
    cleanupConnection();
    showHomePage();
    
    if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname);
    }
    
    initPeerAndRedirect();
}

function disconnectAndGoHome() {
    isGoingHome = true;
    cleanupConnection();
    showHomePage();
    
    if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname);
    }
    
    initPeerAndRedirect();
}

function cleanupConnection() {
    stopHeartbeat();
    
    if (conn) {
        conn.close();
        conn = null;
    }
    
    if (peer && !peer.destroyed) {
        peer.destroy();
        peer = null;
    }
    
    isConnected = false;
    sharedSecret = null;
    isInitiator = false;
    window.dhKeyPair = null;
    myPeerId = null;
}

function startHeartbeat() {
    stopHeartbeat();
    heartbeatInterval = setInterval(() => {
        if (conn && conn.open) {
            conn.send({ type: 'ping' });
        } else {
            stopHeartbeat();
            if (isConnected && !isGoingHome) {
                showChatError('Соединение потеряно');
                isConnected = false;
            }
        }
    }, 10000);
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

window.addEventListener('beforeunload', () => {
    cleanupConnection();
});