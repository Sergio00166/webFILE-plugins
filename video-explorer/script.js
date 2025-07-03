/* Code by Sergio00166 */

const { pathname } = window.location;
const segs = pathname.split("/");
if (!segs.pop().includes('.')) segs.push('');
const basePath = segs.join('/') + '/';

const cache = {};
let currentPath = basePath;

document.getElementById('folder-name').textContent =
    'Videos @ ' + decodeURIComponent(basePath) || '/';

const fullUrl = function(path) { return path + '?cache'; };
const loadImage = function(img) {
    if (typeof img.decode === 'function') return img.decode();
    return new Promise(function(res) { img.onload = res; });
};
const getJSON = function(path) {
    return cache[path] = cache[path] || fetch(path, { headers: { Accept: 'application/json' } })
        .then(function(res) { return res.json(); })
        .catch(function() { return []; });
};
const getText = function(path) {
    return fetch(path + '?cache', { headers: { Accept: 'text/plain' } })
        .then(function(res) { return res.text(); })
        .catch(function() { return ''; });
};

const io = new IntersectionObserver(onIntersection, { rootMargin: '200px' });

function onIntersection(entries, observer) {
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const target = entry.target;
        const isIntersecting = entry.isIntersecting;

        if (!isIntersecting) continue;
        observer.unobserve(target);

        if (target.classList.contains('thumb')) {
            target.classList.add('loading');
            const folder = target.closest('.grid').dataset.folder;
            getJSON(folder).then(function(list) {
                const match = list.find(function(item) { return item.name.startsWith(target.dataset.video); });
                if (!match) return;
                const img = new Image();
                img.src = fullUrl(match.path);
                target.textContent = '';
                target.appendChild(img);
                loadImage(img).finally(function() {
                    target.classList.remove('loading');
                    target.removeAttribute('data-video');
                });
            });
        } else if (target.classList.contains('folder__poster-bg')) {
            target.classList.add('loading');
            const container = target.closest('.folder__poster-container');
            const poster = container.querySelector('.folder__poster-image');
            const bg = new Image();
            bg.src = poster.src = fullUrl(target.dataset.src);
            Promise.all([loadImage(bg), loadImage(poster)]).then(function() {
                target.innerHTML = '';
                target.appendChild(bg);
                poster.classList.add('loaded');
                target.classList.remove('loading');
                target.removeAttribute('data-src');
            });
        }
    }
}

function createDiv(className, props) {
    props = props || {};
    const div = document.createElement('div');
    div.className = className;
    Object.assign(div, props);
    return div;
}

function createDescription(photos, descObj) {
    const container = createDiv('folder__description');
    const inner = createDiv('folder__desc-inner');

    if (photos.length) {
        const posterContainer = createDiv('folder__poster-container');
        const bg = createDiv('folder__poster-bg');
        bg.dataset.src = photos[0].path;
        const img = document.createElement('img');
        img.className = 'folder__poster-image';
        posterContainer.appendChild(bg);
        posterContainer.appendChild(img);
        io.observe(bg);
        inner.appendChild(posterContainer);
    }
    if (descObj) {
        const textDiv = createDiv('desc-text');
        textDiv.style.visibility = 'hidden';
        textDiv.style.opacity = '0';
        getText(descObj.path).then(function(txt) {
            textDiv.textContent = txt;
            textDiv.style.visibility = 'visible';
            textDiv.style.opacity = '1';
        });
        inner.appendChild(textDiv);
    }
    container.appendChild(inner);
    return container;
}

function appendGrid(parent, videos, path) {
    if (!videos.length) return;
    const grid = createDiv('grid');
    grid.dataset.folder = path + '.thumbnails/';
    parent.appendChild(grid);
    const chunkSize = 8;
    let index = 0;

    function renderChunk() {
        const frag = document.createDocumentFragment();
        for (let i = 0; i < chunkSize && index < videos.length; i++, index++) {
            const video = videos[index];
            const card = createDiv('card', { tabIndex: 0 });
            card.dataset.path = video.path;
            const thumb = createDiv('thumb');
            thumb.dataset.video = video.name;
            io.observe(thumb);
            const info = createDiv('info');
            const title = createDiv('title');
            title.textContent = video.name.replace(/\.[^/.]+$/, '');
            info.appendChild(title);
            card.appendChild(thumb);
            card.appendChild(info);
            frag.appendChild(card);
        }
        grid.appendChild(frag);
        if (index < videos.length) setTimeout(renderChunk, 0);
    }
    renderChunk();
}

function goBack() {
    const current = currentPath.split('/').filter(Boolean);
    const base = basePath.split('/').filter(Boolean);
    if (current.length <= base.length) {
        window.location.href = basePath.split('/').slice(0, -2).join('/') + '/';
        return;
    }
    const parent = '/' + current.slice(0, -1).join('/') + '/';
    const focusName = current[current.length - 1];
    renderFolder(parent, focusName);
}

function renderFolder(path, focusBack) {
    if (typeof focusBack === 'undefined') focusBack = '';
    currentPath = path;

    const container = document.getElementById('container');
    container.innerHTML = '';
    document.getElementById('folder-name').textContent =
        'Videos @ ' + decodeURIComponent(path) || '/';

    getJSON(path).then(function(items) {
        if (path === basePath) {
            const photos = items.filter(function(i) { return i.type === 'photo'; });
            const descObj = items.find(function(i) { return i.type === 'text' && i.name === 'description.txt'; });
            if (photos.length || descObj) container.appendChild(createDescription(photos, descObj));
        }
        appendGrid(container, items.filter(function(i) { return i.type === 'video'; }), path);

        const subfolders = items
            .filter(function(i) { return i.type === 'directory' && i.name !== '.thumbnails'; })
            .sort(function(a, b) { return a.name.localeCompare(b.name); });

        if (subfolders.length) {
            const subCt = createDiv('subfolders');
            const chunkSize = 4;
            let index = 0;

            function renderSubfolderChunk() {
                for (let i = 0; i < chunkSize && index < subfolders.length; i++, index++) {
                    const sub = subfolders[index];
                    const subPath = path + sub.name + '/';
                    const folderEl = createDiv('folder', { tabIndex: 0 });
                    if (sub.name === focusBack) folderEl.dataset.focusMe = '1';
                    subCt.appendChild(folderEl);

                    getJSON(subPath).then(function(subItems) {
                        renderFolderContent(subItems, folderEl, subPath);
                        folderEl.classList.add('loaded');
                    });
                    folderEl.addEventListener('click', function(e) {
                        e.stopPropagation();
                        window.scrollTo(0, 0);
                        renderFolder(subPath);
                    });
                }
                if (index < subfolders.length) renderSubfolderChunk();
            }
            renderSubfolderChunk();
            container.appendChild(subCt);
        }
        if (focusBack) waitForElement('[data-focus-me="1"]').then(function(el) { el.focus(); });
    });
}

function renderFolderContent(items, container, path) {
    const photos = items.filter(function(i) { return i.type === 'photo'; });
    const descObj = items.find(function(i) { return i.type === 'text' && i.name === 'description.txt'; });
    const nameBlock = createDiv('info');
    const title = createDiv('title');
    const parts = path.split('/').filter(Boolean);
    title.textContent = parts.length ? parts[parts.length - 1] : path;
    nameBlock.appendChild(title);
    container.appendChild(nameBlock);

    if (photos.length || descObj) container.appendChild(createDescription(photos, descObj));
}

document.addEventListener('click', function(e) {
    const card = e.target.closest('.card');
    if (card) {
        e.stopPropagation();
        window.open(card.dataset.path, '_blank');
    }
});

document.addEventListener('keydown', function(e) {
    const key = e.key;
    const active = document.activeElement;
    const items = Array.prototype.slice.call(document.querySelectorAll('.folder, .card'));
    let index = items.indexOf(active);
    function moveFocus(step) {
        e.preventDefault();
        index = index === -1
            ? (step > 0 ? 0 : items.length - 1)
            : (index + step + items.length) % items.length;
        items[index].focus();
    }
    switch (key) {
        case 'ArrowDown': moveFocus(1); break;
        case 'ArrowUp': moveFocus(-1); break;
        case 'ArrowRight':
        case 'Enter':
        case ' ':
            e.preventDefault();
            if (active.classList.contains('folder')) active.click();
            else if (active.classList.contains('card')) window.open(active.dataset.path, '_blank');
            break;
        case 'ArrowLeft': e.preventDefault(); goBack(); break;
    }
});

function waitForElement(selector, maxTries, interval) {
    maxTries = maxTries || 20;
    interval = interval || 25;
    return new Promise(function(resolve, reject) {
        let tries = 0;
        function check() {
            const el = document.querySelector(selector);
            if (el) return resolve(el);
            if (++tries >= maxTries) return reject(new Error('Element not found: ' + selector));
            setTimeout(check, interval);
        }
        check();
    });
}

renderFolder(basePath);

