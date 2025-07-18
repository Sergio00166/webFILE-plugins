# 🎞️ webFILE VideoExplorer Plugin

This plugin replaces the default file listing UI from the webFILE server with an optimized layout for videos.    
Using descriptions and posters for the folders and thumbnails for the videos files.

---

## 🚀 Installation Guide

To activate the plugin in any folder:

1. **Rename** `index.web.html` → `index.web`
2. **Copy** all plugin files into the target directory
3. Access the folder via the server—`index.web` will auto-load as the default view

---

## 📦 Required Files

Make sure each target folder contains the following:

| File         | Role                                                       |
|--------------|------------------------------------------------------------|
| `index.web`  | Entry point HTML file that powers the plugin interface     |
| `styles.css` | Visual styling for layout, responsiveness, and polish      |
| `script.js`  | Interactivity, behavior, and feature enhancements          |

---

## ✨ Key Features

- 📽 **Video Auto-Detection** — Finds supported video formats in the folder  
- 🖼 **Thumbnails** — Loads preview images from `.thumbnails/` directory  
- 📝 **Folder Descriptions** — Pulls optional text from `description.txt`  
- 🎬 **Poster Image Display** — Uses `poster.jpg` as the folder’s cover banner

---

## 🧱 Recommended Folder Structure

```plaintext
folder/
├── .thumbnails/           # Contains video thumbnail previews
│   └── 1.webp             # Thumbnail for '1.mkv'
├── 1.mkv                  # Video file
├── description.txt        # Optional: Description shown in UI
├── poster.jpg             # Optional: Folder-wide poster image
├── styles.css             # Plugin styling
├── script.js              # Plugin logic
└── index.web              # Main interface file
