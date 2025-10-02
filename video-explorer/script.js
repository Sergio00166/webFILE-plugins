/* Code by Sergio00166 */

const { pathname } = window.location;
const pathSegments = pathname.split('/');
if (!pathSegments.pop().includes('.')) pathSegments.push('');
const basePath = pathSegments.join('/') + '/';

let currentPath = basePath;
const cache_suffix = '?cache';

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

function attachObserver(el, callback) {
    const obs = new IntersectionObserver(entries => {
        for(let i=0;i<entries.length;i++) {
            const e = entries[i];
            if(e.isIntersecting) {
                obs.unobserve(e.target);
                callback(e.target);
            }
        }
    }, { rootMargin: '200px' });
    obs.observe(el);
}

function createDiv(className, props) {
    const d = document.createElement('div');
    d.className = className;
    if(props) Object.assign(d, props);
    return d;
}

// ============================================================================
// POSTER / DESCRIPTION
// ============================================================================

function createDescription(photos, descObj) {
    const desc = createDiv('description');
    const inner = createDiv('desc-inner');

    if(photos && photos.length) {
        const pc = createDiv('poster-container');
        const pbg = createDiv('poster-bg');
        pbg.classList.add('loading');
        const pimg = document.createElement('img');
        pimg.className = 'poster-image';
        pc.appendChild(pbg);
        pc.appendChild(pimg);
        inner.appendChild(pc);
    }
    if(descObj) {
        const td = createDiv('desc-text');
        td.style.visibility='hidden';
        td.style.opacity='0';
        inner.appendChild(td);
    }
    desc.appendChild(inner);
    return desc;
}

async function loadFolderPoster(el, photos, descObj) {
    const pc = el.querySelector('.poster-container');
    const pbg = pc && pc.querySelector('.poster-bg');
    const pimg = pc && pc.querySelector('.poster-image');

    if(photos && photos.length && pc && pbg && pimg) {
        const bimg = new Image();
        bimg.src = photos[0].path + cache_suffix;
        pimg.src = photos[0].path + cache_suffix;
        try {
            await Promise.all([loadImage(bimg), loadImage(pimg)]);
            pbg.appendChild(bimg);
            pimg.classList.add('loaded');
            pbg.classList.remove('loading');
        } catch {}
    }
    if(descObj) {
        const td = el.querySelector('.desc-text');
        const t = await getText(descObj.path);
        td.textContent=t;
        td.style.visibility='';
        td.style.opacity='';
    }
}

// ============================================================================
// INFO FOR SUBFOLDERS
// ============================================================================

function getFolderInfoFromList(folderName, infoItems) {
    let poster=null, descObj=null;
    for(let i=0;i<infoItems.length;i++) {
        const it=infoItems[i];
        if(!poster && it.type==='photo' && it.name.indexOf(folderName+'.')===0) poster=it;
        if(!descObj && it.type==='text' && it.name===folderName+'.txt') descObj=it;
    }
    return { poster, descObj };
}

// ============================================================================
// THUMBNAILS
// ============================================================================

function findThumbnailForVideo(videoName, thumbsList) {
    const baseName = videoName.replace(/\.[^/.]+$/,'');
    for(let i=0;i<thumbsList.length;i++) {
        const it=thumbsList[i];
        const thumbBase = it.name.replace(/\.[^/.]+$/,'');
        if(thumbBase === baseName) return it;
    }
    return null;
}

async function loadThumbnail(el, thumbItem) {
    el.classList.add('loading');
    try {
        if(!thumbItem) return;
        const img=new Image();
        img.src=thumbItem.path+cache_suffix;
        el.appendChild(img);
        await loadImage(img);
        el.classList.remove('loading');
    } catch {}
}

// ============================================================================
// GRID
// ============================================================================

function appendGrid(parent,videos,thumbsList) {
    if(!videos || !videos.length) return;
    const grid=createDiv('grid');
    parent.appendChild(grid);
    let frag=null;

    for(let i=0;i<videos.length;i++) {
        if(i%8===0) frag=document.createDocumentFragment();
        const v=videos[i];
        const card=document.createElement('button');
        const thumb=createDiv('thumb');
        const thumbItem = findThumbnailForVideo(v.name, thumbsList);
        attachObserver(thumb, el => {
            loadThumbnail(el, thumbItem);
        });
        const info=createDiv('info');
        const title=createDiv('title');
        title.textContent=v.name;

        info.appendChild(title);
        card.appendChild(thumb);
        card.appendChild(info);
        frag.appendChild(card);

        if(i%8===7 || i===videos.length-1) {
            grid.appendChild(frag);
        }
    }
}

// ============================================================================
// FOLDER CONTENT
// ============================================================================

function renderFolderContent(folderName, containerElement, infoItems) {
    const info=createDiv('info');
    const title=createDiv('title');
    title.textContent=folderName;
    info.appendChild(title);
    containerElement.appendChild(info);

    if(!infoItems || !infoItems.length) return;
    const res = getFolderInfoFromList(folderName, infoItems);
    const photos = [];
    if(res.poster) photos.push(res.poster);

    if(!photos.length && !res.descObj) return;
    const descEl=createDescription(photos, res.descObj);
    containerElement.appendChild(descEl);

    attachObserver(descEl, el => {
        loadFolderPoster(el, photos, res.descObj).catch();
    });
}

// ============================================================================
// SUBFOLDERS
// ============================================================================

function renderSubfolder(subfolders, containerElement, focusBackName, infoItems) {
    subfolders.forEach(sub=>{
        const el=document.createElement('button');
        if(sub.name===focusBackName) el.dataset.focusMe='1';
        containerElement.appendChild(el);
        renderFolderContent(sub.name, el, infoItems);
        el.classList.add('loaded');
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
    if (focusBackName) waitForElement('[data-focus-me="1"]').then(el => el.focus()).catch();
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
    const cur=currentPath.split('/').filter(Boolean);
    const base=basePath.split('/').filter(Boolean);
    if(cur.length<=base.length && currentPath.indexOf(basePath)===0) {
        const exitPath='/' + base.slice(0,-1).join('/');
        if(exitPath==='') window.location.href='/';
        else window.location.href=exitPath;
        return;
    }
    let parent='/' + cur.slice(0,-1).join('/');
    if(!parent.endsWith('/')) parent+='/';
    renderFolder(parent, cur[cur.length-1]);
}

async function waitForElement(selector) {
    for(let i=0;i<20;i++) {
        const el=document.querySelector(selector);
        if(el) return el;
        await new Promise(r=>setTimeout(r,25));
    }
    throw new Error('Element not found: '+selector);
}

function moveFocus(direction) {
    const focusable=Array.from(document.querySelectorAll(elsel_str));
    if(!focusable.length) return;
    let idx=focusable.indexOf(document.activeElement);
    if(direction===-Infinity) idx=0;
    else if(direction===Infinity) idx=focusable.length-1;
    else idx=(idx+direction+focusable.length)%focusable.length;
    focusable[idx].focus();
}

// ============================================================================
// EVENTS
// ============================================================================

container.addEventListener('click', e => {
    const clicked=e.target.closest(elsel_str);
    e.stopPropagation();
    if(clicked) handleItemAction(clicked);
});

container.addEventListener('keydown', e => {
    const focused=e.target.closest(elsel_str);
    if(focused && ['Enter',' ','ArrowRight'].indexOf(e.key)!==-1) {
        e.preventDefault();
        handleItemAction(focused);
    }
});

document.addEventListener('keydown', e => {
    if(e.ctrlKey||e.metaKey||e.altKey||e.shiftKey) return;
    const key=e.key.toLowerCase();
    if(key==='arrowdown') { moveFocus(1); e.preventDefault(); }
    else if(key==='arrowup') { moveFocus(-1); e.preventDefault(); }
    else if(key==='home') { moveFocus(-Infinity); e.preventDefault(); }
    else if(key==='end') { moveFocus(Infinity); e.preventDefault(); }
    else if(key==='arrowleft') { goBack(); e.preventDefault(); }
    else if(key==='i') { window.location.reload(); }
});

// ============================================================================
// INIT
// ============================================================================

renderFolder(basePath);

