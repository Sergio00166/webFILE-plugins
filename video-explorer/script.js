/* Code by Sergio00166 */

// ============================================================================
// PATH CONFIGURATION
// ============================================================================

const { pathname } = window.location;
const pathSegments = pathname.split('/');
if (!pathSegments.pop().includes('.')) pathSegments.push('');
const basePath = pathSegments.join('/') + '/';

// ============================================================================
// CACHE & STATE MANAGEMENT
// ============================================================================

const cache = {};
let currentPath = basePath;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function createFullURL(path) { 
    return path + '?cache'; 
};

function loadImage(imageElement) {
    if (typeof imageElement.decode === 'function') {
        return imageElement.decode();
    }
    return new Promise(function(resolve) { 
        imageElement.onload = resolve; 
    });
};

function getJSON(path) {
    return cache[path] = cache[path] || fetch(path, { 
        headers: { Accept: 'application/json' } 
    })
    .then(function(response) { 
        return response.json(); 
    })
    .catch(function() { 
        return []; 
    });
};

function getText(path) {
    return fetch(path + '?cache', { 
        headers: { Accept: 'text/plain' } 
    })
    .then(function(response) { 
        return response.text(); 
    })
    .catch(function() { 
        return ''; 
    });
};

// ============================================================================
// INTERSECTION OBSERVER SETUP
// ============================================================================

const intersectionObserver = new IntersectionObserver(handleIntersection, { 
    rootMargin: '200px' 
});

// ============================================================================
// INTERSECTION HANDLING
// ============================================================================

function handleIntersection(entries, observer) {
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const target = entry.target;
        const isIntersecting = entry.isIntersecting;

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
    const gridContainer = thumbnailElement.closest('.grid');
    const folderPath = gridContainer.dataset.folder;
    
    getJSON(folderPath).then(function(fileList) {
        const videoName = thumbnailElement.dataset.video.replace(/\.[^/.]+$/, '');
        const matchingFile = fileList.find(function(item) {
            return item.name.startsWith(videoName + '.') &&
                   item.name.slice(videoName.length + 1).indexOf('.') === -1;
        });
        
        if (!matchingFile) return;
        
        const thumbnailImage = new Image();
        thumbnailImage.src = createFullURL(matchingFile.path);
        thumbnailElement.textContent = '';
        thumbnailElement.appendChild(thumbnailImage);
        
        loadImage(thumbnailImage).finally(function() {
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
    
    backgroundImage.src = posterImage.src = createFullURL(posterBackgroundElement.dataset.src);
    
    Promise.all([loadImage(backgroundImage), loadImage(posterImage)]).then(function() {
        posterBackgroundElement.innerHTML = '';
        posterBackgroundElement.appendChild(backgroundImage);
        posterImage.classList.add('loaded');
        posterBackgroundElement.classList.remove('loading');
        posterBackgroundElement.removeAttribute('data-src');
    });
}

// ============================================================================
// DOM ELEMENT CREATION
// ============================================================================

function createDiv(className, properties) {
    properties = properties || {};
    const divElement = document.createElement('div');
    divElement.className = className;
    Object.assign(divElement, properties);
    return divElement;
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
        
        getText(descriptionObject.path).then(function(text) {
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
    let currentIndex = 0;

    function renderChunk() {
        const documentFragment = document.createDocumentFragment();
        
        for (let i = 0; i < chunkSize && currentIndex < videos.length; i++, currentIndex++) {
            const video = videos[currentIndex];
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
            documentFragment.appendChild(videoCard);
        }
        
        gridElement.appendChild(documentFragment);
        
        if (currentIndex < videos.length) {
            setTimeout(renderChunk, 0);
        }
    }
    
    renderChunk();
}

// ============================================================================
// NAVIGATION
// ============================================================================

function goBack() {
    const currentPathParts = currentPath.split('/').filter(Boolean);
    const basePathParts = basePath.split('/').filter(Boolean);
    
    if (currentPathParts.length <= basePathParts.length) {
        window.location.href = basePath.split('/').slice(0, -2).join('/') + '/';
        return;
    }
    
    const parentPath = '/' + currentPathParts.slice(0, -1).join('/') + '/';
    const focusBackName = currentPathParts[currentPathParts.length - 1];
    renderFolder(parentPath, focusBackName);
}

// ============================================================================
// FOLDER RENDERING
// ============================================================================

function renderFolder(folderPath, focusBackName) {
    if (typeof focusBackName === 'undefined') focusBackName = '';
    currentPath = folderPath;

    const containerElement = document.getElementById('container');
    containerElement.innerHTML = '';
    document.getElementById('folder-name').textContent = decodeURIComponent(folderPath);

    getJSON(folderPath).then(function(folderItems) {
        if (folderPath === basePath) {
            const photos = folderItems.filter(function(item) { 
                return item.type === 'photo'; 
            });
            const descriptionObject = folderItems.find(function(item) { 
                return item.type === 'text' && item.name === 'description.txt'; 
            });
            
            if (photos.length || descriptionObject) {
                containerElement.appendChild(createDescription(photos, descriptionObject));
            }
        }
        
        appendGrid(containerElement, folderItems.filter(function(item) { 
            return item.type === 'video'; 
        }), folderPath);

        const subfolders = folderItems
            .filter(function(item) { 
                return item.type === 'directory' && item.name !== '.thumbnails'; 
            })
            .sort(function(a, b) { 
                return a.name.localeCompare(b.name); 
            });

        if (subfolders.length) {
            const subfoldersContainer = createDiv('subfolders');
            const chunkSize = 4;
            let currentIndex = 0;

            function renderSubfolderChunk() {
                for (let i = 0; i < chunkSize && currentIndex < subfolders.length; i++, currentIndex++) {
                    const subfolder = subfolders[currentIndex];
                    const subfolderPath = folderPath + subfolder.name + '/';
                    const folderElement = createDiv('folder', { tabIndex: 0 });
                    
                    if (subfolder.name === focusBackName) {
                        folderElement.dataset.focusMe = '1';
                    }

                    folderElement.dataset.path = subfolderPath;
                    subfoldersContainer.appendChild(folderElement);

                    getJSON(subfolderPath).then(function(subfolderItems) {
                        renderFolderContent(subfolderItems, folderElement, subfolderPath);
                        folderElement.classList.add('loaded');
                    });
                }
                
                if (currentIndex < subfolders.length) {
                    renderSubfolderChunk();
                }
            }
            
            renderSubfolderChunk();
            containerElement.appendChild(subfoldersContainer);
        }
        
        if (focusBackName) {
            waitForElement('[data-focus-me="1"]').then(function(element) { 
                element.focus(); 
            });
        }
    });
}

function renderFolderContent(folderItems, containerElement, folderPath) {
    const photos = folderItems.filter(function(item) { 
        return item.type === 'photo'; 
    });
    const descriptionObject = folderItems.find(function(item) { 
        return item.type === 'text' && item.name === 'description.txt'; 
    });
    
    const nameBlock = createDiv('info');
    const titleElement = createDiv('title');
    const pathParts = folderPath.split('/').filter(Boolean);
    titleElement.textContent = pathParts.length ? pathParts[pathParts.length - 1] : folderPath;
    
    nameBlock.appendChild(titleElement);
    containerElement.appendChild(nameBlock);

    if (photos.length || descriptionObject) {
        containerElement.appendChild(createDescription(photos, descriptionObject));
    }
}

// ============================================================================
// ITEM ACTION HANDLING
// ============================================================================

function handleItemAction(element) {
    if (element.classList.contains('folder')) {
        window.scrollTo(0, 0);
        renderFolder(element.dataset.path);
    } else if (element.classList.contains('card')) {
        window.open(element.dataset.path, '_blank');
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function waitForElement(selector, maxTries, interval) {
    maxTries = maxTries || 20;
    interval = interval || 25;
    
    return new Promise(function(resolve, reject) {
        let tries = 0;
        
        function check() {
            const element = document.querySelector(selector);
            if (element) return resolve(element);
            if (++tries >= maxTries) return reject(new Error('Element not found: ' + selector));
            setTimeout(check, interval);
        }
        
        check();
    });
}

function moveFocus(direction) {
    const focusableItems = Array.from(document.querySelectorAll('.folder, .card'));
    if (focusableItems.length === 0) return;

    let currentIndex = focusableItems.indexOf(document.activeElement);
    
    if (direction === -Infinity) {
        currentIndex = 0;
    } else if (direction === Infinity) {
        currentIndex = focusableItems.length - 1;
    } else {
        currentIndex = (currentIndex + direction + focusableItems.length) % focusableItems.length;
    }

    focusableItems[currentIndex].focus();
}

// ============================================================================
// EVENT LISTENERS - CONTAINER
// ============================================================================

container.addEventListener('click', function (event) {
    const clickedItem = event.target.closest('.folder, .card');
    event.stopPropagation();
    
    if (clickedItem) {
        handleItemAction(clickedItem);
    }
});

container.addEventListener('keydown', function (event) {
    const focusedItem = event.target.closest('.folder, .card');
    
    if (['Enter', ' ', 'ArrowRight'].includes(event.key) && focusedItem) {
        event.preventDefault();
        handleItemAction(focusedItem);
    }
});

// ============================================================================
// EVENT LISTENERS - KEYBOARD SHORTCUTS
// ============================================================================

document.addEventListener('keydown', function (event) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    
    const key = event.key.toLowerCase();

    switch (key) {
        case 'arrowdown':
        case 'arrowup':
            event.preventDefault();
            if (key === "arrowup") {
                moveFocus(-1);
            } else {
                moveFocus(1);
            }
            break;            
        case 'home':
        case 'end':
            event.preventDefault();
            if (key === "end") {
                moveFocus(Infinity);
            } else {
                moveFocus(-Infinity);
            }
            break;
        case 'arrowleft': 
            event.preventDefault(); 
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
