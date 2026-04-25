let peer;
let conn;
let myPeerId;
let isConnected = false;
let sharedSecret = null;
let isInitiator = false;
let heartbeatInterval = null;
let reconnectTimeout = null;

// Конфигурация DH
const dhPrime = new Uint8Array([
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xC9, 0x0F, 0xDA, 0xA2,
    0x21, 0x68, 0xC2, 0x34, 0xC4, 0xC6, 0x62, 0x8B, 0x80, 0xDC, 0x1C, 0xD1,
    0x29, 0x02, 0x4E, 0x08, 0x8A, 0x67, 0xCC, 0x74, 0x02, 0x0B, 0xBE, 0xA6,
    0x3B, 0x13, 0x9B, 0x22, 0x51, 0x4A, 0x08, 0x79, 0x8E, 0x34, 0x04, 0xDD,
    0xEF, 0x95, 0x19, 0xB3, 0xCD, 0x3A, 0x43, 0x1B, 0x30, 0x2B, 0x0A, 0x6D,
    0xF2, 0x5F, 0x14, 0x37, 0x4F, 0xE1, 0x35, 0x6D, 0x6D, 0x51, 0xC2, 0x45,
    0xE4, 0x85, 0xB5, 0x76, 0x62, 0x5E, 0x7E, 0xC6, 0xF4, 0x4C, 0x42, 0xE9,
    0xA6, 0x37, 0xED, 0x6B, 0x0B, 0xFF, 0x5C, 0xB6, 0xF4, 0x06, 0xB7, 0xED,
    0xEE, 0x38, 0x6B, 0xFB, 0x5A, 0x89, 0x9F, 0xA5, 0xAE, 0x9F, 0x24, 0x11,
    0x7C, 0x4B, 0x1F, 0xE6, 0x49, 0x28, 0x66, 0x51, 0xEC, 0xE4, 0x5B, 0x3D,
    0xC2, 0x00, 0x7C, 0xB8, 0xA1, 0x63, 0xBF, 0x05, 0x98, 0xDA, 0x48, 0x36,
    0x1C, 0x55, 0xD3, 0x9A, 0x69, 0x16, 0x3F, 0xA8, 0xFD, 0x24, 0xCF, 0x5F,
    0x83, 0x65, 0x5D, 0x23, 0xDC, 0xA3, 0xAD, 0x96, 0x1C, 0x62, 0xF3, 0x56,
    0x20, 0x85, 0x52, 0xBB, 0x9E, 0xD5, 0x29, 0x07, 0x70, 0x96, 0x96, 0x6D,
    0x67, 0x0C, 0x35, 0x4E, 0x4A, 0xBC, 0x98, 0x04, 0xF1, 0x74, 0x6C, 0x08,
    0xCA, 0x18, 0x21, 0x7C, 0x32, 0x90, 0x5E, 0x46, 0x2E, 0x36, 0xCE, 0x3B,
    0xE3, 0x9E, 0x77, 0x2C, 0x18, 0x0E, 0x86, 0x03, 0x9B, 0x27, 0x83, 0xA2,
    0xEC, 0x07, 0xA2, 0x8F, 0xB5, 0xC5, 0x5D, 0xF0, 0x6F, 0x4C, 0x52, 0xC9,
    0xDE, 0x2B, 0xCB, 0xF6, 0x95, 0x58, 0x17, 0x18, 0x39, 0x95, 0x49, 0x7C,
    0xEA, 0x95, 0x6A, 0xE5, 0x15, 0xD2, 0x26, 0x18, 0x98, 0xFA, 0x05, 0x10,
    0x15, 0x72, 0x8E, 0x5A, 0x8A, 0xAC, 0xAA, 0x68, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF
]);

function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    if (!errorEl) return;
    errorEl.textContent = message;
    setTimeout(() => { errorEl.textContent = ''; }, 3000);
}

function showChatError(message) {
    const errorEl = document.getElementById('chatErrorMessage');
    if (!errorEl) return;
    errorEl.textContent = message;
    setTimeout(() => { errorEl.textContent = ''; }, 3000);
}

// Обработка хеша
function handleHashChange() {
    const hash = window.location.hash.substring(1);
    
    if (!hash) {
        cleanupConnection();
        showHomePage();
    } else if (hash !== myPeerId) {
        cleanupConnection();
        joinRoom(hash);
    }
}

window.addEventListener('hashchange', handleHashChange);

// Инициализация при загрузке
const hash = window.location.hash.substring(1);
if (hash) {
    joinRoom(hash);
} else {
    showHomePage();
}

function showHomePage() {
    document.getElementById('homePage').style.display = 'block';
    document.getElementById('chatPage').style.display = 'none';
    document.getElementById('remotePeerId').value = '';
    
    if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname);
    }
    
    initPeer();
}

function joinRoom(roomId) {
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('chatPage').style.display = 'block';
    document.getElementById('chatPeerId').textContent = roomId;
    document.getElementById('messagesBox').innerHTML = '<div class="empty-chat">Сообщений пока нет</div>';
    
    initPeer(roomId);
}

function generateSecureId() {
    const array = new Uint32Array(2);
    crypto.getRandomValues(array);
    return 't' + Array.from(array).map(n => n.toString(36)).join('');
}

function initPeer(roomId = null) {
    const peerId = generateSecureId();
    
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
        
        if (roomId) {
            connectToRoom(roomId);
        }
    });

    peer.on('connection', (connection) => {
        if (isConnected) {
            connection.close();
            return;
        }
        conn = connection;
        isInitiator = false;
        setupConnection();
        startHeartbeat();
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

function connectToRoom(roomId) {
    conn = peer.connect(roomId, { reliable: true });
    isInitiator = true;

    conn.on('open', () => {
        setupConnection();
        startHeartbeat();
        initiateKeyExchange();
    });

    conn.on('error', () => {
        showChatError('Не удалось подключиться к комнате');
    });
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
                // Соединение активно
                break;
        }
    });

    conn.on('close', () => {
        stopHeartbeat();
        isConnected = false;
        
        if (document.getElementById('chatPage').style.display === 'block') {
            showChatError('Собеседник отключился');
            setTimeout(() => { window.location.hash = ''; }, 500);
        }
    });

    isConnected = true;
}

// Diffie-Hellman обмен ключами
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
        
        conn.send({
            type: 'dh_public',
            key: Array.from(new Uint8Array(publicKey))
        });

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

// Шифрование сообщений
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

// Отправка сообщений
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
    
    const shareUrl = `https://zekapro509.github.io/messenger/#${myPeerId}`;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
        showError('Ссылка скопирована!');
    }).catch(() => {
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showError('Ссылка скопирована!');
    });
}

function disconnectAndGoHome() {
    cleanupConnection();
    window.location.hash = '';
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
    
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
}

function startHeartbeat() {
    stopHeartbeat();
    heartbeatInterval = setInterval(() => {
        if (conn && conn.open) {
            conn.send({ type: 'ping' });
        } else {
            stopHeartbeat();
            if (isConnected) {
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

// Очистка при уходе со страницы
window.addEventListener('beforeunload', () => {
    cleanupConnection();
});