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

function createDiv(className) {
    const d = document.createElement("div");
    d.className = className;
    return d;
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
},{ rootMargin: "200px" });

function attachObserver(el, callback) {
    ioCallbacks.set(el, callback);
    globalObserver.observe(el);
}

// ============================================================================
//  ITEM LOADERS
// ============================================================================

async function loadFolderInfo(el, poster, description) {
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
    img.src = thumbItem + cache_suffix;
    el.appendChild(img);
    await loadImage(img);
    el.classList.remove("loading");
}

// ============================================================================
//  DESCRIPTION HELPER
// ============================================================================

function createDescription(parentEl, photos, description) {
    const desc = createDiv("description");

    if (photos) {
        const pc = createDiv("poster-container loading");
        const pbg = createDiv("poster-background");
        const pimg = document.createElement("img");
        pimg.className = "poster-image";
        pc.appendChild(pbg);
        pc.appendChild(pimg);
        desc.appendChild(pc);
    }
    if (description) {
        const td = createDiv("desc-text");
        td.classList.add("loading");
        desc.appendChild(td);
    }
    parentEl.appendChild(desc);
    attachObserver(desc, el => loadFolderInfo(el, photos, description));
}

// ============================================================================
// SUBFOLDER RENDERING
// ============================================================================

function renderSubfolder(parentEl, subfolders, focusBackName, infoMap) {
    const subContainer = createDiv("subfolders");

    for (let i = 0; i < subfolders.length; i++) {
        const subfolder = subfolders[i];
        const el = document.createElement("button");

        if (subfolder.name === focusBackName) el.id = "focused";
        subContainer.appendChild(el);

        const title = createDiv("title");
        title.textContent = subfolder.name;
        el.appendChild(title);

        const out = infoMap.get(subfolder.name);
        if (out) createDescription(el, out[0], out[1]);
    }
    parentEl.appendChild(subContainer);
}

// ============================================================================
// GRID HANDLING
// ============================================================================

function appendGrid(parentEl, videos, thumbsMap) {
    const grid = createDiv("grid");

    for (let i = 0; i < videos.length; i++) {
        const v = videos[i];
        const card = document.createElement("button");
        const thumb = createDiv("thumb");

        const thumbItem = thumbsMap.get(v.name.replace(/\.[^/.]+$/, ""));
        attachObserver(thumb, el => loadThumbnail(el, thumbItem));

        const title = createDiv("title");
        title.textContent = v.name;
        card.appendChild(thumb);
        card.appendChild(title);
        grid.appendChild(card);
    }
    parentEl.appendChild(grid);
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
        const base = it.name.replace(/\.[^/.]+$/, "");
        thumbsMap.set(base, parentPath + it.name);
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

async function renderFolder(folderPath, focusBackName) {
    ioCallbacks.clear();
    currentPath = folderPath;
    container.classList.remove("show");

    const items = await getJSON(folderPath);
    const data = filterFolderItems(items, folderPath);
    const frag = document.createDocumentFragment();

    if (data.selfPoster || data.selfDesc) 
        createDescription(frag, data.selfPoster, data.selfDesc);

    if (data.videos.length) {
        let thumbsMap = new Map();
        if (data.hasDotThumbs) thumbsMap = await getThumbsMap(folderPath);
        appendGrid(frag, data.videos, thumbsMap);
    }
    if (data.subfolders.length) {
        let infoMap = new Map();
        if (data.hasDotInfo) infoMap = await getInfoMap(folderPath);
        renderSubfolder(frag, data.subfolders, focusBackName, infoMap);
    }
    const focusEl = document.getElementById("focused");
    if (focusEl) focusEl.focus();
    else container.scrollTo(0, 0);

    pathStr = decodeURIComponent(folderPath);
    pathElement.textContent = `\u200E${pathStr}\u200E`;
    container.replaceChildren(frag);
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

renderFolder(currentPath);

 
