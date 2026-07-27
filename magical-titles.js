// Magical Titles - AI-powered title generation using vision APIs
// Analyzes app screenshots and generates marketing headlines + subheadlines

// Track if the tooltip has been shown this session
let magicalTitlesTooltipShown = false;

/**
 * Show a tooltip suggesting the Magical Titles feature
 * Called when user adds their first screenshot(s) to a project
 */
function showMagicalTitlesTooltip() {
    // Don't show if already shown this session or dismissed before
    if (magicalTitlesTooltipShown) return;
    if (localStorage.getItem('magicalTitlesTooltipDismissed')) return;

    // Don't show if no API key is configured
    const provider = getSelectedProvider();
    const providerConfig = llmProviders[provider];
    const apiKey = localStorage.getItem(providerConfig.storageKey);
    if (!apiKey) return;

    magicalTitlesTooltipShown = true;

    const btn = document.getElementById('magical-titles-btn');
    if (!btn) return;

    // Make button position relative for tooltip positioning
    btn.style.position = 'relative';

    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'feature-tooltip';
    tooltip.id = 'magical-titles-tooltip';
    tooltip.innerHTML = `
        <button class="feature-tooltip-close" onclick="dismissMagicalTitlesTooltip()">×</button>
        ✨ Try AI-generated titles!
    `;

    btn.appendChild(tooltip);

    // Auto-hide after 8 seconds
    setTimeout(() => {
        dismissMagicalTitlesTooltip();
    }, 8000);
}

/**
 * Dismiss the Magical Titles tooltip
 */
function dismissMagicalTitlesTooltip() {
    const tooltip = document.getElementById('magical-titles-tooltip');
    if (tooltip) {
        tooltip.remove();
    }
    localStorage.setItem('magicalTitlesTooltipDismissed', 'true');
}

/**
 * Get the data URL for a screenshot image in a specific language
 * @param {Object} screenshot - Screenshot object from state
 * @param {string} lang - Language code to get image for
 * @returns {string|null} - Data URL or null if not found
 */
function getScreenshotDataUrl(screenshot, lang) {
    // Try specified language first
    const localized = screenshot.localizedImages?.[lang];
    if (localized?.src) return localized.src;

    // Fallback to first available language
    for (const l of state.projectLanguages) {
        if (screenshot.localizedImages?.[l]?.src) {
            return screenshot.localizedImages[l].src;
        }
    }

    return null;
}

/**
 * Parse a data URL into its components
 * @param {string} dataUrl - Data URL string
 * @returns {Object} - { mimeType, base64 }
 */
function parseDataUrl(dataUrl) {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return {
        mimeType: match[1],
        base64: match[2]
    };
}

function getCompactScreenStateForAI(screenshot, index, lang) {
    const ss = screenshot.screenshot || {};
    const bg = screenshot.background || {};
    const txt = screenshot.text || {};
    return {
        index,
        deviceType: screenshot.deviceType || null,
        headline: txt.headlines?.[lang] || '',
        subheadline: txt.subheadlines?.[lang] || '',
        screenshot: {
            scale: ss.scale,
            x: ss.x,
            y: ss.y,
            use3D: !!ss.use3D,
            device3D: ss.device3D || 'iphone',
            rotation3D: ss.rotation3D || { x: 0, y: 0, z: 0 },
            frameColor: ss.frameColor || null,
            showStatusBar: ss.showStatusBar !== false,
            showCameraNotch: ss.showCameraNotch !== false
        },
        background: {
            type: bg.type || 'gradient',
            solid: bg.solid || null,
            gradient: bg.gradient ? {
                angle: bg.gradient.angle,
                stops: bg.gradient.stops
            } : null
        }
    };
}

function getFrameColorOptionsForDevice(device3D) {
    const presets = (typeof frameColorPresets !== 'undefined' && frameColorPresets[device3D]) ? frameColorPresets[device3D] : null;
    if (!presets || !Array.isArray(presets) || presets.length === 0) {
        return [{ id: 'black', name: 'Black' }];
    }
    return presets.map(p => ({ id: p.id, name: p.name || p.id }));
}

function populateMagicalTitlesFrameColorSelect(device3D, selectedColor) {
    const frameColorSelect = document.getElementById('magical-titles-frame-color');
    if (!frameColorSelect) return;
    const options = getFrameColorOptionsForDevice(device3D);
    frameColorSelect.innerHTML = options.map(opt => `<option value="${opt.id}">${opt.name}</option>`).join('');
    const hasSelected = options.some(opt => opt.id === selectedColor);
    frameColorSelect.value = hasSelected ? selectedColor : options[0].id;
}

function toggleMagicalTitles3DOptions() {
    const modeEl = document.getElementById('magical-titles-render-mode');
    const wrapEl = document.getElementById('magical-titles-3d-options');
    if (!modeEl || !wrapEl) return;
    wrapEl.style.display = modeEl.value === '3d' ? 'block' : 'none';
}

function applyPositionPresetToScreenshot(screenshot, preset) {
    const presets = {
        'centered': { scale: 70, x: 50, y: 50 },
        'bleed-bottom': { scale: 85, x: 50, y: 120 },
        'bleed-top': { scale: 85, x: 50, y: -20 },
        'float-center': { scale: 60, x: 50, y: 50 },
        'tilt-left': { scale: 65, x: 50, y: 60 },
        'tilt-right': { scale: 65, x: 50, y: 60 },
        'perspective': { scale: 65, x: 50, y: 50 },
        'float-bottom': { scale: 55, x: 50, y: 70 }
    };
    const p = presets[preset];
    if (!p || !screenshot?.screenshot) return;
    screenshot.screenshot.scale = p.scale;
    screenshot.screenshot.x = p.x;
    screenshot.screenshot.y = p.y;
}

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function normalizeAIPopout(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const cropX = Number(raw.cropX);
    const cropY = Number(raw.cropY);
    const cropWidth = Number(raw.cropWidth);
    const cropHeight = Number(raw.cropHeight);
    const x = Number(raw.x);
    const y = Number(raw.y);
    const width = Number(raw.width);
    if ([cropX, cropY, cropWidth, cropHeight, x, y, width].some(v => !Number.isFinite(v))) return null;

    return {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `popout-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        cropX: clamp(cropX, 0, 100),
        cropY: clamp(cropY, 0, 100),
        cropWidth: clamp(cropWidth, 5, 100),
        cropHeight: clamp(cropHeight, 5, 100),
        x: clamp(x, 0, 100),
        y: clamp(y, 0, 100),
        width: clamp(width, 5, 100),
        rotation: Number.isFinite(Number(raw.rotation)) ? clamp(Number(raw.rotation), -45, 45) : 0,
        opacity: Number.isFinite(Number(raw.opacity)) ? clamp(Number(raw.opacity), 10, 100) : 100,
        cornerRadius: Number.isFinite(Number(raw.cornerRadius)) ? clamp(Number(raw.cornerRadius), 0, 80) : 12,
        shadow: {
            enabled: raw.shadow?.enabled !== false,
            color: typeof raw.shadow?.color === 'string' ? raw.shadow.color : '#000000',
            blur: Number.isFinite(Number(raw.shadow?.blur)) ? clamp(Number(raw.shadow.blur), 0, 120) : 30,
            opacity: Number.isFinite(Number(raw.shadow?.opacity)) ? clamp(Number(raw.shadow.opacity), 0, 100) : 40,
            x: Number.isFinite(Number(raw.shadow?.x)) ? clamp(Number(raw.shadow.x), -100, 100) : 0,
            y: Number.isFinite(Number(raw.shadow?.y)) ? clamp(Number(raw.shadow.y), -100, 100) : 15
        },
        border: {
            enabled: raw.border?.enabled !== false,
            color: typeof raw.border?.color === 'string' ? raw.border.color : '#ffffff',
            width: Number.isFinite(Number(raw.border?.width)) ? clamp(Number(raw.border.width), 0, 20) : 3,
            opacity: Number.isFinite(Number(raw.border?.opacity)) ? clamp(Number(raw.border.opacity), 0, 100) : 100
        }
    };
}

function normalizeAIPatchesShape(raw) {
    if (!raw || typeof raw !== 'object') return {};
    if (raw.screens && typeof raw.screens === 'object') return raw.screens;
    if (raw.screenshots && typeof raw.screenshots === 'object') return raw.screenshots;
    if (Array.isArray(raw)) {
        const out = {};
        raw.forEach((item, i) => { out[String(i)] = item; });
        return out;
    }
    return raw;
}

function enforceCampaignCoherence(patches, screenCount) {
    const out = { ...patches };
    const rotated = [];
    const popoutScreens = [];

    for (let i = 0; i < screenCount; i++) {
        const p = out[String(i)];
        if (!p || typeof p !== 'object') continue;

        if (p.screenshot?.rotation3D && typeof p.screenshot.rotation3D === 'object') {
            const r = p.screenshot.rotation3D;
            const rx = Number(r.x) || 0;
            const ry = Number(r.y) || 0;
            const rz = Number(r.z) || 0;
            const mag = Math.abs(rx) + Math.abs(ry) + Math.abs(rz);
            if (mag > 0.5) rotated.push(i);
        }

        const hasPopouts = (Array.isArray(p.popouts) && p.popouts.length > 0) || (p.popout && typeof p.popout === 'object');
        if (hasPopouts) popoutScreens.push(i);
    }

    // Limit popout usage to keep visuals clean.
    if (popoutScreens.length > 2) {
        for (let k = 2; k < popoutScreens.length; k++) {
            const idx = popoutScreens[k];
            if (out[String(idx)]) {
                delete out[String(idx)].popouts;
                delete out[String(idx)].popout;
            }
        }
    }

    // Prevent over-rotation noise: keep at most half the screens rotated.
    const maxRotated = Math.max(1, Math.floor(screenCount / 2));
    if (rotated.length > maxRotated) {
        for (let k = maxRotated; k < rotated.length; k++) {
            const idx = rotated[k];
            const ssp = out[String(idx)]?.screenshot;
            if (ssp) ssp.rotation3D = { x: 0, y: 0, z: 0 };
        }
    }

    return out;
}

function setLayoutValueForLang(text, lang, key, value) {
    if (!text) return;
    if (!text.perLanguageLayout) {
        text[key] = value;
        return;
    }
    if (!text.languageSettings) text.languageSettings = {};
    if (!text.languageSettings[lang]) {
        text.languageSettings[lang] = {
            headlineSize: text.headlineSize || 100,
            subheadlineSize: text.subheadlineSize || 50,
            position: text.position || 'top',
            offsetY: typeof text.offsetY === 'number' ? text.offsetY : 12,
            lineHeight: text.lineHeight || 110
        };
    }
    text.languageSettings[lang][key] = value;
    text.currentLayoutLang = lang;
}

function applyMarketingAutoLayout(screenshot, index, total, sourceLang, renderMode) {
    if (!screenshot?.screenshot || !screenshot?.text) return;
    const ss = screenshot.screenshot;
    const txt = screenshot.text;
    const lang = sourceLang || txt.currentHeadlineLang || 'en';

    // Ensure text tracks screenshot horizontal position.
    txt.alignToScreenshot = true;

    // Strategy: hero + support layout with intentional whitespace.
    const isHero = index === 0;
    const useTopText = isHero || (index % 2 === 0);
    const targetPos = useTopText ? 'top' : 'bottom';
    const targetOffset = useTopText ? 8 : 10;
    setLayoutValueForLang(txt, lang, 'position', targetPos);
    setLayoutValueForLang(txt, lang, 'offsetY', targetOffset);

    // Move phone away from text block to reduce collisions.
    if (targetPos === 'top') {
        if (typeof ss.y === 'number' && ss.y < 56) ss.y = 62;
    } else {
        if (typeof ss.y === 'number' && ss.y > 46) ss.y = 40;
    }

    // Keep support screens slightly smaller for better text breathing room.
    if (!isHero && typeof ss.scale === 'number') {
        ss.scale = Math.min(ss.scale, 78);
    }

    // Keep hero mostly straight; allow modest variation on support screens in 3D.
    if (renderMode === '3d') {
        if (!ss.rotation3D || typeof ss.rotation3D !== 'object') ss.rotation3D = { x: 0, y: 0, z: 0 };
        if (isHero) {
            ss.rotation3D = { x: 0, y: 0, z: 0 };
        } else {
            const turns = [10, -10, 16, -16];
            if ((Math.abs(ss.rotation3D.x || 0) + Math.abs(ss.rotation3D.y || 0) + Math.abs(ss.rotation3D.z || 0)) < 0.5) {
                ss.rotation3D = { x: -2, y: turns[(index - 1) % turns.length], z: 0 };
            }
        }
    }
}

function ensureAtLeastOnePopout(screenshots, sourceLang) {
    const hasAnyPopout = screenshots.some(s => Array.isArray(s?.popouts) && s.popouts.length > 0);
    if (hasAnyPopout) return;
    if (!Array.isArray(screenshots) || screenshots.length < 2) return;

    // Add one clean support popout to screen 2 (or last if only two screens).
    const targetIndex = Math.min(1, screenshots.length - 1);
    const target = screenshots[targetIndex];
    if (!target) return;

    target.popouts = [{
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `popout-${Date.now()}`,
        cropX: 62,
        cropY: 24,
        cropWidth: 26,
        cropHeight: 26,
        x: 78,
        y: 34,
        width: 28,
        rotation: 8,
        opacity: 100,
        cornerRadius: 12,
        shadow: { enabled: true, color: '#000000', blur: 30, opacity: 40, x: 0, y: 15 },
        border: { enabled: true, color: '#ffffff', width: 3, opacity: 100 }
    }];
}

/**
 * Generate titles using Anthropic Claude vision API
 * @param {string} apiKey - Anthropic API key
 * @param {Array} images - Array of { mimeType, base64 } objects
 * @param {string} prompt - Text prompt
 * @returns {Promise<string>} - Response text
 */
async function generateTitlesWithAnthropic(apiKey, images, prompt) {
    const model = getSelectedModel('anthropic');

    // Build content array with images first, then text
    const content = [];

    for (const img of images) {
        content.push({
            type: "image",
            source: {
                type: "base64",
                media_type: img.mimeType,
                data: img.base64
            }
        });
    }

    content.push({ type: "text", text: prompt });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 4096,
            messages: [{ role: "user", content: content }]
        })
    });

    if (!response.ok) {
        const status = response.status;
        const errorBody = await response.json().catch(() => ({}));
        console.error('Anthropic Vision API Error:', { status, model, error: errorBody });
        if (status === 401 || status === 403) throw new Error('AI_UNAVAILABLE');
        throw new Error(`API request failed: ${status} - ${errorBody.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.content[0].text;
}

/**
 * Generate titles using OpenAI GPT vision API
 * @param {string} apiKey - OpenAI API key
 * @param {Array} images - Array of { mimeType, base64 } objects
 * @param {string} prompt - Text prompt
 * @returns {Promise<string>} - Response text
 */
async function generateTitlesWithOpenAI(apiKey, images, prompt) {
    const model = getSelectedModel('openai');

    // Build content array with images and text
    const content = [];

    for (const img of images) {
        content.push({
            type: "image_url",
            image_url: {
                url: `data:${img.mimeType};base64,${img.base64}`
            }
        });
    }

    content.push({ type: "text", text: prompt });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            max_completion_tokens: 4096,
            messages: [{ role: "user", content: content }]
        })
    });

    if (!response.ok) {
        const status = response.status;
        const errorBody = await response.json().catch(() => ({}));
        console.error('OpenAI Vision API Error:', { status, model, error: errorBody });
        if (status === 401 || status === 403) throw new Error('AI_UNAVAILABLE');
        throw new Error(`API request failed: ${status} - ${errorBody.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

/**
 * Generate titles using Google Gemini vision API
 * @param {string} apiKey - Google API key
 * @param {Array} images - Array of { mimeType, base64 } objects
 * @param {string} prompt - Text prompt
 * @returns {Promise<string>} - Response text
 */
async function generateTitlesWithGoogle(apiKey, images, prompt) {
    const model = getSelectedModel('google');

    // Build parts array with images and text
    const parts = [];

    for (const img of images) {
        parts.push({
            inlineData: {
                mimeType: img.mimeType,
                data: img.base64
            }
        });
    }

    parts.push({ text: prompt });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            contents: [{ parts: parts }]
        })
    });

    if (!response.ok) {
        const status = response.status;
        const errorBody = await response.json().catch(() => ({}));
        console.error('Google Vision API Error:', { status, model, error: errorBody });
        if (status === 401 || status === 403 || status === 400) throw new Error('AI_UNAVAILABLE');
        throw new Error(`API request failed: ${status} - ${errorBody.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

/**
 * Show the magical titles confirmation dialog
 */
function showMagicalTitlesDialog() {
    // Validate screenshots exist
    if (!state.screenshots || state.screenshots.length === 0) {
        showAppAlert('Please add some screenshots first.', 'info');
        return;
    }

    // Get provider and API key
    const provider = getSelectedProvider();
    const providerConfig = llmProviders[provider];
    const apiKey = localStorage.getItem(providerConfig.storageKey);

    if (!apiKey) {
        showAppAlert('Please configure your AI API key in Settings first.', 'error');
        return;
    }

    // Update modal info
    document.getElementById('magical-titles-count').textContent = state.screenshots.length;
    document.getElementById('magical-titles-provider').textContent = providerConfig.name;

    // Populate language dropdown
    const langSelect = document.getElementById('magical-titles-language');
    langSelect.innerHTML = state.projectLanguages.map(lang => {
        const langName = languageNames[lang] || lang;
        return `<option value="${lang}">${langName}</option>`;
    }).join('');

    // Restore previous creative prompt for convenience
    const creativePromptEl = document.getElementById('magical-titles-prompt');
    if (creativePromptEl) {
        creativePromptEl.value = localStorage.getItem('magicalTitlesCreativePrompt') || '';
    }

    // Restore global style controls from current screenshot/defaults
    const currentSS = state.screenshots[state.currentScreenshotIndex]?.screenshot
        || state.screenshots[0]?.screenshot
        || state.defaults?.screenshot
        || {};
    const use3D = !!currentSS.use3D;
    const device3D = currentSS.device3D || 'iphone';
    const frameColor = currentSS.frameColor || 'black';
    const modeEl = document.getElementById('magical-titles-render-mode');
    const deviceEl = document.getElementById('magical-titles-device-3d');
    if (modeEl) modeEl.value = use3D ? '3d' : '2d';
    if (deviceEl) deviceEl.value = device3D;
    populateMagicalTitlesFrameColorSelect(device3D, frameColor);
    toggleMagicalTitles3DOptions();

    // Show modal
    document.getElementById('magical-titles-modal').classList.add('visible');
}

/**
 * Hide the magical titles confirmation dialog
 */
function hideMagicalTitlesDialog() {
    document.getElementById('magical-titles-modal').classList.remove('visible');
}

/**
 * Main function to generate magical titles for all screenshots
 */
async function generateMagicalTitles() {
    // Hide the confirmation dialog
    hideMagicalTitlesDialog();

    // Get provider and API key
    const provider = getSelectedProvider();
    const providerConfig = llmProviders[provider];
    const apiKey = localStorage.getItem(providerConfig.storageKey);

    // Get selected language from dropdown
    const langSelect = document.getElementById('magical-titles-language');
    const sourceLang = langSelect.value || state.projectLanguages[0] || 'en';
    const langName = languageNames[sourceLang] || 'English';
    const creativePrompt = (document.getElementById('magical-titles-prompt')?.value || '').trim();
    const renderMode = document.getElementById('magical-titles-render-mode')?.value === '3d' ? '3d' : '2d';
    const globalDevice3D = document.getElementById('magical-titles-device-3d')?.value === 'samsung' ? 'samsung' : 'iphone';
    const globalFrameColor = document.getElementById('magical-titles-frame-color')?.value || 'black';
    const globalStyleLine = renderMode === '3d'
        ? `GLOBAL STYLE LOCK (applies to ALL screenshots): 3D mode, device3D="${globalDevice3D}", frameColor="${globalFrameColor}".`
        : 'GLOBAL STYLE LOCK (applies to ALL screenshots): 2D mode (use3D=false).';
    localStorage.setItem('magicalTitlesCreativePrompt', creativePrompt);

    // Collect images from all screenshots
    const images = [];
    for (const screenshot of state.screenshots) {
        const dataUrl = getScreenshotDataUrl(screenshot, sourceLang);
        if (dataUrl) {
            const parsed = parseDataUrl(dataUrl);
            if (parsed) {
                images.push(parsed);
            }
        }
    }

    if (images.length === 0) {
        await showAppAlert('No screenshot images found. Please upload some screenshots first.', 'error');
        return;
    }

    const compactScreens = state.screenshots.map((s, i) => getCompactScreenStateForAI(s, i, sourceLang));

    // Build prompt (patch-only to minimize tokens and preserve current project styling)
    const creativePromptSection = creativePrompt
        ? `\nCREATIVE DIRECTION FROM USER:\n${creativePrompt}\n`
        : '\nCREATIVE DIRECTION FROM USER: none provided. Infer best campaign direction from screenshot content.\n';

    const prompt = `You are an expert App Store marketing copywriter. Analyze these ${images.length} app screenshots and create compelling marketing titles.

The screenshots are shown in order (1 through ${images.length}). Study what the app does and identify:
1. The main purpose and value proposition
2. The user problem it solves
3. Key features visible in each screen
4. Which sell point (if any) best fits each screenshot

CRITICAL: Screenshot 1's headline MUST focus on the main value proposition - what problem does this app solve for users? This is the most important title.
${creativePromptSection}
MAPPING REQUIREMENTS:
- Match each screenshot's copy to what is actually visible in that screenshot.
${globalStyleLine}

CAMPAIGN COHERENCE (HIGHEST PRIORITY):
- First decide a single coherent visual strategy for the full set, then apply it consistently.
- Do not maximize effects; use restraint.
- It is valid to keep most screens clean/flat if that produces a stronger campaign.
- Only rotate or add popouts when they clearly improve hierarchy, focus, or storytelling.
- Avoid noisy compositions or gimmicks.

3D COMPOSITION REQUIREMENTS (when global style is 3D):
- Optimize the full set like one coherent campaign (hero + support screens).
- Use rotation3D only where it improves visual impact; keep some screens straight if that reads better.
- Flat/no-tilt screens are valid when they are the best design choice.
- Vary composition across the set (not identical poses), but prioritize coherence and readability.
- Preferred ranges when rotating: rotation3D.x -12..12, rotation3D.y -30..30, rotation3D.z -6..6.

LENGTH REQUIREMENTS - THIS IS VERY IMPORTANT:
- headline: VERY SHORT, maximum 2-4 words. Punchy, memorable, benefit-focused.
- subheadline: SHORT, maximum 4-8 words. Expands on the headline.

UNIQUENESS - VERY IMPORTANT:
- Each screenshot MUST have a UNIQUE headline and subheadline
- Do NOT repeat or reuse similar titles across screenshots
- Each title should highlight a DIFFERENT feature or benefit

IMPORTANT: Return only CHANGES (PATCH), not full screen data. Keep token usage low.
Allowed keys per screen patch:
- "headline" (string)
- "subheadline" (string)
- "positionPreset" ("centered"|"bleed-bottom"|"bleed-top"|"float-center"|"tilt-left"|"tilt-right"|"perspective"|"float-bottom")
- "screenshot" with optional keys: scale, x, y, rotation3D{x,y,z}, showStatusBar, showCameraNotch
- "background" with optional keys: type, solid, gradient{angle,stops}
- "popouts" (optional array, usually 0-2 items) where each item can include:
  cropX,cropY,cropWidth,cropHeight,x,y,width,rotation,opacity,cornerRadius,
  shadow{enabled,color,blur,opacity,x,y}, border{enabled,color,width,opacity}
- Also accepted: "popout" (single object), which will be converted to a one-item array.

CONSERVATIVE RULES:
- Default: no popout unless there is a clear visual reason.
- Prefer at most 1 popout on a minority of screens.
- Avoid strong tilt on text-heavy screens.

CURRENT PROJECT SNAPSHOT (compact JSON):
${JSON.stringify(compactScreens)}

Examples of good headlines: "Track Every Expense", "Sleep Better Tonight", "Never Forget Again"
Examples of good subheadlines: "Automatic expense categorization and insights", "Science-backed sleep improvement", "Smart reminders that actually work"

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
    "0": { "headline": "...", "subheadline": "...", "positionPreset": "centered", "screenshot": {"scale": 72, "rotation3D":{"x":-4,"y":18,"z":0}} },
    "1": { "headline": "...", "subheadline": "...", "popouts": [ { "cropX": 60, "cropY": 25, "cropWidth": 26, "cropHeight": 26, "x": 78, "y": 36, "width": 28, "rotation": 8 } ] }
}

Where the keys are 0-indexed screenshot numbers.
Only include screens that need changes.
Write all titles in ${langName}.`;

    // Create progress overlay
    const progressOverlay = document.createElement('div');
    progressOverlay.id = 'magical-titles-progress';
    progressOverlay.innerHTML = `
        <div class="modal-overlay visible">
            <div class="modal">
                <div class="modal-icon" style="background: linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 140, 0, 0.2) 100%);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #ffa500; animation: spin 2s linear infinite;">
                        <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 21l2.3-7-6-4.6h7.6z"/>
                    </svg>
                </div>
                <h3 class="modal-title">Generating Magical Titles...</h3>
                <p id="magical-titles-status" style="color: var(--text-secondary); margin-top: 8px;">Analyzing ${images.length} screenshots with AI...</p>
                <p id="magical-titles-detail" style="color: var(--text-tertiary); font-size: 12px; margin-top: 4px;">Using ${providerConfig.name}</p>
            </div>
        </div>
    `;
    document.body.appendChild(progressOverlay);

    const updateStatus = (text, detail = '') => {
        const statusEl = document.getElementById('magical-titles-status');
        const detailEl = document.getElementById('magical-titles-detail');
        if (statusEl) statusEl.textContent = text;
        if (detailEl) detailEl.textContent = detail;
    };

    try {
        // Call provider-specific API
        let responseText;

        updateStatus('Sending screenshots to AI...', `${images.length} images to analyze`);

        if (provider === 'anthropic') {
            responseText = await generateTitlesWithAnthropic(apiKey, images, prompt);
        } else if (provider === 'openai') {
            responseText = await generateTitlesWithOpenAI(apiKey, images, prompt);
        } else if (provider === 'google') {
            responseText = await generateTitlesWithGoogle(apiKey, images, prompt);
        } else {
            throw new Error(`Unknown provider: ${provider}`);
        }

        updateStatus('Processing response...', 'Parsing generated titles');

        // Clean up response - remove markdown code blocks if present
        responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        // Extract JSON object from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            responseText = jsonMatch[0];
        }

        console.log('Magical Titles response:', responseText);

        // Parse JSON and normalize possible wrapper shapes
        let titles = normalizeAIPatchesShape(JSON.parse(responseText));
        titles = enforceCampaignCoherence(titles, state.screenshots.length);

        updateStatus('Applying titles...', 'Updating screenshots');

        // Apply global campaign style lock to all screenshots
        for (let i = 0; i < state.screenshots.length; i++) {
            const screenshot = state.screenshots[i];
            if (!screenshot) continue;
            if (!screenshot.screenshot) screenshot.screenshot = {};
            screenshot.screenshot.use3D = renderMode === '3d';
            if (renderMode === '3d') {
                screenshot.screenshot.device3D = globalDevice3D;
                screenshot.screenshot.frameColor = globalFrameColor;
                if (!screenshot.screenshot.rotation3D) screenshot.screenshot.rotation3D = { x: 0, y: 0, z: 0 };
            }
        }

        // Apply patch to screenshots
        const allowedPresets = new Set(['centered', 'bleed-bottom', 'bleed-top', 'float-center', 'tilt-left', 'tilt-right', 'perspective', 'float-bottom']);
        for (let i = 0; i < state.screenshots.length; i++) {
            const patch = titles[String(i)];
            if (!patch) continue;
            const screenshot = state.screenshots[i];
            if (!screenshot) continue;

            if (!screenshot.text) screenshot.text = { headlines: {}, subheadlines: {} };
            if (!screenshot.text.headlines) screenshot.text.headlines = {};
            if (!screenshot.text.subheadlines) screenshot.text.subheadlines = {};
            screenshot.text.alignToScreenshot = true;
            if (!screenshot.screenshot) screenshot.screenshot = {};
            if (!screenshot.background) screenshot.background = {};

            if (typeof patch.headline === 'string' && patch.headline.trim()) {
                screenshot.text.headlines[sourceLang] = patch.headline.trim();
                screenshot.text.headlineEnabled = true;
            }
            if (typeof patch.subheadline === 'string' && patch.subheadline.trim()) {
                screenshot.text.subheadlines[sourceLang] = patch.subheadline.trim();
                screenshot.text.subheadlineEnabled = true;
            }

            if (typeof patch.positionPreset === 'string' && allowedPresets.has(patch.positionPreset)) {
                applyPositionPresetToScreenshot(screenshot, patch.positionPreset);
            }

            const ssp = patch.screenshot;
            if (ssp && typeof ssp === 'object') {
                const keys = ['scale', 'x', 'y', 'showStatusBar', 'showCameraNotch'];
                keys.forEach(k => {
                    if (ssp[k] !== undefined) screenshot.screenshot[k] = ssp[k];
                });
                if (ssp.rotation3D && typeof ssp.rotation3D === 'object') {
                    screenshot.screenshot.rotation3D = {
                        x: ssp.rotation3D.x ?? screenshot.screenshot.rotation3D?.x ?? 0,
                        y: ssp.rotation3D.y ?? screenshot.screenshot.rotation3D?.y ?? 0,
                        z: ssp.rotation3D.z ?? screenshot.screenshot.rotation3D?.z ?? 0
                    };
                }
            }

            const bgp = patch.background;
            if (bgp && typeof bgp === 'object') {
                if (bgp.type !== undefined) screenshot.background.type = bgp.type;
                if (bgp.solid !== undefined) screenshot.background.solid = bgp.solid;
                if (bgp.gradient && typeof bgp.gradient === 'object') {
                    if (!screenshot.background.gradient) screenshot.background.gradient = {};
                    if (bgp.gradient.angle !== undefined) screenshot.background.gradient.angle = bgp.gradient.angle;
                    if (bgp.gradient.stops !== undefined) screenshot.background.gradient.stops = bgp.gradient.stops;
                }
            }

            const incomingPopouts = Array.isArray(patch.popouts)
                ? patch.popouts
                : (patch.popout && typeof patch.popout === 'object' ? [patch.popout] : null);
            if (incomingPopouts) {
                const normalized = incomingPopouts
                    .slice(0, 3)
                    .map(normalizeAIPopout)
                    .filter(Boolean);
                if (normalized.length > 0) {
                    screenshot.popouts = normalized;
                }
            }
        }

        // Deterministic cleanup pass for coherence and phone/text collision avoidance.
        for (let i = 0; i < state.screenshots.length; i++) {
            const screenshot = state.screenshots[i];
            applyMarketingAutoLayout(screenshot, i, state.screenshots.length, sourceLang, renderMode);
        }
        ensureAtLeastOnePopout(state.screenshots, sourceLang);


        // Update UI
        syncUIWithState();
        updateCanvas();
        saveState();

        // Remove progress overlay
        progressOverlay.remove();

        // Show success message
        const changedScreens = Object.keys(titles).filter(k => !Number.isNaN(Number(k)));
        await showAppAlert(`Generated titles for ${changedScreens.length} screenshots in ${langName}!`, 'success');

    } catch (error) {
        console.error('Magical Titles error:', error);
        progressOverlay.remove();

        if (error.message === 'AI_UNAVAILABLE') {
            await showAppAlert('AI service unavailable. Please check your API key in Settings.', 'error');
        } else if (error instanceof SyntaxError) {
            await showAppAlert('Failed to parse AI response. Please try again.', 'error');
        } else {
            await showAppAlert(`Error generating titles: ${error.message}`, 'error');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const modeEl = document.getElementById('magical-titles-render-mode');
    const deviceEl = document.getElementById('magical-titles-device-3d');
    if (modeEl) {
        modeEl.addEventListener('change', () => {
            toggleMagicalTitles3DOptions();
        });
    }
    if (deviceEl) {
        deviceEl.addEventListener('change', () => {
            const device3D = deviceEl.value === 'samsung' ? 'samsung' : 'iphone';
            populateMagicalTitlesFrameColorSelect(device3D, null);
        });
    }
});
