/* Code by Sergio00166 */

const { pathname } = window.location;
const pathSegments = pathname.split('/');
if (!pathSegments.pop().includes('.')) pathSegments.push('');
const basePath = pathSegments.join('/') + '/';

const cache = {};
let currentPath = basePath;
const cache_suffix = '?cache';

const container = document.getElementById('container');
const elsel_str = '.grid > button, .subfolders > button';

const intersectionObserver = new IntersectionObserver(
    handleIntersection, { rootMargin: '200px' }
);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function loadImage(img) {
    if (typeof img.decode === 'function') return img.decode();
    return new Promise(res => { img.onload = res; });
}

function getJSON(path) {
    if (cache[path]) return cache[path];
    cache[path] = fetch(path, { headers: { Accept: 'application/json' } })
        .then(r => r.json()).catch(() => []);
    return cache[path];
}

function getText(path) {
    return fetch(path + cache_suffix, { headers: { Accept: 'text/plain' } })
        .then(r => r.text()).catch(() => '');
}

// ============================================================================
// FOLDER RENDERING HELPERS
// ============================================================================

const extractPhotos = items => items.filter(i => i.type === 'photo');
const extractVideos = items => items.filter(i => i.type === 'video');
const extractDescription = items => items.find(i => i.type === 'text' && i.name === 'description.txt');

function extractSubfolders(items) {
    return items
    .filter(i => i.type === 'directory' && i.name !== '.thumbnails')
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ============================================================================
// ELEMENTs HELPERs
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
    const name = nameEl ? nameEl.textContent : '';
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
// INTERSECTION HANDLING
// ============================================================================

function handleIntersection(entries, observer) {
    for (const e of entries) {
        if (!e.isIntersecting) continue;
        observer.unobserve(e.target);

        if (e.target.classList.contains('thumb')) {
            handleThumbnailIntersection(e.target);
        }
        else if (e.target.classList.contains('poster-bg')) {
            handlePosterIntersection(e.target);
        }
    }
}
function handleThumbnailIntersection(el) {
    el.classList.add('loading');
    const folderPath = currentPath + '.thumbnails/';

    getJSON(folderPath).then(list => {
        const videoName = el.dataset.video.replace(/\.[^/.]+$/, '');
        const match = list.find(item =>
            item.name.startsWith(videoName + '.') &&
            item.name.slice(videoName.length + 1).indexOf('.') === -1
        );
        if (!match) return;
        const img = new Image();
        img.src = match.path + cache_suffix;
        el.appendChild(img);

        loadImage(img).finally(() => {
            el.classList.remove('loading');
            el.removeAttribute('data-video');
        });
    });
}


function handlePosterIntersection(bgEl) {
    bgEl.classList.add('loading');
    const pc = bgEl.closest('.poster-container');
    const posterImg = pc.querySelector('.poster-image');

    const bimg = new Image();
    const src = bgEl.dataset.src + cache_suffix;
    bimg.src = posterImg.src = src;

    Promise.all([loadImage(bimg), loadImage(posterImg)]).then(() => {
        bgEl.appendChild(bimg);
        posterImg.classList.add('loaded');
        bgEl.classList.remove('loading');
        bgEl.removeAttribute('data-src');
    });
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
        pbg.dataset.src = photos[0].path;
        const pimg = document.createElement('img');
        pimg.className = 'poster-image';
        pc.appendChild(pbg);
        pc.appendChild(pimg);
        intersectionObserver.observe(pbg);
        inner.appendChild(pc);
    }
    if (descriptionObject) {
        const td = createDiv('desc-text');
        td.style.visibility = 'hidden';
        td.style.opacity = '0';
        getText(descriptionObject.path).then(t => {
            td.textContent = t;
            td.style.visibility = '';
            td.style.opacity = '';
        });
        inner.appendChild(td);
    }
    desc.appendChild(inner);
    return desc;
}

// ============================================================================
// GRID RENDERING
// ============================================================================

function appendGrid(parent, videos, folderPath) {
    if (!videos.length) return;
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
        intersectionObserver.observe(thumb);

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
// NAVIGATION
// ============================================================================

function goBack() {
    const cur = currentPath.split('/').filter(Boolean);
    const base = basePath.split('/').filter(Boolean);

    if (cur.length <= base.length && currentPath.indexOf(basePath) === 0) {
        const exitPath = '/' + base.slice(0, -1).join('/');
        window.location.href = exitPath || '/';
        return;
    }
    let parent = '/' + cur.slice(0, -1).join('/');
    const focusBackName = cur[cur.length - 1];
    if (parent.charAt(parent.length - 1) !== '/') parent += '/';
    renderFolder(parent, focusBackName);
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
            if (photos.length || descObj) container.appendChild(createDescription(photos, descObj));
        }
        appendGrid(container, extractVideos(items), folderPath);

        const subs = extractSubfolders(items);
        if (subs.length) {
            const sc = createDiv('subfolders');
            renderSubfolder(subs, sc, folderPath, focusBackName);
            container.appendChild(sc);
        }
        if (focusBackName) {
            waitForElement('[data-focus-me="1"]')
                .then(el => el.focus()).catch(() => {});
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

    if (parts.length) {
        title.textContent = parts[parts.length - 1]
    } else {
        title.textContent = folderPath
    }
    info.appendChild(title);
    containerElement.appendChild(info);

    if (photos.length || descObj) {
        containerElement.appendChild(
            createDescription(photos, descObj)
        );
    }
}

// ============================================================================
// UTIL — WAIT & FOCUS
// ============================================================================

async function waitForElement(selector, maxTries, interval) {
    let tries = 0;
    while (tries < 20) {
        const el = document.querySelector(selector);
        if (el) return el;
        await new Promise(r => setTimeout(r, 25));
        tries++;
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
// EVENT LISTENERS - CONTAINER
// ============================================================================

container.addEventListener('click', e => {
    const clicked = e.target.closest(elsel_str);
    e.stopPropagation();
    if (clicked) handleItemAction(clicked);
});

container.addEventListener('keydown', e => {
    const focused = e.target.closest(elsel_str);
    if (focused && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight')) {
        e.preventDefault();
        handleItemAction(focused);
    }
});

// ============================================================================
// EVENT LISTENERS - KEYBOARD SHORTCUTS
// ============================================================================

document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    const key = e.key.toLowerCase();

    switch (key) {
        case 'arrowdown':
        case 'arrowup':
            e.preventDefault();
            if (key === 'arrowup') moveFocus(-1);
            else moveFocus(1);
            break;
        case 'home':
        case 'end':
            e.preventDefault();
            if (key === 'end') moveFocus(Infinity);
            else moveFocus(-Infinity);
            break;
        case 'arrowleft':
            e.preventDefault();
            goBack();
            break;
        case 'i':
            window.location.reload();
            break;
    }
});

// ============================================================================
// INITIALIZATION
// ============================================================================

renderFolder(basePath);

 
