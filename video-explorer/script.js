/* Code by Sergio00166 */

const {pathname} = window.location;
const pathSegments = pathname.split("/");
if (!pathSegments.pop().includes(".")) pathSegments.push("");
const basePath = pathSegments.join("/") + "/";
let currentPath = basePath;

const cache_suffix = "?get=static";
const ioCallbacks = new Map();
const focusStack = [];

const container = document.getElementById("container");
const pathElement = document.getElementById("path-text");
const elsel_str = ".grid > button, .subfolders > button";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function resetPage() {
    window.location.hash = "";
    renderFolder(basePath);
}

function loadImage(img) {
    if (typeof img.decode === "function") return img.decode();
    return new Promise(function(res) { img.onload = res; });
}

function getJSON(path) {
    return fetch(path + "?get=json")
      .then(res => res.json())
      .catch(() => []);
}

function getText(path) {
    return fetch(path + cache_suffix)
      .then(res => res.text())
      .catch(() => "");
}

// ============================================================================
// INTERSECTION OBSERVER (lazy loading)
// ============================================================================

const globalObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
        const cb = ioCallbacks.get(entry.target);

        if (!cb) {
            globalObserver.unobserve(entry.target);
            continue;
        }
        if (entry.isIntersecting) {
            cb(entry.target);
            ioCallbacks.delete(entry.target);
            globalObserver.unobserve(entry.target);
        }
    }
}, { rootMargin: "200px" });

function attachObserver(el, callback) {
    ioCallbacks.set(el, callback);
    globalObserver.observe(el);
}

// ============================================================================
// ITEM LOADERS
// ============================================================================

async function loadFolderInfo(el, poster, description) {
    if (poster) {
        const pc = el.querySelector(".poster-container");
        const pbg = pc.querySelector(".poster-background");
        const pimg = pc.querySelector(".poster-image");

        const bimg = new Image();
        bimg.src = poster + cache_suffix;
        pimg.src = poster + cache_suffix;

        await Promise.all([loadImage(bimg), loadImage(pimg)]);
        pbg.appendChild(bimg);
        pc.classList.remove("loading");
    }
    if (description) {
        const td = el.querySelector(".desc-text");
        const t = await getText(description);
        td.innerHTML = t;
        td.classList.remove("loading");
    }
}

async function loadThumbnail(el, thumbItem) {
    el.classList.add("loading");
    if (!thumbItem) return;
    const img = new Image();
    img.src = thumbItem;
    el.appendChild(img);
    await loadImage(img);
    el.classList.remove("loading");
}

// ============================================================================
// HTML BUILDERS
// ============================================================================

function buildDescriptionHTML(photos, description) {
    const parts = ['<div class="description"'];
    if (photos)      parts.push(` data-poster="${escapeHTML(photos)}"`);
    if (description) parts.push(` data-desc="${escapeHTML(description)}"`);
    parts.push('>');
    if (photos)      parts.push('<div class="poster-container loading"><div class="poster-background"></div><img class="poster-image"></div>');
    if (description) parts.push('<div class="desc-text loading"></div>');
    parts.push('</div>');
    return parts.join('');
}

function buildGridHTML(videos, thumbsMap) {
    const parts = ['<div class="grid">'];

    for (let i = 0; i < videos.length; i++) {
        const v = videos[i];
        const thumbItem = thumbsMap.get(v.name.replace(/\.[^/.]+$/, ""));
        const thumbAttr = `data-thumb="${escapeHTML((thumbItem || '') + cache_suffix)}"`;
        parts.push(
            '<button>',
            `<div class="thumb" ${thumbAttr}></div>`,
            `<div class="title">${escapeHTML(v.name)}</div>`,
            '</button>'
        );
    }
    parts.push('</div>');
    return parts.join('');
}

function buildSubfoldersHTML(subfolders, focusBackName, infoMap) {
    const parts = ['<div class="subfolders">'];

    for (let i = 0; i < subfolders.length; i++) {
        const subfolder = subfolders[i];
        const out = infoMap.get(subfolder.name);
        parts.push(
            `<button${subfolder.name === focusBackName && ' id="focused"' || ''}>`,
            `<div class="title">${escapeHTML(subfolder.name)}</div>`,
            out && buildDescriptionHTML(out[0], out[1]) || '',
            '</button>'
        );
    }
    parts.push('</div>');
    return parts.join('');
}

// ============================================================================
// ITEM FILTERING
// ============================================================================

async function getThumbsMap(folderPath) {
    const thumbsMap = new Map();
    const parentPath = folderPath + ".thumbnails/";
    const thumbsList = await getJSON(parentPath);

    for (let i = 0; i < thumbsList.length; i++) {
        const it = thumbsList[i];
        thumbsMap.set(it.name.replace(/\.[^/.]+$/, ""), parentPath + it.name);
    }
    return thumbsMap;
}

async function getInfoMap(folderPath) {
    const folderMap = new Map();
    const parentPath = folderPath + ".info/";
    const infoItems = await getJSON(parentPath);

    for (const it of infoItems) {
        const elDirPath = it.name.split(".")[0];
        const entry = folderMap.get(elDirPath) || [null, null];

        switch (it.type) {
            case "photo":
                entry[0] = parentPath + it.name;
                break;
            case "text":
                if (it.name === `${elDirPath}.txt`)
                    entry[1] = parentPath + it.name;
                break;
        }
        folderMap.set(elDirPath, entry);
    }
    return folderMap;
}

// ============================================================================
// MAIN FILTERING
// ============================================================================

function filterFolderItems(items, path) {
    const data = {
        videos: [],
        selfDesc: "",
        selfPoster: "",
        subfolders: [],
        hasDotInfo: false,
        hasDotThumbs: false,
    };
    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        switch (item.type) {
            case "photo":
                if (!data.selfPoster && item.name.startsWith("poster."))
                    data.selfPoster = path + item.name;
                break;
            case "text":
                if (!data.selfDesc && item.name === "description.txt")
                    data.selfDesc = path + item.name;
                break;
            case "video":
                data.videos.push(item);
                break;
            case "directory":
                if (item.name === ".info")
                    data.hasDotInfo = true;
                else if (item.name === ".thumbnails")
                    data.hasDotThumbs = true;
                else
                    data.subfolders.push(item);
                break;
        }
    }
    return data;
}

// ============================================================================
// FOLDER RENDERER
// ============================================================================

async function generateHTML(folderPath, focusBackName) {
    const items = await getJSON(folderPath);
    const data = filterFolderItems(items, folderPath);
    const parts = [];

    if (data.selfPoster || data.selfDesc)
        parts.push(buildDescriptionHTML(data.selfPoster, data.selfDesc));

    if (data.videos.length) {
        let thumbsMap = new Map();
        if (data.hasDotThumbs) thumbsMap = await getThumbsMap(folderPath);
        parts.push(buildGridHTML(data.videos, thumbsMap));
    }
    if (data.subfolders.length) {
        let infoMap = new Map();
        if (data.hasDotInfo) infoMap = await getInfoMap(folderPath);
        parts.push(buildSubfoldersHTML(data.subfolders, focusBackName, infoMap));
    }   
    return parts;
}

function finalizeRenderedFolder() {
    for (const desc of container.querySelectorAll('.description')) {
        const poster   = desc.dataset.poster || null;
        const descPath = desc.dataset.desc   || null;
        attachObserver(desc, el => loadFolderInfo(el, poster, descPath));
    }
    for (const thumb of container.querySelectorAll('.grid .thumb')) {
        attachObserver(thumb, el => loadThumbnail(el, thumb.dataset.thumb || null));
    }
    const focusEl = document.getElementById("focused");
    if (focusEl) focusEl.focus();
    else container.scrollTo(0, 0);
}

async function renderFolder(folderPath, focusBackName) {
    ioCallbacks.clear();
    container.classList.remove("show");
    const parts = await generateHTML(folderPath, focusBackName);

    currentPath = folderPath;
    pathStr = decodeURIComponent(folderPath);
    pathElement.textContent = `\u200E${pathStr}\u200E`;
    window.location.hash = folderPath.slice(basePath.length, -1);

    container.innerHTML = parts.join('');
    finalizeRenderedFolder();
    container.classList.add("show");
}

// ============================================================================
// NAVIGATION & FOCUS
// ============================================================================

function handleItemAction(el) {
    const nameEl = el.querySelector(".title");
    const name = nameEl.textContent;
    const encoded = encodeURIComponent(name);
    const parent = el.parentElement;
    const path = currentPath;

    if (parent.classList.contains("subfolders")) {
        focusStack.push(name);
        renderFolder(path + encoded + "/");
    }
    if (parent.classList.contains("grid"))
        window.open(path + encoded, "_blank");
}

function goBack() {
    const path = currentPath;
    const cur = path.split("/").filter(Boolean);
    const base = basePath.split("/").filter(Boolean);

    if (cur.length <= base.length && path.indexOf(basePath) === 0) {
        const exitPath = "/" + base.slice(0, -1).join("/");
        if (exitPath === "") window.location.href = "/";
        else window.location.href = exitPath;
        return;
    }
    let parent = "/" + cur.slice(0, -1).join("/");
    if (!parent.endsWith("/")) parent += "/";

    const focusBackName = focusStack.pop() || null;
    renderFolder(parent, focusBackName);
}

function moveFocus(direction) {
    const focusable = Array.from(document.querySelectorAll(elsel_str));
    if (!focusable.length) return;
    let idx = focusable.indexOf(document.activeElement);

    switch (direction) {
        case -Infinity: idx = 0; break;
        case  Infinity: idx = focusable.length - 1; break;
        default: idx = (idx + direction + focusable.length) % focusable.length; break;
    }
    focusable[idx].focus();
}

// ============================================================================
// EVENTS
// ============================================================================

container.addEventListener("click", event => {
    const clicked = event.target.closest(elsel_str);
    if (clicked) handleItemAction(clicked);
});

container.addEventListener("keydown", event => {
    if (event.key === " ") event.preventDefault();
});

document.addEventListener("mouseup", event => {
    switch (event.button) {
        case 3: event.preventDefault(); goBack(); break;
        case 4: event.preventDefault(); document.activeElement.click(); break;
        default: break;
    }
});

document.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    let delta = 1;

    switch (event.key.toLowerCase()) {
        case "arrowup": delta -= 2;
        case "arrowdown":
            event.preventDefault();
            const el = event.target.closest(".desc-text");
            if (!el) moveFocus(delta);
            else el.scrollTop += delta * 16;
            break;

        case "home": delta -= 2;
        case "end":
            event.preventDefault();
            moveFocus(delta * Infinity);
            break;

        case "arrowleft":
            event.preventDefault();
        case "backspace":
            goBack();
            break;

        case "arrowright":
            document.activeElement.click();
            break;
        case "h":
            window.location.reload();
            break;
        default:
            break;
    }
});

// ============================================================================
// INIT
// ============================================================================

(async () => {
    if (!window.location.hash) renderFolder(basePath);
    else {   
        const savedPath = window.location.hash.slice(1);
        currentPath = `${basePath}${savedPath}/`;
        // Fallback when the saved path is just invalid
        const res = await fetch(`${currentPath}?get=json`, { method: "HEAD" })
        if (!res.ok) resetPage();
        else renderFolder(currentPath);
    }
})();

 