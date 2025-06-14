/* Code by Sergio00166 */

const { pathname } = window.location;
const segs = pathname.split("/");
if (!segs.pop().includes('.')) segs.push('');
const basePath = segs.join('/') + '/';
document.getElementById('folder-name').textContent = 'Videos @ ' + decodeURIComponent(basePath) || '/';

const io = new IntersectionObserver(onIntersection, { rootMargin: '200px' });
const thumbnailsCache = {};

function fullUrlWithCache(path) { return path + '?cache'; }
function toggleContent(el) { el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
function goBack() { window.location.href = basePath.split('/').slice(0,-2).join('/') + '/'; }

function onIntersection(entries, obs) {
    entries.forEach(async entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        obs.unobserve(el);

        if (el.classList.contains('thumb')) {
            const folder = el.closest('.grid').dataset.folder;
            thumbnailsCache[folder] ||= fetch(folder, { headers: { Accept: 'application/json' } })
            .then(res => res.json())
            .catch(() => []);
            
            thumbnailsCache[folder].then(list => {
                const match = list.find(x => x.name.startsWith(el.dataset.video));
                if (!match) return;
                
                const img = new Image();
                img.src = fullUrlWithCache(match.path);
                el.textContent = '';
                el.append(img);
                
                const ready = img.decode ? img.decode() : new Promise(r => img.onload = r);
                ready.finally(() => {
                    el.classList.remove('loading');
                    el.removeAttribute('data-video');
                });
            });

        } else if (el.classList.contains('folder__poster-bg')) {
            const posterContainer = el.closest('.folder__poster-container');
            const posterImage = posterContainer.querySelector('.folder__poster-image');
            
            const imageSrc = el.dataset.src;
            const backgroundImage = new Image();
            backgroundImage.src = posterImage.src = imageSrc;
            
            const loadImage = img => img.decode?.() ?? new Promise(resolve => (img.onload = resolve));
            const revealImage = () => {
                el.innerHTML = '';
                el.append(backgroundImage);
                posterImage.classList.add('loaded');
                el.classList.remove('loading');
                el.removeAttribute('data-src');
            };
            Promise.all([loadImage(backgroundImage), loadImage(posterImage)]).then(revealImage, revealImage);
        }
    });
}

function collectAndRender(folderObj, parentEl) {
    const folderEl = document.createElement('div');
    folderEl.className = 'folder is-loading';
    folderEl.tabIndex = 0;

    const header = document.createElement('div');
    header.className = 'folder__header';
    header.textContent = folderObj.name;

    const contentEl = document.createElement('div');
    contentEl.className = 'folder__content';
    contentEl.style.display = 'none';

    folderEl.append(header, contentEl);
    parentEl.append(folderEl);

    (async () => {
        let items;
        try { items = await fetch(folderObj.path, { headers:{Accept:'application/json'} }).then(r=>r.json()); }
        catch { folderEl.classList.remove('is-loading'); return; }

        // descripción y poster
        const photos = items.filter(i=>i.type==='photo');
        const desc    = items.find(i=>i.type==='text' && i.name==='description.txt');
        if (photos.length || desc) {
            const descContainer = document.createElement('div');
            descContainer.className = 'folder__description';
            const inner = document.createElement('div');
            inner.className = 'folder__desc-inner';

            if (photos.length) {
                const pc = document.createElement('div');
                pc.className = 'folder__poster-container';
                const bg = document.createElement('div');
                bg.className = 'folder__poster-bg loading';
                bg.dataset.src = fullUrlWithCache(photos[0].path);
                const img = document.createElement('img');
                img.className = 'folder__poster-image';
                pc.append(bg, img);
                io.observe(bg);
                inner.append(pc);
            }
            if (desc) {
                const td = document.createElement('div');
                td.className = 'desc-text';
                fetch(fullUrlWithCache(desc.path))
                    .then(r=>r.text())
                    .then(txt=> td.textContent = txt);
                inner.append(td);
            }
            descContainer.append(inner);
            folderEl.insertBefore(descContainer, contentEl);
        }

        const videos = items.filter(i=>i.type==='video');
        if (videos.length) {
            const grid = document.createElement('div');
            grid.className = 'grid';
            grid.dataset.folder = folderObj.path + '.thumbnails/';
            const frag = document.createDocumentFragment();

            for (const vid of videos) {
                const card = document.createElement('div');
                card.className = 'card';
                card.tabIndex = 0;
                card.dataset.path = vid.path;

                const thumb = document.createElement('div');
                thumb.className = 'thumb loading';
                thumb.dataset.video = vid.name;
                io.observe(thumb);

                const info = document.createElement('div');
                info.className = 'info';
                const title = document.createElement('div');
                title.className = 'title';
                title.textContent = vid.name.replace(/\.[^/.]+$/, '');
                info.append(title);

                card.append(thumb, info);
                frag.append(card);
            }
            grid.append(frag);
            contentEl.append(grid);
        }
        const subs = items
            .filter(i=>i.type==='directory' && i.name!=='.thumbnails')
            .sort((a,b)=>a.name.localeCompare(b.name));

        if (subs.length) {
            const subContainer = document.createElement('div');
            subContainer.className = 'subfolders';
            let loaded = false;

            const loadSub = async () => {
                if (loaded) return;
                loaded = true;
                for (const s of subs) {
                    collectAndRender({ name: s.name, path: folderObj.path + s.name + '/' }, subContainer);
                }
                contentEl.append(subContainer);
            };
            const subObs = new IntersectionObserver((ents, o) => {
                if (ents.some(e=>e.isIntersecting)) {
                    loadSub().then(()=>o.disconnect());
                }
            }, { rootMargin: '200px' });
            subObs.observe(contentEl);
        }

        folderEl.classList.remove('is-loading');
    })();
}

function renderAll() {
    const container = document.getElementById('container');
    fetch(basePath, { headers:{Accept:'application/json'} })
        .then(r => r.json())
        .then(items => {
            if (items.some(i=>i.type==='video')) {
                collectAndRender({ name: '.', path: basePath }, container);
            }
            items
                .filter(i=>i.type==='directory' && i.name!=='.thumbnails')
                .sort((a,b)=>a.name.localeCompare(b.name))
                .forEach(dir => {
                    collectAndRender({ name: dir.name, path: basePath + dir.name + '/' }, container);
                });
        });
}
renderAll();


document.addEventListener('click', e => {
    const c = e.target.closest('.card');
    if (c) { e.stopPropagation(); return window.open(c.dataset.path, '_blank'); }
    const f = e.target.closest('.folder');
    if (f) toggleContent(f.querySelector('.folder__content'));
});
document.addEventListener('keydown', e => {
    const key = e.key, active = document.activeElement;
    if (['Enter',' ','Spacebar'].includes(key)) {
        const c = active.closest('.card');
        if (c) { e.preventDefault(); e.stopPropagation(); return window.open(c.dataset.path,'_blank'); }
        const f = active.closest('.folder');
        if (f) { e.preventDefault(); toggleContent(f.querySelector('.folder__content')); }
        return;
    }
    switch (key) {
        case 'ArrowDown': e.preventDefault(); moveFocusSibling(1); break;
        case 'ArrowUp':     e.preventDefault(); moveFocusSibling(-1); break;
        case 'ArrowRight':e.preventDefault(); goDeeper(); break;
        case 'ArrowLeft': e.preventDefault(); goUp(); break;
        case 'q': goBack(); break;
    }
});

/* Aux Keyboard Functions */

function moveFocusSibling(direction) {
    const container = document.getElementById("container");
    const active = document.activeElement;

    if (!active.matches(".folder, .card")) {
        const topItems = Array.from(container.children).filter(function (el) {
            return el.matches(".folder");
        });
        if (!topItems.length) return;
        const idx = direction > 0 ? 0 : topItems.length - 1;
        topItems[idx].focus();
        return;
    }
    const group = active.matches(".card")
        ? active.parentElement
        : active.closest(".subfolders") || container;

    const siblings = Array.from(group.children).filter(function (el) {
        return el.matches(".folder, .card");
    });
    if (!siblings.length) return;

    const idx = siblings.indexOf(active);
    const nextIdx = Math.min(Math.max(idx + direction, 0), siblings.length - 1);
    siblings[nextIdx].focus();
}

function goDeeper() {
    const active = document.activeElement;
    if (!active.classList.contains("folder")) return;

    const content = active.querySelector(".folder__content");
    if (!content || content.style.display === "none") return;

    requestAnimationFrame(function () {
        const childContainer = active.querySelector(".subfolders, .grid");
        if (!childContainer) return;
        const next = Array.from(childContainer.children).find(function (el) {
            return el.matches(".folder, .card");
        });
        if (next) next.focus();
    });
}

function goUp() {
    const active = document.activeElement;
    if (active.matches(".card")) {
        active.closest(".grid")?.closest(".folder")?.focus();
    } else if (active.matches(".folder")) {
        active.closest(".subfolders")?.closest(".folder")?.focus();
    }
}


