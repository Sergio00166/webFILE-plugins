// Code by Sergio00166

const { pathname } = window.location;
const pathSegments = pathname.split('/');
if (!pathSegments.pop().includes('.')) {
    pathSegments.push('');
}
const basePath = pathSegments.join('/') + '/';

const cache = {};
let currentPath = basePath;
const cache_suffix = '?cache';
const OBS_ROOT_MARGIN = '200px';

const container = document.getElementById('container');
const elsel_str = '.grid > button, .subfolders > button';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function loadImage(img) {
    if (typeof img.decode === 'function') {
        return img.decode();
    }
    return new Promise(res => { img.onload = res; });
}

function getJSON(path) {
    if (cache[path]) return cache[path];
    cache[path] = fetch(path, { headers: { Accept: 'application/json' } })
        .then(r => r.json())
        .catch(() => []);
    return cache[path];
}

function getText(path) {
    return fetch(path + cache_suffix, { headers: { Accept: 'text/plain' } })
        .then(r => r.text())
        .catch(() => '');
}

// ============================================================================
// FOLDER RENDERING HELPERS
// ============================================================================

function extractPhotos(items) {
    return items.filter(i => i.type === 'photo');
}
function extractVideos(items) {
    return items.filter(i => i.type === 'video');
}
function extractDescription(items) {
    return items.find(i => i.type === 'text' && i.name === 'description.txt');
}
function extractSubfolders(items) {
    return items
        .filter(i => i.type === 'directory' && i.name !== '.thumbnails')
        .sort((a, b) => a.name.localeCompare(b.name));
}

// ============================================================================
// ELEMENT HELPERS
// ============================================================================

function createDiv(className, props) {
    const d = document.createElement('div');
    d.className = className;
    if (props) Object.assign(d, props);
    return d;
}

function handleItemAction(el) {
    const parent = el.parentElement;
    const nameEl = el.querySelector('.title');
    let name = '';
    if (nameEl) name = nameEl.textContent;
    const encoded = encodeURIComponent(name);

    if (parent.classList.contains('subfolders')) {
        container.scrollTo(0, 0);
        const targetPath = currentPath + encoded + '/';
        renderFolder(targetPath);
        return;
    }
    if (parent.classList.contains('grid')) {
        const targetPath = currentPath + encoded;
        window.open(targetPath, '_blank');
    }
}

// ============================================================================
// GENERIC OBSERVER
// ============================================================================

function attachObserver(el, callback) {
    const obs = new IntersectionObserver((entries, o) => {
        for (const e of entries) {
            if (e.isIntersecting) {
                o.unobserve(e.target);
                callback(e.target);
            }
        }
    }, { rootMargin: OBS_ROOT_MARGIN });
    obs.observe(el);
}

// ============================================================================
// OBSERVER CALLBACKS
// ============================================================================

function loadThumbnail(el, videoName) {
    el.classList.add('loading');
    const folderPath = currentPath + '.thumbnails/';

    getJSON(folderPath).then(list => {
        const baseName = videoName.replace(/\.[^/.]+$/, '');
        const match = list.find(item =>
            item.name.startsWith(baseName + '.') &&
            item.name.slice(baseName.length + 1).indexOf('.') === -1
        );
        if (!match) {
            el.classList.remove('loading');
            return;
        }
        const img = new Image();
        img.src = match.path + cache_suffix;
        el.appendChild(img);

        loadImage(img).finally(() => {
            el.classList.remove('loading');
            el.removeAttribute('data-video');
        });
    });
}

function loadFolderPoster(el, photos, descObj) {
    // Poster
    if (photos.length) {
        const pc = el.querySelector('.poster-container');
        const pbg = pc.querySelector('.poster-bg');
        const pimg = pc.querySelector('.poster-image');
        const bimg = new Image();
        const src = photos[0].path + cache_suffix;
        bimg.src = src;
        pimg.src = src;

        Promise.all([loadImage(bimg), loadImage(pimg)]).then(() => {
            pbg.appendChild(bimg);
            pimg.classList.add('loaded');
            pbg.classList.remove('loading');
        });
    }

    // Description text
    if (descObj) {
        const td = el.querySelector('.desc-text');
        getText(descObj.path).then(t => {
            td.textContent = t;
            td.style.visibility = '';
            td.style.opacity = '';
        });
    }
}

// ============================================================================
// DESCRIPTION CREATION
// ============================================================================

function createDescription(photos, descriptionObject) {
    const desc = createDiv('description');
    const inner = createDiv('desc-inner');

    if (photos.length) {
        const pc = createDiv('poster-container');
        const pbg = createDiv('poster-bg');
        pbg.classList.add('loading');
        const pimg = document.createElement('img');
        pimg.className = 'poster-image';
        pc.appendChild(pbg);
        pc.appendChild(pimg);
        inner.appendChild(pc);
    }
    if (descriptionObject) {
        const td = createDiv('desc-text');
        td.style.visibility = 'hidden';
        td.style.opacity = '0';
        inner.appendChild(td);
    }

    desc.appendChild(inner);
    return desc;
}

// ============================================================================
// GRID RENDERING
// ============================================================================

function appendGrid(parent, videos) {
    if (videos.length === 0) return;
    const grid = createDiv('grid');
    parent.appendChild(grid);

    const chunk = 8;
    let frag;
    for (let i = 0; i < videos.length; i++) {
        if (i % chunk === 0) frag = document.createDocumentFragment();

        const v = videos[i];
        const card = document.createElement('button');

        const thumb = createDiv('thumb');
        thumb.dataset.video = v.name;
        attachObserver(thumb, el => loadThumbnail(el, v.name));

        const info = createDiv('info');
        const title = createDiv('title');
        title.textContent = v.name;
        info.appendChild(title);

        card.appendChild(thumb);
        card.appendChild(info);
        frag.appendChild(card);

        if (i % chunk === chunk - 1 || i === videos.length - 1) {
            grid.appendChild(frag);
        }
    }
}

// ============================================================================
// FOLDER RENDERING
// ============================================================================

function renderFolder(folderPath, focusBackName) {
    currentPath = folderPath;
    container.innerHTML = '';
    const titleEl = document.querySelector('.path-title');
    if (titleEl) titleEl.textContent = decodeURIComponent(folderPath);

    getJSON(folderPath).then(items => {
        if (folderPath === basePath) {
            const photos = extractPhotos(items);
            const descObj = extractDescription(items);
            if (photos.length || descObj) {
                const descEl = createDescription(photos, descObj);
                container.appendChild(descEl);
                attachObserver(descEl, el => loadFolderPoster(el, photos, descObj));
            }
        }

        appendGrid(container, extractVideos(items));

        const subs = extractSubfolders(items);
        if (subs.length) {
            const sc = createDiv('subfolders');
            renderSubfolder(subs, sc, folderPath, focusBackName);
            container.appendChild(sc);
        }

        if (focusBackName) {
            waitForElement('[data-focus-me="1"]')
                .then(el => el.focus())
                .catch(() => {});
        }
    });
}

function renderSubfolder(subfolders, containerElement, folderPath, focusBackName) {
    subfolders.forEach(sub => {
        const subPath = folderPath + sub.name + '/';
        const el = document.createElement('button');
        if (sub.name === focusBackName) el.dataset.focusMe = '1';
        containerElement.appendChild(el);

        getJSON(subPath).then(items => {
            renderFolderContent(items, el, subPath);
            el.classList.add('loaded');
        });
    });
}

function renderFolderContent(folderItems, containerElement, folderPath) {
    const photos = extractPhotos(folderItems);
    const descObj = extractDescription(folderItems);
    const info = createDiv('info');
    const title = createDiv('title');
    const parts = folderPath.split('/').filter(Boolean);
    title.textContent = parts.length ? parts[parts.length - 1] : folderPath;
    info.appendChild(title);
    containerElement.appendChild(info);

    if (photos.length || descObj) {
        const descEl = createDescription(photos, descObj);
        containerElement.appendChild(descEl);
        attachObserver(descEl, el => loadFolderPoster(el, photos, descObj));
    }
}

// ============================================================================
// NAVIGATION & FOCUS
// ============================================================================

function goBack() {
    const cur = currentPath.split('/').filter(Boolean);
    const base = basePath.split('/').filter(Boolean);
    if (cur.length <= base.length && currentPath.indexOf(basePath) === 0) {
        const exitPath = '/' + base.slice(0, -1).join('/') || '/';
        window.location.href = exitPath;
        return;
    }
    let parent = '/' + cur.slice(0, -1).join('/');
    if (!parent.endsWith('/')) parent += '/';
    renderFolder(parent, cur[cur.length - 1]);
}

async function waitForElement(selector) {
    for (let i = 0; i < 20; i++) {
        const el = document.querySelector(selector);
        if (el) return el;
        await new Promise(r => setTimeout(r, 25));
    }
    throw new Error('Element not found: ' + selector);
}

function moveFocus(direction) {
    const focusable = Array.from(document.querySelectorAll(elsel_str));
    if (!focusable.length) return;
    let idx = focusable.indexOf(document.activeElement);
    if (direction === -Infinity) idx = 0;
    else if (direction === Infinity) idx = focusable.length - 1;
    else idx = (idx + direction + focusable.length) % focusable.length;
    focusable[idx].focus();
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

container.addEventListener('click', e => {
    const clicked = e.target.closest(elsel_str);
    e.stopPropagation();
    if (clicked) handleItemAction(clicked);
});

container.addEventListener('keydown', e => {
    const focused = e.target.closest(elsel_str);
    if (focused && ['Enter', ' ', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        handleItemAction(focused);
    }
});

document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    const key = e.key.toLowerCase();

    switch (key) {
        case 'arrowdown': moveFocus(1); e.preventDefault(); break;
        case 'arrowup': moveFocus(-1); e.preventDefault(); break;
        case 'home': moveFocus(-Infinity); e.preventDefault(); break;
        case 'end': moveFocus(Infinity); e.preventDefault(); break;
        case 'arrowleft': goBack(); e.preventDefault(); break;
        case 'i': window.location.reload(); break;
    }
});

// ============================================================================
// INIT
// ============================================================================

renderFolder(basePath);

 
