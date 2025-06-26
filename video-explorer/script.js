/* Code by Sergio00166 */

const { pathname } = window.location;
const segs = pathname.split("/");
if (!segs.pop().includes('.')) segs.push('');
const basePath = segs.join('/') + '/';

const cache = {};
let currentPath = basePath;

document.getElementById('folder-name').textContent =
    'Videos @ ' + decodeURIComponent(basePath) || '/';

const fullUrl = path => `${path}?cache`;
const loadImage = img => img.decode?.() ?? new Promise(res => (img.onload = res));
const getJSON = path =>
    cache[path] ??= fetch(path, { headers: { Accept: 'application/json' } })
        .then(res => res.json()).catch(() => []);
const getText = path =>
    fetch(`${path}?cache`, { headers: { Accept: 'text/plain' } })
        .then(res => res.text()).catch(() => '');

const io = new IntersectionObserver(onIntersection, { rootMargin: '200px' });


function onIntersection(entries, observer) {
    for (let { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        observer.unobserve(target);

        if (target.classList.contains('thumb')) {
            const folder = target.closest('.grid').dataset.folder;
            getJSON(folder).then(list => {
                const match = list.find(item => item.name.startsWith(target.dataset.video));
                if (!match) return;
                const img = new Image();
                img.src = fullUrl(match.path);
                target.textContent = '';
                target.append(img);
                loadImage(img).finally(() => {
                    target.classList.remove('loading');
                    target.removeAttribute('data-video');
                });
            });
        } else if (target.classList.contains('folder__poster-bg')) {
            const container = target.closest('.folder__poster-container');
            const poster = container.querySelector('.folder__poster-image');
            const bg = new Image();
            bg.src = poster.src = fullUrl(target.dataset.src);
            Promise.all([loadImage(bg), loadImage(poster)]).then(() => {
                target.innerHTML = '';
                target.append(bg);
                poster.classList.add('loaded');
                target.classList.remove('loading');
                target.removeAttribute('data-src');
            });
        }
    }
}

function createDiv(className, props = {}) {
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
        const bg = createDiv('folder__poster-bg loading');
        bg.dataset.src = photos[0].path;
        const img = document.createElement('img');
        img.className = 'folder__poster-image';
        posterContainer.append(bg, img);
        io.observe(bg)
        inner.append(posterContainer);
    }
    if (descObj) {
        const textDiv = createDiv('desc-text');
        textDiv.style.visibility = 'hidden';
        textDiv.style.opacity = '0';
        getText(descObj.path).then(txt => {
            textDiv.textContent = txt;
            textDiv.style.visibility = 'visible';
            textDiv.style.opacity = '1';
        });
        inner.append(textDiv);
    }
    container.append(inner);
    return container;
}

function appendGrid(parent, videos, path) {
    if (!videos.length) return;
    const grid = createDiv('grid');
    grid.dataset.folder = path + '.thumbnails/';
    parent.append(grid);
    const chunkSize = 8;
    let index = 0;

    function renderChunk() {
        const frag = document.createDocumentFragment();
        for (let i = 0; i < chunkSize && index < videos.length; i++, index++) {
            const video = videos[index];
            const card = createDiv('card', { tabIndex: 0 });
            card.dataset.path = video.path;
            const thumb = createDiv('thumb loading');
            thumb.dataset.video = video.name;
            io.observe(thumb)
            const info = createDiv('info');
            const title = createDiv('title');
            title.textContent = video.name.replace(/\.[^/.]+$/, '');
            info.append(title);
            card.append(thumb, info);
            frag.append(card);
        }
        grid.append(frag);
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
    const focusName = current.at(-1);
    renderFolder(parent, focusName);
}

function renderFolder(path, focusBack = '') {
    currentPath = path;

    const container = document.getElementById('container');
    container.innerHTML = '';
    document.getElementById('folder-name').textContent =
        'Videos @ ' + decodeURIComponent(path) || '/';

    getJSON(path).then(items => {
        if (path === basePath) {
            const photos = items.filter(i => i.type === 'photo');
            const descObj = items.find(i => i.type === 'text' && i.name === 'description.txt');
            if (photos.length || descObj) container.append(createDescription(photos, descObj));
        }
        appendGrid(container, items.filter(i => i.type === 'video'), path);

        const subfolders = items
            .filter(i => i.type === 'directory' && i.name !== '.thumbnails')
            .sort((a, b) => a.name.localeCompare(b.name));

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
                    subCt.append(folderEl);

                    getJSON(subPath).then(subItems => {
                        renderFolderContent(subItems, folderEl, subPath);
                        folderEl.classList.add('loaded');
                    });
                    folderEl.addEventListener('click', e => {
                        e.stopPropagation();
                        window.scrollTo(0, 0);
                        renderFolder(subPath);
                    });
                }
                if (index < subfolders.length) renderSubfolderChunk();
            }
            renderSubfolderChunk();
            container.append(subCt);
        }
        if (focusBack) waitForElement('[data-focus-me="1"]').then(el => el.focus());
    });
}

function renderFolderContent(items, container, path) {
    const photos = items.filter(i => i.type === 'photo');
    const descObj = items.find(i => i.type === 'text' && i.name === 'description.txt');
    const nameBlock = createDiv('info');
    const title = createDiv('title');
    title.textContent = path.split('/').filter(Boolean).pop() || path;
    nameBlock.append(title);
    container.append(nameBlock);

    if (photos.length || descObj) container.append(createDescription(photos, descObj));
}

document.addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (card) {
        e.stopPropagation();
        window.open(card.dataset.path, '_blank');
    }
});

document.addEventListener('keydown', e => {
    const key = e.key;
    const active = document.activeElement;
    const items = Array.from(document.querySelectorAll('.folder, .card'));
    let index = items.indexOf(active);
    const moveFocus = step => {
        e.preventDefault();
        index = index === -1
            ? (step > 0 ? 0 : items.length - 1)
            : (index + step + items.length) % items.length;
        items[index].focus();
    };
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

function waitForElement(selector, maxTries = 20, interval = 25) {
    return new Promise((resolve, reject) => {
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

