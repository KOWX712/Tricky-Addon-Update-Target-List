import { linkRedirect } from './main.js';

// Function to show about overlay
document.getElementById("about").addEventListener("click", () => {
    const aboutOverlay = document.getElementById('about-overlay');
    const aboutContent = document.querySelector('.about-menu');
    const closeAbout = document.getElementById('close-about');

    // Show about menu
    document.body.classList.add("no-scroll");
    aboutOverlay.style.display = 'flex';
    setTimeout(() => {
        aboutOverlay.style.opacity = '1';
        aboutContent.classList.add('open');
    }, 10);

    const hideMenu = () => {
        document.body.classList.remove("no-scroll");
        aboutOverlay.style.opacity = '0';
        aboutContent.classList.remove('open');
        setTimeout(() => {
            aboutOverlay.style.display = 'none';
        }, 200);
    };

    closeAbout.addEventListener("click", hideMenu);
    aboutOverlay.addEventListener('click', (event) => {
        if (event.target === aboutOverlay) hideMenu();
    });
});

// Event listener for link redirect
document.getElementById('telegram').addEventListener('click', function() {
    linkRedirect('https://t.me/kowchannel');
});
document.getElementById('github').addEventListener('click', function() {
    linkRedirect('https://github.com/KOWX712/Tricky-Addon-Update-Target-List');
});