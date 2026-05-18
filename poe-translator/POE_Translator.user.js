// ==UserScript==
// @name         POE翻译助手
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Path of Exile游戏翻译插件，支持英译中、简繁互译
// @author       POE Translator
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @connect      gitee.com
// @connect      raw.githubusercontent.com
// @connect      localhost
// @updateURL    https://gitee.com/你的用户名/poe-translator/raw/master/POE_Translator.user.js
// @downloadURL  https://gitee.com/你的用户名/poe-translator/raw/master/POE_Translator.user.js
// ==/UserScript==

/**
 * POE翻译助手 - 油猴脚本版本
 * 支持：英译中、简繁互译
 */

// 配置区域 - 请根据实际情况修改
const CONFIG = {
    // 词典和转换表URL - 请修改为你的实际URL
    DICTIONARY_URL: 'https://gitee.com/你的用户名/poe-translator/raw/master/poe_dictionary.json',
    SC_TC_CONVERSION_URL: 'https://gitee.com/你的用户名/poe-translator/raw/master/sc_tc_conversion.json',

    // 默认设置
    DEFAULT_LOCALE: 'zh-rCN',  // zh-rCN: 简体中文, zh-rTW: 繁体中文
    DEFAULT_MODE: 'both',       // both: 精确+模糊, exact: 仅精确, fuzzy: 仅模糊
    DEFAULT_SC_TC_MODE: 'none', // none: 不转换, toTraditional: 简→繁, toSimplified: 繁→简
    AUTO_TRANSLATE: true
};

// 全局变量
let dictionary = null;
let scTcConversion = null;
let settings = {
    enabled: true,
    locale: CONFIG.DEFAULT_LOCALE,
    translationMode: CONFIG.DEFAULT_MODE,
    scTcMode: CONFIG.DEFAULT_SC_TC_MODE
};

// 简繁转换器类
class SC_TCConverter {
    constructor(conversionTable) {
        this.scToTc = conversionTable.sc_to_tc || {};
        this.tcToSc = conversionTable.tc_to_sc || {};
        this.metadata = conversionTable.metadata || {};
    }

    toTraditional(text) {
        if (!text) return text;
        if (this.scToTc[text]) return this.scToTc[text];

        let result = text;
        const sortedKeys = Object.keys(this.scToTc).sort((a, b) => b.length - a.length);

        for (const sc of sortedKeys) {
            const regex = new RegExp(this.escapeRegex(sc), 'g');
            result = result.replace(regex, this.scToTc[sc]);
        }
        return result;
    }

    toSimplified(text) {
        if (!text) return text;
        if (this.tcToSc[text]) return this.tcToSc[text];

        let result = text;
        const sortedKeys = Object.keys(this.tcToSc).sort((a, b) => b.length - a.length);

        for (const tc of sortedKeys) {
            const regex = new RegExp(this.escapeRegex(tc), 'g');
            result = result.replace(regex, this.tcToSc[tc]);
        }
        return result;
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    getSize() {
        return this.metadata.total_pairs || 0;
    }
}

// 翻译器类
class POETranslator {
    constructor(dictionary, settings, scTcConverter = null) {
        this.exactMap = dictionary.exact_map;
        this.phrases = dictionary.phrases;
        this.settings = settings;
        this.scTcConverter = scTcConverter;
        this.translatedCount = 0;
        this.initACM();
    }

    initACM() {
        this.acMachine = new AhoCorasickMachine();
        this.acMachine.build(this.phrases);
    }

    translateNode(textNode) {
        if (!this.settings.enabled) return;

        let text = textNode.nodeValue;
        if (!text || text.trim().length === 0) return;
        if (textNode._poeTranslated) return;

        const lowerText = text.toLowerCase();
        let translated = false;

        // 策略1：精确匹配整句
        if (this.settings.translationMode !== 'fuzzy') {
            let exactTranslation = this.exactMap[lowerText];
            if (!exactTranslation) {
                exactTranslation = this.exactMap[lowerText.trim()];
            }

            if (exactTranslation) {
                textNode.nodeValue = exactTranslation;
                textNode._poeTranslated = true;
                this.translatedCount++;
                return;
            }
        }

        // 策略2：使用AC自动机进行局部替换
        if (this.settings.translationMode !== 'exact') {
            const matches = this.acMachine.search(text);

            if (matches.length > 0) {
                matches.sort((a, b) => a.start - b.start);

                let result = '';
                let lastEnd = 0;

                for (const match of matches) {
                    result += text.slice(lastEnd, match.start);
                    const translation = this.exactMap[match.pattern];
                    if (translation) {
                        result += translation;
                        lastEnd = match.end + 1;
                        translated = true;
                    } else {
                        result += text[match.start];
                        lastEnd = match.start + 1;
                    }
                }

                result += text.slice(lastEnd);

                if (translated) {
                    textNode.nodeValue = result;
                    textNode._poeTranslated = true;
                    this.translatedCount++;
                }
            }
        }

        // 策略3：简繁互译
        if (this.settings.scTcMode && this.settings.scTcMode !== 'none' && this.scTcConverter) {
            let scText = textNode.nodeValue;

            if (this.settings.scTcMode === 'toTraditional') {
                scText = this.scTcConverter.toTraditional(scText);
            } else if (this.settings.scTcMode === 'toSimplified') {
                scText = this.scTcConverter.toSimplified(scText);
            }

            if (scText !== textNode.nodeValue) {
                textNode.nodeValue = scText;
                textNode._poeTranslated = true;
                this.translatedCount++;
            }
        }
    }

    translatePage() {
        const startTime = performance.now();
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;

                    const tagName = parent.tagName.toLowerCase();
                    if (['script', 'style', 'noscript', 'textarea', 'input'].includes(tagName)) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    if (node._poeTranslated) return NodeFilter.FILTER_REJECT;

                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const nodes = [];
        let node;
        while ((node = walker.nextNode())) {
            nodes.push(node);
        }

        for (const textNode of nodes) {
            this.translateNode(textNode);
        }

        const endTime = performance.now();
        console.log(`POE翻译助手：页面翻译完成，翻译 ${this.translatedCount} 个节点，耗时 ${(endTime - startTime).toFixed(2)}ms`);
    }
}

// AC自动机实现
class AhoCorasickMachine {
    constructor() {
        this.trie = new Map();
    }

    build(patterns) {
        for (const pattern of patterns) {
            let node = this.trie;
            for (const char of pattern) {
                if (!node.has(char)) {
                    node.set(char, { next: new Map(), fail: null, output: [] });
                }
                node = node.get(char).next;
            }
            if (!node.has('end')) {
                node.set('end', []);
            }
            node.get('end').push(pattern);
        }

        const queue = [];
        const root = this.trie;

        for (const [char, node] of root) {
            if (char === 'end') continue;
            node.fail = root;
            node.output = node.output || [];
            queue.push(node);
        }

        while (queue.length > 0) {
            const current = queue.shift();

            for (const [char, child] of current.next) {
                if (char === 'end') continue;

                let failNode = current.fail;
                while (failNode && !failNode.has(char)) {
                    failNode = failNode.fail || root;
                }

                child.fail = failNode && failNode.has(char) ? failNode.get(char) : root;
                child.output = [...(child.fail.output || []), ...(child.output || [])];

                queue.push(child);
            }
        }
    }

    search(text) {
        const matches = [];
        let node = this.trie;
        let i = 0;

        while (i < text.length) {
            const char = text[i].toLowerCase();

            while (node && !node.has(char)) {
                node = node.fail || this.trie;
            }

            if (node && node.has(char)) {
                node = node.get(char);
            } else {
                node = this.trie;
            }

            if (node && node.has('end')) {
                const patterns = node.get('end');
                for (const pattern of patterns) {
                    matches.push({
                        pattern: pattern,
                        start: i - pattern.length + 1,
                        end: i
                    });
                }
            }

            i++;
        }

        return matches;
    }
}

// 全局实例
let translator = null;
let scTcConverterInstance = null;
let observer = null;

// 加载词典
function loadDictionary() {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url: CONFIG.DICTIONARY_URL,
            onload: function(response) {
                try {
                    dictionary = JSON.parse(response.responseText);
                    console.log(`POE翻译助手：词典加载完成，共 ${dictionary.metadata.total_entries} 词条`);
                    resolve(dictionary);
                } catch (e) {
                    console.error('词典解析失败:', e);
                    reject(e);
                }
            },
            onerror: function(error) {
                console.error('词典加载失败:', error);
                reject(error);
            }
        });
    });
}

// 加载简繁转换表
function loadScTcConversion() {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url: CONFIG.SC_TC_CONVERSION_URL,
            onload: function(response) {
                try {
                    scTcConversion = JSON.parse(response.responseText);
                    console.log(`POE翻译助手：简繁转换表加载完成，共 ${scTcConversion.metadata.total_pairs} 对照`);
                    resolve(scTcConversion);
                } catch (e) {
                    console.error('转换表解析失败:', e);
                    reject(e);
                }
            },
            onerror: function(error) {
                console.error('转换表加载失败:', error);
                reject(error);
            }
        });
    });
}

// 加载设置
function loadSettings() {
    const savedSettings = GM_getValue('poeTranslatorSettings', null);
    if (savedSettings) {
        settings = { ...settings, ...savedSettings };
    }
}

// 保存设置
function saveSettings(newSettings) {
    settings = { ...settings, ...newSettings };
    GM_setValue('poeTranslatorSettings', settings);
}

// 初始化翻译器
async function initializeTranslator() {
    try {
        loadSettings();

        await loadDictionary();
        await loadScTcConversion();

        if (dictionary) {
            if (scTcConversion) {
                scTcConverterInstance = new SC_TCConverter(scTcConversion);
            }

            translator = new POETranslator(dictionary, settings, scTcConverterInstance);

            if (CONFIG.AUTO_TRANSLATE) {
                translator.translatePage();

                // 启动DOM监控
                observer = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        if (mutation.type === 'childList') {
                            for (const node of mutation.addedNodes) {
                                if (node.nodeType === Node.ELEMENT_NODE) {
                                    translateElement(node);
                                } else if (node.nodeType === Node.TEXT_NODE) {
                                    translator.translateNode(node);
                                }
                            }
                        }
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }

            // 注册菜单命令
            GM_registerMenuCommand('🔄 重新翻译页面', () => {
                if (translator) {
                    const walker = document.createTreeWalker(
                        document.body,
                        NodeFilter.SHOW_TEXT,
                        null
                    );
                    let node;
                    while ((node = walker.nextNode())) {
                        delete node._poeTranslated;
                    }
                    translator.translatedCount = 0;
                    translator.translatePage();
                }
            });

            GM_registerMenuCommand('⚙️ 切换翻译开/关', () => {
                settings.enabled = !settings.enabled;
                saveSettings(settings);
                translator.settings = settings;
                alert(`翻译已${settings.enabled ? '开启' : '关闭'}`);
            });

            GM_registerMenuCommand('🌐 切换简繁转换', () => {
                const modes = ['none', 'toTraditional', 'toSimplified'];
                const currentIndex = modes.indexOf(settings.scTcMode);
                settings.scTcMode = modes[(currentIndex + 1) % modes.length];
                saveSettings(settings);
                translator.settings = settings;

                const modeNames = {
                    'none': '不转换',
                    'toTraditional': '简体→繁体',
                    'toSimplified': '繁体→简体'
                };
                alert(`简繁转换：${modeNames[settings.scTcMode]}`);
            });

            console.log('POE翻译助手：初始化完成');
        }
    } catch (error) {
        console.error('POE翻译助手：初始化失败', error);
    }
}

// 翻译元素
function translateElement(element) {
    if (!translator) return;

    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;

                const tagName = parent.tagName.toLowerCase();
                if (['script', 'style', 'noscript', 'textarea', 'input'].includes(tagName)) {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    let node;
    while ((node = walker.nextNode())) {
        translator.translateNode(node);
    }
}

// 页面加载完成后初始化
if (document.readyState === 'complete') {
    initializeTranslator();
} else {
    window.addEventListener('load', initializeTranslator);
}
