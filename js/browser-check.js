(function() {
    var userAgent = navigator.userAgent;
    var isOldBrowser = false;
    var browserName = '';
    
    // Firefox < 52
    var firefoxMatch = userAgent.match(/Firefox\/(\d+)/);
    if (firefoxMatch && parseInt(firefoxMatch[1]) < 52) {
        isOldBrowser = true;
        browserName = 'Firefox ' + firefoxMatch[1];
    }
    
    // Chrome < 49
    var chromeMatch = userAgent.match(/Chrome\/(\d+)/);
    if (chromeMatch && parseInt(chromeMatch[1]) < 49) {
        isOldBrowser = true;
        browserName = 'Chrome ' + chromeMatch[1];
    }
    
    // IE (любая версия)
    var ieMatch = userAgent.match(/MSIE (\d+)|Trident.*rv:(\d+)/);
    if (ieMatch) {
        isOldBrowser = true;
        browserName = 'Internet Explorer';
    }
    
    // Edge < 79 (до Chromium)
    var edgeMatch = userAgent.match(/Edge\/(\d+)/);
    if (edgeMatch && parseInt(edgeMatch[1]) < 79) {
        isOldBrowser = true;
        browserName = 'Edge ' + edgeMatch[1];
    }
    
    // Safari < 10
    var safariMatch = userAgent.match(/Version\/(\d+).*Safari/);
    if (safariMatch && parseInt(safariMatch[1]) < 10) {
        isOldBrowser = true;
        browserName = 'Safari ' + safariMatch[1];
    }
    
    if (isOldBrowser) {
        document.body.innerHTML = '<div style="text-align: center; padding: 50px 20px; font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">' +
            '<h1 style="color: #000; font-size: 28px; margin-bottom: 20px;">⚠️ Ваш браузер устарел</h1>' +
            '<p style="color: #333; font-size: 18px; margin-bottom: 30px;">' +
            'Вы используете ' + browserName + '. Эта версия не поддерживается.<br>' +
            'Пожалуйста, обновите браузер для доступа к сайту.</p>' +
            '<div style="background: #f5f5f5; padding: 20px; border-radius: 10px; text-align: left;">' +
            '<p style="margin: 0 0 10px 0; font-weight: bold;">Рекомендуемые браузеры:</p>' +
            '<ul style="margin: 0; padding-left: 20px;">' +
            '<li><a href="https://www.mozilla.org/firefox/" style="color: #000;">Firefox 52+</a></li>' +
            '<li><a href="https://www.google.com/chrome/" style="color: #000;">Chrome 49+</a></li>' +
            '<li><a href="https://www.microsoft.com/edge/" style="color: #000;">Edge 79+</a></li>' +
            '</ul></div></div>';
    }
})();