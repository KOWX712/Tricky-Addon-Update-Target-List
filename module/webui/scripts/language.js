import { applyRippleEffect, linkRedirect } from './main.js';

const languageButton = document.querySelector('.language-button');
const languageMenu = document.querySelector('.language-menu');
const languageOptions = document.querySelectorAll('.language-option');
const languageOverlay = document.getElementById('language-overlay');

export let translations = {};
let baseTranslations = {};
let availableLanguages = ['en'];
let languageNames = {};

/**
 * Parse XML translation file into a JavaScript object
 * @param {string} xmlText - The XML content as string
 * @returns {Object} - Parsed translations
 */
function parseTranslationsXML(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const strings = xmlDoc.getElementsByTagName('string');
    const translations = {};

    for (let i = 0; i < strings.length; i++) {
        const string = strings[i];
        const name = string.getAttribute('name');
        const value = string.textContent;
        translations[name] = value;
    }

    return translations;
}

/**
 * Detect user's default language
 * @returns {Promise<string>} - Detected language code
 */
async function detectUserLanguage() {
    const userLang = navigator.language || navigator.userLanguage;
    const langCode = userLang.split('-')[0];

    try {
        // Fetch available languages
        const availableResponse = await fetch('locales/languages.json');
        const availableData = await availableResponse.json();
        availableLanguages = Object.keys(availableData);
        languageNames = availableData;

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
            localStorage.removeItem('trickyAddonLanguage');
            return 'en';
        }
    } catch (error) {
        console.error('Error detecting user language:', error);
        return 'en';
    }
}

/**
 * Load translations dynamically based on the selected language
 * @returns {Promise<void>}
 */
export async function loadTranslations() {
    try {
        // load Englsih as base translations
        const baseResponse = await fetch('locales/strings/en.xml');
        const baseXML = await baseResponse.text();
        baseTranslations = parseTranslationsXML(baseXML);

        // load user's language if available
        const lang = await detectUserLanguage();
        if (lang !== 'en') {
            const response = await fetch(`locales/strings/${lang}.xml`);
            const userXML = await response.text();
            const userTranslations = parseTranslationsXML(userXML);
            translations = { ...baseTranslations, ...userTranslations };
        } else {
            translations = baseTranslations;
        }

        // Generate language menu
        await generateLanguageMenu();
    } catch (error) {
        console.error('Error loading translations:', error);
        translations = baseTranslations;
    }
    applyTranslations();
    applyRippleEffect();
}

/**
 * Apply translations to all elements with data-i18n attributes
 * @returns {void}
 */
function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        const translation = translations[key];
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
            languageOverlay.style.display = 'flex';
            setTimeout(() => languageMenu.classList.add("show"), 10);
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
    const closeLanguageMenu = () => {
        setTimeout(() => {
            languageMenu.classList.remove("show");
            languageOverlay.style.display = 'none';
        }, 80)
    }
    languageMenu.addEventListener("click", async (e) => {
        if (e.target.classList.contains("language-option")) {
            const lang = e.target.getAttribute("data-lang");
            localStorage.setItem('trickyAddonLanguage', lang);
            closeLanguageMenu();
            await new Promise(resolve => setTimeout(resolve, 200));
            loadTranslations();
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

    // Create and sort language entries
    const sortedLanguages = Object.entries(languageNames)
        .map(([lang, name]) => ({ lang, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

    // Add language buttons
    sortedLanguages.forEach(({ lang, name }) => {
        const button = document.createElement('button');
        button.classList.add('language-option', 'ripple-element');
        button.setAttribute('data-lang', lang);
        button.textContent = name;
        languageMenu.appendChild(button);
    });

    // Add translation guide button
    const moreBtn = document.createElement('button');
    moreBtn.classList.add('language-option', 'ripple-element');
    moreBtn.textContent = translations.more_language;
    moreBtn.onclick = () => linkRedirect('https://github.com/KOWX712/Tricky-Addon-Update-Target-List/blob/main/module/webui/locales/GUIDE.md');
    languageMenu.appendChild(moreBtn);
}
