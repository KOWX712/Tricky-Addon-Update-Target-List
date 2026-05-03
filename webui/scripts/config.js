import { exec } from 'kernelsu-alt';

const TRICKY_STORE_DIR = '/data/adb/tricky_store';
const CONFIG_INI_PATH = `${TRICKY_STORE_DIR}/config.ini`;
const TARGET_TXT_PATH = `${TRICKY_STORE_DIR}/target.txt`;
const SECURITY_PATCH_TXT_PATH = `${TRICKY_STORE_DIR}/security_patch.txt`;
const MODULE_PROP_PATH = '/data/adb/modules/tricky_store/module.prop';

export const POLICY_KEYS = ['os_patch', 'vendor_patch', 'boot_patch'];
const DEFAULT_POLICY = Object.freeze({
    os_patch: 'no',
    vendor_patch: 'no',
    boot_patch: 'no'
});

let currentConfig = createEmptyConfig();
let storeInfo = {
    versionCode: 0,
    isFork: false,
    usesConfigIni: false
};

function createEmptyConfig() {
    return {
        defaultPolicy: { ...DEFAULT_POLICY },
        targets: [],
        policies: {}
    };
}

function normalizePolicy(policy = {}, { allowEmpty = false } = {}) {
    const normalized = {};
    for (const key of POLICY_KEYS) {
        const value = typeof policy[key] === 'string' ? policy[key].trim() : '';
        if (!value) {
            if (!allowEmpty) normalized[key] = DEFAULT_POLICY[key];
            continue;
        }
        normalized[key] = value.replace(/-/g, '');
    }
    return normalized;
}

function cloneConfig(config = currentConfig) {
    return {
        defaultPolicy: { ...config.defaultPolicy },
        targets: config.targets.map(target => ({ ...target })),
        policies: Object.fromEntries(
            Object.entries(config.policies).map(([pkg, policy]) => [pkg, { ...policy }])
        )
    };
}

function parseTargetLine(rawLine) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) return null;

    let mode = 'auto';
    let packageName = line;
    if (line.endsWith('!')) {
        mode = 'generate';
        packageName = line.slice(0, -1);
    } else if (line.endsWith('?')) {
        mode = 'hack';
        packageName = line.slice(0, -1);
    }

    packageName = packageName.trim();
    if (!packageName) return null;
    return { packageName, mode };
}

function sortTargets(targets) {
    return [...targets].sort((a, b) => a.packageName.localeCompare(b.packageName));
}

function toLegacyDate(value) {
    if (!value || value === 'no' || value === 'prop') return value;
    if (value.length !== 8) return value;
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function removeLegacyDateDelimiters(value) {
    return value.replace(/-/g, '');
}

function isAllPolicy(policy) {
    return (
        /^\d{6}$/.test(policy.os_patch) &&
        policy.vendor_patch === `${policy.os_patch}05` &&
        policy.boot_patch === `${policy.os_patch}05`
    ) || (
        /^[YMD0-9]{6}$/.test(policy.os_patch) &&
        policy.vendor_patch === `${policy.os_patch}05` &&
        policy.boot_patch === `${policy.os_patch}05`
    );
}

export function parseTargetList(content = '') {
    const targets = [];
    const seen = new Set();

    for (const line of content.split('\n')) {
        const parsed = parseTargetLine(line);
        if (!parsed || seen.has(parsed.packageName)) continue;
        seen.add(parsed.packageName);
        targets.push(parsed);
    }

    return sortTargets(targets);
}

function serializeTargetList(targets = []) {
    return sortTargets(targets)
        .map(({ packageName, mode }) => {
            if (mode === 'generate') return `${packageName}!`;
            if (mode === 'hack') return `${packageName}?`;
            return packageName;
        })
        .join('\n');
}

function parseLegacySecurityPatch(content = '') {
    const policy = { ...DEFAULT_POLICY };
    const trimmed = content.trim();
    if (!trimmed) return policy;

    for (const rawLine of trimmed.split('\n')) {
        const line = rawLine.trim();
        if (!line || !line.includes('=')) continue;
        const [rawKey, rawValue] = line.split('=');
        const key = rawKey.trim();
        const value = removeLegacyDateDelimiters((rawValue || '').trim());
        if (!value) continue;

        if (key === 'all') {
            policy.os_patch = value.slice(0, 6);
            policy.vendor_patch = value;
            policy.boot_patch = value;
        } else if (key === 'system') {
            policy.os_patch = value;
        } else if (key === 'vendor') {
            policy.vendor_patch = value;
        } else if (key === 'boot') {
            policy.boot_patch = value;
        }
    }

    return policy;
}

function serializeLegacySecurityPatch(policy = DEFAULT_POLICY) {
    const normalized = {
        ...DEFAULT_POLICY,
        ...normalizePolicy(policy)
    };

    if (Object.values(normalized).every(value => value === 'no')) {
        return '';
    }

    if (isAllPolicy(normalized)) {
        return `all=${normalized.boot_patch}`;
    }

    return [
        `system=${normalized.os_patch}`,
        `boot=${toLegacyDate(normalized.boot_patch)}`,
        `vendor=${toLegacyDate(normalized.vendor_patch)}`
    ].join('\n');
}

function parseConfigIni(content = '') {
    const config = createEmptyConfig();
    let currentSection = '';

    for (const rawLine of content.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || line.startsWith(';')) continue;

        const sectionMatch = line.match(/^\[(.+)\]$/);
        if (sectionMatch) {
            currentSection = sectionMatch[1].trim();
            continue;
        }

        if (currentSection === 'target') {
            const parsedTarget = parseTargetLine(line);
            if (parsedTarget && !config.targets.some(target => target.packageName === parsedTarget.packageName)) {
                config.targets.push(parsedTarget);
            }
            continue;
        }

        if (!line.includes('=')) continue;
        const separatorIndex = line.indexOf('=');
        const key = line.slice(0, separatorIndex).trim();
        const value = removeLegacyDateDelimiters(line.slice(separatorIndex + 1).trim());
        if (!POLICY_KEYS.includes(key) || !value) continue;

        if (currentSection === 'default_policy') {
            config.defaultPolicy[key] = value;
        } else if (currentSection) {
            if (!config.policies[currentSection]) {
                config.policies[currentSection] = {};
            }
            config.policies[currentSection][key] = value;
        }
    }

    config.targets = sortTargets(config.targets);
    for (const packageName of Object.keys(config.policies)) {
        if (!config.targets.some(target => target.packageName === packageName)) {
            delete config.policies[packageName];
        }
    }

    return config;
}

function serializeConfigIni(config = currentConfig) {
    const normalized = cloneConfig(config);
    const lines = [
        '[default_policy]',
        ...POLICY_KEYS.map(key => `${key} = ${normalized.defaultPolicy[key] ?? DEFAULT_POLICY[key]}`),
        '',
        '[target]',
        ...sortTargets(normalized.targets).map(({ packageName, mode }) => {
            if (mode === 'generate') return `${packageName}!`;
            if (mode === 'hack') return `${packageName}?`;
            return packageName;
        })
    ];

    for (const { packageName } of sortTargets(normalized.targets)) {
        const policy = normalized.policies[packageName];
        if (!policy || Object.keys(policy).length === 0) continue;
        lines.push('', `[${packageName}]`);
        for (const key of POLICY_KEYS) {
            if (policy[key]) {
                lines.push(`${key} = ${policy[key]}`);
            }
        }
    }

    return lines.join('\n');
}

function writeFileCmd(path, content) {
    return `cat <<'CONFIG_EOF' > '${path}'
${content}

CONFIG_EOF
chmod 644 '${path}'`;
}

async function readFile(path) {
    const { stdout } = await exec(`cat '${path}' 2>/dev/null || true`);
    return stdout;
}

async function detectTrickyStoreInfo() {
    const moduleProp = await readFile(MODULE_PROP_PATH);
    const versionMatch = moduleProp.match(/^versionCode=(\d+)$/m);
    const versionCode = versionMatch ? Number(versionMatch[1]) : 0;
    const isFork = /James|beakthoven|JingMatrix/.test(moduleProp);
    storeInfo = {
        versionCode,
        isFork,
        usesConfigIni: !isFork && versionCode > 245
    };
    return { ...storeInfo };
}

export function getStoreInfo() {
    return { ...storeInfo };
}

export async function loadConfig() {
    const info = await detectTrickyStoreInfo();
    if (info.usesConfigIni) {
        currentConfig = parseConfigIni(await readFile(CONFIG_INI_PATH));
    } else {
        const [targetContent, securityPatchContent] = await Promise.all([
            readFile(TARGET_TXT_PATH),
            readFile(SECURITY_PATCH_TXT_PATH)
        ]);
        currentConfig = createEmptyConfig();
        currentConfig.targets = parseTargetList(targetContent);
        currentConfig.defaultPolicy = parseLegacySecurityPatch(securityPatchContent);
    }
    return cloneConfig(currentConfig);
}

export async function writeConfig() {
    const info = storeInfo.usesConfigIni || storeInfo.versionCode
        ? storeInfo
        : await detectTrickyStoreInfo();

    if (info.usesConfigIni) {
        const iniContent = serializeConfigIni(currentConfig);
        return exec(`
            rm -f '${TARGET_TXT_PATH}' '${SECURITY_PATCH_TXT_PATH}'
            ${writeFileCmd(CONFIG_INI_PATH, iniContent)}
        `);
    }

    const targetContent = serializeTargetList(currentConfig.targets);
    const securityPatchContent = serializeLegacySecurityPatch(currentConfig.defaultPolicy);
    const securityPatchCommand = securityPatchContent
        ? writeFileCmd(SECURITY_PATCH_TXT_PATH, `${securityPatchContent}`)
        : `rm -f '${SECURITY_PATCH_TXT_PATH}'`;

    return exec(`
        rm -f '${CONFIG_INI_PATH}'
        ${writeFileCmd(TARGET_TXT_PATH, targetContent)}
        ${securityPatchCommand}
    `);
}

export function getTarget() {
    return currentConfig.targets.map(target => target.packageName);
}

export function getTargetEntries() {
    return currentConfig.targets.map(target => ({ ...target }));
}

export function getTargetMode(packageName) {
    return currentConfig.targets.find(target => target.packageName === packageName)?.mode || 'auto';
}

export function setTargetMode(packageName, mode = 'auto') {
    const target = currentConfig.targets.find(entry => entry.packageName === packageName);
    if (target) {
        target.mode = mode;
        return;
    }
    currentConfig.targets = sortTargets([
        ...currentConfig.targets,
        { packageName, mode }
    ]);
}

export function getDefaultPolicy() {
    return { ...currentConfig.defaultPolicy };
}

export function getPolicy(packageName) {
    return currentConfig.policies[packageName] ? { ...currentConfig.policies[packageName] } : null;
}

export function setDefaultPolicy(policy = {}) {
    currentConfig.defaultPolicy = {
        ...DEFAULT_POLICY,
        ...normalizePolicy(policy)
    };
}

export function setTarget(appList = []) {
    const previousModes = new Map(currentConfig.targets.map(target => [target.packageName, target.mode]));
    const unique = [...new Set(appList.map(pkg => pkg.trim()).filter(Boolean))];
    currentConfig.targets = sortTargets(unique.map(packageName => ({
        packageName,
        mode: previousModes.get(packageName) || 'auto'
    })));

    for (const packageName of Object.keys(currentConfig.policies)) {
        if (!unique.includes(packageName)) {
            delete currentConfig.policies[packageName];
        }
    }
}

export function setPolicy(packageName, policy = {}) {
    const normalized = normalizePolicy(policy, { allowEmpty: true });
    if (Object.keys(normalized).length === 0) {
        delete currentConfig.policies[packageName];
        return;
    }
    currentConfig.policies[packageName] = normalized;
}

export function removePolicy(packageName) {
    delete currentConfig.policies[packageName];
}
