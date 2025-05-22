# Post-it Notes App

A lightweight, browser-based sticky notes application that lets you create, edit, and organize colorful digital post-it notes. All notes are saved locally in your browser, with no server required.

![Post-it Notes App](screenshot.png)

## Features

- **Create notes anywhere** on the canvas by clicking or pressing the 'N' key
- **Five vibrant colors** to choose from (red, orange, yellow, green, blue)
- **Auto-saving** ensures you never lose your work
- **Drag and drop** to organize your notes
- **Responsive design** that works on desktop and mobile devices
- **Undo feature** to revert changes (Ctrl+Z / Cmd+Z)
- **Complete privacy** with browser-based local storage (notes never leave your computer)
- **Automatic text sizing** to fit content

## How to Use

### Creating Notes
- **Click anywhere** on the canvas to create a new note with the currently selected color
- **Press 'N'** to create a new note with a random color at your cursor position

### Selecting Colors
- **Click a color circle** at the top to select that color for new notes
- **Press keys 1-5** to quickly select colors (1=red, 2=orange, 3=yellow, 4=green, 5=blue)

### Editing Notes
- **Click on a note** to select it (note becomes slightly larger)
- **Type directly** into a note to add content
- **Click and drag** any part of the note (except the text area) to move it
- **Press Delete or Backspace** to delete a selected note
- **Double-press Delete** when editing text to delete the entire note

### Advanced Features
- **Ctrl+Z / Cmd+Z** to undo your last action (up to 50 actions stored in history)
- **Automatic text resizing** if content exceeds available space
- **Responsive scaling** for different screen sizes

## Technical Implementation

### Storage
- Notes are stored in your browser's `localStorage`
- No data is ever sent to a server
- Notes persist between sessions but are tied to your specific browser

### Key Components
- **HTML Structure**: Simple layout with header, canvas area, and footer
- **CSS Styling**: Responsive design with pastel colors and smooth animations
- **JavaScript Logic**: Core functionality including:
  - Note creation and positioning
  - Drag and drop implementation
  - Color selection handling
  - Text entry and auto-sizing
  - History tracking for undo functionality
  - Bounds management for note positioning
  - Local storage integration

### Recent Improvements
- Fixed note positioning to ensure notes are centered at the cursor location
- Implemented consistent note sizing with global constants
- Enhanced drop area initialization and bounds detection
- Improved coordinate handling for accurate placement
- Added detailed console logging for debugging

## Browser Compatibility
- Works with all modern browsers including Chrome, Firefox, Safari, and Edge
- Requires support for:
  - localStorage
  - CSS Flexbox
  - ES6 JavaScript features

## Limitations
- Notes are stored in browser localStorage which has limited capacity (~5MB)
- Notes do not sync between devices or browsers

## Future Enhancements
- Cloud sync option
- Rich text formatting
- Image support
- Note grouping and categorization
- Export/import functionality
- **Interactive Enhancements:**
  - Delete animations and sounds
  - Create note animations and sounds
  - Color change animations and sounds
- **User Experience:**
  - Onboarding tutorial for first-time users
  - Maximum number of notes with appropriate warnings
  - Visual framework/canvas background options for the placement area
- **Note Management:**
  - Trash bin for deleted notes with recovery option
  - Clear board feature with confirmation warning
- **Advanced Features:**
  - Multiplayer/collaboration capabilities

## License
This project is open source and available under the MIT License.

---

Made with ❤️ as a simple, useful tool for organizing your thoughts 