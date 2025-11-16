# webFILE VideoExplorer Plugin

This plugin replaces the default file listing UI from the webFILE server with an optimized layout for videos.    
Using descriptions and posters for the folders and thumbnails for the videos files.

---

## Installation Guide

To activate the plugin in any folder:

1. **Rename** `index.web.html` → `index.web`
2. **Copy** all plugin files into the target directory
3. Access the folder via the server—`index.web` will auto-load as the default view

---

## Required Files

Make sure each target folder contains the following:

| File         | Role                       |
|--------------|----------------------------|
| `index.web`  | Entry point HTML file      |
| `styles.css` | Visual styling and layout  |
| `script.js`  | Rendered and actions       |

---

## Key Features

- **Video Auto-Detection** — Automatically detects supported video formats within each folder  
- **Thumbnails** — Loads preview images from the `.thumbnails/` directory alongside the videos  
- **Folder Descriptions**  
  - **Prelook (from parent view):** Reads description text from `.info/<folder>.txt`  
  - **Inside the folder:** Reads `description.txt` located directly inside the folder  
- **Poster Image Display**  
  - **Prelook (from parent view):** Uses `.info/<folder>.png` as the folder’s preview poster  
  - **Inside the folder:** Uses `poster.jpg` located inside the folder as its banner  

---

## Example of Folder Structure

```plaintext
.info/
├── folder.txt             # Description for folder
├── folder.png             # Poster for folder
folder/
├── .thumbnails/           # Contains video thumbnail previews
│   └── 1.webp             # Thumbnail for '1.mkv'
├── 1.mkv                  # Video file
├── description.txt        # Description for inside the folder
├── poster.jpg             # Poster for inside the folder
├── styles.css             # Styles
├── script.js              # Core
└── index.web              # Loader
```
