/* Code by Sergio00166 */

const {pathname} = window.location;
const pathSegments = pathname.split("/");
if (!pathSegments.pop().includes(".")) pathSegments.push("");
const basePath = pathSegments.join("/") + "/";

let currentPath = basePath;
const cache_suffix = "?get=cached";
const ioCallbacks = new Map();
const focusStack = [];

const container = document.getElementById("container");
const pathElement = document.getElementById("path-text");
const elsel_str = ".grid > button, .subfolders > button";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function createDiv(className, props) {
    const d = document.createElement("div");
    d.className = className;
    if (props) Object.assign(d, props);
    return d;
}

function loadImage(img) {
    if (typeof img.decode === "function") return img.decode();
    return new Promise(function(res) { img.onload = res; });
}

function getJSON(path) {
    return fetch(path + "?get=json")
      .then(r => r.ok && r.json() || [])
      .catch(() => []);
}

function getText(path) {
    return fetch(path + cache_suffix)
      .then(r => r.ok && r.text() || "")
      .catch(() => "");
}

// ============================================================================
// INTERSECTION OBSERVER (lazy loading)
// ============================================================================

const globalObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
        if (entry.isIntersecting) {
            const cb = ioCallbacks.get(entry.target);
            cb(entry.target);
            ioCallbacks.delete(entry.target);
            globalObserver.unobserve(entry.target);
        }
    }
},{ rootMargin: "200px" });

function attachObserver(el, callback) {
    ioCallbacks.set(el, callback);
    globalObserver.observe(el);
}

// ============================================================================
// DESCRIPTION & POSTER HANDLING
// ============================================================================

function createDescription(photos, description) {
    const desc = createDiv("description");

    if (photos) {
        const pc = createDiv("poster-container");
        const pbg = createDiv("poster-background");
        pbg.classList.add("loading");
        const pimg = document.createElement("img");
        pimg.className = "poster-image";
        pc.appendChild(pbg);
        pc.appendChild(pimg);
        desc.appendChild(pc);
    }
    if (description) {
        const td = createDiv("desc-text");
        desc.appendChild(td);
    }
    return desc;
}

async function loadFolderPoster(el, poster, description) {
    if (poster) {
        const pc = el.querySelector(".poster-container");
        const pbg = pc.querySelector(".poster-background");
        const pimg = pc.querySelector(".poster-image");

        const bimg = new Image();
        bimg.src = poster + cache_suffix;
        pimg.src = poster + cache_suffix;

        await Promise.all(
            [loadImage(bimg), loadImage(pimg)]
        );
        pbg.appendChild(bimg);
        pbg.classList.remove("loading");
        pimg.classList.add("loaded");
    }
    if (description) {
        const td = el.querySelector(".desc-text");
        const t = await getText(description);
        td.innerHTML = t;
    }
}

function addMainDescription(curPoster, curDesc) {
    if (curPoster || curDesc) {
        const descEl = createDescription(curPoster, curDesc);
        container.appendChild(descEl);
        attachObserver(descEl, el => loadFolderPoster(el, curPoster, curDesc));
    }
}

// ============================================================================
// SUBFOLDER / INFO HANDLING
// ============================================================================

async function getInfoMap(folderPath) {
    const folderMap = new Map();
    const infoItems = await getJSON(folderPath + ".info/");

    for (const it of infoItems) {
        const elDirPath = it.name.split(".")[0];
        const entry = folderMap.get(elDirPath) || [null, null];

        switch (it.type) {
            case "photo":
                entry[0] = it.path;
                break;
            case "text":
                if (it.name === `${elDirPath}.txt`)
                    entry[1] = it.path;
                break;
        }
        folderMap.set(elDirPath, entry);
    }
    return folderMap;
}

function renderFolderContent(folderName, containerElement, infoMap) {
    const title = createDiv("title");
    title.textContent = folderName;
    containerElement.appendChild(title);

    const out = infoMap.get(folderName);
    if (!out) return;

    const descEl = createDescription(out[0], out[1]);
    containerElement.appendChild(descEl);
    attachObserver(descEl, el => loadFolderPoster(el, out[0], out[1]));
}

function renderSubfolder(subfolders, focusBackName, infoMap) {
    const subContainer = createDiv("subfolders");

    for (let i = 0; i < subfolders.length; i++) {
        const subfolder = subfolders[i];
        const el = document.createElement("button");

        if (subfolder.name === focusBackName) el.id = "focused";
        subContainer.appendChild(el);
        renderFolderContent(subfolder.name, el, infoMap);
    }
    container.appendChild(subContainer);
}

// ============================================================================
// THUMBNAILS HANDLING
// ============================================================================

async function loadThumbnail(el, thumbItem) {
    el.classList.add("loading");
    if (!thumbItem) return;
    const img = new Image();
    img.src = thumbItem + cache_suffix;
    el.appendChild(img);
    await loadImage(img);
    el.classList.remove("loading");
}

async function getThumbsMap(folderPath) {
    const thumbsMap = new Map();
    const thumbsList = await getJSON(folderPath + ".thumbnails/");

    for (let i = 0; i < thumbsList.length; i++) {
        const it = thumbsList[i];
        const base = it.name.replace(/\.[^/.]+$/, "");
        thumbsMap.set(base, it.path);
    }
    return thumbsMap;
}

// ============================================================================
// GRID HANDLING
// ============================================================================

function appendGrid(parent, videos, thumbsMap) {
    const grid = createDiv("grid");
    parent.appendChild(grid);
    let frag = null;

    for (let i = 0; i < videos.length; i++) {
        if (i % 8 === 0) frag = document.createDocumentFragment();
        const v = videos[i];
        const card = document.createElement("button");
        const thumb = createDiv("thumb");

        const thumbItem = thumbsMap.get(v.name.replace(/\.[^/.]+$/, "")) || null;
        attachObserver(thumb, el => loadThumbnail(el, thumbItem));

        const title = createDiv("title");
        title.textContent = v.name;
        card.appendChild(thumb);
        card.appendChild(title);
        frag.appendChild(card);

        if (i % 8 === 7 || i === videos.length - 1)
            grid.appendChild(frag);
    }
}

// ============================================================================
// FOLDER HELPERS
// ============================================================================

function separateFolderItems(items) {
    let curDesc = "";
    let curPoster = "";
    const subfolders = [];
    const videos = [];
    let hasDotInfo = false;
    let hasDotThumbnails = false;

    for (let i = 0, len = items.length; i < len; i++) {
        const it = items[i];

        switch (it.type) {
            case "photo":
                if (!curPoster && it.name.startsWith("poster."))
                    curPoster = it.path;
                break;
            case "text":
                if (!curDesc && it.name === "description.txt")
                    curDesc = it.path;
                break;
            case "video":
                videos.push(it);
                break;
            case "directory":
                if (it.name === ".info")
                    hasDotInfo = true;
                else if (it.name === ".thumbnails")
                    hasDotThumbnails = true;
                else
                    subfolders.push(it);
                break;
        }
    }
    addMainDescription(curPoster, curDesc);
    return [hasDotInfo, hasDotThumbnails, subfolders, videos];
}

// ============================================================================
// FOLDER RENDERER
// ============================================================================

async function renderFolder(folderPath, focusBackName) {
    container.classList.remove("show");
    container.innerHTML = "";
    currentPath = folderPath;
    pathElement.textContent = decodeURIComponent(folderPath);

    const items = await getJSON(folderPath);
    const [hasDotInfo, hasDotThumbnails, subfolders, videos] = separateFolderItems(items);

    if (videos.length) {
        let thumbsMap = new Map();
        if (hasDotThumbnails) thumbsMap = await getThumbsMap(folderPath);
        appendGrid(container, videos, thumbsMap);
    }
    if (subfolders.length) {
        let infoMap = new Map();
        if (hasDotInfo) infoMap = await getInfoMap(folderPath);
        renderSubfolder(subfolders, focusBackName, infoMap);
    }
    const focusEl = document.getElementById("focused");
    if (focusEl) focusEl.focus();
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

    if (parent.classList.contains("subfolders")) {
        focusStack.push(name);
        container.scrollTo(0, 0);
        renderFolder(currentPath + encoded + "/");
    }
    if (parent.classList.contains("grid"))
        window.open(currentPath + encoded, "_blank");
}

function goBack() {
    const cur = currentPath.split("/").filter(Boolean);
    const base = basePath.split("/").filter(Boolean);

    if (cur.length <= base.length && currentPath.indexOf(basePath) === 0) {
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
        case -Infinity:
            idx = 0;
            break;
        case Infinity:
            idx = focusable.length - 1;
            break;
        default:
            idx = (idx + direction + focusable.length) % focusable.length;
            break;
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
        case 3:
            event.preventDefault();
            goBack();
            break;
        case 4:
            event.preventDefault();
            document.activeElement.click();
            break;
        default:
            break;
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

renderFolder(basePath);

 