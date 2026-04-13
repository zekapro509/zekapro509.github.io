const toggleButton = document.getElementById('theme-toggle');

function setTheme(isDark) {
    if (isDark) {
        document.documentElement.classList.add('dark-theme');
        toggleButton.textContent = '☾';
        toggleButton.classList.remove('sun');
        toggleButton.classList.add('moon');
    } else {
        document.documentElement.classList.remove('dark-theme');
        toggleButton.textContent = '☀';
        toggleButton.classList.remove('moon');
        toggleButton.classList.add('sun');
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    setTheme(true);
} else {
    setTheme(false);
}

toggleButton.onclick = function() {
    const isDark = document.documentElement.classList.contains('dark-theme');
    setTheme(!isDark);
};