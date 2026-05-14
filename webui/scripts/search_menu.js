import { appListContainer } from './applist.js';

export const searchInput = document.getElementById('search');
const searchBtn = document.getElementById('search-button');
const clearBtn = document.getElementById('clear-btn');
const menuButton = document.getElementById('menu-button');
const menuOptions = document.getElementById('menu-options');

function setAppVisibility(searchQuery = "") {
    const normalizedQuery = searchQuery.toLowerCase();
    const apps = appListContainer.querySelectorAll(".card");

    apps.forEach(app => {
        const name = app.querySelector(".name").textContent.toLowerCase();
        app.parentElement.style.display = name.includes(normalizedQuery) ? "flex" : "none";
    });
}

searchBtn.onclick = () => {
    searchInput.classList.add('show');
    searchInput.focus();
};

searchInput.addEventListener('focus', () => {
    searchBtn.style.pointerEvents = 'none';
    document.querySelectorAll('.search-bg').forEach(el => {
        el.classList.add('hide');
    });
});

searchInput.addEventListener('blur', () => {
    if (searchInput.value === '') {
        searchInput.classList.remove('show');
        searchBtn.style.pointerEvents = 'auto';
        document.querySelectorAll('.search-bg').forEach(el => {
            el.classList.remove('hide');
        });
    }
});

// Search functionality
searchInput.addEventListener("input", (e) => {
    setAppVisibility(e.target.value);
    window.scrollTo(0, 0);
});

// Clear search input
clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    setAppVisibility();
    searchInput.blur();
    window.scrollTo(0, 0);
});

menuButton.addEventListener('click', () => {
    menuOptions.open = !menuOptions.open;
});
