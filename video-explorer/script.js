/* Code by Sergio00166 */

const {pathname} = window.location;
const pathSegments = pathname.split('/');
if (!pathSegments.pop().includes('.')) pathSegments.push('');
const basePath = pathSegments.join('/') + '/';

let currentPath = basePath;
const cache_suffix = '?cache';
const ioCallbacks = new Map();
const focusStack = [];

const container = document.getElementById('container');
const elsel_str = '.grid > button, .subfolders > button';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function loadImage(img) {
    if (typeof img.decode === 'function') return img.decode();
    return new Promise(function(res) { img.onload = res; });
}

function getJSON(path) {
    return fetch(path, { headers: { Accept: 'application/json' } })
    .then(r => r.json()).catch(() => []);
}

function getText(path) {
    return fetch(path + cache_suffix, { headers: { Accept: 'text/plain' } })
    .then(r => r.text()).catch(() => '');
}

function createDiv(className, props) {
    const d = document.createElement('div');
    d.className = className;
    if (props) Object.assign(d, props);
    return d;
}

// ============================================================================
// INSTERSECTION OBSERVER (lazy loading)
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
}, { rootMargin: '200px' });

function attachObserver(el, callback) {
    ioCallbacks.set(el, callback);
    globalObserver.observe(el);
}

// ============================================================================
// POSTER / DESCRIPTION
// ============================================================================

function createDescription(photos, descObj) {
    const desc = createDiv('description');

    if (photos && photos.length) {
        const pc = createDiv('poster-container');
        const pbg = createDiv('poster-background');
        pbg.classList.add('loading');
        const pimg = document.createElement('img');
        pimg.className = 'poster-image';
        pc.appendChild(pbg);
        pc.appendChild(pimg);
        desc.appendChild(pc);
    }
    if (descObj) {
        const td = createDiv('desc-text');
        desc.appendChild(td);
    }
    return desc;
}

async function loadFolderPoster(el, photos, descObj) {
    const pc = el.querySelector('.poster-container');
    const pbg = pc.querySelector('.poster-background');
    const pimg = pc.querySelector('.poster-image');

    if (photos && photos.length) {
        const bimg = new Image();
        bimg.src = photos[0].path + cache_suffix;
        pimg.src = photos[0].path + cache_suffix;
        await Promise.all([loadImage(bimg), loadImage(pimg)]);
        pbg.appendChild(bimg);
        pbg.classList.remove('loading');
        pimg.classList.add('loaded');
    }
    if (descObj) {
        const td = el.querySelector('.desc-text');
        const t = await getText(descObj.path);
        td.textContent = t;
    }
}

// ============================================================================
// INFO FOR SUBFOLDERS
// ============================================================================

function getFolderInfoFromList(folderName, infoItems) {
    let poster = null,
    descObj = null;
    for (let i = 0; i < infoItems.length; i++) {
        const it = infoItems[i];
        if (!poster && it.type === 'photo' && it.name.indexOf(folderName + '.') === 0) poster = it;
        if (!descObj && it.type === 'text' && it.name === folderName + '.txt') descObj = it;
    }
    return {poster, descObj};
}

// ============================================================================
// THUMBNAILS
// ============================================================================

function findThumbnailForVideo(videoName, thumbsList) {
    const baseName = videoName.replace(/\.[^/.]+$/, '');
    for (let i = 0; i < thumbsList.length; i++) {
        const it = thumbsList[i];
        const thumbBase = it.name.replace(/\.[^/.]+$/, '');
        if (thumbBase === baseName) return it;
    }
    return null;
}

async function loadThumbnail(el, thumbItem) {
    el.classList.add('loading');
    if (!thumbItem) return;
    const img = new Image();
    img.src = thumbItem.path + cache_suffix;
    el.appendChild(img);
    await loadImage(img);
    el.classList.remove('loading');
}

// ============================================================================
// GRID
// ============================================================================

function appendGrid(parent, videos, thumbsList) {
    if (!videos || !videos.length) return;
    const grid = createDiv('grid');
    parent.appendChild(grid);
    let frag = null;

    for (let i = 0; i < videos.length; i++) {
        if (i % 8 === 0) frag = document.createDocumentFragment();
        const v = videos[i];
        const card = document.createElement('button');
        const thumb = createDiv('thumb');
        const thumbItem = findThumbnailForVideo(v.name, thumbsList);
        attachObserver(thumb, el => {
            loadThumbnail(el, thumbItem);
        });
        const title = createDiv('title');
        title.textContent = v.name;

        card.appendChild(thumb);
        card.appendChild(title);
        frag.appendChild(card);

        if (i % 8 === 7 || i === videos.length - 1) {
            grid.appendChild(frag);
        }
    }
}

// ============================================================================
// FOLDER CONTENT
// ============================================================================

function renderFolderContent(folderName, containerElement, infoItems) {
    const title = createDiv('title');
    title.textContent = folderName;
    containerElement.appendChild(title);

    if (!infoItems || !infoItems.length) return;
    const res = getFolderInfoFromList(folderName, infoItems);
    const photos = [];
    if (res.poster) photos.push(res.poster);

    if (!photos.length && !res.descObj) return;
    const descEl = createDescription(photos, res.descObj);
    containerElement.appendChild(descEl);

    attachObserver(descEl, el => {
        loadFolderPoster(el, photos, res.descObj).catch();
    });
}

// ============================================================================
// SUBFOLDERS
// ============================================================================

function renderSubfolder(subfolders, containerElement, focusBackName, infoItems) {
    subfolders.forEach(sub => {
        const el = document.createElement('button');
        if (sub.name === focusBackName) el.dataset.focusMe = '1';
        containerElement.appendChild(el);
        renderFolderContent(sub.name, el, infoItems);
    });
}

// ============================================================================
// FOLDER RENDERER
// ============================================================================

async function renderFolder(folderPath, focusBackName) {
    currentPath = folderPath;
    container.innerHTML = '';
    let curPoster = null;
    let curDesc = null;
    let hasDotInfo = false;
    let hasDotThumbnails = false;

    const titleEl = document.querySelector('.path-title');
    titleEl.textContent = decodeURIComponent(folderPath);
    const items = await getJSON(folderPath);

    for (const it of items) {
        if (!curPoster && it.type === 'photo' && it.name.startsWith('poster.')) {
            curPoster = it;
        } else if (!curDesc && it.type === 'text' && it.name === 'description.txt') {
            curDesc = it;
        } else if (it.type === 'directory') {
            if (!hasDotInfo && it.name === '.info') {
                hasDotInfo = true;
            } else if (!hasDotThumbnails && it.name === '.thumbnails') {
                hasDotThumbnails = true;
            }
        }
        if (curPoster && curDesc && hasDotInfo && hasDotThumbnails) break;
    }
    if (curPoster || curDesc) {
        const photos = [];
        if (curPoster) photos.push(curPoster);
        const descEl = createDescription(photos, curDesc);
        container.appendChild(descEl);
        attachObserver(descEl, el => loadFolderPoster(el, photos, curDesc));
    }
    let thumbsList = [];
    if (hasDotThumbnails) {
        thumbsList = await getJSON(folderPath + '.thumbnails/');
    }
    appendGrid(container, items.filter(i => i.type === 'video'), thumbsList);
    const subs = items
        .filter(i => i.type === 'directory' && i.name !== '.thumbnails' && i.name !== '.info')
        .sort((a, b) => a.name.localeCompare(b.name));

    if (subs.length > 0) {
        let infoItems = [];
        if (hasDotInfo) infoItems = await getJSON(folderPath + '.info/');
        const sc = createDiv('subfolders');
        renderSubfolder(subs, sc, focusBackName, infoItems);
        container.appendChild(sc);
    }
    if (focusBackName) {
        const el = container.querySelector('[data-focus-me="1"]');
        if (el) el.focus();
    }
}

// ============================================================================
// NAVIGATION & FOCUS
// ============================================================================

function handleItemAction(el) {
    var parent = el.parentElement;
    var nameEl = el.querySelector('.title');
    var name = '';
    if (nameEl) name = nameEl.textContent;
    var encoded = encodeURIComponent(name);

    if (parent.classList.contains('subfolders')) {
        focusStack.push(name);
        container.scrollTo(0, 0);
        var targetPath = currentPath + encoded + '/';
        renderFolder(targetPath);
        return;
    }
    if (parent.classList.contains('grid')) {
        var targetPath2 = currentPath + encoded;
        window.open(targetPath2, '_blank');
    }
}

function goBack() {
    const cur = currentPath.split('/').filter(Boolean);
    const base = basePath.split('/').filter(Boolean);

    if (cur.length <= base.length && currentPath.indexOf(basePath) === 0) {
        const exitPath = '/' + base.slice(0, -1).join('/');
        if (exitPath === '') window.location.href = '/';
        else window.location.href = exitPath;
        return;
    }
    let parent = '/' + cur.slice(0, -1).join('/');
    if (!parent.endsWith('/')) parent += '/';

    const focusBackName = focusStack.pop() || null;
    renderFolder(parent, focusBackName);
}

function moveFocus(direction) {
    const focusable = Array.from(document.querySelectorAll(elsel_str));
    if (!focusable.length) return;
    let idx = focusable.indexOf(document.activeElement);

    if (direction === -Infinity) {
        idx = 0;
    } else if (direction === Infinity) {
        idx = focusable.length - 1;
    } else {
        idx = (idx + direction + focusable.length) % focusable.length;
    }
    focusable[idx].focus();
}

// ============================================================================
// EVENTS
// ============================================================================

container.addEventListener('click', e => {
    const clicked = e.target.closest(elsel_str);
    e.stopPropagation();
    if (clicked) handleItemAction(clicked);
});

container.addEventListener('keydown', e => {
    const focused = e.target.closest(elsel_str);
    if (focused && ['Enter', ' ', 'ArrowRight'].indexOf(e.key) !== -1) {
        e.preventDefault();
        handleItemAction(focused);
    }
});

document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    const key = e.key.toLowerCase();
    if (key === 'arrowdown') {
        moveFocus(1);
        e.preventDefault();
    } else if (key === 'arrowup') {
        moveFocus(-1);
        e.preventDefault();
    } else if (key === 'home') {
        moveFocus(-Infinity);
        e.preventDefault();
    } else if (key === 'end') {
        moveFocus(Infinity);
        e.preventDefault();
    } else if (key === 'arrowleft') {
        goBack();
        e.preventDefault();
    } else if (key === 'i') {
        window.location.reload();
    }
});

// ============================================================================
// INIT
// ============================================================================

renderFolder(basePath);

 