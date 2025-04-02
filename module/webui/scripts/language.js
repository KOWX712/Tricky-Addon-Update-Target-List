const languageButton = document.querySelector('.language-button');
const languageMenu = document.querySelector('.language-menu');
const languageOptions = document.querySelectorAll('.language-option');
const languageOverlay = document.getElementById('language-overlay');

export let translations = {};
let availableLanguages = ['en-US'];

/**
 * Detect user's default language
 * @returns {Promise<string>} - Detected language code
 */
async function detectUserLanguage() {
    const userLang = navigator.language || navigator.userLanguage;
    const langCode = userLang.split('-')[0];

    try {
        // Fetch available languages
        const availableResponse = await fetch('locales/available-lang.json');
        const availableData = await availableResponse.json();
        availableLanguages = availableData.languages;
        await generateLanguageMenu();

        // Fetch preferred language
        const prefered_language_code = localStorage.getItem('trickyAddonLanguage');

        // Check if preferred language is valid
        if (prefered_language_code !== 'default' && availableLanguages.includes(prefered_language_code)) {
            return prefered_language_code;
        } else if (availableLanguages.includes(userLang)) {
            return userLang;
        } else if (availableLanguages.includes(langCode)) {
            return langCode;
        } else {
            return 'en-US';
        }
    } catch (error) {
        console.error('Error detecting user language:', error);
        return 'en-US';
    }
}

/**
 * Load translations dynamically based on the selected language
 * @returns {Promise<void>}
 */
export async function loadTranslations() {
    const lang = await detectUserLanguage();
    const response = await fetch(`locales/${lang}.json`);
    translations = await response.json();
    applyTranslations();
}

/**
 * Apply translations to all elements with data-i18n attributes
 * @returns {void}
 */
function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const keyString = el.getAttribute("data-i18n");
        const translation = keyString.split('.').reduce((acc, key) => acc && acc[key], translations);
        if (translation) {
            if (el.hasAttribute("placeholder")) {
                el.setAttribute("placeholder", translation);
            } else {
                el.textContent = translation;
            }
        }
    });
}

/**
 * Function to setup the language menu
 * @returns {void}
 */
export function setupLanguageMenu() {
    languageButton.addEventListener("click", (event) => {
        event.stopPropagation();
        const isVisible = languageMenu.classList.contains("show");
        if (isVisible) {
            closeLanguageMenu();
        } else {
            openLanguageMenu();
        }
    });
    document.addEventListener("click", (event) => {
        if (!languageButton.contains(event.target) && !languageMenu.contains(event.target)) {
            closeLanguageMenu();
        }
    });
    languageOptions.forEach(option => {
        option.addEventListener("click", () => {
            closeLanguageMenu();
        });
    });
    window.addEventListener('scroll', () => {
        if (languageMenu.classList.contains("show")) {
            closeLanguageMenu();
        }
    });
    function openLanguageMenu() {
        languageOverlay.style.display = 'flex';
        setTimeout(() => {
            languageMenu.classList.add("show");
        }, 10);
    }
    function closeLanguageMenu() {
        languageMenu.classList.remove("show");
        languageOverlay.style.display = 'none';
    }
    languageMenu.addEventListener("click", (e) => {
    if (e.target.classList.contains("language-option")) {
        const lang = e.target.getAttribute("data-lang");
        localStorage.setItem('trickyAddonLanguage', lang);
        loadTranslations(lang);
        closeLanguageMenu();
    }
});
}

/**
 * Generate the language menu dynamically
 * Refer available-lang.json in ./locales for list of languages
 * @returns {Promise<void>}
 */
async function generateLanguageMenu() {
    languageMenu.innerHTML = '';
    
    // Add System Default option
    const defaultButton = document.createElement('button');
    defaultButton.classList.add('language-option', 'ripple-element');
    defaultButton.setAttribute('data-lang', 'default');
    defaultButton.setAttribute('data-i18n', 'system_default');
    languageMenu.appendChild(defaultButton);

    const languagePromises = availableLanguages.map(async (lang) => {
        try {
            const response = await fetch(`locales/${lang}.json`);
            const data = await response.json();
            return { lang, name: data.language || lang };
        } catch (error) {
            console.error(`Error fetching language name for ${lang}:`, error);
            return { lang, name: lang };
        }
    });
    const languageData = await Promise.all(languagePromises);
    const sortedLanguages = languageData.sort((a, b) => a.name.localeCompare(b.name));
    sortedLanguages.forEach(({ lang, name }) => {
        const button = document.createElement('button');
        button.classList.add('language-option', 'ripple-element');
        button.setAttribute('data-lang', lang);
        button.textContent = name;
        languageMenu.appendChild(button);
    });
}
