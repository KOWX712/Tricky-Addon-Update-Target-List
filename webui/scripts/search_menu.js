import { appListContainer } from './applist.js';

export const searchInput = document.getElementById('search');
const searchBtn = document.getElementById('search-button');
const clearBtn = document.getElementById('clear-btn');
const menuButton = document.getElementById('menu-button');
const menuOptions = document.getElementById('menu-options');
const searchBarBg = document.querySelector('.search-background');

searchBtn.onclick = () => {
    searchInput.classList.add('show');
    searchBarBg.classList.add('show');
    searchInput.focus();
};

searchInput.addEventListener('focus', () => {
    searchBtn.style.pointerEvents = 'none';
});

searchInput.addEventListener('blur', () => {
    if (searchInput.value === '') {
        searchInput.classList.remove('show');
        searchBarBg.classList.remove('show');
        searchBtn.style.pointerEvents = 'auto';
    }
});

// Search functionality
searchInput.addEventListener("input", (e) => {
    const searchQuery = e.target.value.toLowerCase();
    const apps = appListContainer.querySelectorAll(".card");
    apps.forEach(app => {
        const name = app.querySelector(".name").textContent.toLowerCase();
        app.style.display = name.includes(searchQuery) ? "flex" : "none";
        window.scrollTo(0, 0);
    });
});

// Clear search input
clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchInput.blur();
    window.scrollTo(0, 0);
    const apps = appListContainer.querySelectorAll(".card");
    apps.forEach(app => app.style.display = "flex");
});

menuButton.addEventListener('click', () => {
    menuOptions.open = !menuOptions.open;
});
