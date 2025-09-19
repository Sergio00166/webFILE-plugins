/* Code by Sergio00166 */

// ============================================================================
// MAIN DEFINITIONS
// ============================================================================

const { pathname } = window.location;
const pathSegments = pathname.split('/');
if (!pathSegments.pop().includes('.')) pathSegments.push('');
const basePath = pathSegments.join('/') + '/';
const cache_suffix = '?cache';

const cache = {};
let currentPath = basePath;

const intersectionObserver = new IntersectionObserver(handleIntersection, {
    rootMargin: '200px'
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function loadImage(imageElement) {
    if (typeof imageElement.decode === 'function') {
        return imageElement.decode();
    }
    return new Promise(resolve => { imageElement.onload = resolve; });
}

function getJSON(path) {
    return cache[path] ||
    (cache[path] = fetch(path, { headers: { Accept: 'application/json' } })
    .then(r => r.json()).catch(() => []));
}

function getText(path) {
    return fetch(path + cache_suffix, { headers: { Accept: 'text/plain' } })
    .then(r => r.text()).catch(() => '');
}

// ============================================================================
// FOLDER RENDERING HELPERS
// ============================================================================

function extractPhotos(items) {
    return items.filter(item => item.type === 'photo');
}

function extractDescription(items) {
    return items.find(item => item.type === 'text' && item.name === 'description.txt');
}

function extractVideos(items) {
    return items.filter(item => item.type === 'video');
}

function extractSubfolders(items) {
    return items
    .filter(item => item.type === 'directory' && item.name !== '.thumbnails')
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ============================================================================
// ELEMENTs HELPERs
// ============================================================================

function createDiv(className, props = {}) {
    const div = document.createElement('div');
    div.className = className;
    Object.assign(div, props);
    return div;
}

function handleItemAction(element) {
    if (element.classList.contains('folder')) {
        window.scrollTo(0, 0);
        renderFolder(element.dataset.path);
    } else if (element.classList.contains('card')) {
        window.open(element.dataset.path, '_blank');
    }
}

// ============================================================================
// INTERSECTION HANDLING
// ============================================================================

function handleIntersection(entries, observer) {
    for (let i = 0; i < entries.length; i++) {
        const { target, isIntersecting } = entries[i];
        if (!isIntersecting) continue;
        observer.unobserve(target);

        if (target.classList.contains('thumb')) {
            handleThumbnailIntersection(target);
        } else if (target.classList.contains('poster-bg')) {
            handlePosterIntersection(target);
        }
    }
}

function handleThumbnailIntersection(thumbnailElement) {
    thumbnailElement.classList.add('loading');
    const folderPath = thumbnailElement.closest('.grid').dataset.folder;

    getJSON(folderPath).then(fileList => {
        const videoName = thumbnailElement.dataset.video.replace(/\.[^/.]+$/, '');
        const match = fileList.find(item =>
            item.name.startsWith(videoName + '.') &&
            item.name.slice(videoName.length + 1).indexOf('.') === -1
        );
        if (!match) return;

        const thumbnailImage = new Image();
        thumbnailImage.src = match.path + cache_suffix;
        thumbnailElement.textContent = '';
        thumbnailElement.appendChild(thumbnailImage);

        loadImage(thumbnailImage).finally(() => {
            thumbnailElement.classList.remove('loading');
            thumbnailElement.removeAttribute('data-video');
        });
    });
}

function handlePosterIntersection(posterBackgroundElement) {
    posterBackgroundElement.classList.add('loading');
    const posterContainer = posterBackgroundElement.closest('.poster-container');
    const posterImage = posterContainer.querySelector('.poster-image');
    const backgroundImage = new Image();

    backgroundImage.src = posterImage.src = posterBackgroundElement.dataset.src + cache_suffix;

    Promise.all([loadImage(backgroundImage), loadImage(posterImage)]).then(() => {
        posterBackgroundElement.innerHTML = '';
        posterBackgroundElement.appendChild(backgroundImage);
        posterImage.classList.add('loaded');
        posterBackgroundElement.classList.remove('loading');
        posterBackgroundElement.removeAttribute('data-src');
    });
}

// ============================================================================
// DESCRIPTION CREATION
// ============================================================================

function createDescription(photos, descriptionObject) {
    const descriptionContainer = createDiv('description');
    const innerContainer = createDiv('desc-inner');

    if (photos.length) {
        const posterContainer = createDiv('poster-container');
        const posterBackground = createDiv('poster-bg');
        posterBackground.dataset.src = photos[0].path;

        const posterImage = document.createElement('img');
        posterImage.className = 'poster-image';

        posterContainer.appendChild(posterBackground);
        posterContainer.appendChild(posterImage);
        intersectionObserver.observe(posterBackground);
        innerContainer.appendChild(posterContainer);
    }
    if (descriptionObject) {
        const textDiv = createDiv('desc-text');
        textDiv.style.visibility = 'hidden';
        textDiv.style.opacity = '0';

        getText(descriptionObject.path).then(text => {
            textDiv.textContent = text;
            textDiv.style.visibility = 'visible';
            textDiv.style.opacity = '1';
        });
        innerContainer.appendChild(textDiv);
    }
    descriptionContainer.appendChild(innerContainer);
    return descriptionContainer;
}

// ============================================================================
// GRID RENDERING
// ============================================================================

function appendGrid(parentContainer, videos, folderPath) {
    if (!videos.length) return;

    const gridElement = createDiv('grid');
    gridElement.dataset.folder = folderPath + '.thumbnails/';
    parentContainer.appendChild(gridElement);

    const chunkSize = 8;
    const total = videos.length;

    for (let start = 0; start < total; start += chunkSize) {
        const fragment = document.createDocumentFragment();

        for (let i = start, end = Math.min(start + chunkSize, total); i < end; i++) {
            const video = videos[i];

            const videoCard = createDiv('card', { tabIndex: 0 });
            videoCard.dataset.path = video.path;

            const thumbnail = createDiv('thumb');
            thumbnail.dataset.video = video.name;
            intersectionObserver.observe(thumbnail);

            const infoContainer = createDiv('info');
            const titleElement = createDiv('title');
            titleElement.textContent = video.name.replace(/\.[^/.]+$/, '');

            infoContainer.appendChild(titleElement);
            videoCard.appendChild(thumbnail);
            videoCard.appendChild(infoContainer);
            fragment.appendChild(videoCard);
        }
        gridElement.appendChild(fragment);
    }
}

// ============================================================================
// NAVIGATION
// ============================================================================

function goBack() {
    const currentParts = currentPath.split('/').filter(Boolean);
    const baseParts = basePath.split('/').filter(Boolean);

    const isAtOrAboveBase =
    currentParts.length <= baseParts.length &&
    currentPath.startsWith(basePath);

    if (isAtOrAboveBase) {
        const exitPath = '/' + baseParts.slice(0, -1).join('/');
        window.location.href = exitPath || '/';
        return;
    }
    let parentPath = '/' + currentParts.slice(0, -1).join('/');
    const focusBackName = currentParts[currentParts.length - 1];
    if (!parentPath.endsWith('/')) parentPath += '/';
    renderFolder(parentPath, focusBackName);
}

// ============================================================================
// FOLDER RENDERING
// ============================================================================

function renderFolder(folderPath, focusBackName = '') {
    currentPath = folderPath;

    const containerElement = document.getElementById('container');
    containerElement.innerHTML = '';
    document.querySelector('.path-title').textContent = decodeURIComponent(folderPath);

    getJSON(folderPath).then(folderItems => {
        if (folderPath === basePath) {
            const photos = extractPhotos(folderItems);
            const descriptionObject = extractDescription(folderItems);
            if (photos.length || descriptionObject) {
                containerElement.appendChild(createDescription(photos, descriptionObject));
            }
        }
        appendGrid(containerElement, extractVideos(folderItems), folderPath);

        const subfolders = extractSubfolders(folderItems);
        if (subfolders.length) {
            const subfoldersContainer = createDiv('subfolders');
            renderSubfolder(subfolders, subfoldersContainer, folderPath, focusBackName);
            containerElement.appendChild(subfoldersContainer);
        }
        if (focusBackName) {
            waitForElement('[data-focus-me="1"]').then(el => el.focus());
        }
    });
}

function renderSubfolder(subfolders, container, folderPath, focusBackName) {
    const chunkSize = 4;
    let currentIndex = 0;

    while (currentIndex < subfolders.length) {
        const end = Math.min(currentIndex + chunkSize, subfolders.length);

        for (;currentIndex < end; currentIndex++) {
            const subfolder = subfolders[currentIndex];
            const subfolderPath = folderPath + subfolder.name + '/';
            const folderElement = createDiv('folder', { tabIndex: 0 });

            if (subfolder.name === focusBackName) {
                folderElement.dataset.focusMe = '1';
            }
            folderElement.dataset.path = subfolderPath;
            container.appendChild(folderElement);

            getJSON(subfolderPath).then(items => {
                renderFolderContent(items, folderElement, subfolderPath);
                folderElement.classList.add('loaded');
            });
        }
    }
}

function renderFolderContent(folderItems, containerElement, folderPath) {
    const photos = extractPhotos(folderItems);
    const descriptionObject = extractDescription(folderItems);

    const nameBlock = createDiv('info');
    const titleElement = createDiv('title');
    const pathParts = folderPath.split('/').filter(Boolean);

    if (pathParts.length) {
        titleElement.textContent = pathParts[pathParts.length - 1];
    } else {
        titleElement.textContent = folderPath;
    }
    nameBlock.appendChild(titleElement);
    containerElement.appendChild(nameBlock);

    if (photos.length || descriptionObject) {
        containerElement.appendChild(createDescription(photos, descriptionObject));
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

async function waitForElement(selector, maxTries = 20, interval = 25) {
    let tries = 0;
    while (tries < maxTries) {
        const el = document.querySelector(selector);
        if (el) return el;
        await new Promise(resolve => setTimeout(resolve, interval));
        tries++;
    }
    throw new Error('Element not found: ' + selector);
}

function moveFocus(direction) {
    const focusable = Array.from(document.querySelectorAll('.folder, .card'));
    if (!focusable.length) return;
    let currentIndex = focusable.indexOf(document.activeElement);

    if (direction === -Infinity) {
        currentIndex = 0;
    } else if (direction === Infinity) {
        currentIndex = focusable.length - 1;
    } else {
        currentIndex = (currentIndex + direction + focusable.length) % focusable.length;
    }
    focusable[currentIndex].focus();
}

// ============================================================================
// EVENT LISTENERS - CONTAINER
// ============================================================================

container.addEventListener('click', e => {
    const clickedItem = e.target.closest('.folder, .card');
    e.stopPropagation();
    if (clickedItem) handleItemAction(clickedItem);
});

container.addEventListener('keydown', e => {
    const focusedItem = e.target.closest('.folder, .card');
    if (['Enter', ' ', 'ArrowRight'].includes(e.key) && focusedItem) {
        e.preventDefault();
        handleItemAction(focusedItem);
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
            if (key === 'arrowup') {
                moveFocus(-1);
            } else {
                moveFocus(1);
            }
            break;
        case 'home':
        case 'end':
            e.preventDefault();
            if (key === 'end') {
                moveFocus(Infinity);
            } else {
                moveFocus(-Infinity);
            }
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

 