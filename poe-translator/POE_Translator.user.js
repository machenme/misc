// ==UserScript==
// @name         POE翻译助手
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Path of Exile游戏翻译插件，优化性能，支持可视化控制面板
// @author       POE Translator
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @connect      cdn.jsdelivr.net
// @connect      cdn.bootcdn.net
// @connect      gitee.com
// @connect      raw.githubusercontent.com
// @connect      localhost
// @updateURL    https://cdn.jsdelivr.net/gh/machenme/misc@main/poe-translator/POE_Translator.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/machenme/misc@main/poe-translator/POE_Translator.user.js
// ==/UserScript==

/**
 * POE翻译助手 - 油猴脚本版本 v2.2
 * 性能优化版本：
 * 1. 禁用自动实时DOM监控（改为手动翻译）
 * 2. 优化AC自动机构建
 * 3. 添加节流机制
 */

// 配置区域
const CONFIG = {
    // 请修改为你的实际URL
    DICTIONARY_URL: 'https://cdn.jsdelivr.net/gh/你的GitHub用户名/poe-translator@master/poe_dictionary.json',
    SC_TC_CONVERSION_URL: 'https://cdn.jsdelivr.net/gh/你的GitHub用户名/poe-translator@master/sc_tc_conversion.json',

    // 性能优化配置
    AUTO_TRANSLATE: false,  // 改为false，避免自动翻译消耗CPU
    OBSERVER_ENABLED: false, // 禁用自动DOM监控，改为手动翻译
    MAX_NODES_PER_BATCH: 500, // 每次最多翻译500个节点
    DEBOUNCE_DELAY: 500, // 防抖延迟（毫秒）
};

// 全局变量
let dictionary = null;
let scTcConversion = null;
let settings = {
    enabled: true,
    locale: 'zh-rCN',
    translationMode: 'both',
    scTcMode: 'none'
};

// 翻译器类（优化版）
class POETranslator {
    constructor(dictionary, settings, scTcConverter = null) {
        this.exactMap = dictionary.exact_map;
        this.phrases = dictionary.phrases || [];
        this.settings = settings;
        this.scTcConverter = scTcConverter;
        this.translatedCount = 0;
        this.acMachine = null;
        this.initACM();
    }

    // 优化：延迟构建AC自动机
    initACM() {
        if (!this.phrases || this.phrases.length === 0) return;
        
        this.acMachine = {
            trie: new Map(),
            search: this.createSearchMethod(this.phrases)
        };
        
        // 构建Trie树
        for (const pattern of this.phrases) {
            let node = this.acMachine.trie;
            for (const char of pattern) {
                if (!node.has(char)) {
                    node.set(char, new Map());
                }
                node = node.get(char);
            }
        }
    }

    // 创建优化的搜索方法
    createSearchMethod(patterns) {
        // 预排序短语（按长度降序）
        const sortedPatterns = patterns
            .filter(p => p && p.length > 0)
            .sort((a, b) => b.length - a.length);
        
        // 预构建正则表达式缓存
        const regexCache = new Map();
        
        return (text) => {
            if (!text || !sortedPatterns.length) return [];
            
            const matches = [];
            const lowerText = text.toLowerCase();
            
            // 使用正则表达式匹配
            for (const pattern of sortedPatterns) {
                if (pattern.length > text.length) continue;
                
                let regex = regexCache.get(pattern);
                if (!regex) {
                    regex = new RegExp(this.escapeRegex(pattern), 'gi');
                    regexCache.set(pattern, regex);
                }
                
                let match;
                while ((match = regex.exec(lowerText)) !== null) {
                    matches.push({
                        pattern: pattern,
                        start: match.index,
                        end: match.index + pattern.length - 1
                    });
                }
            }
            
            return matches;
        };
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    translateNode(textNode) {
        if (!this.settings.enabled) return false;
        if (!textNode || !textNode.nodeValue) return false;
        if (textNode._poeTranslated) return false;
        
        const text = textNode.nodeValue.trim();
        if (!text || text.length === 0) return false;
        
        // 跳过特殊标签
        const parent = textNode.parentElement;
        if (parent) {
            const tagName = parent.tagName?.toLowerCase();
            if (['script', 'style', 'noscript', 'textarea', 'input', 'code', 'pre'].includes(tagName)) {
                return false;
            }
        }

        const lowerText = text.toLowerCase();

        // 策略1：精确匹配
        if (this.settings.translationMode !== 'fuzzy') {
            let translation = this.exactMap[lowerText];
            if (!translation) {
                translation = this.exactMap[lowerText.trim()];
            }
            
            if (translation) {
                textNode.nodeValue = translation;
                textNode._poeTranslated = true;
                this.translatedCount++;
                return true;
            }
        }

        // 策略2：模糊匹配（使用AC自动机）
        if (this.settings.translationMode !== 'exact' && this.acMachine) {
            const matches = this.acMachine.search(text);
            
            if (matches && matches.length > 0) {
                // 按位置排序
                matches.sort((a, b) => a.start - b.start);
                
                let result = '';
                let lastEnd = 0;
                let translated = false;
                
                for (const match of matches) {
                    if (match.start < lastEnd) continue; // 避免重叠
                    
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
                    return true;
                }
            }
        }

        // 策略3：简繁互译
        if (this.settings.scTcMode && this.settings.scTcMode !== 'none' && this.scTcConverter) {
            let convertedText = textNode.nodeValue;
            
            if (this.settings.scTcMode === 'toTraditional') {
                convertedText = this.scTcConverter.toTraditional(convertedText);
            } else if (this.settings.scTcMode === 'toSimplified') {
                convertedText = this.scTcConverter.toSimplified(convertedText);
            }
            
            if (convertedText !== textNode.nodeValue) {
                textNode.nodeValue = convertedText;
                textNode._poeTranslated = true;
                this.translatedCount++;
                return true;
            }
        }
        
        return false;
    }

    translatePage(options = {}) {
        const startTime = performance.now();
        const maxNodes = options.maxNodes || CONFIG.MAX_NODES_PER_BATCH;
        
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    if (node._poeTranslated) return NodeFilter.FILTER_REJECT;
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;
                    const tagName = parent.tagName?.toLowerCase();
                    if (['script', 'style', 'noscript', 'textarea', 'input', 'code', 'pre', 'noscript'].includes(tagName)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let nodeCount = 0;
        let translatedCount = 0;
        let node;
        
        while ((node = walker.nextNode()) && nodeCount < maxNodes) {
            if (this.translateNode(node)) {
                translatedCount++;
            }
            nodeCount++;
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.log(`POE翻译：翻译 ${translatedCount}/${nodeCount} 个节点，耗时 ${duration.toFixed(2)}ms`);
        
        return {
            total: nodeCount,
            translated: translatedCount,
            duration: duration
        };
    }
}

// 简繁转换器（优化版）
class SC_TCConverter {
    constructor(conversionTable) {
        this.scToTc = conversionTable.sc_to_tc || {};
        this.tcToSc = conversionTable.tc_to_sc || {};
        
        // 预排序以提高性能
        this.scKeys = Object.keys(this.scToTc).sort((a, b) => b.length - a.length);
        this.tcKeys = Object.keys(this.tcToSc).sort((a, b) => b.length - a.length);
    }

    toTraditional(text) {
        if (!text || !this.scKeys.length) return text;
        
        // 精确匹配优先
        if (this.scToTc[text]) return this.scToTc[text];
        
        // 批量替换
        let result = text;
        for (const key of this.scKeys) {
            if (result.includes(key)) {
                result = result.split(key).join(this.scToTc[key]);
            }
        }
        return result;
    }

    toSimplified(text) {
        if (!text || !this.tcKeys.length) return text;
        
        if (this.tcToSc[text]) return this.tcToSc[text];
        
        let result = text;
        for (const key of this.tcKeys) {
            if (result.includes(key)) {
                result = result.split(key).join(this.tcToSc[key]);
            }
        }
        return result;
    }
}

// 悬浮控制面板
class POETranslatorPanel {
    constructor() {
        this.isVisible = false;
        this.isDragging = false;
        this.createUI();
        this.loadSettings();
    }

    createUI() {
        this.panel = document.createElement('div');
        this.panel.id = 'poe-translator-panel';
        this.panel.innerHTML = `
            <div class="poe-panel-header">
                <span class="poe-panel-title">🌐 POE翻译助手</span>
                <button class="poe-panel-close" id="poe-panel-close">×</button>
            </div>

            <div class="poe-panel-content">
                <div class="poe-panel-section">
                    <div class="poe-panel-label">翻译目标语言</div>
                    <div class="poe-panel-buttons">
                        <button class="poe-lang-btn ${settings.locale === 'zh-rCN' ? 'active' : ''}" data-locale="zh-rCN">
                            <span class="poe-lang-icon">🇨🇳</span>
                            <span>简体中文</span>
                        </button>
                        <button class="poe-lang-btn ${settings.locale === 'zh-rTW' ? 'active' : ''}" data-locale="zh-rTW">
                            <span class="poe-lang-icon">🇹🇼</span>
                            <span>繁体中文</span>
                        </button>
                    </div>
                </div>

                <div class="poe-panel-section">
                    <div class="poe-panel-label">翻译模式</div>
                    <div class="poe-panel-buttons">
                        <button class="poe-mode-btn ${settings.translationMode === 'both' ? 'active' : ''}" data-mode="both">精确+模糊</button>
                        <button class="poe-mode-btn ${settings.translationMode === 'exact' ? 'active' : ''}" data-mode="exact">仅精确</button>
                        <button class="poe-mode-btn ${settings.translationMode === 'fuzzy' ? 'active' : ''}" data-mode="fuzzy">仅模糊</button>
                    </div>
                </div>

                <div class="poe-panel-section">
                    <div class="poe-panel-label">简繁转换</div>
                    <div class="poe-panel-buttons">
                        <button class="poe-sctc-btn ${settings.scTcMode === 'none' ? 'active' : ''}" data-sctc="none">不转换</button>
                        <button class="poe-sctc-btn ${settings.scTcMode === 'toTraditional' ? 'active' : ''}" data-sctc="toTraditional">简→繁</button>
                        <button class="poe-sctc-btn ${settings.scTcMode === 'toSimplified' ? 'active' : ''}" data-sctc="toSimplified">繁→简</button>
                    </div>
                </div>

                <div class="poe-panel-section">
                    <button class="poe-action-btn primary" id="poe-retranslate-btn">
                        🔄 翻译当前页面
                    </button>
                    <button class="poe-action-btn ${settings.enabled ? '' : 'disabled'}" id="poe-toggle-btn">
                        ${settings.enabled ? '⏸️ 暂停' : '▶️ 启用'}
                    </button>
                </div>

                <div class="poe-panel-stats">
                    <span>📚 词条: <strong>${dictionary ? dictionary.metadata.total_entries.toLocaleString() : '加载中...'}</strong></span>
                    <span>✅ 已翻: <strong id="poe-translated-count">0</strong></span>
                </div>

                <div class="poe-panel-tip">
                    💡 性能优化：默认手动翻译，点击上方按钮开始
                </div>
            </div>
        `;

        this.addStyles();
        document.body.appendChild(this.panel);
        this.createToggleButton();
        this.bindEvents();
    }

    addStyles() {
        const styles = `
            #poe-translator-panel {
                position: fixed;
                top: 100px;
                right: 20px;
                width: 280px;
                background: white;
                border-radius: 16px;
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                font-size: 14px;
                z-index: 2147483647;
                overflow: hidden;
                transition: all 0.3s ease;
                transform: translateX(320px);
                opacity: 0;
            }

            #poe-translator-panel.visible {
                transform: translateX(0);
                opacity: 1;
            }

            .poe-panel-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 16px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: move;
                user-select: none;
            }

            .poe-panel-title {
                font-weight: 700;
                font-size: 16px;
            }

            .poe-panel-close {
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 50%;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .poe-panel-close:hover {
                background: rgba(255,255,255,0.3);
            }

            .poe-panel-content {
                padding: 20px;
            }

            .poe-panel-section {
                margin-bottom: 20px;
            }

            .poe-panel-label {
                font-size: 12px;
                color: #666;
                margin-bottom: 10px;
                font-weight: 600;
            }

            .poe-panel-buttons {
                display: flex;
                gap: 8px;
            }

            .poe-lang-btn {
                flex: 1;
                padding: 12px 8px;
                border: 2px solid #e8e8e8;
                background: white;
                border-radius: 10px;
                cursor: pointer;
                font-size: 13px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
            }

            .poe-lang-btn.active {
                border-color: #667eea;
                background: #667eea;
                color: white;
            }

            .poe-lang-icon {
                font-size: 24px;
            }

            .poe-mode-btn, .poe-sctc-btn {
                flex: 1;
                padding: 10px 8px;
                border: 2px solid #e8e8e8;
                background: white;
                border-radius: 8px;
                cursor: pointer;
                font-size: 12px;
            }

            .poe-mode-btn.active, .poe-sctc-btn.active {
                border-color: #667eea;
                background: #667eea;
                color: white;
            }

            .poe-action-btn {
                width: 100%;
                padding: 14px;
                margin-bottom: 10px;
                border: none;
                border-radius: 10px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }

            .poe-action-btn.primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }

            .poe-action-btn.primary:hover {
                transform: translateY(-2px);
            }

            .poe-action-btn.disabled {
                background: #ff6b6b;
                color: white;
            }

            .poe-action-btn:not(.primary):not(.disabled) {
                background: #f0f0f0;
                color: #333;
            }

            .poe-panel-stats {
                display: flex;
                justify-content: space-between;
                padding: 14px;
                background: #f8f9ff;
                border-radius: 10px;
                font-size: 13px;
                color: #666;
            }

            .poe-panel-stats strong {
                color: #667eea;
            }

            .poe-panel-tip {
                text-align: center;
                font-size: 11px;
                color: #999;
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid #f0f0f0;
            }

            #poe-translator-toggle {
                position: fixed;
                top: 100px;
                right: 20px;
                width: 52px;
                height: 52px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 50%;
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
                cursor: pointer;
                z-index: 2147483646;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 26px;
                border: none;
            }

            #poe-translator-toggle:hover {
                transform: scale(1.15);
            }

            #poe-translator-toggle.panel-open {
                transform: rotate(180deg);
            }
        `;

        const styleElement = document.createElement('style');
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }

    createToggleButton() {
        this.toggleBtn = document.createElement('button');
        this.toggleBtn.id = 'poe-translator-toggle';
        this.toggleBtn.innerHTML = '🌐';
        this.toggleBtn.title = 'POE翻译助手';
        document.body.appendChild(this.toggleBtn);

        this.toggleBtn.addEventListener('click', () => {
            this.togglePanel();
        });
    }

    togglePanel() {
        this.isVisible = !this.isVisible;
        this.panel.classList.toggle('visible', this.isVisible);
        this.toggleBtn.classList.toggle('panel-open', this.isVisible);
    }

    bindEvents() {
        document.getElementById('poe-panel-close').addEventListener('click', () => {
            this.togglePanel();
        });

        document.querySelectorAll('.poe-lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setLocale(btn.dataset.locale);
            });
        });

        document.querySelectorAll('.poe-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setMode(btn.dataset.mode);
            });
        });

        document.querySelectorAll('.poe-sctc-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setScTcMode(btn.dataset.sctc);
            });
        });

        document.getElementById('poe-retranslate-btn').addEventListener('click', () => {
            this.retranslate();
        });

        document.getElementById('poe-toggle-btn').addEventListener('click', () => {
            this.toggleEnabled();
        });

        // 拖拽
        const header = this.panel.querySelector('.poe-panel-header');
        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName !== 'BUTTON') {
                this.isDragging = true;
                this.dragOffset = {
                    x: e.clientX - this.panel.offsetLeft,
                    y: e.clientY - this.panel.offsetTop
                };
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.panel.style.left = (e.clientX - this.dragOffset.x) + 'px';
                this.panel.style.top = (e.clientY - this.dragOffset.y) + 'px';
                this.panel.style.right = 'auto';
            }
        });

        document.addEventListener('mouseup', () => {
            this.isDragging = false;
        });
    }

    setLocale(locale) {
        settings.locale = locale;
        this.saveSettings();
        document.querySelectorAll('.poe-lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.locale === locale);
        });
        if (translator) translator.settings = settings;
    }

    setMode(mode) {
        settings.translationMode = mode;
        this.saveSettings();
        document.querySelectorAll('.poe-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        if (translator) translator.settings = settings;
    }

    setScTcMode(sctc) {
        settings.scTcMode = sctc;
        this.saveSettings();
        document.querySelectorAll('.poe-sctc-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sctc === sctc);
        });
        if (translator) translator.settings = settings;
    }

    toggleEnabled() {
        settings.enabled = !settings.enabled;
        this.saveSettings();
        const btn = document.getElementById('poe-toggle-btn');
        btn.innerHTML = settings.enabled ? '⏸️ 暂停' : '▶️ 启用';
        btn.classList.toggle('disabled', !settings.enabled);
        if (translator) translator.settings = settings;
    }

    retranslate() {
        if (!translator) return;
        
        const btn = document.getElementById('poe-retranslate-btn');
        btn.innerHTML = '⏳ 翻译中...';
        btn.disabled = true;

        setTimeout(() => {
            // 清除标记
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
            let node;
            while ((node = walker.nextNode())) {
                delete node._poeTranslated;
            }

            translator.translatedCount = 0;
            const result = translator.translatePage();
            
            this.updateStats();
            
            btn.innerHTML = `✅ 完成 (${result.translated}个)`;
            setTimeout(() => {
                btn.innerHTML = '🔄 翻译当前页面';
                btn.disabled = false;
            }, 1500);
        }, 50);
    }

    updateStats() {
        const countEl = document.getElementById('poe-translated-count');
        if (countEl && translator) {
            countEl.textContent = translator.translatedCount;
        }
    }

    saveSettings() {
        GM_setValue('poeTranslatorSettings', settings);
    }

    loadSettings() {
        const savedSettings = GM_getValue('poeTranslatorSettings', null);
        if (savedSettings) {
            settings = { ...settings, ...savedSettings };
        }
    }
}

// 全局实例
let translator = null;
let poePanel = null;

// 加载词典
function loadDictionary() {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url: CONFIG.DICTIONARY_URL,
            onload: function(response) {
                try {
                    dictionary = JSON.parse(response.responseText);
                    console.log(`POE翻译：词典加载完成 (${dictionary.metadata.total_entries} 词条)`);
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
                    console.log(`POE翻译：转换表加载完成 (${scTcConversion.metadata.total_pairs} 对照)`);
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

// 初始化
async function initialize() {
    try {
        const savedSettings = GM_getValue('poeTranslatorSettings', null);
        if (savedSettings) {
            settings = { ...settings, ...savedSettings };
        }

        await loadDictionary();
        await loadScTcConversion();

        if (dictionary) {
            const scTcConverter = scTcConversion ? new SC_TCConverter(scTcConversion) : null;
            translator = new POETranslator(dictionary, settings, scTcConverter);
            
            poePanel = new POETranslatorPanel();

            // 自动翻译（仅在启用时）
            if (CONFIG.AUTO_TRANSLATE && settings.enabled) {
                setTimeout(() => {
                    translator.translatePage();
                }, 1000);
            }

            // 注册菜单
            GM_registerMenuCommand('🔄 翻译当前页面', () => {
                if (poePanel) poePanel.retranslate();
            });

            GM_registerMenuCommand('⚙️ 打开翻译面板', () => {
                if (poePanel) poePanel.togglePanel();
            });

            console.log('POE翻译：初始化完成');
        }
    } catch (error) {
        console.error('POE翻译：初始化失败', error);
    }
}

// 页面加载完成后初始化
if (document.readyState === 'complete') {
    initialize();
} else {
    window.addEventListener('load', initialize);
}
