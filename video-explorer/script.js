/* Code by Sergio00166 */

const { origin, pathname } = window.location;
const segs = pathname.split("/");
if (!segs.pop().includes(".")) { segs.push(""); }

const basePath = segs.join("/") + "/";
document.getElementById("folder-name").textContent =
    "Videos @ " + decodeURIComponent(basePath) || "/";

function fullUrlWithCache(path) {
    return path + "?cache";
}
function toggleContent(el) {
    el.style.display = el.style.display === "none" ? "block" : "none";
}
function goBack() {
    const parent = basePath.split("/").slice(0, -2).join("/") + "/";
    window.location.href = parent;
}

/* Lazy‐Loading Observer */

const thumbnailsCache = {};
const io = new IntersectionObserver(onIntersection, { rootMargin: "200px" });

function onIntersection(entries, observer) {
    entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        const el = entry.target;

        if (el.classList.contains("thumb")) {
            const folder = el.closest(".grid").dataset.folder;
            if (!thumbnailsCache[folder]) {
                thumbnailsCache[folder] = fetch(folder, { headers: { Accept: "application/json" } })
                    .then(function (res) { return res.json(); })
                    .catch(function () { return []; });
            }
            thumbnailsCache[folder].then(function (list) {
                const match = list.find(function (x) {
                    return x.name.startsWith(el.dataset.video);
                });
                if (match) {
                    const imgLoader = new Image();
                    imgLoader.onload = function () {
                        el.style.backgroundImage = "url('" + fullUrlWithCache(match.path) + "')";
                        el.classList.remove("loading");
                    };
                    imgLoader.src = fullUrlWithCache(match.path);
                }
            });
            observer.unobserve(el);

        } else if (el.classList.contains("folder__poster-bg")) {
            el.style.backgroundImage = "url('" + el.dataset.src + "')";
            const img = el.parentNode.querySelector(".folder__poster-image");
            img.onload = function () {
                img.style.display = "block";
                el.classList.remove("loading");
            };
            el.onload = function () {
                el.style.display = "block";
                const bg = el.parentNode.querySelector(".folder__poster-bg");
                bg.style.backgroundImage = "url('" + bg.dataset.src + "')";
                bg.classList.remove("loading");
            };
            el.src = el.dataset.src;
            observer.unobserve(el);
            img.src = el.dataset.src;
            observer.unobserve(el);
            el.removeAttribute("data-src");
        }
    });
}

/* Folder & File Rendering */
async function collectAndRender(folderObj, parentEl) {
    const fragment = document.createDocumentFragment();

    const folderEl = document.createElement("div");
    folderEl.className = "folder is-loading";
    folderEl.tabIndex = 0;

    const header = document.createElement("div");
    header.className = "folder__header";
    header.textContent = folderObj.name;
    folderEl.append(header);

    const contentEl = document.createElement("div");
    contentEl.className = "folder__content";
    contentEl.style.display = "none";
    folderEl.append(contentEl);

    let items;
    try {
        items = await fetch(folderObj.path, { headers: { Accept: "application/json" } })
            .then(function (res) { return res.json(); });
    } catch { return; }

    const photos = items.filter(function (i) { return i.type === "photo"; });
    const descFile = items.find(function (i) {
        return i.type === "text" && i.name === "description.txt";
    });

    if (photos.length || descFile) {
        const descContainer = document.createElement("div");
        descContainer.className = "folder__description";

        const inner = document.createElement("div");
        inner.className = "folder__desc-inner";

        if (photos.length) {
            const posterContainer = document.createElement("div");
            posterContainer.className = "folder__poster-container";

            const bg = document.createElement("div");
            bg.className = "folder__poster-bg loading";
            bg.dataset.src = fullUrlWithCache(photos[0].path);
            posterContainer.append(bg);
            io.observe(bg);

            const img = document.createElement("img");
            img.className = "folder__poster-image";
            img.style.display = "none";
            posterContainer.append(img);

            inner.append(posterContainer);
        }

        if (descFile) {
            const textDiv = document.createElement("div");
            textDiv.className = "desc-text";
            fetch(fullUrlWithCache(descFile.path))
                .then(function (r) { return r.text(); })
                .then(function (text) {
                    textDiv.textContent = text;
                });
            inner.append(textDiv);
        }

        descContainer.append(inner);
        folderEl.insertBefore(descContainer, contentEl);
    }

    const videos = items.filter(function (i) { return i.type === "video"; });
    if (videos.length) {
        const grid = document.createElement("div");
        grid.className = "grid";
        grid.dataset.folder = folderObj.path + ".thumbnails/";

        videos.forEach(function (vid) {
            const card = document.createElement("div");
            card.className = "card";
            card.tabIndex = 0;
            card.dataset.path = vid.path;

            const thumb = document.createElement("div");
            thumb.className = "thumb loading";
            thumb.dataset.video = vid.name;
            io.observe(thumb);

            const info = document.createElement("div");
            info.className = "info";

            const title = document.createElement("div");
            title.className = "title";
            title.textContent = vid.name.replace(/\.[^/.]+$/, "");

            info.append(title);
            card.append(thumb, info);
            grid.append(card);
        });
        contentEl.append(grid);
    }

    const subdirs = items
        .filter(function (i) { return i.type === "directory" && i.name !== ".thumbnails"; })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });

    if (subdirs.length) {
        let loaded = false;

        async function loadSubfolders() {
            if (loaded) return;
            loaded = true;

            const subContainer = document.createElement("div");
            subContainer.className = "subfolders";

            for (const sub of subdirs) {
                await collectAndRender(
                    { name: sub.name, path: folderObj.path + sub.name + "/" },
                    subContainer
                );
            }
            contentEl.append(subContainer);
        }
        const subObserver = new IntersectionObserver(function (entries, obs) {
            Promise.all(
                entries.filter(entry => entry.isIntersecting).map(entry => {
                    return loadSubfolders().then(() => obs.disconnect());
                })
            );
        }, { rootMargin: "200px" });

        subObserver.observe(contentEl);
    }

    folderEl.classList.remove("is-loading");
    fragment.append(folderEl);
    parentEl.append(fragment);
}


async function renderAll() {
  const container = document.getElementById("container");
  const response = await fetch(basePath, { headers: { Accept: "application/json" } });
  const items = await response.json();

  const videos = items.filter(item => item.type === "video");
  if (videos.length) {
    await collectAndRender({ name: ".", path: basePath }, container);
  }

  const dirs = items
    .filter(item => item.type === "directory" && item.name !== ".thumbnails")
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const dir of dirs) {
    await collectAndRender(
      { name: dir.name, path: `${basePath}${dir.name}/` },
      container
    );
  }
}
renderAll();


/* Interaction Handlers */

document.addEventListener("click", function (ev) {
    const cardEl = ev.target.closest(".card");
    if (cardEl) {
        ev.stopPropagation();
        window.open(cardEl.dataset.path, "_blank");
        return;
    }
    const folderEl = ev.target.closest(".folder");
    if (!folderEl) return;

    const content = folderEl.querySelector(".folder__content");
    if (content) { toggleContent(content); }
});

document.addEventListener("keydown", (ev) => {
    const key = ev.key;
    const active = document.activeElement;

    if (key === "Enter" || key === " " || key === "Spacebar") {
        const cardEl = active.closest(".card");
        if (cardEl) {
            ev.preventDefault();
            ev.stopPropagation();
            window.open(cardEl.dataset.path, "_blank");
            return;
        }
        const folderEl = active.closest(".folder");
        if (folderEl) {
            const content = folderEl.querySelector(".folder__content");
            if (content) {
                toggleContent(content);
                ev.preventDefault();
            }
        } 
        return;
    }
    switch (key) {
        case "ArrowDown":
            moveFocusSibling(1);
            ev.preventDefault();
            break;
        case "ArrowUp":
            moveFocusSibling(-1);
            ev.preventDefault();
            break;
        case "ArrowRight":
            goDeeper();
            ev.preventDefault();
            break;
        case "ArrowLeft":
            goUp();
            ev.preventDefault();
            break;
        case "q":
            goBack();
            break;
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
 